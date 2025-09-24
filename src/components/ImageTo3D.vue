<template>
  <div class="image-to-3d">
    <el-card class="generation-card">
      <template #header>
        <div class="card-header">
          <h3>
            <el-icon><Picture /></el-icon>
            图片转3D模型
          </h3>
          <p class="description">上传2D图片，AI将为您生成对应的3D模型</p>
        </div>
      </template>
      
      <el-form
        ref="formRef"
        :model="form"
        :rules="rules"
        label-width="80px"
        @submit.prevent="handleGenerate"
      >
        <el-form-item label="上传图片" prop="imageFile" required>
          <div class="upload-section">
            <el-upload
              ref="uploadRef"
              class="image-uploader"
              :show-file-list="false"
              :before-upload="beforeUpload"
              :on-success="handleUploadSuccess"
              :on-error="handleUploadError"
              accept="image/*"
              :disabled="isGenerating"
              drag
            >
              <div v-if="!previewUrl" class="upload-placeholder">
                <el-icon class="upload-icon"><Plus /></el-icon>
                <div class="upload-text">
                  <p>点击或拖拽图片到此处上传</p>
                  <p class="upload-tip">支持 JPG、PNG、GIF 格式，建议图片大小不超过 10MB</p>
                </div>
              </div>
              <div v-else class="image-preview">
                <img :src="previewUrl" alt="预览图片" />
                <div class="image-overlay">
                  <el-button type="primary" size="small" :icon="Edit">更换图片</el-button>
                </div>
              </div>
            </el-upload>
          </div>
        </el-form-item>
        
        <el-form-item v-if="form.imageFile" label="图片信息">
          <div class="image-info">
            <el-descriptions :column="2" size="small">
              <el-descriptions-item label="文件名">
                {{ form.imageFile.name }}
              </el-descriptions-item>
              <el-descriptions-item label="文件大小">
                {{ formatFileSize(form.imageFile.size) }}
              </el-descriptions-item>
              <el-descriptions-item label="图片类型">
                {{ form.imageFile.type }}
              </el-descriptions-item>
              <el-descriptions-item label="修改时间">
                {{ formatDate(new Date(form.imageFile.lastModified)) }}
              </el-descriptions-item>
            </el-descriptions>
          </div>
        </el-form-item>
        
        <el-form-item label="生成质量" prop="quality">
          <el-radio-group v-model="form.quality" :disabled="isGenerating">
            <el-radio value="low">低质量 (快速生成)</el-radio>
            <el-radio value="medium">中等质量 (推荐)</el-radio>
            <el-radio value="high">高质量 (精细模型)</el-radio>
          </el-radio-group>
        </el-form-item>
        
        <el-form-item label="颜色保持">
          <el-switch
            v-model="form.preserveColors"
            active-text="保持原始颜色"
            inactive-text="自动优化颜色"
            :disabled="isGenerating"
          />
          <p class="form-tip">
            开启后将尽可能保持图片的原始颜色，关闭后AI会自动优化颜色搭配
          </p>
        </el-form-item>
        
        <!-- 图片处理选项 -->
        <el-form-item label="预处理" v-if="form.imageFile">
          <div class="preprocessing-options">
            <el-checkbox-group v-model="preprocessingOptions" :disabled="isGenerating">
              <el-checkbox value="enhance">图片增强</el-checkbox>
              <el-checkbox value="denoise">降噪处理</el-checkbox>
              <el-checkbox value="upscale">智能放大</el-checkbox>
            </el-checkbox-group>
          </div>
        </el-form-item>
        
        <el-form-item>
          <el-button
            type="primary"
            size="large"
            @click="handleGenerate"
            :loading="isGenerating"
            :disabled="!form.imageFile"
            style="width: 100%"
          >
            <el-icon v-if="!isGenerating"><Promotion /></el-icon>
            {{ isGenerating ? '正在生成中...' : '生成3D模型' }}
          </el-button>
        </el-form-item>
      </el-form>
      
      <!-- 生成进度 -->
      <div v-if="isGenerating" class="progress-section">
        <el-divider />
        <div class="progress-content">
          <h4>
            <el-icon class="is-loading"><Loading /></el-icon>
            {{ generationMessage || '正在处理图片并生成3D模型...' }}
          </h4>
          <el-progress
            :percentage="generationProgress"
            :stroke-width="8"
            striped
            striped-flow
            :format="formatProgress"
          />
          <p class="progress-tip">
            {{ getProgressTip() }}
          </p>
        </div>
      </div>
    </el-card>
    
    <!-- 生成历史 -->
    <el-card v-if="imageModels.length > 0" class="history-card">
      <template #header>
        <div class="card-header">
          <h3>
            <el-icon><Clock /></el-icon>
            图片生成历史
          </h3>
          <el-button size="small" @click="clearHistory">清空历史</el-button>
        </div>
      </template>
      
      <div class="history-list">
        <div
          v-for="model in imageModels"
          :key="model.id"
          class="history-item"
          :class="{ 
            active: currentModel?.id === model.id,
            failed: model.status === 'failed'
          }"
          @click="selectModel(model)"
        >
          <div class="history-thumbnail">
            <img :src="model.sourceContent" :alt="model.name" />
          </div>
          
          <div class="history-content">
            <h4>{{ model.name }}</h4>
            <div class="history-meta">
              <el-tag 
                :type="getStatusTagType(model.status)" 
                size="small"
              >
                {{ getStatusText(model.status) }}
              </el-tag>
              <span class="time">{{ formatTime(model.createdAt) }}</span>
            </div>
          </div>
          
          <div class="history-actions">
            <el-button 
              size="small" 
              type="primary" 
              plain
              @click.stop="selectModel(model)"
              :disabled="model.status !== 'completed'"
            >
              查看
            </el-button>
            <el-button 
              size="small" 
              type="danger" 
              plain
              @click.stop="removeModel(model.id)"
            >
              删除
            </el-button>
          </div>
        </div>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive } from 'vue'
