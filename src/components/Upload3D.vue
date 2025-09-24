<template>
  <div class="upload-3d">
    <!-- 上传区域 -->
    <div 
      ref="dropZone"
      class="upload-zone"
      :class="{ 
        'is-dragover': isDragOver, 
        'is-uploading': isUploading,
        'has-error': uploadError 
      }"
      @drop="handleDrop"
      @dragover="handleDragOver"
      @dragleave="handleDragLeave"
      @click="triggerFileSelect"
    >
      <!-- 文件输入 -->
      <input
        ref="fileInput"
        type="file"
        :accept="acceptedTypes"
        @change="handleFileSelect"
        style="display: none"
        multiple
      />
      
      <!-- 上传状态显示 -->
      <div v-if="isUploading" class="upload-status">
        <el-icon class="is-loading" size="48">
          <Loading />
        </el-icon>
        <p class="status-text">正在处理文件...</p>
        <el-progress 
          :percentage="uploadProgress" 
          :stroke-width="6"
          style="width: 280px; margin-top: 16px;"
        />
        <p class="progress-text">{{ progressMessage }}</p>
      </div>
      
      <!-- 错误状态 -->
      <div v-else-if="uploadError" class="error-state">
        <el-icon size="48" color="#f56c6c">
          <Close />
        </el-icon>
        <p class="error-text">{{ uploadError }}</p>
        <el-button @click="clearError" type="primary" size="small">
          重新上传
        </el-button>
      </div>
      
      <!-- 默认上传界面 -->
      <div v-else class="upload-content">
        <el-icon size="64" color="#409eff">
          <UploadFilled />
        </el-icon>
        <h3>上传3D模型</h3>
        <p class="upload-tip">
          将文件拖拽到此处，或<span class="link-text">点击上传</span>
        </p>
        <div class="format-info">
          <p class="supported-formats">
            支持格式：{{ supportedFormats.join(', ').toUpperCase() }}
          </p>
          <p class="size-limit">最大文件大小：50MB</p>
        </div>
      </div>
    </div>
    
    <!-- 上传选项 -->
    <div v-if="!isUploading && !uploadError" class="upload-options">
      <el-form :model="uploadOptions" label-position="top" size="small">
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="模型名称">
              <el-input 
                v-model="uploadOptions.name"
                placeholder="自定义模型名称（可选）"
                clearable
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="描述">
              <el-input 
                v-model="uploadOptions.description"
                placeholder="模型描述（可选）"
                clearable
              />
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>
    </div>
    
    <!-- 文件队列 -->
    <div v-if="fileQueue.length > 0" class="file-queue">
      <h4>待处理文件</h4>
      <div class="file-list">
        <div 
          v-for="(file, index) in fileQueue" 
          :key="index"
          class="file-item"
          :class="{ 'is-processing': file.isProcessing, 'is-error': file.error }"
        >
          <div class="file-info">
            <el-icon size="20">
              <Document />
            </el-icon>
            <div class="file-details">
              <p class="file-name">{{ file.file.name }}</p>
              <p class="file-meta">
                {{ formatFileSize(file.file.size) }} • {{ getFileFormat(file.file.name) }}
              </p>
            </div>
          </div>
          
          <div class="file-actions">
            <el-button 
              v-if="!file.isProcessing && !file.error"
              @click="processFile(index)"
              type="primary"
              size="small"
            >
              处理
            </el-button>
            <el-button 
              @click="removeFile(index)"
              type="danger"
              size="small"
              :disabled="file.isProcessing"
            >
              移除
            </el-button>
          </div>
          
          <!-- 文件处理状态 -->
          <div v-if="file.isProcessing" class="file-progress">
            <el-progress :percentage="file.progress" :stroke-width="4" />
          </div>
          
          <!-- 错误信息 -->
          <div v-if="file.error" class="file-error">
            <p>{{ file.error }}</p>
          </div>
        </div>
      </div>
      
      <div class="queue-actions">
        <el-button @click="processAllFiles" type="primary" :disabled="isProcessingAny">
          处理所有文件
        </el-button>
        <el-button @click="clearQueue" :disabled="isProcessingAny">
          清空队列
        </el-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { ElMessage } from 'element-plus'
import { 
  Loading, 
  Close, 
  UploadFilled, 
  Document 
} from '@element-plus/icons-vue'
import { fileLoader } from '../utils/fileLoader'
import { useModel3DStore } from '../stores/model3d'
import type { Upload3DRequest } from '../types/3d'

interface FileQueueItem {
  file: File
  isProcessing: boolean
  progress: number
  error?: string
}

