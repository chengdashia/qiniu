// main.go
package main

import (
	"context"
	"database/sql"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"

	_ "github.com/jackc/pgx/v5/stdlib"

	"github.com/tencentcloud/tencentcloud-sdk-go/tencentcloud/common"
	tcerr "github.com/tencentcloud/tencentcloud-sdk-go/tencentcloud/common/errors"
	"github.com/tencentcloud/tencentcloud-sdk-go/tencentcloud/common/profile"
	ai3d "github.com/tencentcloud/tencentcloud-sdk-go/tencentcloud/ai3d/v20250513"
)

var (
	appPort     = 5000
	downloadDir = "downloads"

	// DB
	db   *sql.DB
	repo JobRepo
)

/* =========================
   Models / Repo Interfaces
   ========================= */

type ResultFile struct {
	Type            string `json:"Type"`
	Url             string `json:"Url"`
	PreviewImageUrl string `json:"PreviewImageUrl,omitempty"`
}

type JobMeta struct {
	JobID     string       `json:"job_id"`
	Status    string       `json:"status"` // WAIT | RUN | DONE | FAIL
	Files     []ResultFile `json:"files"`
	Error     string       `json:"error"`
	CreatedAt time.Time    `json:"created_at"`
	UpdatedAt time.Time    `json:"updated_at"`
}

type JobRepo interface {
	Upsert(ctx context.Context, jobID, status string, files []ResultFile, errStr string) error
	Get(ctx context.Context, jobID string) (*JobMeta, error)
}

/* =========================
   PostgreSQL Repo
   ========================= */

type pgJobRepo struct{ db *sql.DB }

func NewPGJobRepo(db *sql.DB) JobRepo { return &pgJobRepo{db: db} }

func (r *pgJobRepo) Upsert(ctx context.Context, jobID, status string, files []ResultFile, errStr string) error {
	b, _ := json.Marshal(files)
	_, err := r.db.ExecContext(ctx, `
		INSERT INTO jobs (job_id, status, files, error)
		VALUES ($1, $2, $3::jsonb, NULLIF($4,''))
		ON CONFLICT (job_id) DO UPDATE
		SET status = EXCLUDED.status,
		    files  = EXCLUDED.files,
		    error  = EXCLUDED.error,
		    updated_at = now()
	`, jobID, status, string(b), errStr)
	return err
}

