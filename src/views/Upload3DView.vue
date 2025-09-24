<template>
  <div class="upload-3d-view">
    <!-- 页面头部 -->
    <div class="page-header">
      <h1>3D模型上传</h1>
      <p class="page-description">
        上传您的3D模型文件，支持多种格式，快速导入并查看您的3D作品
      </p>
    </div>

    <!-- 主要内容区域 -->
    <div class="main-content">
      <el-row :gutter="24">
        <!-- 左侧：上传区域 -->
        <el-col :lg="12" :md="24">
          <el-card class="upload-card">
            <template #header>
              <div class="card-header">
                <h3>文件上传</h3>
                <el-tag type="info" size="small">支持批量上传</el-tag>
              </div>
            </template>
            
            <Upload3D
              @upload-success="handleUploadSuccess"
              @upload-error="handleUploadError"
            />
          </el-card>
        </el-col>

        <!-- 右侧：预览区域 -->
        <el-col :lg="12" :md="24">
          <el-card class="preview-card">
            <template #header>
              <div class="card-header">
                <h3>模型预览</h3>
                <div class="header-actions">
                  <el-button 
                    v-if="selectedModel"
                    @click="goToGallery"
                    type="primary"
                    size="small"
                  >
                    查看画廊
                  </el-button>
                </div>
              </div>
            </template>
            
            <ModelViewer
              :model="selectedModel"
              :height="400"
              :config="viewerConfig"
              @export="handleModelExport"
            />
          </el-card>
        </el-col>
      </el-row>

      <!-- 最近上传的模型 -->
      <div v-if="recentModels.length > 0" class="recent-models">
        <h3>最近上传</h3>
        <div class="models-grid">
          <div
            v-for="model in recentModels"
            :key="model.id"
            class="model-card"
            :class="{ 'is-selected': selectedModel?.id === model.id }"
            @click="selectModel(model)"
          >
            <div class="model-thumbnail">
              <el-icon size="32" color="#409eff">
                <Box />
              </el-icon>
            </div>
            <div class="model-info">
              <h4>{{ model.name }}</h4>
              <p class="model-meta">
                {{ formatDate(model.createdAt) }}
              </p>
              <div v-if="model.fileInfo" class="file-meta">
                <el-tag size="small">{{ model.fileInfo.format.toUpperCase() }}</el-tag>
                <span class="file-size">{{ formatFileSize(model.fileInfo.size) }}</span>
              </div>
            </div>
            <div class="model-actions">
              <el-button
                @click.stop="selectModel(model)"
                :type="selectedModel?.id === model.id ? 'primary' : ''"
                size="small"
              >
                {{ selectedModel?.id === model.id ? '已选中' : '选择' }}
              </el-button>
              <el-dropdown @command="(command: string) => handleModelAction(command, model)" trigger="click">
                <el-button size="small" circle>
                  <el-icon><MoreFilled /></el-icon>
                </el-button>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item command="rename">重命名</el-dropdown-item>
                    <el-dropdown-item command="download">下载</el-dropdown-item>
                    <el-dropdown-item command="delete" divided>删除</el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </div>
          </div>
        </div>
      </div>

      <!-- 上传统计 -->
      <div class="upload-stats">
        <el-row :gutter="16">
          <el-col :sm="6" :xs="12">
            <el-statistic title="总计上传" :value="totalUploaded" />
          </el-col>
          <el-col :sm="6" :xs="12">
            <el-statistic title="成功上传" :value="successfulUploads" />
          </el-col>
          <el-col :sm="6" :xs="12">
            <el-statistic title="总计文件大小" :value="totalFileSize" suffix="MB" />
          </el-col>
          <el-col :sm="6" :xs="12">
            <el-statistic title="支持格式" :value="supportedFormatsCount" />
          </el-col>
        </el-row>
      </div>
    </div>

    <!-- 重命名对话框 -->
    <el-dialog
      v-model="renameDialogVisible"
      title="重命名模型"
      width="400px"
    >
      <el-form @submit.prevent="confirmRename">
        <el-form-item label="新名称">
          <el-input
            v-model="newModelName"
            placeholder="请输入新的模型名称"
            maxlength="100"
            show-word-limit
            ref="renameInput"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="renameDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="confirmRename">确认</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Box, MoreFilled } from '@element-plus/icons-vue'
import Upload3D from '../components/Upload3D.vue'
import ModelViewer from '../components/ModelViewer.vue'
import { useModel3DStore } from '../stores/model3d'
import { fileLoader } from '../utils/fileLoader'
import type { Model3D, ViewerConfig, ExportFormat } from '../types/3d'

// 路由和store
const router = useRouter()
const model3dStore = useModel3DStore()

// 状态
const selectedModel = ref<Model3D | null>(null)
const renameDialogVisible = ref(false)
const newModelName = ref('')
const modelToRename = ref<Model3D | null>(null)
const renameInput = ref()

// 查看器配置
const viewerConfig: ViewerConfig = {
  enableControls: true,
  enableAnimation: true,
  backgroundColor: '#f5f5f5',
  cameraPosition: { x: 5, y: 5, z: 5 },
  lightIntensity: 1.2
}

// 计算属性
const recentModels = computed(() => {
  return model3dStore.userUploadModels.slice(0, 6) // 显示最近6个用户上传模型
})

const totalUploaded = computed(() => 
  model3dStore.userUploadModels.length
)

const successfulUploads = computed(() => 
  model3dStore.userUploadModels.filter(model => model.status === 'completed').length
)