interface UploadOptions {
  name: string
  description: string
}

const emit = defineEmits<{
  'upload-success': [modelId: string]
  'upload-error': [error: string]
}>()

// 状态
const dropZone = ref<HTMLElement>()
const fileInput = ref<HTMLInputElement>()
const isDragOver = ref(false)
const isUploading = ref(false)
const uploadProgress = ref(0)
const progressMessage = ref('')
const uploadError = ref('')
const fileQueue = ref<FileQueueItem[]>([])

// 上传选项
const uploadOptions = ref<UploadOptions>({
  name: '',
  description: ''
})

// Store
const model3dStore = useModel3DStore()

// 支持的格式
const supportedFormats = ref(fileLoader.getSupportedFormats())
const acceptedTypes = computed(() => 
  supportedFormats.value.map(format => `.${format}`).join(',')
)

// 计算属性
const isProcessingAny = computed(() => 
  fileQueue.value.some(item => item.isProcessing)
)

// 生命周期
onMounted(() => {
  setupDragAndDrop()
})

onUnmounted(() => {
  removeDragAndDrop()
})

// 方法
function setupDragAndDrop() {
  // 阻止全局拖拽事件
  document.addEventListener('dragover', preventDefaults)
  document.addEventListener('drop', preventDefaults)
}

function removeDragAndDrop() {
  document.removeEventListener('dragover', preventDefaults)
  document.removeEventListener('drop', preventDefaults)
}

function preventDefaults(e: Event) {
  e.preventDefault()
  e.stopPropagation()
}

function handleDragOver(e: DragEvent) {
  e.preventDefault()
  isDragOver.value = true
}

function handleDragLeave(e: DragEvent) {
  e.preventDefault()
  isDragOver.value = false
}

function handleDrop(e: DragEvent) {
  e.preventDefault()
  isDragOver.value = false
  
  const files = Array.from(e.dataTransfer?.files || [])
  addFilesToQueue(files)
}

function triggerFileSelect() {
  if (isUploading.value) return
  fileInput.value?.click()
}

function handleFileSelect(e: Event) {
  const target = e.target as HTMLInputElement
  const files = Array.from(target.files || [])
  addFilesToQueue(files)
  
  // 清空input值，允许重复选择同一文件
  if (target) target.value = ''
}

function addFilesToQueue(files: File[]) {
  for (const file of files) {
    // 验证文件
    const validation = fileLoader.validateFile(file)
    
    if (!validation.isValid) {
      ElMessage.error(`${file.name}: ${validation.error}`)
      continue
    }
    
    // 检查是否已存在
    const exists = fileQueue.value.some(item => 
      item.file.name === file.name && item.file.size === file.size
    )
    
    if (exists) {
      ElMessage.warning(`文件 ${file.name} 已在队列中`)
      continue
    }
    
    // 添加到队列
    fileQueue.value.push({
      file,
      isProcessing: false,
      progress: 0
    })
  }
  
  if (files.length === 1 && fileQueue.value.length === 1) {
    // 单文件上传时自动填充名称
    if (!uploadOptions.value.name) {
      const baseName = files[0]?.name?.split('.')[0]
      if (baseName) {
        uploadOptions.value.name = baseName
      }
    }
  }
}

async function processFile(index: number) {
  const item = fileQueue.value[index]
  if (!item || item.isProcessing) return
  
  item.isProcessing = true
  item.progress = 0
  item.error = undefined
  
  try {
    // 加载文件
    const result = await fileLoader.loadFile(item.file, (progress) => {
      item.progress = Math.floor(progress)
    })
    
    if (!result.success) {
      throw new Error(result.error || '文件处理失败')
    }
    
    // 创建模型
    const request: Upload3DRequest = {
      file: item.file,
      name: uploadOptions.value.name || item.file.name.split('.')[0],
      description: uploadOptions.value.description
    }
    
    // 传统的模型创建方式（使用现有的addModel方法）
    const model = model3dStore.createUploadedModel(request, result)
    
    if (model) {
      ElMessage.success(`${item.file.name} 上传成功`)
      emit('upload-success', model.id)
      
      // 从队列中移除
      fileQueue.value.splice(index, 1)
      
      // 清空选项（如果队列为空）
      if (fileQueue.value.length === 0) {
        uploadOptions.value.name = ''
        uploadOptions.value.description = ''
      }
    } else {
      throw new Error('模型创建失败')
    }
  } catch (error) {
    console.error('文件处理失败:', error)
    item.error = error instanceof Error ? error.message : '未知错误'
    ElMessage.error(`${item.file.name} 处理失败: ${item.error}`)
    emit('upload-error', item.error)
  } finally {
    item.isProcessing = false
    item.progress = 0
  }
}