func (r *pgJobRepo) Get(ctx context.Context, jobID string) (*JobMeta, error) {
	var jm JobMeta
	var filesJSON []byte
	err := r.db.QueryRowContext(ctx, `
		SELECT job_id, status, files, COALESCE(error,''), created_at, updated_at
		FROM jobs WHERE job_id = $1
	`, jobID).Scan(&jm.JobID, &jm.Status, &filesJSON, &jm.Error, &jm.CreatedAt, &jm.UpdatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	if len(filesJSON) > 0 {
		_ = json.Unmarshal(filesJSON, &jm.Files)
	}
	return &jm, nil
}

/* =========================
   Env / DB Init
   ========================= */

func mustInit() {
	_ = godotenv.Load()

	if p := os.Getenv("PORT"); p != "" {
		if v, err := strconv.Atoi(p); err == nil {
			appPort = v
		}
	}
	if err := os.MkdirAll(downloadDir, 0o755); err != nil {
		panic(err)
	}
	mustInitDB()
	repo = NewPGJobRepo(db)
}

func mustInitDB() {
	dsn := os.Getenv("DATABASE_URL") // e.g. postgres://user:pass@host:5432/db?sslmode=disable

	fmt.Println(dsn)

	if dsn == "" {
		panic("DATABASE_URL is required")
	}
	var err error
	db, err = sql.Open("pgx", dsn)
	if err != nil {
		panic(err)
	}
	db.SetMaxOpenConns(20)
	db.SetMaxIdleConns(10)
	db.SetConnMaxLifetime(30 * time.Minute)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := db.PingContext(ctx); err != nil {
		panic(err)
	}
}

/* =========================
   Tencent Cloud Client
   ========================= */

func getClient() (*ai3d.Client, error) {
	secretID := os.Getenv("TENCENTCLOUD_SECRET_ID")
	secretKey := os.Getenv("TENCENTCLOUD_SECRET_KEY")
	region := os.Getenv("TENCENTCLOUD_REGION")
	if region == "" {
		region = "ap-guangzhou"
	}
	if secretID == "" || secretKey == "" {
		return nil, errors.New("missing TENCENTCLOUD_SECRET_ID or TENCENTCLOUD_SECRET_KEY")
	}
	cred := common.NewCredential(secretID, secretKey)
	httpProf := profile.NewHttpProfile()
	httpProf.Endpoint = "ai3d.tencentcloudapi.com"
	cliProf := profile.NewClientProfile()
	cliProf.HttpProfile = httpProf
	return ai3d.NewClient(cred, region, cliProf)
}

/* =========================
   Pro 参数构建与校验
   ========================= */

type ProCommonOpts struct {
	EnablePBR    *bool  `json:"enable_pbr"`     // 默认为 false
	FaceCount    *int64 `json:"face_count"`     // 40000-500000
	GenerateType string `json:"generate_type"`  // Normal|LowPoly|Geometry|Sketch
}

func buildProPayload(prompt, imageBase64, imageURL string, opts ProCommonOpts) (map[string]any, error) {
	// Prompt / ImageBase64 / ImageUrl 三选一、互斥
	count := 0
	if strings.TrimSpace(prompt) != "" {
		count++
	}
	if strings.TrimSpace(imageBase64) != "" {
		count++
	}
	if strings.TrimSpace(imageURL) != "" {
		count++
	}
	if count == 0 {
		return nil, fmt.Errorf("one of prompt, image_base64, image_url is required")
	}
	if count > 1 {
		return nil, fmt.Errorf("prompt and image cannot be used together")
	}

	payload := map[string]any{}
	switch {
	case prompt != "":
		payload["Prompt"] = prompt
	case imageBase64 != "":
		payload["ImageBase64"] = imageBase64
	default:
		payload["ImageUrl"] = imageURL
	}

	gen := strings.TrimSpace(opts.GenerateType)
	if gen == "" {
		gen = "Normal"
	}
	payload["GenerateType"] = gen

	enable := false
	if opts.EnablePBR != nil {
		enable = *opts.EnablePBR
	}
	// Geometry 时 EnablePBR 不生效，这里直接置 false 以表意清晰
	if strings.EqualFold(gen, "Geometry") {
		enable = false
	}
	payload["EnablePBR"] = enable

	if opts.FaceCount != nil {
		fc := *opts.FaceCount
		if fc < 40000 || fc > 500000 {
			return nil, fmt.Errorf("face_count out of range (40000-500000)")
		}
		payload["FaceCount"] = fc
	}

	// 需要时可扩展 MultiViewImages（略）
	return payload, nil
}

/* =========================
   Tencent Cloud API Wrappers
   ========================= */

func submitHunyuan(payload map[string]any) (string, error) {
	client, err := getClient()
	if err != nil {
		return "", err
	}
	req := ai3d.NewSubmitHunyuanTo3DProJobRequest()
	b, _ := json.Marshal(payload)
	if err := req.FromJsonString(string(b)); err != nil {
		return "", err
	}
	resp, err := client.SubmitHunyuanTo3DProJob(req)
	if err != nil {
		return "", err
	}
	return strVal(resp.Response.JobId), nil
}

// 放在 imports 顶部已引入：
// "github.com/tencentcloud/tencentcloud-sdk-go/tencentcloud/common"

type QueryProResult struct {
	Status       string       `json:"status"`                  // WAIT/RUN/FAIL/DONE
	ErrorCode    string       `json:"error_code,omitempty"`    // 可能为空
	ErrorMessage string       `json:"error_message,omitempty"` // 可能为空
	Files        []ResultFile `json:"files"`                   // ResultFile3Ds 映射
	RequestId    string       `json:"request_id"`              // 服务端生成
}

// 按文档：仅需传 JobId；Region/Action/Version 走 SDK 配置
func queryHunyuan(jobID string) (*QueryProResult, error) {
	if strings.TrimSpace(jobID) == "" {
		return nil, fmt.Errorf("job_id is required")
	}
	client, err := getClient()
	if err != nil {
		return nil, err
	}

	req := ai3d.NewQueryHunyuanTo3DProJobRequest()
	// 使用强类型设置 JobId，避免 FromJsonString 的 unknown keys 风险
	req.JobId = common.StringPtr(jobID)

	resp, err := client.QueryHunyuanTo3DProJob(req)
	if err != nil {
		return nil, err
	}
	out := &QueryProResult{
		Status:       strVal(resp.Response.Status),
		ErrorCode:    strVal(resp.Response.ErrorCode),
		ErrorMessage: strVal(resp.Response.ErrorMessage),
		RequestId:    strVal(resp.Response.RequestId),
	}
	// 映射 ResultFile3Ds -> Files
	if resp.Response.ResultFile3Ds != nil {
		files := make([]ResultFile, 0, len(resp.Response.ResultFile3Ds))
		for _, f := range resp.Response.ResultFile3Ds {
			files = append(files, ResultFile{
				Type:            strVal(f.Type),
				Url:             strVal(f.Url),
				PreviewImageUrl: strVal(f.PreviewImageUrl), // 若无此字段，保持空串
			})
		}
		out.Files = files
	}
	return out, nil
}


/* =========================
   HTTP Handlers
   ========================= */

type SubmitTextReq struct {
	Prompt       string `json:"prompt"`                 // 必填（这个 text 接口）
	EnablePBR    *bool  `json:"enable_pbr"`             // 可选
	FaceCount    *int64 `json:"face_count"`             // 可选，生成3D模型的面数
	GenerateType string `json:"generate_type"`          // 可选：Normal|LowPoly|Geometry|Sketch
}

func handleSubmitText(c *gin.Context) {
	var req SubmitTextReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"ok": false, "error": "invalid json"})
		return
	}
	if strings.TrimSpace(req.Prompt) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"ok": false, "error": "prompt is required"})
		return
	}
	payload, err := buildProPayload(
		req.Prompt, "", "",
		ProCommonOpts{EnablePBR: req.EnablePBR, FaceCount: req.FaceCount, GenerateType: req.GenerateType},
	)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"ok": false, "error": err.Error()})
		return
	}

	jobID, err := submitHunyuan(payload)
	if err != nil {
		handleSDKError(c, err)
		return
	}
	_ = repo.Upsert(c.Request.Context(), jobID, "WAIT", nil, "")
	c.JSON(http.StatusOK, gin.H{"ok": true, "job_id": jobID})
}

