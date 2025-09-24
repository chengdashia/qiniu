<template>
  <div class="model-detail-view">
    <div class="view-header">
      <div class="container">
        <el-breadcrumb separator="/">
          <el-breadcrumb-item :to="{ path: '/' }">首页</el-breadcrumb-item>
          <el-breadcrumb-item :to="{ path: '/gallery' }">模型画廊</el-breadcrumb-item>
          <el-breadcrumb-item>{{ model?.name || '模型详情' }}</el-breadcrumb-item>
        </el-breadcrumb>
        
        <div class="header-content">
          <div class="header-left">
            <h1 class="page-title">
              <el-icon><Box /></el-icon>
              {{ model?.name || '模型详情' }}
            </h1>
            <p class="page-description" v-if="model">
              {{ getModelDescription(model) }}
            </p>
          </div>
          
          <div class="header-actions" v-if="model">
            <el-button @click="goBack">
              <el-icon><ArrowLeft /></el-icon>
              返回画廊
            </el-button>
            <el-button type="primary" @click="setAsCurrentModel" v-if="model.status === 'completed'">
              <el-icon><Star /></el-icon>
              设为当前模型
            </el-button>
          </div>
        </div>
      </div>
    </div>
    
    <div class="view-content">
      <div class="container">
        <!-- 模型不存在 -->
        <div v-if="!model" class="not-found">
          <el-icon size="80" color="#c0c4cc"><DocumentDelete /></el-icon>
          <h3>模型不存在</h3>
          <p>您访问的模型可能已被删除或不存在</p>
          <el-button type="primary" @click="goBack">
            <el-icon><ArrowLeft /></el-icon>
            返回画廊
          </el-button>
        </div>
        
        <!-- 模型详情 -->
        <div v-else class="model-detail">
          <div class="detail-layout">
            <!-- 左侧：3D预览 -->
            <div class="preview-section">
              <div class="preview-card">
                <div class="card-header">
                  <h3>3D预览</h3>
                  <el-tag 
                    :type="getStatusTagType(model.status)" 
                    size="large"
                  >
                    {{ getStatusText(model.status) }}
                  </el-tag>
                </div>
                
                <div class="preview-container">
                  <ModelViewer 
                    v-if="model.status === 'completed' && model.geometry"
                    :model="model" 
                    :height="500"
                    :config="{ 
                      enableControls: true, 
                      enableAnimation: true,
                      backgroundColor: '#f8f9fa'
                    }"
                  />
                  <div v-else class="preview-placeholder">
                    <el-icon size="80">
                      <Loading v-if="model.status === 'generating'" />
                      <WarningFilled v-else-if="model.status === 'failed'" />
                      <Box v-else />
                    </el-icon>
                    <h4>{{ getStatusText(model.status) }}</h4>
                    <p v-if="model.status === 'generating'">模型正在生成中，请稍候...</p>
                    <p v-else-if="model.status === 'failed'">模型生成失败，请重新生成</p>
                  </div>
                </div>
              </div>
            </div>
            
            <!-- 右侧：模型信息 -->
            <div class="info-section">
              <!-- 基本信息 -->
              <div class="info-card">
                <h3>基本信息</h3>
                <el-descriptions :column="1" border>
                  <el-descriptions-item label="模型名称">
                    <span class="model-name">{{ model.name }}</span>
                  </el-descriptions-item>
                  <el-descriptions-item label="生成类型">
                    <el-tag :type="getTypeTagType(model.type)">
                      {{ getTypeText(model.type) }}
                    </el-tag>
                  </el-descriptions-item>
                  <el-descriptions-item label="创建时间">
                    {{ formatDetailTime(model.createdAt) }}
                  </el-descriptions-item>
                  <el-descriptions-item label="模型状态">
                    <el-tag :type="getStatusTagType(model.status)">
                      {{ getStatusText(model.status) }}
                    </el-tag>
                  </el-descriptions-item>
                  <el-descriptions-item label="模型ID">
                    <el-text type="info" size="small">{{ model.id }}</el-text>
                  </el-descriptions-item>
                </el-descriptions>
              </div>
              
              <!-- 源内容 -->
              <div class="info-card">
                <h3>源内容</h3>
                <div class="source-content">
                  <div v-if="model.type === 'text'" class="text-source">
                    <el-input
                      type="textarea"
                      :value="model.sourceContent"
                      readonly
                      :rows="4"
                      placeholder="文本内容"
                    />
                  </div>
                  <div v-else-if="model.type === 'image'" class="image-source">
                    <div class="image-preview">
                      <img 
                        v-if="model.sourceContent.startsWith('blob:')"
                        :src="model.sourceContent" 
                        alt="源图片"
                        @error="handleImageError"
                      />
                      <div v-else class="image-placeholder">
                        <el-icon size="48"><Picture /></el-icon>
                        <p>{{ model.sourceContent }}</p>
                      </div>
                    </div>
                  </div>
                  <div v-else class="upload-source">
                    <div class="file-info">
                      <el-icon size="32"><Document /></el-icon>
                      <div class="file-details">
                        <p class="file-name">{{ model.sourceContent }}</p>
                        <p class="file-meta" v-if="model.fileInfo">
                          格式: {{ model.fileInfo.format?.toUpperCase() || 'Unknown' }} | 
                          大小: {{ formatFileSize(model.fileInfo.size) }}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              <!-- 技术信息 -->
              <div class="info-card" v-if="model.fileInfo?.metadata">
                <h3>技术信息</h3>
                <el-descriptions :column="2" border size="small">
                  <el-descriptions-item label="顶点数" v-if="model.fileInfo.metadata.vertices">
                    {{ model.fileInfo.metadata.vertices.toLocaleString() }}
                  </el-descriptions-item>
                  <el-descriptions-item label="面数" v-if="model.fileInfo.metadata.faces">
                    {{ model.fileInfo.metadata.faces.toLocaleString() }}
                  </el-descriptions-item>
                  <el-descriptions-item label="材质数" v-if="model.fileInfo.metadata.materials">
                    {{ model.fileInfo.metadata.materials }}
                  </el-descriptions-item>
                  <el-descriptions-item label="贴图数" v-if="model.fileInfo.metadata.textures">
                    {{ model.fileInfo.metadata.textures }}
                  </el-descriptions-item>
                </el-descriptions>
              </div>
              
              <!-- 操作按钮 -->
              <div class="action-card" v-if="model.status === 'completed'">
                <h3>
                  <el-icon><Setting /></el-icon>
                  操作
                </h3>
                <div class="action-buttons">
                  <!-- 主要操作 -->
                  <div class="primary-actions">
                    <el-button 
                      type="primary" 
                      size="large"
                      @click="setAsCurrentModel"
                      class="action-btn primary-btn"
                    >
                      <el-icon><Star /></el-icon>
                      设为当前模型
                    </el-button>
                    
                    <el-dropdown @command="handleExportAction" trigger="click" class="export-dropdown">
                      <el-button 
                        type="success" 
                        size="large"
                        class="action-btn export-btn"
                      >
                        <el-icon><Download /></el-icon>
                        导出模型<el-icon class="el-icon--right"><ArrowDown /></el-icon>
                      </el-button>
                      <template #dropdown>
                        <el-dropdown-menu class="export-menu">
                          <el-dropdown-item command="obj">
                            <el-icon><Document /></el-icon>
                            导出 OBJ 格式
                          </el-dropdown-item>
                          <el-dropdown-item command="stl">
                            <el-icon><Document /></el-icon>
                            导出 STL 格式
                          </el-dropdown-item>
                          <el-dropdown-item command="gltf">
                            <el-icon><Document /></el-icon>
                            导出 GLTF 格式
                          </el-dropdown-item>
                        </el-dropdown-menu>
                      </template>
                    </el-dropdown>
                  </div>
                  
                  <!-- 辅助操作 -->
                  <div class="secondary-actions">
                    <el-button 
                      type="warning" 
                      size="large"
                      @click="handleEdit"
                      class="action-btn edit-btn"
                    >
                      <el-icon><Edit /></el-icon>
                      编辑信息
                    </el-button>
                    
                    <el-button 
                      type="danger" 
                      size="large"
                      @click="handleDelete"
                      class="action-btn delete-btn"
                    >
                      <el-icon><Delete /></el-icon>
                      删除模型
                    </el-button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <!-- 编辑对话框 -->
    <el-dialog
      v-model="editDialogVisible"
      title="编辑模型信息"
      width="500px"
    >
      <el-form :model="editForm" label-width="80px">
        <el-form-item label="模型名称">
          <el-input v-model="editForm.name" placeholder="请输入模型名称" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveEdit">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  Box,
  ArrowLeft,
  Star,
  DocumentDelete,
  Loading,
  WarningFilled,
  Picture,
  Document,
  ArrowDown,
  Edit,
  Delete,
  Setting,
  Download
} from '@element-plus/icons-vue'
import { useModel3DStore } from '../stores/model3d'
import ModelViewer from '../components/ModelViewer.vue'
import type { Model3D, ExportFormat } from '../types/3d'

