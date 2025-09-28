# 文本转3D功能实现说明

根据用户需求，已实现完整的文本转3D功能流程，包括模型格式选择和下载显示。

## 实现的API流程

1. 调用 `/api/submit-text` 提交任务
2. 轮询 `/api/status/{job_id}` 检查状态
3. 当状态为DONE时调用 `/api/download/{job_id}/{format_index}` 下载模型
   - format_index: 0表示OBJ格式，1表示GLB格式
4. 解析并显示模型

## 核心功能实现

### 1. 模型格式选择
- 在前端界面添加了格式选择控件（OBJ/GLB）
- 默认选择OBJ格式（索引0）
- 用户可切换到GLB格式（索引1）

### 2. 完整流程处理
- 提交文本转3D任务获取job_id
- 轮询任务状态直到完成
- 根据用户选择的格式下载对应模型文件
- 解析并显示3D模型

### 3. 错误处理
- 轮询超时处理
- 下载失败重试机制
- 模型解析失败降级处理

## 文件修改说明

### src/components/TextTo3D.vue
- 添加模型格式选择控件（OBJ/GLB单选框）
- 在表单数据中添加modelFormat字段
- 更新示例数据包含格式选择
- 传递modelFormat参数到生成接口

### src/types/3d.ts
- 在TextTo3DRequest接口中添加modelFormat字段

### src/stores/model3d.ts
- generateFromText方法已支持传递modelFormat参数
- pollJobStatus方法已支持指定格式下载模型

### src/api/model3d.ts
- downloadModel方法已支持指定文件索引参数

## 使用说明

1. 用户在文本转3D界面输入描述文本
2. 可选择生成参数（提示词优化、PBR材质、面数等）
3. 选择模型格式（OBJ或GLB）
4. 点击生成按钮开始处理
5. 系统自动提交任务、轮询状态、下载模型
6. 下载完成后解析并显示3D模型

## 技术细节

- 使用Three.js库解析OBJ和GLB格式模型
- 支持轮询超时处理（最多30次轮询）
- 提供下载失败重试功能
- 实现模型缓存机制提升性能