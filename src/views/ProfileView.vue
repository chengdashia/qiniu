<template>
  <div class="profile-container">
    <!-- 个人信息卡片 -->
    <div class="profile-header">
      <el-card shadow="hover" class="profile-card">
        <div class="profile-info">
          <div class="avatar-section">
            <el-avatar
              :size="80"
              :src="authStore.currentUser?.avatar"
              class="user-avatar"
            >
              <el-icon><User /></el-icon>
            </el-avatar>
            <div class="avatar-upload">
              <el-button size="small" type="text">更换头像</el-button>
            </div>
          </div>
          
          <div class="user-details">
            <h2>{{ authStore.currentUser?.username }}</h2>
            <p class="user-email">{{ authStore.currentUser?.email }}</p>
            <p class="join-date">
              加入时间: {{ formatDate(authStore.currentUser?.createdAt) }}
            </p>
          </div>
          
          <div class="profile-actions">
            <el-button type="primary" @click="showEditProfile = true">
              编辑资料
            </el-button>
            <el-button @click="showChangePassword = true">
              修改密码
            </el-button>
          </div>
        </div>
      </el-card>
    </div>

    <!-- 统计信息 -->
    <div class="stats-section">
      <el-row :gutter="16">
        <el-col :span="6">
          <el-card shadow="hover" class="stat-card">
            <div class="stat-item">
              <el-icon size="32" color="#409eff"><Collection /></el-icon>
              <div class="stat-content">
                <div class="stat-number">{{ userStats?.totalModels || 0 }}</div>
                <div class="stat-label">总模型数</div>
              </div>
            </div>
          </el-card>
        </el-col>
        <el-col :span="6">
          <el-card shadow="hover" class="stat-card">
            <div class="stat-item">
              <el-icon size="32" color="#67c23a"><Check /></el-icon>
              <div class="stat-content">
                <div class="stat-number">{{ userStats?.completedModels || 0 }}</div>
                <div class="stat-label">完成模型</div>
              </div>
            </div>
          </el-card>
        </el-col>
        <el-col :span="6">
          <el-card shadow="hover" class="stat-card">
            <div class="stat-item">
              <el-icon size="32" color="#e6a23c"><Loading /></el-icon>
              <div class="stat-content">
                <div class="stat-number">{{ userStats?.generatingModels || 0 }}</div>
                <div class="stat-label">生成中</div>
              </div>
            </div>
          </el-card>
        </el-col>
        <el-col :span="6">
          <el-card shadow="hover" class="stat-card">
            <div class="stat-item">
              <el-icon size="32" color="#909399"><Folder /></el-icon>
              <div class="stat-content">
                <div class="stat-number">{{ formatStorage(userStats?.totalStorage || 0) }}</div>
                <div class="stat-label">存储空间</div>
              </div>
            </div>
          </el-card>
        </el-col>
      </el-row>
    </div>

    <!-- 模型历史列表 -->
    <div class="history-section">
      <el-card shadow="hover">
        <template #header>
          <div class="card-header">
            <span>我的模型历史</span>
          </div>
        </template>

        <div class="history-content">
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
                <el-option label="上传模型" value="upload" />
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
              
              <el-button type="primary" :icon="Refresh" @click="refreshHistory">
                刷新
              </el-button>
            </div>
          </div>
          
          <!-- 统计信息 -->
          <div class="stats-bar" v-if="historyData?.list && historyData.list.length > 0">
            <div class="stats-item">
              <span class="stats-label">总计:</span>
              <span class="stats-value">{{ filteredHistory.length }} / {{ historyData.list.length }}</span>
            </div>
            <div class="stats-item">
              <span class="stats-label">已完成:</span>
              <span class="stats-value">{{ completedHistory.length }}</span>
            </div>
            <div class="stats-item">
              <span class="stats-label">文本生成:</span>
              <span class="stats-value">{{ textHistory.length }}</span>
            </div>
            <div class="stats-item">
              <span class="stats-label">图片生成:</span>
              <span class="stats-value">{{ imageHistory.length }}</span>
            </div>
          </div>

          <div v-loading="historyLoading" class="models-content">
            <div v-if="filteredHistory.length === 0" class="empty-state">
              <el-icon size="80" color="#c0c4cc"><FolderOpened /></el-icon>
              <h3>{{ historyData?.list && historyData.list.length === 0 ? '暂无模型历史记录' : '无匹配结果' }}</h3>
              <p>
                {{ historyData?.list && historyData.list.length === 0 
                  ? '您还没有创建任何3D模型，去创建第一个吧！' 
                  : '尝试调整筛选条件或搜索关键词'
                }}
              </p>
              <div class="empty-actions" v-if="historyData?.list && historyData.list.length === 0">
                <el-button type="primary" @click="$router.push('/text-to-3d')">
                  <el-icon><EditPen /></el-icon>
                  文本转3D
                </el-button>
                <el-button type="success" @click="$router.push('/image-to-3d')">
                  <el-icon><Picture /></el-icon>
                  图片转3D
                </el-button>
              </div>
            </div>

            <div v-else class="history-models">
              <!-- 网格视图 -->
              <div v-if="viewMode === 'grid'" class="models-grid">
                <div 
                  v-for="item in paginatedHistory" 
                  :key="item.id"
                  class="model-card"
                  :class="{ 
                    failed: item.status === 'failed'
                  }"
                  @click="viewModel(item)"
                >
                  <div class="model-preview">
                    <!-- 使用ModelViewer渲染实际的3D模型 -->
                    <ModelViewer 
                      v-if="canRenderModel(item)"
                      :model="getActualModel(item)!" 
                      :height="180"
                      :config="{ 
                        enableControls: true, 
                        enableAnimation: true,
                        backgroundColor: '#f8f9fa'
                      }"
                      class="profile-model-viewer"
                    />
                    <!-- 显示缩略图 -->
                    <div v-else-if="item.thumbnailUrl && !imageErrorMap[item.id]" class="preview-image">
                      <img
                        :src="item.thumbnailUrl"
                        :alt="item.modelName"
                        class="thumbnail-image"
                        @error="() => handleImageError(item)"
                      />
                    </div>
                    <!-- 占位符 -->
                    <div v-else class="preview-placeholder" :class="`placeholder-${item.modelType}`">
                      <el-icon size="48">
                        <Loading v-if="item.status === 'generating'" />
                        <WarningFilled v-else-if="item.status === 'failed'" />
                        <Picture v-else-if="item.modelType === 'image'" />
                        <EditPen v-else-if="item.modelType === 'text'" />
                        <Upload v-else />
                      </el-icon>
                      <p>{{ getStatusLabel(item.status) }}</p>
                    </div>
                  </div>
                  
                  <div class="model-info">
                    <h4>{{ item.modelName }}</h4>
                    <p class="model-source">{{ getSourcePreview(item) }}</p>
                    <div class="model-meta">
                      <el-tag 
                        :type="getModelTypeTagType(item.modelType)" 
                        size="small"
                      >
                        {{ getModelTypeLabel(item.modelType) }}
                      </el-tag>
                      <el-tag 
                        :type="getStatusTagType(item.status)" 
                        size="small"
                      >
                        {{ getStatusLabel(item.status) }}
                      </el-tag>
                      <span class="time">{{ formatTime(item.createdAt) }}</span>
                    </div>
                  </div>
                  
                  <div class="model-actions">
                    <el-button 
                      size="small" 
                      type="primary" 
                      plain
                      @click.stop="viewModel(item)"
                    >
                      查看详情
                    </el-button>
                    <el-dropdown @command="(command: string) => handleModelAction(command, item)" trigger="click">
                      <el-button size="small" type="info" plain>
                        更多<el-icon class="el-icon--right"><ArrowDown /></el-icon>
                      </el-button>
                      <template #dropdown>
                        <el-dropdown-menu>
                          <el-dropdown-item command="download">下载模型</el-dropdown-item>
                          <el-dropdown-item divided command="delete">删除模型</el-dropdown-item>
                        </el-dropdown-menu>
                      </template>
                    </el-dropdown>
                  </div>
                </div>
              </div>
              
              <!-- 列表视图 -->
              <div v-else class="models-list">
                <el-table 
                  :data="paginatedHistory" 
                  @row-click="viewModel"
                  :row-class-name="getRowClassName"
                >
                  <el-table-column label="名称" prop="modelName" min-width="200">
                    <template #default="{ row }">
                      <div class="table-name">
                        <strong>{{ row.modelName }}</strong>
                        <p class="table-source">{{ getSourcePreview(row) }}</p>
                      </div>
                    </template>
                  </el-table-column>
                  
                  <el-table-column label="类型" width="120">
                    <template #default="{ row }">
                      <el-tag :type="getModelTypeTagType(row.modelType)" size="small">
                        {{ getModelTypeLabel(row.modelType) }}
                      </el-tag>
                    </template>
                  </el-table-column>
                  
                  <el-table-column label="状态" width="100">
                    <template #default="{ row }">
                      <el-tag :type="getStatusTagType(row.status)" size="small">
                        {{ getStatusLabel(row.status) }}
                      </el-tag>
                    </template>
                  </el-table-column>
                  
                  <el-table-column label="创建时间" width="150">
                    <template #default="{ row }">
                      {{ formatTime(row.createdAt) }}
                    </template>
                  </el-table-column>
                  
                  <el-table-column label="操作" width="180">
                    <template #default="{ row }">
                      <el-button 
                        size="small" 
                        type="primary" 
                        @click.stop="viewModel(row)"
                      >
                        查看详情
                      </el-button>
                      <el-dropdown @command="(command: string) => handleModelAction(command, row)" trigger="click">
                        <el-button size="small" type="info">
                          更多<el-icon class="el-icon--right"><ArrowDown /></el-icon>
                        </el-button>
                        <template #dropdown>
                          <el-dropdown-menu>
                            <el-dropdown-item command="download">下载模型</el-dropdown-item>
                            <el-dropdown-item divided command="delete">删除模型</el-dropdown-item>
                          </el-dropdown-menu>
                        </template>
                      </el-dropdown>
                    </template>
                  </el-table-column>
                </el-table>
              </div>
            </div>

            <!-- 分页 -->
            <div class="pagination-wrapper" v-if="filteredHistory.length > historyPageSize">
              <el-pagination
                v-model:current-page="historyCurrentPage"
                :page-size="historyPageSize"
                :total="filteredHistory.length"
                layout="total, prev, pager, next, jumper"
                @current-change="handleHistoryPageChange"
              />
            </div>
          </div>
        </div>
      </el-card>
    </div>

    <!-- 编辑资料对话框 -->
    <el-dialog
      v-model="showEditProfile"
      title="编辑个人资料"
      width="500px"
      destroy-on-close
    >
      <el-form
        ref="editFormRef"
        :model="editForm"
        :rules="editRules"
        label-width="80px"
      >
        <el-form-item label="用户名" prop="username">
          <el-input v-model="editForm.username" />
        </el-form-item>
        <el-form-item label="邮箱" prop="email">
          <el-input v-model="editForm.email" type="email" />
        </el-form-item>
      </el-form>
      
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="showEditProfile = false">取消</el-button>
          <el-button type="primary" :loading="authStore.isLoading" @click="saveProfile">
            保存
          </el-button>
        </span>
      </template>
    </el-dialog>

    <!-- 修改密码对话框 -->
    <el-dialog
      v-model="showChangePassword"
      title="修改密码"
      width="500px"
      destroy-on-close
    >
      <el-form
        ref="passwordFormRef"
        :model="passwordForm"
        :rules="passwordRules"
        label-width="100px"
      >
        <el-form-item label="当前密码" prop="oldPassword">
          <el-input v-model="passwordForm.oldPassword" type="password" show-password />
        </el-form-item>
        <el-form-item label="新密码" prop="newPassword">
          <el-input v-model="passwordForm.newPassword" type="password" show-password />
        </el-form-item>
        <el-form-item label="确认密码" prop="confirmPassword">
          <el-input v-model="passwordForm.confirmPassword" type="password" show-password />
        </el-form-item>
      </el-form>
      
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="showChangePassword = false">取消</el-button>
          <el-button type="primary" :loading="authStore.isLoading" @click="changePassword">
            修改密码
          </el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import {
  User,
  Collection,
  Check,
  Loading,
  Folder,
  Refresh,
  Picture,
  EditPen,
  Upload,
  Search,
  Grid,
  List,
  ArrowDown,
  FolderOpened,
  WarningFilled
} from '@element-plus/icons-vue'
import { useAuthStore } from '../stores/auth'
import { useModel3DStore } from '../stores/model3d'
import ModelViewer from '../components/ModelViewer.vue'
import type { UserModelHistory, UserStats, UpdateProfileRequest, ChangePasswordRequest } from '../types/auth'
import type { Model3D } from '../types/3d'

