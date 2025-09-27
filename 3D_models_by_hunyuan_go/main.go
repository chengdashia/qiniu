// main.go
package main

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/gin-contrib/cors"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
	"golang.org/x/crypto/bcrypt"

	"github.com/gin-contrib/sessions"
	"github.com/gin-contrib/sessions/cookie"
	_ "github.com/jackc/pgx/v5/stdlib"

	//_ "github.com/lib/pq"

	"github.com/jinzhu/gorm"
	ai3d "github.com/tencentcloud/tencentcloud-sdk-go/tencentcloud/ai3d/v20250513"
	"github.com/tencentcloud/tencentcloud-sdk-go/tencentcloud/common"
	tcerr "github.com/tencentcloud/tencentcloud-sdk-go/tencentcloud/common/errors"
	"github.com/tencentcloud/tencentcloud-sdk-go/tencentcloud/common/profile"

	_ "github.com/jinzhu/gorm/dialects/postgres"
	hunyuan "github.com/tencentcloud/tencentcloud-sdk-go/tencentcloud/hunyuan/v20230901"
)

var (
	appPort     = 5000
	downloadDir = "downloads"

	// 设置数据库连接
	db   *gorm.DB
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

// 用户表
type User struct {
	ID       uint   `gorm:"primary_key"`
	Username string `gorm:"unique;not null"`
	Password string `gorm:"not null"`
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
   GORM Repo
   ========================= */

type gormJobRepo struct{ db *gorm.DB }

func NewGormJobRepo(db *gorm.DB) JobRepo { return &gormJobRepo{db: db} }

func createTable(db *gorm.DB) error {
	// GORM 会自动处理表的迁移
	db.AutoMigrate(&User{})
	result := db.AutoMigrate(&JobMeta{})
	return result.Error
}

func (r *gormJobRepo) Upsert(ctx context.Context, jobID, status string, files []ResultFile, errStr string) error {
	// 插入或更新操作
	jobMeta := JobMeta{
		JobID:  jobID,
		Status: status,
		Files:  files,
		Error:  errStr,
	}

	// GORM 提供了 `Save` 方法，支持插入或更新数据
	// 注意：`Save` 方法根据主键进行判断，如果记录存在则更新，如果不存在则插入
	return r.db.Save(&jobMeta).Error
}

func (r *gormJobRepo) Get(ctx context.Context, jobID string) (*JobMeta, error) {
	var jm JobMeta
	// GORM 提供了 `First` 方法来查找指定条件的第一条记录
	err := r.db.Where("job_id = ?", jobID).First(&jm).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &jm, nil
}

/* =========================
   Env / DB Init
   ========================= */

func mustInit(dsn string) {
	_ = godotenv.Load()

	if p := os.Getenv("PORT"); p != "" {
		if v, err := strconv.Atoi(p); err == nil {
			appPort = v
		}
	}
	if err := os.MkdirAll(downloadDir, 0o755); err != nil {
		panic(err)
	}
	mustInitDB(dsn)

	// 创建表格（如果不存在的话）
	err := createTable(db)
	if err != nil {
		log.Fatal("Error creating table:", err)
	}
	fmt.Println("Table created (if not already exists) successfully.")

	repo = NewGormJobRepo(db)
}

// 初始化数据库
func mustInitDB(dsn string) {
	//dsn := os.Getenv("DATABASE_URL") // e.g. postgres://user:pass@host:5432/db?sslmode=disable

	//fmt.Println(dsn)

	if dsn == "" {
		panic("DATABASE_URL is required")
	}
	var err error
	db, err = gorm.Open("postgres", dsn)
	if err != nil {
		panic(err)
	}

	// 设置连接池
	db.DB().SetMaxOpenConns(20)
	db.DB().SetMaxIdleConns(10)
	db.DB().SetConnMaxLifetime(30 * time.Minute)

	// 测试数据库连接
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := db.DB().PingContext(ctx); err != nil {
		panic(err)
	}
}

/* =========================
   Tencent Cloud Client
   ========================= */

func getHunyuanClient() (*hunyuan.Client, error) {
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
	httpProf.Endpoint = "hunyuan.tencentcloudapi.com"
	cliProf := profile.NewClientProfile()
	cliProf.HttpProfile = httpProf
	return hunyuan.NewClient(cred, region, cliProf)
}

// 使用混元大模型打磨提示词，提升生成质量
// 环境变量可选：HUNYUAN_MODEL（默认给一个常用模型名）
func polishPromptLLM(input string) (string, error) {
	client, err := getHunyuanClient()
	if err != nil {
		return "", err
	}

	// 模型名可从环境变量覆盖，例如：hunyuan-pro / hunyuan-standard / hunyuan-lite 等
	model := os.Getenv("HUNYUAN_MODEL")
	//fmt.Println("Using LLM model:", model)
	if model == "" {
		model = "hunyuan-turbo"
	}

	req := hunyuan.NewChatCompletionsRequest()
	req.Model = common.StringPtr(model)
	// 可根据需要微调温度/TopP
	req.Temperature = common.Float64Ptr(0.3)
	req.TopP = common.Float64Ptr(0.9)

	// 系统提示：只输出打磨后的 3D 提示词（中文，单行，<=512 字，无多余解释/引号）
	systemPrompt := `你是3D模型生成提示词的润色助手。请将用户的想法改写为适合“文本/图生3D（混元到3D Pro）”的高质量中文提示词，要求：
- 聚焦主体（物体/角色）、材质与表面特性（如 PBR、金属/塑料/陶瓷等）、风格与工艺（Q版、写实、粘土感等）、灯光与相机（打光环境、构图、镜头）、细节与复杂度（多边形/细节程度）、色彩与氛围。
- 语言简洁有力，避免行话与赘述。
- 输出仅一行、最多 512 字符、不要引号、不要任何解释或前后缀。`

	// 构造消息
	req.Messages = []*hunyuan.Message{
		{Role: common.StringPtr("system"), Content: common.StringPtr(systemPrompt)},
		{Role: common.StringPtr("user"), Content: common.StringPtr(input)},
	}

	// 非流式
	stream := false
	req.Stream = &stream

	resp, err := client.ChatCompletions(req)
	if err != nil {
		return "", err
	}
	// 解析首条选择
	if resp.Response == nil || len(resp.Response.Choices) == 0 ||
		resp.Response.Choices[0].Message == nil || resp.Response.Choices[0].Message.Content == nil {
		return "", errors.New("empty LLM response")
	}
	out := *resp.Response.Choices[0].Message.Content
	// 简单裁剪到 512 字（防御；通常模型会遵守）
	if len([]rune(out)) > 512 {
		r := []rune(out)
		out = string(r[:512])
	}
	// 单行输出
	out = strings.TrimSpace(strings.ReplaceAll(out, "\n", " "))
	return out, nil
}

type PolishReq struct {
	Prompt string `json:"prompt"`
}

func handlePolishPrompt(c *gin.Context) {
	var req PolishReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"ok": false, "error": "invalid json"})
		return
	}
	if strings.TrimSpace(req.Prompt) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"ok": false, "error": "prompt is required"})
		return
	}

	refined, err := polishPromptLLM(req.Prompt)
	if err != nil {
		// 复用你的 SDK 错误处理
		handleSDKError(c, err)
		return
	}

	c.Set("refined", refined)

	c.JSON(http.StatusOK, gin.H{
		"ok":              true,
		"polished_prompt": refined,
	})
}

