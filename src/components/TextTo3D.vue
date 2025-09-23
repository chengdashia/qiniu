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
        <el-form-item label="文本描述" prop="text" required>
          <el-input
            v-model="form.text"
            type="textarea"
            :rows="4"
            placeholder="请描述您想要生成的3D模型，例如：一只可爱的小猫咪、现代风格的椅子、科幻飞船等..."
            :maxlength="500"
            show-word-limit
            :disabled="isGenerating"
          />
        </el-form-item>
        
        <el-form-item label="生成质量" prop="quality">
          <el-radio-group v-model="form.quality" :disabled="isGenerating">
            <el-radio value="low">低质量 (快速生成)</el-radio>
            <el-radio value="medium">中等质量 (推荐)</el-radio>
            <el-radio value="high">高质量 (精细模型)</el-radio>
          </el-radio-group>
        </el-form-item>
        
        <el-form-item label="风格设置" prop="style">
          <el-select
            v-model="form.style"
            placeholder="选择生成风格 (可选)"
            clearable
            :disabled="isGenerating"
            style="width: 100%"
          >
            <el-option label="写实风格" value="realistic" />
            <el-option label="卡通风格" value="cartoon" />
            <el-option label="低聚合风格" value="low-poly" />
            <el-option label="科幻风格" value="sci-fi" />
            <el-option label="古典风格" value="classical" />
            <el-option label="现代简约" value="modern" />
          </el-select>
        </el-form-item>
        
        <!-- 预设示例 -->
        <el-form-item label="快速示例">
          <div class="example-buttons">
            <el-button
              v-for="example in examples"
              :key="example.text"
              size="small"
              type="info"
              plain
              @click="useExample(example)"
              :disabled="isGenerating"
            >
              {{ example.text }}
            </el-button>
          </div>
        </el-form-item>
        
        <el-form-item>
          <el-button
            type="primary"
            size="large"
            @click="handleGenerate"
            :loading="isGenerating"
            :disabled="!form.text.trim()"
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
  Clock 
} from '@element-plus/icons-vue'
import { useModel3DStore } from '../stores/model3d'
import type { TextTo3DRequest } from '../types/3d'

// Store
const model3dStore = useModel3DStore()

// 表单引用
const formRef = ref<FormInstance>()

// 表单数据
const form = reactive<TextTo3DRequest>({
  text: '',
  quality: 'medium',
  style: ''
})

// 表单验证规则
const rules = {
  text: [
    { required: true, message: '请输入文本描述', trigger: 'blur' },
    { min: 5, message: '描述至少需要5个字符', trigger: 'blur' },
    { max: 500, message: '描述不能超过500个字符', trigger: 'blur' }
  ]
}

// 预设示例
const examples = [
  { text: '一只可爱的橙色小猫', quality: 'medium' as const, style: 'cartoon' },
  { text: '现代简约的办公椅', quality: 'medium' as const, style: 'modern' },
  { text: '科幻风格的宇宙飞船', quality: 'medium' as const, style: 'sci-fi' },
  { text: '古典欧式的花瓶', quality: 'medium' as const, style: 'classical' },
  { text: '卡通风格的小房子', quality: 'medium' as const, style: 'cartoon' },
  { text: '低聚合风格的小岛', quality: 'medium' as const, style: 'low-poly' }
]

// 计算属性
const isGenerating = computed(() => model3dStore.isGenerating)
const generationProgress = computed(() => model3dStore.generationProgress)
const generationMessage = computed(() => model3dStore.generationMessage)
const currentModel = computed(() => model3dStore.currentModel)
const textModels = computed(() => 
  model3dStore.models.filter(model => model.type === 'text')
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
      text: form.text.trim(),
      quality: form.quality,
      style: form.style || undefined
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

function useExample(example: typeof examples[0]) {
  form.text = example.text
  form.quality = example.quality
  form.style = example.style
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