func handleSubmitImage(c *gin.Context) {
	fh, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"ok": false, "error": "file is required"})
		return
	}
	file, err := fh.Open()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"ok": false, "error": err.Error()})
		return
	}
	defer file.Close()
	all, err := io.ReadAll(file)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"ok": false, "error": err.Error()})
		return
	}
	b64 := base64.StdEncoding.EncodeToString(all)

	enablePBR := parseBoolDefault(c.PostForm("enable_pbr"), false)
	var faceCount *int64
	if v := strings.TrimSpace(c.PostForm("face_count")); v != "" {
		if n, e := strconv.ParseInt(v, 10, 64); e == nil {
			faceCount = &n
		}
	}
	genType := strings.TrimSpace(c.PostForm("generate_type"))

	payload, err := buildProPayload(
		"", b64, "",
		ProCommonOpts{EnablePBR: &enablePBR, FaceCount: faceCount, GenerateType: genType},
	)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"ok": false, "error": err.Error()})
		return
	}
	jobID, err := submitHunyuan(payload)
	if err != nil {
		handleSDKError(c, err)
		return
	}
	_ = repo.Upsert(c.Request.Context(), jobID, "WAIT", nil, "")
	c.JSON(http.StatusOK, gin.H{"ok": true, "job_id": jobID})
}

type SubmitImageURLReq struct {
	ImageURL     string `json:"image_url"`
	EnablePBR    *bool  `json:"enable_pbr"`
	FaceCount    *int64 `json:"face_count"`
	GenerateType string `json:"generate_type"`
}

func handleSubmitImageURL(c *gin.Context) {
	var req SubmitImageURLReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"ok": false, "error": "invalid json"})
		return
	}
	if strings.TrimSpace(req.ImageURL) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"ok": false, "error": "image_url is required"})
		return
	}

	payload, err := buildProPayload(
		"", "", req.ImageURL,
		ProCommonOpts{EnablePBR: req.EnablePBR, FaceCount: req.FaceCount, GenerateType: req.GenerateType},
	)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"ok": false, "error": err.Error()})
		return
	}
	jobID, err := submitHunyuan(payload)
	if err != nil {
		handleSDKError(c, err)
		return
	}
	_ = repo.Upsert(c.Request.Context(), jobID, "WAIT", nil, "")
	c.JSON(http.StatusOK, gin.H{"ok": true, "job_id": jobID})
}