// 3D模型创建
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
	EnablePBR    *bool  `json:"enable_pbr"`    // 默认为 false
	FaceCount    *int64 `json:"face_count"`    // 40000-500000
	GenerateType string `json:"generate_type"` // Normal|LowPoly|Geometry|Sketch
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
	Prompt       string `json:"prompt"`        // 原始提示词
	EnablePBR    *bool  `json:"enable_pbr"`    // 可选
	FaceCount    *int64 `json:"face_count"`    // 可选
	GenerateType string `json:"generate_type"` // 可选：Normal|LowPoly|Geometry|Sketch

	// 新增：是否先润色再提交
	Polish bool `json:"polish"` // 默认 false；true 时会先调用混元生文润色
}

func handleSubmitText(c *gin.Context) {
	var req SubmitTextReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"ok": false, "error": "invalid json"})
		return
	}
	raw := strings.TrimSpace(req.Prompt)
	if raw == "" {
		c.JSON(http.StatusBadRequest, gin.H{"ok": false, "error": "prompt is required"})
		return
	}

	// 如果需要润色 -> 先走混元生文
	usedPrompt := raw
	if req.Polish {
		refined, err := polishPromptLLM(raw) // 这里就是你上一步实现的函数
		if err != nil {
			// 你也可以选择“润色失败则降级用原文”，
			// 这里只是给出清晰的错误返回，方便排查
			handleSDKError(c, err)
			return
		}
		usedPrompt = refined
	}

	// 按 Pro 规范构造 payload（只允许 Prompt）
	payload, err := buildProPayload(
		usedPrompt, "", "",
		ProCommonOpts{
			EnablePBR:    req.EnablePBR,
			FaceCount:    req.FaceCount,
			GenerateType: req.GenerateType,
		},
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

	// 把最终使用的 prompt 回给前端，便于展示/复用
	c.JSON(http.StatusOK, gin.H{
		"ok":          true,
		"job_id":      jobID,
		"prompt_used": usedPrompt, // 如果 polish=true，这里就是 refined
		"polished":    req.Polish,
	})
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
	fmt.Println("Received job_id:", jobID) // 打印 job_id

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
		"ok":            true,
		"job_id":        jobID,
		"status":        res.Status,       // WAIT/RUN/FAIL/DONE
		"error_code":    res.ErrorCode,    // 可为空
		"error_message": res.ErrorMessage, // 可为空
		"files":         res.Files,        // ResultFile3Ds
		"request_id":    res.RequestId,    // 便于排障
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
	DisableCompression:  true, // 避免中间代理压缩异常
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

// 用户登录
func hashPassword(password string) (string, error) {
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return "", err
	}
	return string(hashedPassword), nil
}