const router = useRouter()
const authStore = useAuthStore()
const model3dStore = useModel3DStore()

// 初始化示例模型
model3dStore.initSampleModels()

// 响应式数据
const userStats = ref<UserStats | null>(null)
const historyData = ref<{
  list: UserModelHistory[]
  total: number
  page: number
  pageSize: number
} | null>(null)
const historyLoading = ref(false)
const currentPage = ref(1)
const pageSize = ref(10)
const filterType = ref('')
const filterStatus = ref('')
const sortBy = ref('created_desc')
const searchKeyword = ref('')
const viewMode = ref<'grid' | 'list'>('grid')
const historyCurrentPage = ref(1)
const historyPageSize = ref(12)

// 对话框控制
const showEditProfile = ref(false)
const showChangePassword = ref(false)

// 表单引用
const editFormRef = ref<FormInstance>()
const passwordFormRef = ref<FormInstance>()

// 编辑资料表单
const editForm = reactive<UpdateProfileRequest>({
  username: '',
  email: ''
})

// 修改密码表单
const passwordForm = reactive<ChangePasswordRequest>({
  oldPassword: '',
  newPassword: '',
  confirmPassword: ''
})

// 表单验证规则
const editRules: FormRules = {
  username: [
    { required: true, message: '请输入用户名', trigger: 'blur' },
    { min: 3, max: 20, message: '用户名长度应为3-20位', trigger: 'blur' }
  ],
  email: [
    { required: true, message: '请输入邮箱', trigger: 'blur' },
    { type: 'email', message: '请输入有效的邮箱地址', trigger: 'blur' }
  ]
}

