# 文本转3D API流程实现总结

根据main.go文件分析和内存规范，已实现文本转3D的简化流程。

## API流程

### 原始流程（已改为简化流程）
1. 调用`/api/submit-text`提交任务 → 返回`job_id`
2. 调用`/api/status/{job_id}`轮询状态
3. 当status为"DONE"时，调用`/api/download/{job_id}/0`下载模型

### 现在的简化流程
1. 调用`/api/submit-text`提交任务 → 返回`job_id`和`prompt_used`
2. **直接尝试**调用`/api/download/{job_id}/0`下载模型文件
3. 如果下载成功，解析并展示模型
4. 如果下载失败，提供重试按钮

## 修改的文件

### 1. `.env`
- 更新API基础URL为本地后端服务: `http://127.0.0.1:5000`

### 2. `src/api/model3d.ts`
- 添加了3D文件加载器导入（GLTFLoader, OBJLoader, FBXLoader）
- 重写`textTo3D`方法，实现简化流程
- 添加`downloadModel`方法用于手动下载
- 添加`loadModelFromBlob`函数处理下载的模型文件

### 3. `src/types/3d.ts`
- 为`Model3D`接口添加`jobId`字段

### 4. `src/stores/model3d.ts`
- 导入`loadModelFromBlob`函数
- 重写`generateFromText`方法，实现简化流程：
  - 提交任务后直接尝试下载
  - 保存`jobId`到模型对象
  - 处理模型文件解析
  - 如果解析失败，降级使用模拟数据
- 添加`downloadModelManually`方法用于手动重试下载

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

### 下载模型文件
**GET** `/api/download/{job_id}/0`
- 返回模型文件的二进制数据（通常是GLTF/GLB格式）

### 查询任务状态（可选，已简化不使用）
**GET** `/api/status/{job_id}`
```json
{
  "ok": true,
  "job_id": "1363443869727195136",
  "status": "DONE",
  "files": [...],
  "request_id": "..."
}
```

## 特性

1. **简化流程**: 避免无限轮询，直接尝试下载
2. **错误处理**: 下载失败时提供重试机制
3. **降级处理**: 真实模型解析失败时使用模拟数据
4. **用户体验**: 保存优化后的提示词，显示生成进度

## 使用说明

1. 确保后端服务运行在`http://127.0.0.1:5000`
2. 前端会自动调用简化流程
3. 如果模型下载失败，用户可以点击"重试下载"按钮
4. 支持提示词优化、PBR材质、面数调整等高级选项