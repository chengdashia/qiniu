import os, json, base64, time, threading
from pathlib import Path
from flask import Flask, request, jsonify, send_from_directory
from dotenv import load_dotenv
import requests

from tencentcloud.common import credential
from tencentcloud.common.profile.client_profile import ClientProfile
from tencentcloud.common.profile.http_profile import HttpProfile
from tencentcloud.ai3d.v20250513 import ai3d_client, models
from tencentcloud.common.exception.tencent_cloud_sdk_exception import TencentCloudSDKException

# ---------- 基础配置 ----------
load_dotenv()
APP_PORT = int(os.getenv("PORT", 5000))
DOWNLOAD_DIR = Path("downloads")
DOWNLOAD_DIR.mkdir(exist_ok=True)

# 简单“任务字典”（内存+落盘），生产建议换 Redis/DB
JOB_DB_FILE = Path(".job_db.json")
_job_lock = threading.Lock()
if JOB_DB_FILE.exists():
    with JOB_DB_FILE.open("r", encoding="utf-8") as f:
        JOB_DB = json.load(f)
else:
    JOB_DB = {}  # job_id -> {"status": "...", "files": [{"Type": "...", "Url": "..."}], "error": "..."}
    JOB_DB_FILE.write_text("{}", encoding="utf-8")

def _save_job_db():
    with _job_lock:
        JOB_DB_FILE.write_text(json.dumps(JOB_DB, ensure_ascii=False, indent=2), encoding="utf-8")

def get_client():
    cred = credential.Credential(
        os.getenv("TENCENTCLOUD_SECRET_ID"),
        os.getenv("TENCENTCLOUD_SECRET_KEY"),
    )
    http = HttpProfile(endpoint="ai3d.tencentcloudapi.com")
    return ai3d_client.Ai3dClient(cred, os.getenv("TENCENTCLOUD_REGION", "ap-guangzhou"), ClientProfile(httpProfile=http))

def submit_hunyuan(payload: dict) -> str:
    """提交文生/图生 3D 任务，返回 job_id"""
    client = get_client()
    req = models.SubmitHunyuanTo3DJobRequest()
    req.from_json_string(json.dumps(payload))
    resp = client.SubmitHunyuanTo3DJob(req)
    return resp.JobId  # 注意：SDK 响应字段是直接属性

def query_hunyuan(job_id: str):
    client = get_client()
    req = models.QueryHunyuanTo3DJobRequest()
    req.from_json_string(json.dumps({"JobId": job_id}))
    return client.QueryHunyuanTo3DJob(req)

def record_job(job_id: str, status: str, files=None, error=None):
    with _job_lock:
        JOB_DB[job_id] = {"status": status, "files": files or [], "error": error}
    _save_job_db()

def download_file(url: str, out_path: Path):
    r = requests.get(url, stream=True, timeout=300)
    r.raise_for_status()
    with out_path.open("wb") as f:
        for chunk in r.iter_content(1 << 20):
            if chunk:
                f.write(chunk)
    return out_path

# ---------- Flask ----------
app = Flask(__name__)

@app.route("/api/submit-text", methods=["POST"])
def submit_text():
    data = request.get_json(force=True, silent=True) or {}
    prompt = data.get("prompt")
    result_format = data.get("result_format", "GLB")
    enable_pbr = bool(data.get("enable_pbr", True))
    if not prompt:
        return jsonify({"ok": False, "error": "prompt is required"}), 400
    try:
        job_id = submit_hunyuan({
            "Prompt": prompt,
            "ResultFormat": result_format,
            "EnablePBR": enable_pbr
        })
        record_job(job_id, "WAIT")
        return jsonify({"ok": True, "job_id": job_id})
    except TencentCloudSDKException as e:
        msg = str(e)
        # 并发上限：提示客户端去查已有任务
        if "RequestLimitExceeded.JobNumExceed" in msg:
            return jsonify({"ok": False, "error": "concurrency_limit", "message": msg}), 409
        return jsonify({"ok": False, "error": msg}), 500

##@app.route("/api/submit-image-url", methods=["POST"])
##def submit_image_url():
##    data = request.get_json(force=True, silent=True) or {}
##    image_url = data.get("image_url")
##    ##API还不支持同时传图片和文字，在访问时，不填这个字段
##    prompt = data.get("prompt")  # 可选
##    result_format = data.get("result_format", "GLB")
##    enable_pbr = bool(data.get("enable_pbr", True))
##    if not image_url:
##        return jsonify({"ok": False, "error": "image_url is required"}), 400
##    try:
##        payload = {
##            "ImageUrl": image_url,
##            "ResultFormat": result_format,
##            "EnablePBR": enable_pbr
##        }
##        if prompt:
##            payload["Prompt"] = prompt
##        job_id = submit_hunyuan(payload)
##        record_job(job_id, "WAIT")
##        return jsonify({"ok": True, "job_id": job_id})
##    except TencentCloudSDKException as e:
##        msg = str(e)
##        if "RequestLimitExceeded.JobNumExceed" in msg:
##            return jsonify({"ok": False, "error": "concurrency_limit", "message": msg}), 409
##        return jsonify({"ok": False, "error": msg}), 500