const totalFileSize = computed(() => {
  const totalBytes = model3dStore.userUploadModels
    .filter(model => model.fileInfo)
    .reduce((sum, model) => sum + (model.fileInfo?.size || 0), 0)
  return (totalBytes / (1024 * 1024)).toFixed(2)
})

const supportedFormatsCount = computed(() => 
  fileLoader.getSupportedFormats().length
)

// 生命周期
onMounted(() => {
  // 如果有当前模型，选中它
  if (model3dStore.currentModel) {
    selectedModel.value = model3dStore.currentModel
  }
})

// 方法
function handleUploadSuccess(modelId: string) {
  const model = model3dStore.getModelById(modelId)
  if (model) {
    selectedModel.value = model
    ElMessage.success('文件上传成功！')
  }
}

function handleUploadError(error: string) {
  ElMessage.error(`上传失败: ${error}`)
}

function selectModel(model: Model3D) {
  selectedModel.value = model
  model3dStore.setCurrentModel(model)
}

function handleModelExport(format: ExportFormat, data: string) {
  ElMessage.success(`模型已导出为 ${format.toUpperCase()} 格式`)
}

function handleModelAction(command: string, model: Model3D) {
  switch (command) {
    case 'rename':
      startRename(model)
      break
    case 'download':
      downloadModel(model)
      break
    case 'delete':
      deleteModel(model)
      break
  }
}

function startRename(model: Model3D) {
  modelToRename.value = model
  newModelName.value = model.name
  renameDialogVisible.value = true
  
  nextTick(() => {
    renameInput.value?.focus()
  })
}

function confirmRename() {
  if (!modelToRename.value || !newModelName.value.trim()) {
    ElMessage.warning('请输入有效的模型名称')
    return
  }
  
  // 这里可以添加重命名逻辑到store
  modelToRename.value.name = newModelName.value.trim()
  
  ElMessage.success('重命名成功')
  renameDialogVisible.value = false
  modelToRename.value = null
  newModelName.value = ''
}

async function downloadModel(model: Model3D) {
  try {
    if (!model.fileInfo) {
      ElMessage.warning('无法下载此模型')
      return
    }
    
    // 这里可以实现下载逻辑
    ElMessage.info('下载功能开发中...')
  } catch (error) {
    ElMessage.error('下载失败')
  }
}

function deleteModel(model: Model3D) {
  ElMessageBox.confirm(
    `确定要删除模型 "${model.name}" 吗？此操作不可恢复。`,
    '确认删除',
    {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning',
      confirmButtonClass: 'el-button--danger'
    }
  ).then(() => {
    model3dStore.removeModel(model.id)
    
    // 如果删除的是当前选中的模型，清空选择
    if (selectedModel.value?.id === model.id) {
      selectedModel.value = null
    }
    
    ElMessage.success('模型已删除')
  }).catch(() => {
    // 用户取消删除
  })
}

function goToGallery() {
  router.push('/gallery')
}

function formatDate(date: Date): string {
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  
  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes}分钟前`
  if (hours < 24) return `${hours}小时前`
  if (days < 7) return `${days}天前`
  
  return date.toLocaleDateString('zh-CN')
}

function formatFileSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB']
  let size = bytes
  let unitIndex = 0

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex++
  }

  return `${size.toFixed(1)} ${units[unitIndex]}`
}
</script>

<style scoped>
.upload-3d-view {
  padding: 24px;
  max-width: 1400px;
  margin: 0 auto;
}

.page-header {
  text-align: center;
  margin-bottom: 32px;
}

.page-header h1 {
  font-size: 32px;
  color: #303133;
  margin-bottom: 8px;
}

.page-description {
  font-size: 16px;
  color: #606266;
  max-width: 600px;
  margin: 0 auto;
  line-height: 1.6;
}

.main-content {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.upload-card,
.preview-card {
  height: fit-content;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.card-header h3 {
  margin: 0;
  color: #303133;
}

.header-actions {
  display: flex;
  gap: 8px;
}

.recent-models {
  margin-top: 32px;
}

.recent-models h3 {
  margin-bottom: 16px;
  color: #303133;
  font-size: 20px;
}

.models-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}

.model-card {
  border: 1px solid #ebeef5;
  border-radius: 8px;
  padding: 16px;
  cursor: pointer;
  transition: all 0.3s ease;
  background: #fff;
}

.model-card:hover {
  border-color: #409eff;
  box-shadow: 0 4px 12px rgba(64, 158, 255, 0.15);
}

.model-card.is-selected {
  border-color: #409eff;
  background: #f0f9ff;
}

.model-thumbnail {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 80px;
  background: #f5f7fa;
  border-radius: 6px;
  margin-bottom: 12px;
}

.model-info h4 {
  margin: 0 0 4px;
  color: #303133;
  font-size: 16px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.model-meta {
  margin: 0 0 8px;
  color: #909399;
  font-size: 12px;
}

.file-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.file-size {
  font-size: 12px;
  color: #909399;
}

.model-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.upload-stats {
  margin-top: 32px;
  padding: 24px;
  background: #f8f9fa;
  border-radius: 8px;
}

@media (max-width: 768px) {
  .upload-3d-view {
    padding: 16px;
  }
  
  .page-header h1 {
    font-size: 24px;
  }
  
  .models-grid {
    grid-template-columns: 1fr;
  }
  
  .model-card {
    padding: 12px;
  }
  
  .model-actions {
    flex-direction: column;
    gap: 8px;
    align-items: stretch;
  }
}
</style>