async function processAllFiles() {
  for (let i = 0; i < fileQueue.value.length; i++) {
    const item = fileQueue.value[i]
    if (item && !item.isProcessing && !item.error) {
      await processFile(i)
    }
  }
}

function removeFile(index: number) {
  const item = fileQueue.value[index]
  if (!item) return
  
  if (item.isProcessing) {
    ElMessage.warning('文件正在处理中，无法移除')
    return
  }
  
  fileQueue.value.splice(index, 1)
}

function clearQueue() {
  if (isProcessingAny.value) {
    ElMessage.warning('有文件正在处理中，无法清空队列')
    return
  }
  
  fileQueue.value = []
  uploadOptions.value.name = ''
  uploadOptions.value.description = ''
}

function clearError() {
  uploadError.value = ''
}

function formatFileSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB']
  let size = bytes
  let unitIndex = 0

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex++
  }

  return `${size.toFixed(2)} ${units[unitIndex]}`
}

function getFileFormat(fileName: string): string {
  const extension = fileName.split('.').pop()?.toLowerCase()
  return extension ? extension.toUpperCase() : 'Unknown'
}
</script>

<style scoped>
.upload-3d {
  max-width: 800px;
  margin: 0 auto;
}

.upload-zone {
  border: 2px dashed #dcdfe6;
  border-radius: 8px;
  padding: 40px;
  text-align: center;
  cursor: pointer;
  transition: all 0.3s ease;
  background: #fafafa;
  min-height: 200px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.upload-zone:hover {
  border-color: #409eff;
  background: #f0f9ff;
}

.upload-zone.is-dragover {
  border-color: #409eff;
  background: #f0f9ff;
  transform: scale(1.02);
}

.upload-zone.is-uploading {
  border-color: #e6a23c;
  background: #fdf6ec;
  cursor: not-allowed;
}

.upload-zone.has-error {
  border-color: #f56c6c;
  background: #fef0f0;
}

.upload-content h3 {
  margin: 16px 0 8px;
  color: #303133;
  font-size: 18px;
}

.upload-tip {
  color: #606266;
  margin: 8px 0 16px;
  font-size: 14px;
}

.link-text {
  color: #409eff;
  font-weight: 500;
}

.format-info {
  margin-top: 16px;
}

.supported-formats {
  color: #909399;
  font-size: 12px;
  margin: 4px 0;
}

.size-limit {
  color: #909399;
  font-size: 12px;
  margin: 4px 0;
}

.upload-status {
  text-align: center;
}

.status-text {
  margin: 16px 0 8px;
  color: #303133;
  font-size: 16px;
  font-weight: 500;
}

.progress-text {
  margin-top: 8px;
  color: #606266;
  font-size: 14px;
}

.error-state {
  text-align: center;
}

.error-text {
  margin: 16px 0;
  color: #f56c6c;
  font-size: 14px;
}

.upload-options {
  margin-top: 24px;
  padding: 20px;
  background: #f8f9fa;
  border-radius: 8px;
}

.file-queue {
  margin-top: 24px;
}

.file-queue h4 {
  margin-bottom: 16px;
  color: #303133;
}

.file-list {
  border: 1px solid #ebeef5;
  border-radius: 6px;
  overflow: hidden;
}

.file-item {
  padding: 16px;
  border-bottom: 1px solid #ebeef5;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #fff;
  transition: background-color 0.3s ease;
}

.file-item:last-child {
  border-bottom: none;
}

.file-item.is-processing {
  background: #f0f9ff;
}

.file-item.is-error {
  background: #fef0f0;
}

.file-info {
  display: flex;
  align-items: center;
  flex: 1;
}

.file-details {
  margin-left: 12px;
}

.file-name {
  margin: 0 0 4px;
  font-weight: 500;
  color: #303133;
}

.file-meta {
  margin: 0;
  font-size: 12px;
  color: #909399;
}

.file-actions {
  display: flex;
  gap: 8px;
}

.file-progress {
  width: 100%;
  margin-top: 12px;
}

.file-error {
  width: 100%;
  margin-top: 8px;
}

.file-error p {
  margin: 0;
  color: #f56c6c;
  font-size: 12px;
}

.queue-actions {
  margin-top: 16px;
  text-align: center;
}

.queue-actions .el-button {
  margin: 0 8px;
}

@media (max-width: 768px) {
  .upload-zone {
    padding: 24px 16px;
  }
  
  .file-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }
  
  .file-actions {
    width: 100%;
    justify-content: flex-end;
  }
}
</style>