// 路由和Store
const route = useRoute()
const router = useRouter()
const model3dStore = useModel3DStore()

// 状态
const editDialogVisible = ref(false)
const editForm = ref({
  name: ''
})

// 计算属性
const model = computed(() => {
  const id = route.params.id as string
  return model3dStore.getModelById(id)
})

// 生命周期
onMounted(() => {
  // 确保有公共模型数据
  if (model3dStore.publicGalleryModels.length === 0) {
    model3dStore.initSampleModels()
  }
  
  // 如果模型不存在，显示提示
  if (!model.value) {
    ElMessage.warning('模型不存在，将返回画廊')
    setTimeout(() => {
      goBack()
    }, 2000)
  }
})

// 方法
function goBack() {
  router.push('/gallery')
}

function setAsCurrentModel() {
  if (model.value) {
    model3dStore.setCurrentModel(model.value)
    ElMessage.success(`已设置 "${model.value.name}" 为当前模型`)
  }
}

function getModelDescription(model: Model3D): string {
  switch (model.type) {
    case 'text':
      return `基于文本 "${model.sourceContent.substring(0, 30)}..." 生成的3D模型`
    case 'image':
      return '基于图片生成的3D模型'
    case 'upload':
      return '上传的3D模型文件'
    default:
      return '3D模型详情'
  }
}

