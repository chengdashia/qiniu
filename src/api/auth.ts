import axios from 'axios'
import type { 
  LoginRequest, 
  RegisterRequest, 
  AuthResponse, 
  User,
  UpdateProfileRequest,
  ChangePasswordRequest,
  UserModelHistory,
  UserStats
} from '../types/auth'

// 创建axios实例
const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
})

// 请求拦截器 - 添加token
api.interceptors.request.use(
  (config) => {
    const token = sessionStorage.getItem('auth_token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

/**
 * 模拟数据 - 临时用户数据库
 */
const mockUsers: User[] = [
  {
    id: 'user_1',
    username: 'demo_user',
    email: 'demo@example.com',
    avatar: 'https://cube.elemecdn.com/0/88/03b0d39583f48206768a7534e55bcpng.png',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date()
  }
]

// 模拟密码存储 (实际应用中应该加密存储)
const mockPasswords: Record<string, string> = {
  'demo_user': 'password123',
  'admin': 'admin123'
}

/**
 * 从token中提取用户ID
 */
function extractUserIdFromToken(token: string): string | null {
  console.log('Extracting user ID from token:', token)
  
  // token 格式: mock_token_{userId}_{timestamp}
  // 由于userID可能包含下划线，需要特殊处理
  const prefix = 'mock_token_'
  const timestampSuffixRegex = /_\d+$/
  
  if (!token.startsWith(prefix)) {
    console.log('Invalid token prefix')
    return null
  }
  
  // 移除前缀
  let remaining = token.substring(prefix.length)
  console.log('After removing prefix:', remaining)
  
  // 移除末尾的时间戳
  const userId = remaining.replace(timestampSuffixRegex, '')
  console.log('Extracted user ID:', userId)
  
  return userId || null
}

/**
 * 认证API服务
 */
export const authApi = {
  /**
   * 用户登录
   */
  async login(credentials: LoginRequest): Promise<AuthResponse> {
    try {
      // 模拟API延迟
      await new Promise(resolve => setTimeout(resolve, 800))
      
      // 查找用户
      const user = mockUsers.find(u => u.username === credentials.username)
      const storedPassword = mockPasswords[credentials.username]
      
      if (!user || storedPassword !== credentials.password) {
        return {
          success: false,
          error: 'INVALID_CREDENTIALS',
          message: '用户名或密码错误'
        }
      }
      
      // 生成模拟token
      const token = `mock_token_${user.id}_${Date.now()}`
      const refreshToken = `mock_refresh_${user.id}_${Date.now()}`
      
      return {
        success: true,
        data: {
          user,
          token,
          refreshToken
        },
        message: '登录成功'
      }
    } catch (error) {
      console.error('Login error:', error)
      return {
        success: false,
        error: 'NETWORK_ERROR',
        message: '网络错误，请稍后重试'
      }
    }
  },

  /**
   * 用户注册
   */
  async register(userData: RegisterRequest): Promise<AuthResponse> {
    try {
      // 模拟API延迟
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      // 检查用户名是否已存在
      if (mockUsers.find(u => u.username === userData.username)) {
        return {
          success: false,
          error: 'USERNAME_ALREADY_EXISTS',
          message: '用户名已存在'
        }
      }
      
      // 检查邮箱是否已存在
      if (mockUsers.find(u => u.email === userData.email)) {
        return {
          success: false,
          error: 'EMAIL_ALREADY_EXISTS',
          message: '邮箱已被注册'
        }
      }
      
      // 创建新用户
      const newUser: User = {
        id: `user_${Date.now()}`,
        username: userData.username,
        email: userData.email,
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${userData.username}`,
        createdAt: new Date(),
        updatedAt: new Date()
      }
      
      // 添加到模拟数据库
      mockUsers.push(newUser)
      mockPasswords[userData.username] = userData.password
      
      // 生成token
      const token = `mock_token_${newUser.id}_${Date.now()}`
      const refreshToken = `mock_refresh_${newUser.id}_${Date.now()}`
      
      return {
        success: true,
        data: {
          user: newUser,
          token,
          refreshToken
        },
        message: '注册成功'
      }
    } catch (error) {
      console.error('Register error:', error)
      return {
        success: false,
        error: 'NETWORK_ERROR',
        message: '网络错误，请稍后重试'
      }
    }
  },

  /**
   * 退出登录
   */
  async logout(): Promise<{ success: boolean; message?: string }> {
    try {
      // 模拟API延迟
      await new Promise(resolve => setTimeout(resolve, 300))
      
      // 清除会话存储
      sessionStorage.removeItem('auth_token')
      sessionStorage.removeItem('refresh_token')
      sessionStorage.removeItem('user_info')
      
      return {
        success: true,
        message: '退出成功'
      }
    } catch (error) {
      console.error('Logout error:', error)
      return {
        success: false,
        message: '退出失败'
      }
    }
  },

  /**
   * 获取当前用户信息
   */
  async getCurrentUser(): Promise<AuthResponse> {
    try {
      const token = sessionStorage.getItem('auth_token')
      if (!token) {
        return {
          success: false,
          error: 'TOKEN_EXPIRED',
          message: '请先登录'
        }
      }
      
      const userId = extractUserIdFromToken(token)
      if (!userId) {
        return {
          success: false,
          error: 'TOKEN_EXPIRED',
          message: 'Token格式错误'
        }
      }
      
      const user = mockUsers.find(u => u.id === userId)
      
      if (!user) {
        return {
          success: false,
          error: 'USER_NOT_FOUND',
          message: '用户不存在'
        }
      }
      
      return {
        success: true,
        data: {
          user,
          token,
          refreshToken: sessionStorage.getItem('refresh_token') || ''
        }
      }
    } catch (error) {
      console.error('Get current user error:', error)
      return {
        success: false,
        error: 'NETWORK_ERROR',
        message: '获取用户信息失败'
      }
    }
  },

  /**
   * 更新用户资料
   */
  async updateProfile(updates: UpdateProfileRequest): Promise<AuthResponse> {
    try {
      const token = sessionStorage.getItem('auth_token')
      if (!token) {
        return {
          success: false,
          error: 'TOKEN_EXPIRED',
          message: '请先登录'
        }
      }
      
      const userId = extractUserIdFromToken(token)
      if (!userId) {
        return {
          success: false,
          error: 'TOKEN_EXPIRED',
          message: 'Token格式错误'
        }
      }
      
      const userIndex = mockUsers.findIndex(u => u.id === userId)
      
      if (userIndex === -1) {
        return {
          success: false,
          error: 'USER_NOT_FOUND',
          message: '用户不存在'
        }
      }
      
      // 更新用户信息
      const user = mockUsers[userIndex]
      if (!user) {
        return {
          success: false,
          error: 'USER_NOT_FOUND',
          message: '用户不存在'
        }
      }
      
      if (updates.username) user.username = updates.username
      if (updates.email) user.email = updates.email
      if (updates.avatar) user.avatar = updates.avatar
      user.updatedAt = new Date()
      
      mockUsers[userIndex] = user
      
      return {
        success: true,
        data: {
          user,
          token,
          refreshToken: sessionStorage.getItem('refresh_token') || ''
        },
        message: '资料更新成功'
      }
    } catch (error) {
      console.error('Update profile error:', error)
      return {
        success: false,
        error: 'NETWORK_ERROR',
        message: '更新失败'
      }
    }
  },

  /**
   * 修改密码
   */
  async changePassword(passwordData: ChangePasswordRequest): Promise<{ success: boolean; message: string }> {
    try {
      const token = sessionStorage.getItem('auth_token')
      if (!token) {
        return {
          success: false,
          message: '请先登录'
        }
      }
      
      const userId = extractUserIdFromToken(token)
      if (!userId) {
        return {
          success: false,
          message: 'Token格式错误'
        }
      }
      
      const user = mockUsers.find(u => u.id === userId)
      
      if (!user) {
        return {
          success: false,
          message: '用户不存在'
        }
      }
      
      // 验证旧密码
      const currentPassword = mockPasswords[user.username]
      if (currentPassword !== passwordData.oldPassword) {
        return {
          success: false,
          message: '当前密码错误'
        }
      }
      
      // 更新密码
      mockPasswords[user.username] = passwordData.newPassword
      
      return {
        success: true,
        message: '密码修改成功'
      }
    } catch (error) {
      console.error('Change password error:', error)
      return {
        success: false,
        message: '修改密码失败'
      }
    }
  },

  /**
   * 获取用户模型历史
   */
  async getUserModelHistory(page = 1, pageSize = 10): Promise<{
    success: boolean
    data?: {
      list: UserModelHistory[]
      total: number
      page: number
      pageSize: number
    }
    error?: string
  }> {
    try {
      const token = sessionStorage.getItem('auth_token')
      if (!token) {
        return {
          success: false,
          error: '请先登录'
        }
      }
      
      const userId = extractUserIdFromToken(token)
      if (!userId) {
        return {
          success: false,
          error: 'Token格式错误'
        }
      }
      
      // 获取当前用户的3D模型数据
      // 模拟从3D模型store获取数据
      const mockHistory: UserModelHistory[] = [
        {
          id: 'history_1',
          userId: 'user_1',
          modelId: 'sample_0', // 关联到实际的3D模型ID
          modelName: '一个立方体机器人',
          modelType: 'text',
          sourceContent: '一个立方体机器人',
          thumbnailUrl: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTUwIiBoZWlnaHQ9IjE1MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjNDA5ZWZmIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIyNCIgZmlsbD0iI2ZmZiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPjNEPC90ZXh0Pjwvc3ZnPg==',
          createdAt: new Date('2024-01-15'),
          status: 'completed'
        },
        {
          id: 'history_2',
          userId: 'user_1',
          modelId: 'sample_1',
          modelName: '蓝色的球形物体',
          modelType: 'text',
          sourceContent: '蓝色的球形物体',
          thumbnailUrl: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTUwIiBoZWlnaHQ9IjE1MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjNjdjMjNhIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIyNCIgZmlsbD0iI2ZmZiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPjNEPC90ZXh0Pjwvc3ZnPg==',
          createdAt: new Date('2024-01-14'),
          status: 'completed'
        },
        {
          id: 'history_3',
          userId: 'user_1',
          modelId: 'sample_2',
          modelName: '红色的圆环形状',
          modelType: 'text',
          sourceContent: '红色的圆环形状',
          thumbnailUrl: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTUwIiBoZWlnaHQ9IjE1MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZTZhMjNjIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIyMCIgZmlsbD0iI2ZmZiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPjNEPC90ZXh0Pjwvc3ZnPg==',
          createdAt: new Date('2024-01-13'),
          status: 'completed'
        },
        {
          id: 'history_4',
          userId: 'user_1',
          modelId: 'sample_3',
          modelName: '绿色的圆锥体建筑',
          modelType: 'text',
          sourceContent: '绿色的圆锥体建筑',
          thumbnailUrl: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTUwIiBoZWlnaHQ9IjE1MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjNjdjMjNhIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIyMCIgZmlsbD0iI2ZmZiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPjNEPC90ZXh0Pjwvc3ZnPg==',
          createdAt: new Date('2024-01-12'),
          status: 'completed'
        },
        {
          id: 'history_5',
          userId: 'user_1',
          modelId: 'sample_4',
          modelName: '紫色的多面体水晶',
          modelType: 'text',
          sourceContent: '紫色的多面体水晶',
          thumbnailUrl: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTUwIiBoZWlnaHQ9IjE1MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjOTA5Mzk5Ii8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIyNCIgZmlsbD0iI2ZmZiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPjNEPC90ZXh0Pjwvc3ZnPg==',
          createdAt: new Date('2024-01-11'),
          status: 'completed'
        }
      ]
      
      const startIndex = (page - 1) * pageSize
      const endIndex = startIndex + pageSize
      const paginatedData = mockHistory.slice(startIndex, endIndex)
      
      return {
        success: true,
        data: {
          list: paginatedData,
          total: mockHistory.length,
          page,
          pageSize
        }
      }
    } catch (error) {
      console.error('Get user model history error:', error)
      return {
        success: false,
        error: '获取历史记录失败'
      }
    }
  },

  /**
   * 获取用户统计信息
   */
  async getUserStats(): Promise<{
    success: boolean
    data?: UserStats
    error?: string
  }> {
    try {
      const token = sessionStorage.getItem('auth_token')
      if (!token) {
        return {
          success: false,
          error: '请先登录'
        }
      }
      
      // 模拟统计数据 - 基于实际模型数量
      const stats: UserStats = {
        totalModels: 5,
        completedModels: 4,
        failedModels: 0,
        generatingModels: 1,
        totalStorage: 1024 * 1024 * 15, // 15MB
        lastActiveAt: new Date()
      }
      
      return {
        success: true,
        data: stats
      }
    } catch (error) {
      console.error('Get user stats error:', error)
      return {
        success: false,
        error: '获取统计信息失败'
      }
    }
  }
}

export default authApi