const passwordRules: FormRules = {
  oldPassword: [
    { required: true, message: '请输入当前密码', trigger: 'blur' }
  ],
  newPassword: [
    { required: true, message: '请输入新密码', trigger: 'blur' },
    { min: 6, message: '密码长度至少为6位', trigger: 'blur' }
  ],
  confirmPassword: [
    { required: true, message: '请确认新密码', trigger: 'blur' },
    {
      validator: (rule: any, value: any, callback: any) => {
        if (value !== passwordForm.newPassword) {
          callback(new Error('两次输入密码不一致'))
        } else {
          callback()
        }
      },
      trigger: 'blur'
    }
  ]
}

// 计算属性
const filteredHistory = computed(() => {
  if (!historyData.value?.list) return []
  let result = [...historyData.value.list]
  
  // 搜索过滤
  if (searchKeyword.value) {
    const keyword = searchKeyword.value.toLowerCase()
    result = result.filter(item => 
      item.modelName.toLowerCase().includes(keyword) ||
      item.sourceContent.toLowerCase().includes(keyword)
    )
  }
  
  // 类型过滤
  if (filterType.value && filterType.value !== 'all') {
    result = result.filter(item => item.modelType === filterType.value)
  }
  
  // 状态过滤
  if (filterStatus.value && filterStatus.value !== 'all') {
    result = result.filter(item => item.status === filterStatus.value)
  }
  
  // 排序
  result.sort((a, b) => {
    switch (sortBy.value) {
      case 'created_desc':
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      case 'created_asc':
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      case 'name_asc':
        return a.modelName.localeCompare(b.modelName)
      case 'name_desc':
        return b.modelName.localeCompare(a.modelName)
      default:
        return 0
    }
  })
  
  return result
})

