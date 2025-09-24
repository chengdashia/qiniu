<template>
  <div class="gallery-view">
    <div class="view-header">
      <div class="container">
        <el-breadcrumb separator="/">
          <el-breadcrumb-item :to="{ path: '/' }">首页</el-breadcrumb-item>
          <el-breadcrumb-item>模型画廊</el-breadcrumb-item>
        </el-breadcrumb>
        
        <div class="header-content">
          <div class="header-left">
            <h1 class="page-title">
              <el-icon><Collection /></el-icon>
              模型画廊
            </h1>
            <p class="page-description">
              浏览和管理您生成的所有3D模型
            </p>
          </div>
          
          <div class="header-actions">
            <el-button type="danger" @click="clearAllModels" v-if="models.length > 0">
              <el-icon><Delete /></el-icon>
              清空所有
            </el-button>
          </div>
        </div>
      </div>
    </div>
    
    <div class="view-content">
      <div class="container">
        <!-- 筛选和搜索栏 -->
        <div class="filters-bar">
          <div class="filters-left">
            <el-input
              v-model="searchKeyword"
              placeholder="搜索模型名称..."
              :prefix-icon="Search"
              clearable
              style="width: 300px"
            />
            
            <el-select
              v-model="filterType"
              placeholder="筛选类型"
              clearable
              style="width: 150px"
            >
              <el-option label="全部" value="" />
              <el-option label="文本生成" value="text" />
              <el-option label="图片生成" value="image" />
            </el-select>
            
            <el-select
              v-model="filterStatus"
              placeholder="筛选状态"
              clearable
              style="width: 150px"
            >
              <el-option label="全部" value="" />
              <el-option label="已完成" value="completed" />
              <el-option label="生成中" value="generating" />
              <el-option label="失败" value="failed" />
            </el-select>
          </div>
          
          <div class="filters-right">
            <el-select
              v-model="sortBy"
              placeholder="排序方式"
              style="width: 200px"
            >
              <el-option label="创建时间（最新）" value="created_desc" />
              <el-option label="创建时间（最早）" value="created_asc" />
              <el-option label="名称（A-Z）" value="name_asc" />
              <el-option label="名称（Z-A）" value="name_desc" />
            </el-select>
            
            <el-button-group>
              <el-button 
                :type="viewMode === 'grid' ? 'primary' : ''"
                @click="viewMode = 'grid'"
              >
                <el-icon><Grid /></el-icon>
              </el-button>
              <el-button 
                :type="viewMode === 'list' ? 'primary' : ''"
                @click="viewMode = 'list'"
              >
                <el-icon><List /></el-icon>
              </el-button>
            </el-button-group>
          </div>
        </div>
        
        <!-- 统计信息 -->
        <div class="stats-bar" v-if="models.length > 0">
          <div class="stats-item">
            <span class="stats-label">总计:</span>
            <span class="stats-value">{{ filteredModels.length }} / {{ models.length }}</span>
          </div>
          <div class="stats-item">
            <span class="stats-label">已完成:</span>
            <span class="stats-value">{{ completedModels.length }}</span>
          </div>
          <div class="stats-item">
            <span class="stats-label">文本生成:</span>
            <span class="stats-value">{{ textModels.length }}</span>
          </div>
          <div class="stats-item">
            <span class="stats-label">图片生成:</span>
            <span class="stats-value">{{ imageModels.length }}</span>
          </div>
        </div>
        
        <!-- 模型列表 -->
        <div v-if="filteredModels.length > 0" class="models-content">
          <!-- 网格视图 -->
          <div v-if="viewMode === 'grid'" class="models-grid">
            <div 
              v-for="model in paginatedModels" 
              :key="model.id"
              class="model-card"
              :class="{ 
                active: currentModel?.id === model.id,
                failed: model.status === 'failed'
              }"
              @click="selectModel(model)"
            >
              <div class="model-preview">
                <ModelViewer 
                  v-if="model.status === 'completed' && model.geometry"
                  :model="model" 
                  :height="200"
                  :config="{ 
                    enableControls: true, 
                    enableAnimation: true,
                    backgroundColor: '#f8f9fa'
                  }"
                  class="gallery-viewer"
                />
                <div v-else class="preview-placeholder">
                  <el-icon size="48">
                    <Loading v-if="model.status === 'generating'" />
                    <WarningFilled v-else-if="model.status === 'failed'" />
                    <Box v-else />
                  </el-icon>
                  <p>{{ getStatusText(model.status) }}</p>
                </div>
              </div>
              
              <div class="model-info">
                <h4>{{ model.name }}</h4>
                <p class="model-source">{{ getSourcePreview(model) }}</p>
                <div class="model-meta">
                  <el-tag 
                    :type="getTypeTagType(model.type)" 
                    size="small"
                  >
                    {{ model.type === 'text' ? '文本' : '图片' }}
                  </el-tag>
                  <el-tag 
                    :type="getStatusTagType(model.status)" 
                    size="small"
                  >
                    {{ getStatusText(model.status) }}
                  </el-tag>
                  <span class="time">{{ formatTime(model.createdAt) }}</span>
                </div>
              </div>
              
              <div class="model-actions" @click.stop>
                <el-button 
                  size="small" 
                  type="primary" 
                  plain
                  @click.stop="selectModel(model)"
                >
                  查看详情
                </el-button>
                <el-dropdown @command="handleModelAction" trigger="click" @click.stop>
                  <el-button size="small" type="info" plain @click.stop>
                    更多<el-icon class="el-icon--right"><ArrowDown /></el-icon>
                  </el-button>
                  <template #dropdown>
                    <el-dropdown-menu>
                      <el-dropdown-item :command="`export:obj:${model.id}`">导出OBJ</el-dropdown-item>
                      <el-dropdown-item :command="`export:stl:${model.id}`">导出STL</el-dropdown-item>
                      <el-dropdown-item :command="`export:gltf:${model.id}`">导出GLTF</el-dropdown-item>
                      <el-dropdown-item divided :command="`delete:${model.id}`">删除模型</el-dropdown-item>
                    </el-dropdown-menu>
                  </template>
                </el-dropdown>
              </div>
            </div>
          </div>
          
          <!-- 列表视图 -->
          <div v-else class="models-list">
            <el-table 
              :data="paginatedModels" 
              @row-click="selectModel"
              :row-class-name="getRowClassName"
            >
              <el-table-column label="名称" prop="name" min-width="200">
                <template #default="{ row }">
                  <div class="table-name">
                    <strong>{{ row.name }}</strong>
                    <p class="table-source">{{ getSourcePreview(row) }}</p>
                  </div>
                </template>
              </el-table-column>
              
              <el-table-column label="类型" width="100">
                <template #default="{ row }">
                  <el-tag :type="getTypeTagType(row.type)" size="small">
                    {{ row.type === 'text' ? '文本' : '图片' }}
                  </el-tag>
                </template>
              </el-table-column>
              
              <el-table-column label="状态" width="100">
                <template #default="{ row }">
                  <el-tag :type="getStatusTagType(row.status)" size="small">
                    {{ getStatusText(row.status) }}
                  </el-tag>
                </template>
              </el-table-column>
              
              <el-table-column label="创建时间" width="150">
                <template #default="{ row }">
                  {{ formatTime(row.createdAt) }}
                </template>
              </el-table-column>
              
              <el-table-column label="操作" width="200">
                <template #default="{ row }">
                  <div @click.stop>
                    <el-button 
                      size="small" 
                      type="primary" 
                      @click.stop="selectModel(row)"
                    >
                      查看详情
                    </el-button>
                    <el-dropdown @command="handleModelAction" trigger="click" @click.stop>
                      <el-button size="small" type="info" @click.stop>
                        更多<el-icon class="el-icon--right"><ArrowDown /></el-icon>
                      </el-button>
                      <template #dropdown>
                        <el-dropdown-menu>
                          <el-dropdown-item :command="`export:obj:${row.id}`">导出OBJ</el-dropdown-item>
                          <el-dropdown-item :command="`export:stl:${row.id}`">导出STL</el-dropdown-item>
                          <el-dropdown-item :command="`export:gltf:${row.id}`">导出GLTF</el-dropdown-item>
                          <el-dropdown-item divided :command="`delete:${row.id}`">删除模型</el-dropdown-item>
                        </el-dropdown-menu>
                      </template>
                    </el-dropdown>
                  </div>
                </template>
              </el-table-column>
            </el-table>
          </div>
          
          <!-- 分页 -->
          <div class="pagination-wrapper" v-if="filteredModels.length > pageSize">
            <el-pagination
              v-model:current-page="currentPage"
              :page-size="pageSize"
              :total="filteredModels.length"
              layout="total, prev, pager, next, jumper"
              @current-change="handlePageChange"
            />
          </div>
        </div>
        
        <!-- 空状态 -->
        <div v-else class="empty-state">
          <el-icon size="80" color="#c0c4cc"><FolderOpened /></el-icon>
          <h3>{{ models.length === 0 ? '暂无3D模型' : '无匹配结果' }}</h3>
          <p>
            {{ models.length === 0 
              ? '您还没有生成任何3D模型，去创建第一个吧！' 
              : '尝试调整筛选条件或搜索关键词'
            }}
          </p>
          <div class="empty-actions" v-if="models.length === 0">
            <el-button type="primary" @click="$router.push('/text-to-3d')">
              <el-icon><EditPen /></el-icon>
              文本转3D
            </el-button>
            <el-button type="success" @click="$router.push('/image-to-3d')">
              <el-icon><Picture /></el-icon>
              图片转3D
            </el-button>
            <el-button type="info" @click="refreshSampleModels()">
              <el-icon><Collection /></el-icon>
              刷新示例模型
            </el-button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  Collection,
  Delete,
  Search,
  Grid,
  List,
  Loading,
  WarningFilled,
  Box,
  ArrowDown,
  FolderOpened,
  EditPen,
  Picture
} from '@element-plus/icons-vue'
import { useModel3DStore } from '../stores/model3d'
import ModelViewer from '../components/ModelViewer.vue'
import type { Model3D, ExportFormat } from '../types/3d'