// 验证密码
func checkPassword(hashedPassword, password string) bool {
	err := bcrypt.CompareHashAndPassword([]byte(hashedPassword), []byte(password))
	return err == nil
}

// 注册路由
func handelRegister(c *gin.Context) {
	username := c.PostForm("username")
	password := c.PostForm("password")

	// 检查用户名是否已存在
	var user User
	if err := db.Where("username = ?", username).First(&user).Error; err == nil {
		c.JSON(http.StatusConflict, gin.H{"message": "Username already taken"})
		return
	}

	// 加密密码
	hashedPassword, err := hashPassword(password)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Error encrypting password"})
		return
	}

	// 创建新用户
	newUser := User{Username: username, Password: hashedPassword}
	if err := db.Create(&newUser).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Error registering user"})
		return
	}

	c.JSON(200, gin.H{"message": "Registration successful"})
}

// 登录路由
func handelLogin(c *gin.Context) {
	username := c.PostForm("username")
	password := c.PostForm("password")

	// 查询数据库中的用户
	var user User
	if err := db.Where("username = ?", username).First(&user).Error; err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"message": "Invalid username or password"})
		return
	}

	// 校验密码
	if !checkPassword(user.Password, password) {
		c.JSON(http.StatusUnauthorized, gin.H{"message": "Invalid username or password"})
		return
	}

	// 登录成功，设置 session
	session := sessions.Default(c)
	session.Set("user", user.Username)

	// 设置会话过期时间为 10 分钟
	session.Options(sessions.Options{
		MaxAge: 10 * 60,
	})

	session.Save()

	c.JSON(200, gin.H{"message": "Logged in successfully"})
}

func authMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		session := sessions.Default(c)
		user := session.Get("user")

		if user == nil {
			// 如果没有会话信息，则返回 401 Unauthorized
			c.JSON(http.StatusUnauthorized, gin.H{"message": "Unauthorized"})
			c.Abort() // 终止后续的处理
			return
		}

		// 会话验证通过，继续处理
		c.Next()
	}
}

/* =========================
   main
   ========================= */

func main() {

	//// 定义命令行参数
	//secretID := flag.String("secret-id", "", "Tencent Cloud Secret ID")
	//secretKey := flag.String("secret-key", "", "Tencent Cloud Secret Key")
	//region := flag.String("region", "", "Tencent Cloud Region")
	//port := flag.String("port", "5000", "Server Port")
	//databaseURL := flag.String("database-url", "", "Pgsql Database Connection URL")
	//hunyuanModel := flag.String("hunyuan-model", "hunyuan-t1-latest", "Hunyuan Model")

	dsn := flag.String("database-url", "postgres://whang_3d:wh134151@127.0.0.1:5432/postgres?sslmode=disable", "Pgsql Database Connection URL")

	flag.Parse()

	mustInit(*dsn)

	gin.SetMode(gin.ReleaseMode)
	r := gin.Default()

	r.Use(cors.New(cors.Config{
		AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Length", "Content-Type", "Authorization"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
		AllowOriginFunc: func(origin string) bool {
			return true // 或者用更具体的逻辑来判断
		},
		MaxAge: 12 * time.Hour,
	}))

	// 显式处理 OPTIONS 请求以支持预检请求
	r.OPTIONS("/api/*path", func(c *gin.Context) {
		c.Header("Access-Control-Allow-Origin", "*")
		c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Origin, Content-Length, Content-Type, Authorization")
		c.Status(http.StatusOK)
	})

	r.GET("/", handleHealth)

	// 使用 cookie 存储会话
	store := cookie.NewStore([]byte("secret"))
	r.Use(sessions.Sessions("mysession", store)) //
	//// 设置会话过期时间为 10 分钟
	//store.Options(sessions.Options{
	//	MaxAge: 10 * 60, // 10 minutes
	//})

	// **不使用中间件**的路由
	r.POST("/register", handelRegister)
	r.POST("/login", handelLogin)

	// **需要会话验证中间件**的路由
	authorized := r.Group("/api")
	authorized.Use(authMiddleware()) // 只对该路由组中的路由进行会话验证

	//路由错误
	//authorized.POST("/api/submit-text", handleSubmitText)
	authorized.POST("/submit-text", handleSubmitText)
	authorized.POST("/submit-image", handleSubmitImage)
	authorized.POST("/submit-image-url", handleSubmitImageURL)
	authorized.GET("/status/:job_id", handleStatus)
	authorized.GET("/download/:job_id/:idx", handleDownload)
	authorized.POST("/polish-prompt", handlePolishPrompt)

	addr := ":" + strconv.Itoa(appPort)
	if p := os.Getenv("PORT"); p != "" {
		addr = ":" + p
	}

	fmt.Println("Starting server on", addr)

	err := r.Run(addr)
	if err != nil {
		log.Fatal("Server run error:", err)
	}
}