const completedHistory = computed(() => 
  historyData.value?.list?.filter(item => item.status === 'completed') || []
)

const textHistory = computed(() => 
  historyData.value?.list?.filter(item => item.modelType === 'text') || []
)

const imageHistory = computed(() => 
  historyData.value?.list?.filter(item => item.modelType === 'image') || []
)

const paginatedHistory = computed(() => {
  const start = (historyCurrentPage.value - 1) * historyPageSize.value
  const end = start + historyPageSize.value
  return filteredHistory.value.slice(start, end)
})

// 方法
const formatDate = (date: Date | undefined) => {
  if (!date) return ''
  return new Date(date).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const formatStorage = (bytes: number) => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

const getModelTypeLabel = (type: string) => {
  const labels: Record<string, string> = {
    text: '文本生成',
    image: '图片生成',
    upload: '上传模型'
  }
  return labels[type] || type
}

const getModelTypeTagType = (type: string) => {
  const types: Record<string, any> = {
    text: 'primary',
    image: 'success',
    upload: 'warning'
  }
  return types[type] || 'info'
}

const getStatusLabel = (status: string) => {
  const labels: Record<string, string> = {
    completed: '已完成',
    failed: '失败',
    generating: '生成中'
  }
  return labels[status] || status
}

const getStatusTagType = (status: string) => {
  const types: Record<string, any> = {
    completed: 'success',
    failed: 'danger',
    generating: 'warning'
  }
  return types[status] || 'info'
}

// 加载用户统计信息
const loadUserStats = async () => {
  const stats = await authStore.getUserStats()
  if (stats) {
    userStats.value = stats
  }
}

// 加载模型历史
const loadHistory = async () => {
  historyLoading.value = true
  try {
    console.log('Loading user model history...')
    const data = await authStore.getUserModelHistory(currentPage.value, pageSize.value)
    console.log('Model history loaded:', data)
    if (data) {
      historyData.value = data
    }
  } catch (error) {
    console.error('Failed to load history:', error)
  } finally {
    historyLoading.value = false
  }
}

// 刷新历史记录
const refreshHistory = () => {
  loadHistory()
  loadUserStats()
}

// 分页处理
const handleSizeChange = (size: number) => {
  pageSize.value = size
  loadHistory()
}

const handleCurrentChange = (page: number) => {
  currentPage.value = page
  loadHistory()
}

// 查看模型
const viewModel = (item: UserModelHistory) => {
  router.push(`/model/${item.modelId}`)
}

// 下载模型
const downloadModel = async (item: UserModelHistory) => {
  ElMessage.info('下载功能正在开发中...')
}

// 删除模型
const deleteModel = async (item: UserModelHistory) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除模型 "${item.modelName}" 吗？此操作不可撤销。`,
      '确认删除',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
    
    ElMessage.success('模型删除成功')
    refreshHistory()
  } catch {
    // 用户取消删除
  }
}

// 获取模型来源预览文本
const getSourcePreview = (item: UserModelHistory): string => {
  if (item.modelType === 'text') {
    return item.sourceContent.length > 50 
      ? item.sourceContent.substring(0, 50) + '...'
      : item.sourceContent
  } else {
    return '图片文件'
  }
}

// 格式化时间显示
const formatTime = (date: Date | string): string => {
  const targetDate = typeof date === 'string' ? new Date(date) : date
  const now = new Date()
  const diff = now.getTime() - targetDate.getTime()
  const minutes = Math.floor(diff / 60000)
  
  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes}分钟前`
  
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}小时前`
  
  return targetDate.toLocaleDateString('zh-CN')
}

// 处理模型操作
const handleModelAction = async (command: string, item: UserModelHistory) => {
  if (command === 'delete') {
    await deleteModel(item)
  } else if (command === 'download') {
    await downloadModel(item)
  }
}

// 获取表格行类名
const getRowClassName = ({ row }: { row: UserModelHistory }) => {
  let className = ''
  if (row.status === 'failed') className += 'failed-row '
  return className.trim()
}

// 处理历史记录分页变化
const handleHistoryPageChange = (page: number) => {
  historyCurrentPage.value = page
}

const imageErrorMap = ref<Record<string, boolean>>({})

// 处理图片加载错误
const handleImageError = (item: UserModelHistory) => {
  imageErrorMap.value[item.id] = true
}

// 根据ModelID获取实际的3D模型
const getActualModel = (item: UserModelHistory): Model3D | null => {
  if (!item.modelId) return null
  return model3dStore.getModelById(item.modelId) || null
}

// 检查模型是否可以渲染
const canRenderModel = (item: UserModelHistory): boolean => {
  const model = getActualModel(item)
  return !!(model && model.status === 'completed' && model.geometry)
}

// 保存个人资料
const saveProfile = async () => {
  if (!editFormRef.value) return
  
  try {
    const valid = await editFormRef.value.validate()
    if (!valid) return
    
    const success = await authStore.updateProfile(editForm)
    if (success) {
      showEditProfile.value = false
    }
  } catch (error) {
    console.error('Save profile error:', error)
  }
}

// 修改密码
const changePassword = async () => {
  if (!passwordFormRef.value) return
  
  try {
    const valid = await passwordFormRef.value.validate()
    if (!valid) return
    
    const success = await authStore.changePassword(passwordForm)
    if (success) {
      showChangePassword.value = false
      // 清空表单
      passwordForm.oldPassword = ''
      passwordForm.newPassword = ''
      passwordForm.confirmPassword = ''
    }
  } catch (error) {
    console.error('Change password error:', error)
  }
}

// 组件挂载时初始化
onMounted(async () => {
  // 等待认证状态初始化
  if (!authStore.isAuthenticated) {
    // 尝试初始化认证状态
    try {
      await authStore.initAuth()
    } catch (error) {
      console.error('Failed to initialize auth:', error)
    }
    
    // 再次检查是否已登录
    if (!authStore.isAuthenticated) {
      router.push('/auth/login')
      return
    }
  }
  
  // 初始化编辑表单
  if (authStore.currentUser) {
    editForm.username = authStore.currentUser.username
    editForm.email = authStore.currentUser.email
  }
  
  // 加载数据
  try {
    await Promise.all([
      loadUserStats(),
      loadHistory()
    ])
  } catch (error) {
    console.error('Failed to load profile data:', error)
  }
})
</script>

<style scoped>
.profile-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 24px;
}

.profile-header {
  margin-bottom: 24px;
}

.profile-card {
  border-radius: 12px;
}

.profile-info {
  display: flex;
  align-items: center;
  gap: 24px;
}

.avatar-section {
  text-align: center;
}

.user-avatar {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.avatar-upload {
  margin-top: 8px;
}

.user-details {
  flex: 1;
}

.user-details h2 {
  margin: 0 0 8px 0;
  color: #2c3e50;
  font-size: 24px;
}

.user-email {
  color: #606266;
  margin: 4px 0;
  font-size: 16px;
}

.join-date {
  color: #909399;
  margin: 4px 0;
  font-size: 14px;
}

.profile-actions {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.stats-section {
  margin-bottom: 24px;
}

.stat-card {
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.stat-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.1);
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 16px;
}

.stat-content {
  text-align: left;
}

.stat-number {
  font-size: 24px;
  font-weight: 600;
  color: #2c3e50;
  margin-bottom: 4px;
}

.stat-label {
  color: #606266;
  font-size: 14px;
}

.history-section {
  margin-bottom: 24px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.history-content {
  min-height: 200px;
}

.filters-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  padding: 16px;
  background: #fafafa;
  border-radius: 8px;
  border: 1px solid #e0e0e0;
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
  background: #f0f8ff;
  border-radius: 8px;
  border: 1px solid #409eff20;
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
  min-height: 300px;
}

.history-models {
  margin-bottom: 24px;
}

.models-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 20px;
  margin-bottom: 24px;
}

.model-card {
  border: 1px solid #e0e0e0;
  border-radius: 12px;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.3s ease;
  background: white;
}

.model-card:hover {
  border-color: #409eff;
  box-shadow: 0 4px 12px rgba(64, 158, 255, 0.15);
  transform: translateY(-2px);
}

.model-card.failed {
  border-color: #f56c6c;
  background-color: #fef0f0;
}

.model-preview {
  height: 180px;
  background: #f5f5f5;
  border-radius: 8px 8px 0 0;
  overflow: hidden;
  position: relative;
}

.model-preview :deep(.profile-model-viewer) {
  border: none;
  border-radius: 0;
  height: 100%;
}

.model-preview :deep(.profile-model-viewer .controls),
.model-preview :deep(.profile-model-viewer .model-info) {
  display: none; /* 在个人中心中隐藏控制按钮和信息 */
}

.preview-image {
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.thumbnail-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.preview-placeholder {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #909399;
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
  position: relative;
}

.preview-placeholder::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: radial-gradient(circle at 30% 70%, rgba(255, 255, 255, 0.3) 0%, transparent 50%);
}

.preview-placeholder .el-icon {
  margin-bottom: 8px;
  z-index: 1;
}

.preview-placeholder p {
  margin: 0;
  font-size: 12px;
  z-index: 1;
  font-weight: 500;
}

/* 不同类型模型的占位符样式 */
.placeholder-text {
  background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%);
  color: #1976d2;
}

.placeholder-image {
  background: linear-gradient(135deg, #f3e5f5 0%, #e1bee7 100%);
  color: #7b1fa2;
}

.placeholder-upload {
  background: linear-gradient(135deg, #fff3e0 0%, #ffcc02 100%);
  color: #f57c00;
}

.model-info {
  padding: 16px;
}

.model-info h4 {
  margin: 0 0 8px 0;
  color: #303133;
  font-size: 16px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.model-source {
  margin: 0 0 12px 0;
  color: #666;
  font-size: 14px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  line-height: 1.4;
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

:deep(.failed-row) {
  background-color: #fef0f0 !important;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .profile-container {
    padding: 16px;
  }
  
  .profile-info {
    flex-direction: column;
    text-align: center;
    gap: 16px;
  }
  
  .profile-actions {
    flex-direction: row;
    justify-content: center;
  }
  
  .history-grid {
    grid-template-columns: 1fr;
  }
  
  .header-actions {
    flex-direction: column;
    gap: 8px;
  }
}

@media (max-width: 480px) {
  .stat-item {
    flex-direction: column;
    text-align: center;
    gap: 8px;
  }
  
  .card-header {
    flex-direction: column;
    align-items: stretch;
    gap: 16px;
  }
}
</style>