// Store
const model3dStore = useModel3DStore()
const router = useRouter()

// 状态
const searchKeyword = ref('')
const filterType = ref('')
const filterStatus = ref('')
const sortBy = ref('created_desc')
const viewMode = ref<'grid' | 'list'>('grid')
const currentPage = ref(1)
const pageSize = ref(12)

// 计算属性 - 使用公共画廊模型
const models = computed(() => model3dStore.publicGalleryModels) // 使用公共画廊模型
const currentModel = computed(() => model3dStore.currentModel)
const completedModels = computed(() => model3dStore.completedModels)
const textModels = computed(() => models.value.filter(m => m.type === 'text'))
const imageModels = computed(() => models.value.filter(m => m.type === 'image'))

const filteredModels = computed(() => {
  let result = [...models.value]
  
  // 搜索过滤
  if (searchKeyword.value) {
    const keyword = searchKeyword.value.toLowerCase()
    result = result.filter(model => 
      model.name.toLowerCase().includes(keyword) ||
      model.sourceContent.toLowerCase().includes(keyword)
    )
  }
  
  // 类型过滤
  if (filterType.value) {
    result = result.filter(model => model.type === filterType.value)
  }
  
  // 状态过滤
  if (filterStatus.value) {
    result = result.filter(model => model.status === filterStatus.value)
  }
  
  // 排序
  result.sort((a, b) => {
    switch (sortBy.value) {
      case 'created_desc':
        return b.createdAt.getTime() - a.createdAt.getTime()
      case 'created_asc':
        return a.createdAt.getTime() - b.createdAt.getTime()
      case 'name_asc':
        return a.name.localeCompare(b.name)
      case 'name_desc':
        return b.name.localeCompare(a.name)
      default:
        return 0
    }
  })
  
  return result
})

