# 文本转3D API流程实现总结

根据main.go文件分析和用户需求，已实现文本转3D的完整轮询流程，并支持选择模型格式。

## API流程

### 当前实现的完整流程
1. 调用`/api/submit-text`提交任务 → 返回`job_id`
2. 调用`/api/status/{job_id}`轮询状态
3. 当status为"DONE"时，调用`/api/download/{job_id}/{format_index}`下载模型
   - format_index: 0表示OBJ格式，1表示GLB格式

### 原始简化流程（已改为完整流程）
1. 调用`/api/submit-text`提交任务 → 返回`job_id`和`prompt_used`
2. **直接尝试**调用`/api/download/{job_id}/0`下载模型文件
3. 如果下载成功，解析并展示模型
4. 如果下载失败，提供重试按钮

## 修改的文件

### 1. `.env`
- 更新API基础URL为本地后端服务: `http://127.0.0.1:5000`

### 2. `src/api/model3d.ts`
- 添加了3D文件加载器导入（GLTFLoader, OBJLoader, FBXLoader）
- 重写`textTo3D`方法，实现完整流程
- 添加`downloadModel`方法用于手动下载
- 添加`loadModelFromBlob`函数处理下载的模型文件

### 3. `src/types/3d.ts`
- 为`Model3D`接口添加`jobId`字段

### 4. `src/stores/model3d.ts`
- 导入`loadModelFromBlob`函数
- 重写`generateFromText`方法，实现完整轮询流程：
  - 提交任务后轮询状态
  - 保存`jobId`到模型对象
  - 当状态为DONE时下载并解析模型（支持指定格式）
  - 如果解析失败，降级使用模拟数据
- 添加`downloadModelManually`方法用于手动重试下载
- 添加`pollJobStatus`方法实现轮询机制（支持指定格式）

### 5. `src/components/TextTo3D.vue`
- 添加`isRetrying`状态
- 添加`retryDownload`方法
- 在历史记录中添加"重试下载"按钮（对失败或生成中的模型）

## API接口说明

### 提交文本转3D任务
**POST** `/api/submit-text`
```json
{
  "prompt": "一只可爱的小猫",
  "polish": true,
  "enable_pbr": false,
  "face_count": 400000,
  "generate_type": "Normal"
}
```

**响应:**
```json
{
  "ok": true,
  "job_id": "1363443869727195136",
  "prompt_used": "写实PBR材质马，栗色短毛...",
  "polished": true
}
```

### 查询任务状态
**GET** `/api/status/{job_id}`
```json
{
  "ok": true,
  "job_id": "1363443869727195136",
  "status": "DONE",           // WAIT / RUN / FAIL / DONE
  "files": [...],
  "request_id": "..."
}
```

### 下载模型文件
**GET** `/api/download/{job_id}/{format_index}`
- format_index: 0表示OBJ格式，1表示GLB格式
- 返回模型文件的二进制数据

## 特性

1. **完整轮询流程**: 轮询状态直到完成，然后下载模型
2. **格式选择**: 支持选择OBJ(0)或GLB(1)格式下载
3. **错误处理**: 轮询超时、下载失败时提供重试机制
4. **降级处理**: 真实模型解析失败时使用模拟数据
5. **用户体验**: 保存优化后的提示词，显示生成进度

## 使用说明

1. 确保后端服务运行在`http://127.0.0.1:5000`
2. 前端会自动调用完整流程
3. 用户可选择模型格式（OBJ或GLB）
4. 如果模型下载失败，用户可以点击"重试下载"按钮
5. 支持提示词优化、PBR材质、面数调整等高级选项