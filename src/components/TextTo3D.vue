<template>
  <div class="text-to-3d">
    <el-card class="generation-card">
      <template #header>
        <div class="card-header">
          <h3>
            <el-icon><EditPen /></el-icon>
            文本转3D模型
          </h3>
          <p class="description">输入文字描述，AI将为您生成对应的3D模型</p>
        </div>
      </template>
      
      <el-form
        ref="formRef"
        :model="form"
        :rules="rules"
        label-width="80px"
        @submit.prevent="handleGenerate"
      >
        <el-form-item label="文本描述" prop="prompt" required>
          <el-input
            v-model="form.prompt"
            type="textarea"
            :rows="4"
            placeholder="请描述您想要生成的3D模型，例如：一只可爱的小猫咪、现代风格的椅子、科幻飞船等..."
            :maxlength="500"
            show-word-limit
            :disabled="isGenerating"
          />
        </el-form-item>
        
        <el-form-item label="生成类型" prop="generate_type">
          <el-radio-group v-model="form.generate_type" :disabled="isGenerating">
            <el-radio value="Normal">普通模式</el-radio>
            <el-radio value="LowPoly">低多边形</el-radio>
            <el-radio value="Geometry">几何风格</el-radio>
            <el-radio value="Sketch">素描风格</el-radio>
          </el-radio-group>
        </el-form-item>
        
        <el-form-item label="面数设置" prop="face_count">
          <el-slider
            v-model="form.face_count"
            :min="40000"
            :max="500000"
            :step="10000"
            :disabled="isGenerating"
            :format-tooltip="formatFaceCount"
            show-input
            input-size="small"
          />
          <div class="face-count-hint">
            <span>当前设置: {{ formatFaceCount(form.face_count) }}</span>
            <el-tooltip content="面数越高，模型越精细，但生成时间也越长" placement="top">
              <el-icon class="hint-icon"><QuestionFilled /></el-icon>
            </el-tooltip>
          </div>
        </el-form-item>
        
        <el-form-item label="高级选项">
          <div class="advanced-options">
            <el-checkbox v-model="form.polish" :disabled="isGenerating">
              开启提示词优化
            </el-checkbox>
            <el-checkbox v-model="form.enable_pbr" :disabled="isGenerating">
              启用PBR材质
            </el-checkbox>
            <el-form-item label="模型格式">
              <el-radio-group v-model="form.modelFormat" :disabled="isGenerating">
                <el-radio :label="0">OBJ格式</el-radio>
                <el-radio :label="1">GLB格式</el-radio>
              </el-radio-group>
            </el-form-item>
          </div>
          <div class="option-hints">
            <p>• 提示词优化：AI自动优化您的文本描述，提高生成质量</p>
            <p>• PBR材质：生成更真实的材质效果</p>
            <p>• 模型格式：选择下载的模型文件格式</p>
          </div>
        </el-form-item>
        
        <!-- 预设示例 -->
        <el-form-item label="快速示例">
          <div class="example-buttons">
            <el-button
              v-for="example in examples"
              :key="example.prompt"
              size="small"
              type="info"
              plain
              @click="useExample(example)"
              :disabled="isGenerating"
            >
              {{ example.prompt }}
            </el-button>
          </div>
        </el-form-item>
        
        <el-form-item>
          <el-button
            type="primary"
            size="large"
            @click="handleGenerate"
            :loading="isGenerating"
            :disabled="!form.prompt?.trim()"
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
            {{ generationMessage || '正在生成3D模型...' }}
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
    <el-card v-if="textModels.length > 0" class="history-card">
      <template #header>
        <div class="card-header">
          <h3>
            <el-icon><Clock /></el-icon>
            文本生成历史
          </h3>
          <el-button size="small" @click="clearHistory">清空历史</el-button>
        </div>
      </template>
      
      <div class="history-list">
        <div
          v-for="model in textModels"
          :key="model.id"
          class="history-item"
          :class="{ 
            active: currentModel?.id === model.id,
            failed: model.status === 'failed'
          }"
          @click="selectModel(model)"
        >
          <div class="history-content">
            <h4>{{ model.name }}</h4>
            <p class="source-text">{{ model.sourceContent }}</p>
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
              v-if="model.status === 'failed' || model.status === 'generating'"
              size="small" 
              type="warning" 
              plain
              @click.stop="retryDownload(model)"
              :loading="isRetrying"
            >
              重试下载
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
import { ElMessage, ElMessageBox, type FormInstance } from 'element-plus'
import { 
  EditPen, 
  Promotion, 
  Loading, 
  Clock,
  QuestionFilled
} from '@element-plus/icons-vue'
import { useModel3DStore } from '../stores/model3d'
import type { TextTo3DRequest } from '../types/3d'

// Store
const model3dStore = useModel3DStore()

// 表单引用
const formRef = ref<FormInstance>()

// 表单数据
const form = reactive<TextTo3DRequest>({
  prompt: '',
  polish: true,
  enable_pbr: false, // 默认为false
  face_count: 400000, // 默认40万面
  generate_type: 'Normal', // 默认Normal
  modelFormat: 0, // 0: OBJ, 1: GLB
  // 兼容性字段
  text: '',
  quality: 'medium',
  style: ''
})

// 表单验证规则
const rules = {
  prompt: [
    { required: true, message: '请输入文本描述', trigger: 'blur' },
    { min: 5, message: '描述至少需要5个字符', trigger: 'blur' },
    { max: 500, message: '描述不能超过500个字符', trigger: 'blur' }
  ]
}

// 重试状态
const isRetrying = ref(false)