function getTypeText(type: string): string {
  switch (type) {
    case 'text': return '文本生成'
    case 'image': return '图片生成'
    case 'upload': return '文件上传'
    default: return '未知'
  }
}

function getTypeTagType(type: string) {
  switch (type) {
    case 'text': return 'success'
    case 'image': return 'warning'
    case 'upload': return 'info'
    default: return ''
  }
}

function getStatusText(status: string): string {
  switch (status) {
    case 'completed': return '已完成'
    case 'generating': return '生成中'
    case 'failed': return '失败'
    default: return '未知'
  }
}

function getStatusTagType(status: string) {
  switch (status) {
    case 'completed': return 'success'
    case 'generating': return 'warning'
    case 'failed': return 'danger'
    default: return 'info'
  }
}

function formatDetailTime(date: Date): string {
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

function handleImageError() {
  console.log('图片加载失败')
}

async function handleExportAction(format: ExportFormat) {
  if (!model.value) return
  
  try {
    const exportData = await model3dStore.exportModel(model.value, format)
    if (exportData) {
      // 创建下载链接
      const blob = new Blob([exportData], { type: 'text/plain' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${model.value.name}.${format}`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
      
      ElMessage.success(`模型已导出为 ${format.toUpperCase()} 格式`)
    }
  } catch (error) {
    console.error('导出失败:', error)
    ElMessage.error('导出失败')
  }
}

function handleEdit() {
  if (model.value) {
    editForm.value.name = model.value.name
    editDialogVisible.value = true
  }
}

function saveEdit() {
  if (model.value && editForm.value.name.trim()) {
    // 这里可以添加更新模型名称的逻辑
    model.value.name = editForm.value.name.trim()
    ElMessage.success('模型信息已更新')
    editDialogVisible.value = false
  } else {
    ElMessage.warning('请输入有效的模型名称')
  }
}

async function handleDelete() {
  if (!model.value) return
  
  try {
    await ElMessageBox.confirm(
      `确定要删除模型 "${model.value.name}" 吗？删除后无法恢复。`,
      '确认删除',
      {
        confirmButtonText: '删除',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
    
    model3dStore.removeModel(model.value.id)
    ElMessage.success('模型已删除')
    goBack()
  } catch {
    // 用户取消删除
  }
}
</script>

<style scoped>
.model-detail-view {
  min-height: 100vh;
  background: #f8f9fa;
}

.view-header {
  background: white;
  border-bottom: 1px solid #e0e0e0;
  padding: 24px 0;
}

.container {
  max-width: 1400px;
  margin: 0 auto;
  padding: 0 24px;
}

.header-content {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  margin-top: 16px;
}

.page-title {
  margin: 0 0 8px 0;
  font-size: 1.8rem;
  color: #2c3e50;
  display: flex;
  align-items: center;
  gap: 12px;
}

.page-description {
  margin: 0;
  color: #666;
  font-size: 1rem;
}

.header-actions {
  display: flex;
  gap: 12px;
}

.view-content {
  padding: 32px 0;
}

.not-found {
  text-align: center;
  padding: 80px 20px;
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.not-found h3 {
  margin: 16px 0 8px 0;
  color: #303133;
}

.not-found p {
  margin: 0 0 24px 0;
  color: #666;
}

.detail-layout {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 24px;
}

.preview-section,
.info-section {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.preview-card,
.info-card,
.action-card {
  background: white;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.card-header h3 {
  margin: 0;
  color: #2c3e50;
}

.preview-container {
  border-radius: 8px;
  overflow: hidden;
}

.preview-placeholder {
  height: 500px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
  color: #909399;
  text-align: center;
}

.preview-placeholder h4 {
  margin: 16px 0 8px 0;
  color: #303133;
}

.preview-placeholder p {
  margin: 0;
  color: #666;
}

.info-card h3,
.action-card h3 {
  margin: 0 0 16px 0;
  color: #2c3e50;
  font-size: 1.1rem;
}

.model-name {
  font-weight: bold;
  color: #2c3e50;
}

.source-content {
  margin-top: 8px;
}

.image-preview {
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  overflow: hidden;
  max-width: 300px;
}

.image-preview img {
  width: 100%;
  height: auto;
  display: block;
}

.image-placeholder {
  padding: 40px;
  text-align: center;
  color: #909399;
  background: #f5f5f5;
}

.image-placeholder p {
  margin: 8px 0 0 0;
  font-size: 14px;
}

.file-info {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  background: #f5f5f5;
  border-radius: 8px;
}

.file-details {
  flex: 1;
}

.file-name {
  margin: 0 0 4px 0;
  font-weight: bold;
  color: #2c3e50;
}

.file-meta {
  margin: 0;
  font-size: 12px;
  color: #666;
}

.action-card h3 {
  margin: 0 0 20px 0;
  color: #2c3e50;
  font-size: 1.1rem;
  display: flex;
  align-items: center;
  gap: 8px;
}

.action-card h3 .el-icon {
  color: #409eff;
  font-size: 18px;
}

.action-buttons {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.primary-actions,
.secondary-actions {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}

.primary-actions {
  padding-bottom: 16px;
  border-bottom: 1px solid #e5e7eb;
}

.action-btn {
  min-width: 140px;
  height: 44px;
  border-radius: 10px;
  font-weight: 500;
  font-size: 14px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  border: none;
  position: relative;
  overflow: hidden;
}

.action-btn::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.3), transparent);
  transition: left 0.6s;
}

.action-btn:hover::before {
  left: 100%;
}

.action-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.15);
}

.action-btn:active {
  transform: translateY(0);
}

.primary-btn {
  background: linear-gradient(135deg, #409eff 0%, #3182f6 100%);
  color: white;
}

.primary-btn:hover {
  background: linear-gradient(135deg, #3182f6 0%, #2563eb 100%);
}

.export-btn {
  background: linear-gradient(135deg, #67c23a 0%, #4ade80 100%);
  color: white;
}

.export-btn:hover {
  background: linear-gradient(135deg, #4ade80 0%, #22c55e 100%);
}

.edit-btn {
  background: linear-gradient(135deg, #e6a23c 0%, #f59e0b 100%);
  color: white;
}

.edit-btn:hover {
  background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
}

.delete-btn {
  background: linear-gradient(135deg, #f56c6c 0%, #ef4444 100%);
  color: white;
}

.delete-btn:hover {
  background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
}

.export-dropdown {
  display: inline-block;
}

/* 下拉菜单样式优化 */
:deep(.export-menu) {
  border-radius: 12px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15);
  border: 1px solid #e5e7eb;
  padding: 8px;
  backdrop-filter: blur(10px);
}

:deep(.export-menu .el-dropdown-menu__item) {
  border-radius: 8px;
  margin: 2px 0;
  padding: 12px 16px;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  gap: 10px;
  font-weight: 500;
}

:deep(.export-menu .el-dropdown-menu__item:hover) {
  background: linear-gradient(135deg, #f0f8ff 0%, #e6f3ff 100%);
  color: #409eff;
  transform: translateX(4px);
}

:deep(.export-menu .el-dropdown-menu__item .el-icon) {
  color: #6b7280;
  font-size: 16px;
}

:deep(.export-menu .el-dropdown-menu__item:hover .el-icon) {
  color: #409eff;
}

@media (max-width: 1024px) {
  .detail-layout {
    grid-template-columns: 1fr;
  }
  
  .container {
    padding: 0 16px;
  }
  
  .header-content {
    flex-direction: column;
    align-items: flex-start;
    gap: 16px;
  }
  
  .primary-actions,
  .secondary-actions {
    flex-direction: column;
    width: 100%;
  }
  
  .action-btn {
    width: 100%;
    justify-content: center;
  }
}

@media (max-width: 768px) {
  .page-title {
    font-size: 1.5rem;
  }
  
  .preview-placeholder {
    height: 300px;
  }
  
  .file-info {
    flex-direction: column;
    text-align: center;
  }
  
  .action-btn {
    min-width: unset;
    height: 40px;
    font-size: 13px;
  }
  
  .action-buttons {
    gap: 16px;
  }
  
  .primary-actions {
    padding-bottom: 12px;
  }
}
</style>