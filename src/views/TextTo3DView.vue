<template>
  <div class="text-to-3d-view">
    <div class="view-header">
      <div class="container">
        <el-breadcrumb separator="/">
          <el-breadcrumb-item :to="{ path: '/' }">首页</el-breadcrumb-item>
          <el-breadcrumb-item>文本转3D</el-breadcrumb-item>
        </el-breadcrumb>
        
        <h1 class="page-title">
          <el-icon><EditPen /></el-icon>
          文本转3D模型
        </h1>
        <p class="page-description">
          通过文字描述生成精美的3D模型，支持多种风格和质量选择
        </p>
      </div>
    </div>
    
    <div class="view-content">
      <div class="container">
        <div class="content-grid">
          <!-- 左侧：生成控制面板 -->
          <div class="generation-panel">
            <TextTo3D />
          </div>
          
          <!-- 右侧：3D预览器 -->
          <div class="preview-panel">
            <el-card class="preview-card">
              <template #header>
                <div class="preview-header">
                  <h3>
                    <el-icon><View /></el-icon>
                    3D模型预览
                  </h3>
                  <div class="preview-actions" v-if="currentModel">
                    <el-button size="small" @click="resetView">
                      <el-icon><Refresh /></el-icon>
                      重置视角
                    </el-button>
                    <el-button size="small" @click="toggleFullscreen">
                      <el-icon><FullScreen /></el-icon>
                      全屏预览
                    </el-button>
                  </div>
                </div>
              </template>
              
              <ModelViewer 
                :model="currentModel" 
                :height="viewerHeight"
                @export="handleExport"
              />
            </el-card>
          </div>
        </div>
      </div>
    </div>
    
    <!-- 全屏预览对话框 -->
    <el-dialog
      v-model="fullscreenVisible"
      title="全屏3D预览"
      width="90%"
      :before-close="closeFullscreen"
      class="fullscreen-dialog"
    >
      <ModelViewer 
        v-if="fullscreenVisible"
        :model="currentModel" 
        :height="600"
        @export="handleExport"
      />
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { ElMessage } from 'element-plus'
import {
  EditPen,
  View,
  Refresh,
  FullScreen
} from '@element-plus/icons-vue'
import { useModel3DStore } from '../stores/model3d'
import TextTo3D from '../components/TextTo3D.vue'
import ModelViewer from '../components/ModelViewer.vue'
import type { ExportFormat } from '../types/3d'

// Store
const model3dStore = useModel3DStore()

// 状态
const fullscreenVisible = ref(false)
const viewerHeight = ref(600)

// 计算属性
const currentModel = computed(() => model3dStore.currentModel)

// 生命周期
onMounted(() => {
  updateViewerHeight()
  window.addEventListener('resize', updateViewerHeight)
})

onUnmounted(() => {
  window.removeEventListener('resize', updateViewerHeight)
})

// 方法
function updateViewerHeight() {
  const vh = window.innerHeight
  // 根据屏幕高度动态调整预览器高度
  viewerHeight.value = Math.max(400, Math.min(vh - 300, 800))
}

function resetView() {
  ElMessage.info('视角已重置')
}

function toggleFullscreen() {
  if (!currentModel.value) {
    ElMessage.warning('请先生成或选择一个3D模型')
    return
  }
  fullscreenVisible.value = true
}

function closeFullscreen() {
  fullscreenVisible.value = false
}

function handleExport(format: ExportFormat, data: string) {
  ElMessage.success(`模型已导出为 ${format.toUpperCase()} 格式`)
}
</script>

<style scoped>
.text-to-3d-view {
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

.page-title {
  margin: 16px 0 8px 0;
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

.content-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 32px;
  align-items: start;
}

.generation-panel {
  position: sticky;
  top: 32px;
}

.preview-panel {
  position: sticky;
  top: 32px;
}

.preview-card {
  height: fit-content;
}

.preview-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}

.preview-header h3 {
  margin: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  color: #303133;
}

.preview-actions {
  display: flex;
  gap: 8px;
}

.fullscreen-dialog :deep(.el-dialog) {
  margin: 5vh auto;
}

.fullscreen-dialog :deep(.el-dialog__body) {
  padding: 0;
}

@media (max-width: 1200px) {
  .content-grid {
    grid-template-columns: 1fr;
    gap: 24px;
  }
  
  .generation-panel,
  .preview-panel {
    position: static;
  }
}

@media (max-width: 768px) {
  .container {
    padding: 0 16px;
  }
  
  .view-header {
    padding: 16px 0;
  }
  
  .page-title {
    font-size: 1.5rem;
  }
  
  .view-content {
    padding: 16px 0;
  }
  
  .preview-actions {
    flex-direction: column;
    gap: 4px;
  }
}
</style>