import { ElMessage, ElMessageBox, type FormInstance, type UploadInstance } from 'element-plus'
import { 
  Picture, 
  Plus, 
  Edit,
  Promotion, 
  Loading, 
  Clock 
} from '@element-plus/icons-vue'
import { useModel3DStore } from '../stores/model3d'
import type { ImageTo3DRequest } from '../types/3d'

// Store
const model3dStore = useModel3DStore()

// 引用
const formRef = ref<FormInstance>()
const uploadRef = ref<UploadInstance>()

// 表单数据
const form = reactive<ImageTo3DRequest>({
  imageFile: null as any,
  quality: 'medium',
  preserveColors: true
})

// 图片预览URL
const previewUrl = ref<string>('')

// 预处理选项
const preprocessingOptions = ref<string[]>([])

// 表单验证规则
const rules = {
  imageFile: [
    { required: true, message: '请上传图片文件', trigger: 'change' }
  ]
}

// 计算属性
const isGenerating = computed(() => model3dStore.isGenerating)
const generationProgress = computed(() => model3dStore.generationProgress)
const generationMessage = computed(() => model3dStore.generationMessage)
const currentModel = computed(() => model3dStore.currentModel)
const imageModels = computed(() => 
  // 显示用户的图片模型
  model3dStore.userImageModels
)

// 方法
function beforeUpload(file: File): boolean {
  // 检查文件类型
  const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
  if (!validTypes.includes(file.type)) {
    ElMessage.error('只支持 JPG、PNG、GIF、WebP 格式的图片')
    return false
  }
  
  // 检查文件大小 (10MB)
  const maxSize = 10 * 1024 * 1024
  if (file.size > maxSize) {
    ElMessage.error('图片大小不能超过 10MB')
    return false
  }
  
  // 设置文件和预览
  form.imageFile = file
  previewUrl.value = URL.createObjectURL(file)
  
  ElMessage.success('图片上传成功')
  return false // 阻止自动上传
}

function handleUploadSuccess() {
  // 不会被调用，因为设置了 beforeUpload 返回 false
}

function handleUploadError() {
  ElMessage.error('图片上传失败')
}

async function handleGenerate() {
  if (!formRef.value) return
  
  try {
    // 验证表单
    const valid = await formRef.value.validate()
    if (!valid) return
    
    if (!form.imageFile) {
      ElMessage.warning('请先上传图片')
      return
    }
    
    // 确认生成
    if (isGenerating.value) {
      ElMessage.warning('正在生成中，请等待完成')
      return
    }
    
    ElMessage.info('开始分析图片并生成3D模型，请稍候...')
    
    // 调用生成接口
    const result = await model3dStore.generateFromImage({
      imageFile: form.imageFile,
      quality: form.quality,
      preserveColors: form.preserveColors
    })
    
    if (result) {
      ElMessage.success('3D模型生成成功！')
    } else {
      ElMessage.error('模型生成失败，请重试')
    }
  } catch (error) {
    console.error('生成失败:', error)
    ElMessage.error('生成过程中发生错误')
  }
}

function selectModel(model: any) {
  if (model.status === 'completed') {
    model3dStore.setCurrentModel(model)
    ElMessage.success(`已选择模型：${model.name}`)
  }
}

