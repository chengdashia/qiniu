<template>
  <div class="model-viewer">
    <div 
      ref="viewerContainer" 
      class="viewer-container"
      :style="{ height: height + 'px' }"
    >
      <!-- 加载状态 -->
      <div v-if="loading" class="loading-overlay">
        <el-icon class="is-loading" size="48"><Loading /></el-icon>
        <p>正在加载3D模型...</p>
      </div>
      
      <!-- 无模型状态 -->
      <div v-else-if="!model" class="empty-state">
        <el-icon size="64" color="#909399"><Box /></el-icon>
        <p>暂无3D模型</p>
        <p class="tip">请先生成或选择一个3D模型</p>
      </div>
      
      <!-- 模型显示错误状态 -->
      <div v-else-if="model.status === 'failed'" class="error-state">
        <el-icon size="64" color="#f56c6c"><WarningFilled /></el-icon>
        <p>模型加载失败</p>
        <p class="tip">请重新生成模型</p>
      </div>
    </div>
    
    <!-- 控制栏 -->
    <div v-if="model && !loading" class="controls">
      <div class="control-group">
        <el-button-group>
          <el-button 
            :type="config.enableAnimation ? 'primary' : ''"
            @click="toggleAnimation"
            size="small"
          >
            <el-icon><VideoPlay /></el-icon>
            {{ config.enableAnimation ? '停止旋转' : '自动旋转' }}
          </el-button>
          
          <el-button @click="resetCamera" size="small">
            <el-icon><Refresh /></el-icon>
            重置视角
          </el-button>
          
          <el-button @click="toggleWireframe" size="small">
            <el-icon><Grid /></el-icon>
            线框模式
          </el-button>
        </el-button-group>
      </div>
      
      <div class="control-group">
        <span>背景色：</span>
        <el-color-picker 
          v-model="config.backgroundColor" 
          @change="updateBackgroundColor"
          size="small"
        />
      </div>
      
      <div class="control-group">
        <span>光照强度：</span>
        <el-slider 
          v-model="config.lightIntensity"
          :min="0"
          :max="2"
          :step="0.1"
          @change="updateLightIntensity"
          style="width: 100px;"
          size="small"
        />
      </div>
      
      <!-- 导出按钮 -->
      <div class="control-group">
        <el-dropdown @command="handleExport" trigger="click">
          <el-button type="primary" size="small">
            导出模型<el-icon class="el-icon--right"><ArrowDown /></el-icon>
          </el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="obj">OBJ 格式</el-dropdown-item>
              <el-dropdown-item command="stl">STL 格式</el-dropdown-item>
              <el-dropdown-item command="gltf">GLTF 格式</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
    </div>
    
    <!-- 模型信息 -->
    <div v-if="model && !loading" class="model-info">
      <el-descriptions :column="3" size="small" border>
        <el-descriptions-item label="名称">{{ model.name }}</el-descriptions-item>
        <el-descriptions-item label="类型">
          <el-tag :type="model.type === 'text' ? 'success' : 'warning'">
            {{ model.type === 'text' ? '文本生成' : '图片生成' }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="创建时间">
          {{ formatDate(model.createdAt) }}
        </el-descriptions-item>
      </el-descriptions>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { ElMessage } from 'element-plus'
import { 
  Loading, 
  Box, 
  VideoPlay, 
  Refresh, 
  Grid, 
  ArrowDown,
  WarningFilled
} from '@element-plus/icons-vue'
import { ThreeViewer } from '../utils/threeViewer'
import { useModel3DStore } from '../stores/model3d'
import type { Model3D, ViewerConfig, ExportFormat } from '../types/3d'

interface Props {
  model?: Model3D | null
  height?: number
  config?: Partial<ViewerConfig>
}

const props = withDefaults(defineProps<Props>(), {
  height: 500,
  config: () => ({})
})

const emit = defineEmits<{
  'export': [format: ExportFormat, data: string]
}>()

// 状态
const viewerContainer = ref<HTMLElement>()
const loading = ref(false)
const viewer = ref<ThreeViewer>()
const wireframeMode = ref(false)

// 查看器配置
const config = ref<ViewerConfig>({
  enableControls: true,
  enableAnimation: false,
  backgroundColor: '#f8f9fa',
  cameraPosition: { x: 3, y: 3, z: 3 },
  lightIntensity: 1,
  ...props.config
})

// Store
const model3dStore = useModel3DStore()

// 生命周期
onMounted(async () => {
  await nextTick()
  initViewer()
})

onUnmounted(() => {
  if (viewer.value) {
    viewer.value.dispose()
  }
})

// 监听模型变化
watch(() => props.model, (newModel, oldModel) => {
  if (newModel && viewer.value) {
    if (newModel.status === 'completed' && newModel.geometry) {
      loadModel(newModel)
    }
  } else if (!newModel && oldModel && viewer.value) {
    // 清空模型
    clearModel()
  }
}, { immediate: true })

// 方法
function initViewer() {
  if (!viewerContainer.value) {
    console.warn('ViewerContainer not found')
    return
  }
  
  try {
    viewer.value = new ThreeViewer(viewerContainer.value, config.value)
    
    // 如果有模型且状态为完成，立即加载
    if (props.model && props.model.status === 'completed' && props.model.geometry) {
      loadModel(props.model)
    }
  } catch (error) {
    console.error('初始化3D查看器失败:', error)
    ElMessage.error('3D查看器初始化失败')
  }
}

function loadModel(model: Model3D) {
  if (!viewer.value || !model.geometry || model.status !== 'completed') {
    console.warn('Cannot load model:', { hasViewer: !!viewer.value, hasGeometry: !!model.geometry, status: model.status })
    return
  }
  
  loading.value = true
  
  try {
    viewer.value.loadModel(model.geometry, model.material)
    
    setTimeout(() => {
      loading.value = false
    }, 500)
  } catch (error) {
    console.error('加载模型失败:', error)
    ElMessage.error('模型加载失败')
    loading.value = false
  }
}

function clearModel() {
  if (viewer.value) {
    // 清空当前模型
    try {
      // 这里可以调用ThreeViewer的清空方法
      console.log('Clearing current model')
    } catch (error) {
      console.error('清空模型失败:', error)
    }
  }
}

function toggleAnimation() {
  config.value.enableAnimation = !config.value.enableAnimation
  if (viewer.value) {
    viewer.value.updateConfig({ enableAnimation: config.value.enableAnimation })
  }
}

function resetCamera() {
  if (viewer.value && props.model) {
    loadModel(props.model) // 重新加载会重置相机位置
  }
}

function toggleWireframe() {
  wireframeMode.value = !wireframeMode.value
  // 这里可以添加线框模式的实现
  ElMessage.info(wireframeMode.value ? '已启用线框模式' : '已关闭线框模式')
}

function updateBackgroundColor() {
  if (viewer.value) {
    viewer.value.updateConfig({ backgroundColor: config.value.backgroundColor })
  }
}

function updateLightIntensity() {
  if (viewer.value) {
    viewer.value.updateConfig({ lightIntensity: config.value.lightIntensity })
  }
}

async function handleExport(format: ExportFormat) {
  if (!viewer.value || !props.model) {
    ElMessage.warning('没有可导出的模型')
    return
  }
  
  try {
    ElMessage.info('正在导出模型...')
    
    // 使用 store 的导出功能
    const exportData = await model3dStore.exportModel(props.model, format)
    
    if (exportData) {
      // 创建下载链接
      const blob = new Blob([exportData], { type: 'text/plain' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${props.model.name}.${format}`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
      
      ElMessage.success('模型导出成功')
      emit('export', format, exportData)
    } else {
      ElMessage.error('模型导出失败')
    }
  } catch (error) {
    console.error('导出失败:', error)
    ElMessage.error('导出过程中发生错误')
  }
}

function formatDate(date: Date): string {
  return date.toLocaleString('zh-CN')
}
</script>

<style scoped>
.model-viewer {
  display: flex;
  flex-direction: column;
  gap: 16px;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  overflow: hidden;
  background: #fff;
}

.viewer-container {
  position: relative;
  width: 100%;
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
  min-height: 200px;
}

.loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(4px);
  z-index: 10;
  border-radius: 8px;
}

.loading-overlay p {
  margin-top: 16px;
  color: #666;
  font-size: 14px;
}

.empty-state,
.error-state {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #909399;
  text-align: center;
}

.empty-state p,
.error-state p {
  margin: 8px 0;
  font-size: 14px;
}

.empty-state .tip,
.error-state .tip {
  font-size: 12px;
  opacity: 0.8;
  margin-top: 4px;
}

.controls {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 12px 16px;
  background: #fafafa;
  border-top: 1px solid #e0e0e0;
  flex-wrap: wrap;
}

.control-group {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
}

.model-info {
  padding: 16px;
  border-top: 1px solid #e0e0e0;
}

@media (max-width: 768px) {
  .controls {
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
  }
  
  .control-group {
    justify-content: space-between;
  }
}
</style>