// 预设示例
const examples = [
  { prompt: '一只可爱的橙色小猫', generate_type: 'Normal' as const, polish: true, enable_pbr: false, face_count: 200000, modelFormat: 0 },
  { prompt: '现代简约的办公椅', generate_type: 'Normal' as const, polish: true, enable_pbr: true, face_count: 300000, modelFormat: 1 },
  { prompt: '科幻风格的宇宙飞船', generate_type: 'LowPoly' as const, polish: false, enable_pbr: false, face_count: 150000, modelFormat: 0 },
  { prompt: '古典欧式的花瓶', generate_type: 'Normal' as const, polish: true, enable_pbr: true, face_count: 400000, modelFormat: 1 },
  { prompt: '卡通风格的小房子', generate_type: 'LowPoly' as const, polish: false, enable_pbr: false, face_count: 100000, modelFormat: 0 },
  { prompt: '简约风格的小岛', generate_type: 'Geometry' as const, polish: false, enable_pbr: false, face_count: 80000, modelFormat: 1 }
]

// 计算属性
const isGenerating = computed(() => model3dStore.isGenerating)
const generationProgress = computed(() => model3dStore.generationProgress)
const generationMessage = computed(() => model3dStore.generationMessage)
const currentModel = computed(() => model3dStore.currentModel)
const textModels = computed(() => 
  // 显示用户的文本模型
  model3dStore.userTextModels
)

// 方法
async function handleGenerate() {
  if (!formRef.value) return
  
  try {
    // 验证表单
    const valid = await formRef.value.validate()
    if (!valid) return
    
    // 确认生成
    if (isGenerating.value) {
      ElMessage.warning('正在生成中，请等待完成')
      return
    }
    
    ElMessage.info('开始生成3D模型，请稍候...')
    
    // 调用生成接口
    const result = await model3dStore.generateFromText({
      prompt: form.prompt.trim(),
      polish: form.polish,
      enable_pbr: form.enable_pbr,
      face_count: form.face_count,
      generate_type: form.generate_type,
      modelFormat: form.modelFormat,
      // 兼容性字段
      text: form.prompt.trim(),
      quality: 'medium',
      style: undefined
    })
    
    if (result) {
      // 检查是否是本地降级模型
      if (result.isLocalFallback) {
        ElMessage.warning('资源不足，已加载本地模型')
      } else {
        ElMessage.success('3D模型生成成功！')
      }
    } else {
      ElMessage.error('模型生成失败，请重试')
    }
  } catch (error) {
    console.error('生成失败:', error)
    ElMessage.error('生成过程中发生错误')
  }
}

function useExample(example: typeof examples[0]) {
  form.prompt = example.prompt
  form.generate_type = example.generate_type
  form.polish = example.polish
  form.enable_pbr = example.enable_pbr
  form.face_count = example.face_count
  form.modelFormat = example.modelFormat
  // 同步兼容性字段
  form.text = example.prompt
  ElMessage.info('已填入示例内容')
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
  if (textModels.value.length === 0) return
  
  try {
    await ElMessageBox.confirm(
      '确定要清空所有文本生成历史吗？此操作无法撤销。',
      '确认清空',
      {
        confirmButtonText: '清空',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
    
    // 只删除文本类型的模型
    textModels.value.forEach(model => {
      model3dStore.removeModel(model.id)
    })
    
    ElMessage.success('历史记录已清空')
  } catch {
    // 用户取消
  }
}

// 重试下载模型
async function retryDownload(model: any) {
  if (!model.id.startsWith('text_')) return
  
  isRetrying.value = true
  
  try {
    // 提取job_id（假设存储在模型id中或其他地方）
    const jobId = model.jobId || model.id.replace('text_', '')
    
    const success = await model3dStore.downloadModelManually(jobId)
    
    if (success) {
      ElMessage.success('模型下载成功！')
    } else {
      ElMessage.error('下载失败，请稍后重试')
    }
  } catch (error) {
    console.error('重试下载失败:', error)
    ElMessage.error('下载过程中发生错误')
  } finally {
    isRetrying.value = false
  }
}

function formatProgress(percentage: number): string {
  return `${percentage}%`
}

function getProgressTip(): string {
  const progress = generationProgress.value
  if (progress < 20) return '正在分析文本内容...'
  if (progress < 40) return '正在构建3D结构...'
  if (progress < 60) return '正在优化模型细节...'
  if (progress < 80) return '正在生成材质纹理...'
  if (progress < 100) return '正在完成最后的处理...'
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

function formatFaceCount(value: number): string {
  if (value >= 100000) {
    return `${(value / 10000).toFixed(0)}万面`
  }
  return `${value.toLocaleString()}面`
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
.text-to-3d {
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

.example-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.face-count-hint {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 8px;
  font-size: 14px;
  color: #666;
}

.hint-icon {
  color: #909399;
  cursor: help;
}

.advanced-options {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.option-hints {
  margin-top: 12px;
  padding: 12px;
  background-color: #f8f9fa;
  border-radius: 6px;
  font-size: 13px;
  color: #666;
}

.option-hints p {
  margin: 4px 0;
  line-height: 1.4;
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
  justify-content: space-between;
  align-items: center;
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

.history-content {
  flex: 1;
  min-width: 0;
}

.history-content h4 {
  margin: 0 0 8px 0;
  font-size: 16px;
  color: #303133;
}

.source-text {
  margin: 0 0 8px 0;
  font-size: 14px;
  color: #666;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
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
  margin-left: 16px;
}

@media (max-width: 768px) {
  .history-item {
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
  }
  
  .history-actions {
    margin-left: 0;
    justify-content: flex-end;
  }
  
  .example-buttons {
    justify-content: flex-start;
  }
}
</style>