async function removeModel(id: string) {
  try {
    await ElMessageBox.confirm(
      '确定要删除这个模型吗？删除后无法恢复。',
      '确认删除',
      {
        confirmButtonText: '删除',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
    
    model3dStore.removeModel(id)
    ElMessage.success('模型已删除')
  } catch {
    // 用户取消删除
  }
}

async function clearHistory() {
  if (imageModels.value.length === 0) return
  
  try {
    await ElMessageBox.confirm(
      '确定要清空所有图片生成历史吗？此操作无法撤销。',
      '确认清空',
      {
        confirmButtonText: '清空',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
    
    // 只删除图片类型的模型
    imageModels.value.forEach(model => {
      model3dStore.removeModel(model.id)
    })
    
    ElMessage.success('历史记录已清空')
  } catch {
    // 用户取消
  }
}

function formatProgress(percentage: number): string {
  return `${percentage}%`
}

function getProgressTip(): string {
  const progress = generationProgress.value
  if (progress < 20) return '正在分析图片内容...'
  if (progress < 40) return '正在提取深度信息...'
  if (progress < 60) return '正在构建3D网格...'
  if (progress < 80) return '正在生成纹理贴图...'
  if (progress < 100) return '正在优化模型质量...'
  return '生成完成！'
}

function getStatusTagType(status: string) {
  switch (status) {
    case 'completed': return 'success'
    case 'generating': return 'warning'
    case 'failed': return 'danger'
    default: return 'info'
  }
}

function getStatusText(status: string) {
  switch (status) {
    case 'completed': return '已完成'
    case 'generating': return '生成中'
    case 'failed': return '失败'
    default: return '未知'
  }
}

function formatTime(date: Date): string {
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const minutes = Math.floor(diff / 60000)
  
  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes}分钟前`
  
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}小时前`
  
  return date.toLocaleDateString('zh-CN')
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

function formatDate(date: Date): string {
  return date.toLocaleString('zh-CN')
}
</script>

<style scoped>
.image-to-3d {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.generation-card {
  max-width: 100%;
}

.card-header h3 {
  margin: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  color: #303133;
  font-size: 18px;
}

.card-header .description {
  margin: 8px 0 0 0;
  color: #909399;
  font-size: 14px;
}

.upload-section {
  width: 100%;
}

.image-uploader :deep(.el-upload) {
  width: 100%;
}

.image-uploader :deep(.el-upload-dragger) {
  width: 100%;
  height: 200px;
  border: 2px dashed #d9d9d9;
  border-radius: 8px;
  position: relative;
  overflow: hidden;
}

.upload-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #8c939d;
}

.upload-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.upload-text p {
  margin: 4px 0;
}

.upload-tip {
  font-size: 12px;
  color: #a8abb2;
}

.image-preview {
  position: relative;
  width: 100%;
  height: 100%;
}

.image-preview img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.image-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.3s;
}

.image-preview:hover .image-overlay {
  opacity: 1;
}

.image-info {
  width: 100%;
}

.form-tip {
  font-size: 12px;
  color: #909399;
  margin: 8px 0 0 0;
}

.preprocessing-options {
  width: 100%;
}

.progress-section {
  margin-top: 16px;
}

.progress-content {
  padding: 16px 0;
}

.progress-content h4 {
  margin: 0 0 16px 0;
  display: flex;
  align-items: center;
  gap: 8px;
  color: #409eff;
}

.progress-tip {
  margin: 8px 0 0 0;
  font-size: 14px;
  color: #666;
  text-align: center;
}

.history-card {
  max-width: 100%;
}

.history-card .card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.history-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.history-item {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s;
}

.history-item:hover {
  border-color: #409eff;
  box-shadow: 0 2px 8px rgba(64, 158, 255, 0.1);
}

.history-item.active {
  border-color: #409eff;
  background-color: #f0f8ff;
}

.history-item.failed {
  border-color: #f56c6c;
  background-color: #fef0f0;
}

.history-thumbnail {
  width: 60px;
  height: 60px;
  border-radius: 6px;
  overflow: hidden;
  flex-shrink: 0;
}

.history-thumbnail img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.history-content {
  flex: 1;
  min-width: 0;
}

.history-content h4 {
  margin: 0 0 8px 0;
  font-size: 16px;
  color: #303133;
}

.history-meta {
  display: flex;
  align-items: center;
  gap: 12px;
}

.time {
  font-size: 12px;
  color: #999;
}

.history-actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}

@media (max-width: 768px) {
  .history-item {
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
  }
  
  .history-actions {
    justify-content: flex-end;
  }
  
  .image-uploader :deep(.el-upload-dragger) {
    height: 150px;
  }
}
</style>