func handleStatus(c *gin.Context) {
	jobID := c.Param("job_id")

	res, err := queryHunyuan(jobID)
	if err != nil {
		handleSDKError(c, err)
		return
	}

	// 写入数据库（与你原有逻辑一致）
	var errStr string
	if res.Status == "FAIL" {
		errStr = strings.TrimSpace(res.ErrorCode + " " + res.ErrorMessage)
	}
	_ = repo.Upsert(c.Request.Context(), jobID, res.Status, res.Files, errStr)

	// 返回值对齐文档字段（并保留你已有的 files 映射）
	c.JSON(http.StatusOK, gin.H{
		"ok":           true,
		"job_id":       jobID,
		"status":       res.Status,        // WAIT/RUN/FAIL/DONE
		"error_code":   res.ErrorCode,     // 可为空
		"error_message":res.ErrorMessage,  // 可为空
		"files":        res.Files,         // ResultFile3Ds
		"request_id":   res.RequestId,     // 便于排障
	})
}


func handleDownload(c *gin.Context) {
	jobID := c.Param("job_id")
	idxStr := c.Param("idx")
	idx, _ := strconv.Atoi(idxStr)

	jm, err := repo.Get(c.Request.Context(), jobID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"ok": false, "error": err.Error()})
		return
	}
	if jm == nil || jm.Status != "DONE" {
		c.JSON(http.StatusBadRequest, gin.H{"ok": false, "error": "job not done or unknown"})
		return
	}
	if idx < 0 || idx >= len(jm.Files) {
		c.JSON(http.StatusBadRequest, gin.H{"ok": false, "error": "index out of range"})
		return
	}

	f := jm.Files[idx]
	ext := strings.ToLower(f.Type)
	if ext == "" {
		ext = "bin"
	}
	outName := jobID + "_" + strconv.Itoa(idx) + "." + ext
	outPath := filepath.Join(downloadDir, outName)

	if _, err := os.Stat(outPath); err != nil {
		if err := downloadToFile(f.Url, outPath); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"ok": false, "error": "download failed: " + err.Error()})
			return
		}
	}
	c.FileAttachment(outPath, outName)
}

func handleHealth(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"ok": true, "service": "hunyuan3d"})
}

/* =========================
   Networking Helpers
   ========================= */

func handleSDKError(c *gin.Context, err error) {
	msg := err.Error()
	if se, ok := err.(*tcerr.TencentCloudSDKError); ok {
		if strings.Contains(se.GetCode(), "RequestLimitExceeded.JobNumExceed") {
			c.JSON(http.StatusConflict, gin.H{"ok": false, "error": "concurrency_limit", "message": se.Error()})
			return
		}
	}
	if strings.Contains(msg, "RequestLimitExceeded.JobNumExceed") {
		c.JSON(http.StatusConflict, gin.H{"ok": false, "error": "concurrency_limit", "message": msg})
		return
	}
	c.JSON(http.StatusInternalServerError, gin.H{"ok": false, "error": msg})
}

var httpTransport = &http.Transport{
	MaxIdleConns:        100,
	MaxConnsPerHost:     100,
	IdleConnTimeout:     90 * time.Second,
	DisableCompression:  true,             // 避免中间代理压缩异常
	TLSHandshakeTimeout: 20 * time.Second,
}

//func init() {
//	// 可通过环境变量临时禁用 HTTP/2（某些网关/H2 实现不稳会导致 EOF）
//	if strings.EqualFold(os.Getenv("DISABLE_HTTP2"), "true") {
//		httpTransport.TLSNextProto = map[string.func(string, *tls.Conn) http.RoundTripper{} // 禁 H2
//	}
//}

var httpClient = &http.Client{
	Timeout:   0, // 大文件下载用每次请求的 context 控时长
	Transport: httpTransport,
}