@app.route("/api/submit-image-url", methods=["POST"])
def submit_image_url():
    """
    由于上游 API 不支持直接传 URL，故而：
    1) 先把 image_url 下载到本地临时文件；
    2) 再以 multipart/form-data 调用本服务的 /api/submit-image 接口复用现有逻辑。
    """
    data = request.get_json(force=True, silent=True) or {}
    image_url = data.get("image_url")
    prompt = data.get("prompt")  # 可选
    result_format = data.get("result_format", "GLB")
    enable_pbr = bool(data.get("enable_pbr", True))

    if not image_url:
        return jsonify({"ok": False, "error": "image_url is required"}), 400

    import tempfile
    from urllib.parse import urlparse
    try:
        # 1) 下载图片
        r = requests.get(image_url, stream=True, timeout=60)
        r.raise_for_status()

        # 推断扩展名（优先 Content-Type，退化到 URL 路径）
        content_type = (r.headers.get("Content-Type") or "").lower()
        ext = None
        if content_type.startswith("image/"):
            ext = "." + content_type.split("/", 1)[1].split(";")[0]
            if ext == ".jpeg":
                ext = ".jpg"
            if ext == ".svg+xml":
                ext = ".svg"
        if not ext:
            path = urlparse(image_url).path
            _, ext = os.path.splitext(path)
            if not ext:
                ext = ".img"

        tmpf = tempfile.NamedTemporaryFile(delete=False, suffix=ext)
        try:
            for chunk in r.iter_content(1 << 20):
                if chunk:
                    tmpf.write(chunk)
            tmpf.flush()
        finally:
            tmpf.close()

        # 2) 转发到 /api/submit-image（multipart/form-data）
        files = {
            "file": (os.path.basename(tmpf.name),
                     open(tmpf.name, "rb"),
                     content_type or "application/octet-stream")
        }
        form = {
            "result_format": result_format,
            # /api/submit-image 中是通过字符串 "true"/"false" 判断
            "enable_pbr": "true" if enable_pbr else "false",
        }
        if prompt:
            form["prompt"] = prompt

        # 根据当前请求动态拼本机地址（含端口）
        target = request.host_url.rstrip("/") + "/api/submit-image"
        proxied = requests.post(target, files=files, data=form, timeout=300)
        files["file"][1].close()
        os.unlink(tmpf.name)  # 清理临时文件

        if proxied.status_code >= 400:
            # 把下游错误透传出来，便于排查
            return jsonify({
                "ok": False,
                "error": "submit-image failed",
                "status": proxied.status_code,
                "body": proxied.text
            }), proxied.status_code

        # 成功则直接返回下游 JSON
        return jsonify(proxied.json())

    except requests.RequestException as e:
        # 网络/下载错误
        try:
            if 'tmpf' in locals():
                os.unlink(tmpf.name)
        except Exception:
            pass
        return jsonify({"ok": False, "error": f"download error: {e}"}), 502
    except Exception as e:
        try:
            if 'tmpf' in locals():
                os.unlink(tmpf.name)
        except Exception:
            pass
        return jsonify({"ok": False, "error": str(e)}), 500


@app.route("/api/submit-image", methods=["POST"])
def submit_image_file():
    # 表单：multipart/form-data，字段名 "file"
    file = request.files.get("file")
    result_format = request.form.get("result_format", "GLB")
    enable_pbr = request.form.get("enable_pbr", "true").lower() == "true"
    prompt = request.form.get("prompt")  # 可选
    if not file:
        return jsonify({"ok": False, "error": "file is required"}), 400
    b64 = base64.b64encode(file.read()).decode("utf-8")
    try:
        payload = {
            "ImageBase64": b64,
            "ResultFormat": result_format,
            "EnablePBR": enable_pbr
        }
        if prompt:
            payload["Prompt"] = prompt
        job_id = submit_hunyuan(payload)
        record_job(job_id, "WAIT")
        return jsonify({"ok": True, "job_id": job_id})
    except TencentCloudSDKException as e:
        msg = str(e)
        if "RequestLimitExceeded.JobNumExceed" in msg:
            return jsonify({"ok": False, "error": "concurrency_limit", "message": msg}), 409
        return jsonify({"ok": False, "error": msg}), 500

@app.route("/api/status/<job_id>", methods=["GET"])
def status(job_id):
    # 直接查远端；也会把结果写回 JOB_DB（本地缓存）
    try:
        resp = query_hunyuan(job_id)
        status = resp.Status  # WAIT | RUN | DONE | FAIL
        files = [{"Type": x.Type, "Url": x.Url, "PreviewImageUrl": getattr(x, "PreviewImageUrl", None)} for x in (resp.ResultFile3Ds or [])]
        err = None
        if status == "FAIL":
            err = f"{resp.ErrorCode} {resp.ErrorMessage}"
        record_job(job_id, status, files, err)
        return jsonify({"ok": True, "job_id": job_id, "status": status, "files": files, "error": err})
    except TencentCloudSDKException as e:
        return jsonify({"ok": False, "error": str(e)}), 500

@app.route("/api/download/<job_id>/<int:idx>", methods=["GET"])
def download(job_id, idx):
    meta = JOB_DB.get(job_id)
    if not meta or meta.get("status") != "DONE":
        return jsonify({"ok": False, "error": "job not done or unknown"}), 400
    files = meta.get("files") or []
    if idx < 0 or idx >= len(files):
        return jsonify({"ok": False, "error": "index out of range"}), 400
    f = files[idx]
    ext = f["Type"].lower()
    out_name = f"{job_id}_{idx}.{ext}"
    out_path = DOWNLOAD_DIR / out_name
    if not out_path.exists():
        try:
            download_file(f["Url"], out_path)
        except Exception as e:
            return jsonify({"ok": False, "error": f"download failed: {e}"}), 500
    # 返回本地文件
    return send_from_directory(DOWNLOAD_DIR, out_name, as_attachment=True)

@app.get("/")
def health():
    return jsonify({"ok": True, "service": "hunyuan3d"})

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=APP_PORT, debug=True)
