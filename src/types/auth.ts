/**
 * 认证相关的类型定义
 */

// 用户信息接口
export interface User {
  id: string
  username: string
  email: string
  avatar?: string
  createdAt: Date
  updatedAt: Date
}

// 登录请求接口
export interface LoginRequest {
  username: string
  password: string
}

// 注册请求接口
export interface RegisterRequest {
  username: string
  email: string
  password: string
  confirmPassword: string
}

// 认证响应接口
export interface AuthResponse {
  success: boolean
  data?: {
    user: User
    token: string
    refreshToken: string
  }
  error?: string
  message?: string
}

// 用户资料更新请求
export interface UpdateProfileRequest {
  username?: string
  email?: string
  avatar?: string
}

// 密码修改请求
export interface ChangePasswordRequest {
  oldPassword: string
  newPassword: string
  confirmPassword: string
}

// 认证状态接口
export interface AuthState {
  user: User | null
  token: string | null
  refreshToken: string | null
  isAuthenticated: boolean
  isLoading: boolean
}

// 用户模型历史记录
export interface UserModelHistory {
  id: string
  userId: string
  modelId: string
  modelName: string
  modelType: 'text' | 'image' | 'upload'
  sourceContent: string
  thumbnailUrl?: string
  createdAt: Date
  status: 'completed' | 'failed' | 'generating'
}

// 用户统计信息
export interface UserStats {
  totalModels: number
  completedModels: number
  failedModels: number
  generatingModels: number
  totalStorage: number // 存储空间使用量（字节）
  lastActiveAt: Date
}

// 认证错误类型
export const AuthErrorType = {
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  EMAIL_ALREADY_EXISTS: 'EMAIL_ALREADY_EXISTS',
  USERNAME_ALREADY_EXISTS: 'USERNAME_ALREADY_EXISTS',
  WEAK_PASSWORD: 'WEAK_PASSWORD',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  NETWORK_ERROR: 'NETWORK_ERROR',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR'
} as const

export type AuthErrorType = typeof AuthErrorType[keyof typeof AuthErrorType]

// 认证错误接口
export interface AuthError {
  type: AuthErrorType
  message: string
  details?: any
}