const paginatedModels = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  const end = start + pageSize.value
  return filteredModels.value.slice(start, end)
})

// 方法
function selectModel(model: Model3D) {
  // 跳转到模型详情页
  router.push(`/model/${model.id}`)
}

async function handleModelAction(command: string) {
  const [action, ...params] = command.split(':')
  
  if (action === 'delete') {
    const modelId = params[0]
    if (modelId) {
      await deleteModel(modelId)
    }
  } else if (action === 'export') {
    const format = params[0] as ExportFormat
    const modelId = params[1]
    if (format && modelId) {
      await exportModel(modelId, format)
    }
  }
}

async function deleteModel(id: string) {
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

async function exportModel(id: string, format: ExportFormat) {
  const model = model3dStore.getModelById(id)
  if (!model) {
    ElMessage.error('模型不存在')
    return
  }
  
  try {
    const exportData = await model3dStore.exportModel(model, format)
    if (exportData) {
      // 创建下载链接
      const blob = new Blob([exportData], { type: 'text/plain' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${model.name}.${format}`
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

async function clearAllModels() {
  try {
    await ElMessageBox.confirm(
      '确定要清空所有模型吗？此操作无法撤销。',
      '确认清空',
      {
        confirmButtonText: '清空',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
    
    model3dStore.clearPersonalModels()
    ElMessage.success('所有模型已清空')
  } catch {
    // 用户取消
  }
}

function handlePageChange(page: number) {
  currentPage.value = page
}

function refreshSampleModels() {
  model3dStore.loadPublicGallery()
  ElMessage.success('公共画廊已刷新')
}

function getSourcePreview(model: Model3D): string {
  if (model.type === 'text') {
    return model.sourceContent.length > 50 
      ? model.sourceContent.substring(0, 50) + '...'
      : model.sourceContent
  } else {
    return '图片文件'
  }
}

function getTypeTagType(type: string) {
  return type === 'text' ? 'success' : 'warning'
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

function getRowClassName({ row }: { row: Model3D }) {
  let className = ''
  if (currentModel.value?.id === row.id) className += 'current-row '
  if (row.status === 'failed') className += 'failed-row '
  return className.trim()
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
</script>

<style scoped>
.gallery-view {
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
  font-size: 2rem;
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

.view-content {
  padding: 32px 0;
}

.filters-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  padding: 16px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.filters-left {
  display: flex;
  gap: 16px;
  align-items: center;
}

.filters-right {
  display: flex;
  gap: 16px;
  align-items: center;
}

.stats-bar {
  display: flex;
  gap: 24px;
  margin-bottom: 24px;
  padding: 16px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.stats-item {
  display: flex;
  gap: 8px;
  align-items: center;
}

.stats-label {
  color: #666;
  font-size: 14px;
}

.stats-value {
  font-weight: bold;
  color: #409eff;
}

.models-content {
  background: white;
  border-radius: 8px;
  padding: 24px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.models-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 24px;
  margin-bottom: 24px;
}

.model-card {
  border: 1px solid #e0e0e0;
  border-radius: 12px;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.3s;
  background: white;
}

.model-card:hover {
  border-color: #409eff;
  box-shadow: 0 4px 12px rgba(64, 158, 255, 0.15);
  transform: translateY(-2px);
}

.model-card.active {
  border-color: #409eff;
  background-color: #f0f8ff;
}

.model-card.failed {
  border-color: #f56c6c;
  background-color: #fef0f0;
}

.model-preview {
  height: 200px;
  background: #f5f5f5;
  border-radius: 8px 8px 0 0;
  overflow: hidden;
}

.model-preview :deep(.gallery-viewer) {
  border: none;
  border-radius: 0;
}

.model-preview :deep(.gallery-viewer .controls),
.model-preview :deep(.gallery-viewer .model-info) {
  display: none; /* 在画廊中隐藏控制按钮和信息 */
}

.preview-placeholder {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #909399;
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
}

.model-info {
  padding: 16px;
}

.model-info h4 {
  margin: 0 0 8px 0;
  color: #303133;
  font-size: 16px;
}

.model-source {
  margin: 0 0 12px 0;
  color: #666;
  font-size: 14px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.model-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.time {
  font-size: 12px;
  color: #999;
  margin-left: auto;
}

.model-actions {
  padding: 12px 16px;
  border-top: 1px solid #f0f0f0;
  display: flex;
  gap: 8px;
}

.models-list {
  margin-bottom: 24px;
}

.table-name strong {
  display: block;
  margin-bottom: 4px;
}

.table-source {
  margin: 0;
  color: #666;
  font-size: 12px;
}

.pagination-wrapper {
  display: flex;
  justify-content: center;
  margin-top: 24px;
}

.empty-state {
  text-align: center;
  padding: 80px 20px;
  color: #909399;
}

.empty-state h3 {
  margin: 16px 0 8px 0;
  color: #303133;
}

.empty-state p {
  margin: 0 0 24px 0;
  color: #666;
}

.empty-actions {
  display: flex;
  gap: 16px;
  justify-content: center;
}

:deep(.current-row) {
  background-color: #f0f8ff !important;
}

:deep(.failed-row) {
  background-color: #fef0f0 !important;
}

@media (max-width: 768px) {
  .container {
    padding: 0 16px;
  }
  
  .header-content {
    flex-direction: column;
    align-items: flex-start;
    gap: 16px;
  }
  
  .filters-bar {
    flex-direction: column;
    gap: 16px;
    align-items: stretch;
  }
  
  .filters-left,
  .filters-right {
    flex-direction: column;
    gap: 12px;
  }
  
  .stats-bar {
    flex-wrap: wrap;
    gap: 16px;
  }
  
  .models-grid {
    grid-template-columns: 1fr;
  }
  
  .empty-actions {
    flex-direction: column;
    align-items: center;
  }
  
  .page-title {
    font-size: 1.5rem;
  }
}
</style>