func downloadToFile(url, out string) error {
	const (
		maxRetries   = 6
		chunkSize    = 4 << 20 // 4MiB
		backoffStart = 400 * time.Millisecond
	)

	tmp := out + ".part"

	// 断点：已有多少字节
	var have int64
	if fi, err := os.Stat(tmp); err == nil {
		have = fi.Size()
	} else if fi2, err2 := os.Stat(out); err2 == nil && fi2.Size() > 0 {
		// 已完整下载过
		return nil
	}

	// 尝试探测总大小（HEAD 或 Range）
	total := int64(-1)
	{
		ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
		defer cancel()
		req, _ := http.NewRequestWithContext(ctx, http.MethodHead, url, nil)
		resp, err := httpClient.Do(req)
		if err == nil {
			if cl := resp.Header.Get("Content-Length"); cl != "" {
				if n, e := strconv.ParseInt(cl, 10, 64); e == nil {
					total = n
				}
			}
			resp.Body.Close()
		}
		// 若 HEAD 拿不到，再用 Range 探测 0-0
		if total < 0 {
			req, _ = http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
			req.Header.Set("Range", "bytes=0-0")
			resp, err = httpClient.Do(req)
			if err == nil && resp.StatusCode == http.StatusPartialContent {
				if cr := resp.Header.Get("Content-Range"); cr != "" {
					// 形如: bytes 0-0/123456
					if slash := strings.LastIndexByte(cr, '/'); slash > 0 {
						if n, e := strconv.ParseInt(cr[slash+1:], 10, 64); e == nil {
							total = n
						}
					}
				}
				io.Copy(io.Discard, resp.Body)
				resp.Body.Close()
			}
		}
	}

	// 打开 part 文件（续写）
	f, err := os.OpenFile(tmp, os.O_CREATE|os.O_RDWR, 0o644)
	if err != nil {
		return err
	}
	defer f.Close()
	if _, err := f.Seek(have, io.SeekStart); err != nil {
		return err
	}

	backoff := backoffStart
	for attempt := 0; attempt < maxRetries; attempt++ {
		ctx, cancel := context.WithTimeout(context.Background(), 15*time.Minute)
		req, _ := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
		// 有些网关对 keep-alive/H2 兼容不好，改用短连接更稳
		req.Header.Set("Connection", "close")
		if have > 0 {
			req.Header.Set("Range", "bytes="+strconv.FormatInt(have, 10)+"-")
		}

		resp, err := httpClient.Do(req)
		if err != nil {
			cancel()
			time.Sleep(backoff)
			backoff *= 2
			continue
		}

		// 处理状态码
		if resp.StatusCode == http.StatusRequestedRangeNotSatisfiable {
			// 说明 have >= total（或服务端不支持 Range），认为已完成
			resp.Body.Close()
			cancel()
			break
		}
		if resp.StatusCode >= 400 {
			body, _ := io.ReadAll(io.LimitReader(resp.Body, 512))
			resp.Body.Close()
			cancel()
			return fmt.Errorf("bad status: %s, body: %s", resp.Status, string(body))
		}

		// 复制
		buf := make([]byte, chunkSize)
		var copyErr error
		for {
			n, rerr := resp.Body.Read(buf)
			if n > 0 {
				if _, werr := f.Write(buf[:n]); werr != nil {
					copyErr = werr
					break
				}
				have += int64(n)
			}
			if rerr == io.EOF {
				copyErr = nil
				break
			}
			if rerr != nil {
				copyErr = rerr
				break
			}
		}
		resp.Body.Close()
		cancel()

		if copyErr == nil {
			// 已写完本段；若知道总大小且 have < total，继续下一轮续传
			if total > 0 && have < total {
				continue
			}
			if err := f.Sync(); err != nil {
				return err
			}
			return os.Rename(tmp, out)
		}

		// 读/写中断：指数退避重试
		time.Sleep(backoff)
		backoff *= 2
	}

	// 最后兜底：如果 size 看起来完整，也认为成功
	if total > 0 && have >= total {
		if err := f.Sync(); err != nil {
			return err
		}
		return os.Rename(tmp, out)
	}
	return fmt.Errorf("download failed after retries, got=%d, total=%d", have, total)
}

func parseBoolDefault(v string, def bool) bool {
	if v == "" {
		return def
	}
	switch strings.ToLower(v) {
	case "1", "true", "t", "yes", "y", "on":
		return true
	case "0", "false", "f", "no", "n", "off":
		return false
	default:
		return def
	}
}

func strVal(p *string) string {
	if p == nil {
		return ""
	}
	return *p
}

/* =========================
   main
   ========================= */

func main() {
	mustInit()

	gin.SetMode(gin.ReleaseMode)
	r := gin.Default()

	r.GET("/", handleHealth)
	r.POST("/api/submit-text", handleSubmitText)
	r.POST("/api/submit-image", handleSubmitImage)
	r.POST("/api/submit-image-url", handleSubmitImageURL)
	r.GET("/api/status/:job_id", handleStatus)
	r.GET("/api/download/:job_id/:idx", handleDownload)

	addr := ":" + strconv.Itoa(appPort)
	if p := os.Getenv("PORT"); p != "" {
		addr = ":" + p
	}
	_ = r.Run(addr)
}
