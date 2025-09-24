import { defineStore } from 'pinia'
import { ref, computed, readonly } from 'vue'
import { ElMessage } from 'element-plus'
import type { User, AuthState, LoginRequest, RegisterRequest, UpdateProfileRequest, ChangePasswordRequest, UserModelHistory, UserStats } from '../types/auth'
import { authApi } from '../api/auth'

export const useAuthStore = defineStore('auth', () => {
  // 状态
  const user = ref<User | null>(null)
  const token = ref<string | null>(sessionStorage.getItem('auth_token'))
  const refreshToken = ref<string | null>(sessionStorage.getItem('refresh_token'))
  const isLoading = ref(false)

  // 计算属性
  const isAuthenticated = computed(() => !!token.value && !!user.value)
  const currentUser = computed(() => user.value)

  // 初始化认证状态
  async function initAuth() {
    const storedToken = sessionStorage.getItem('auth_token')
    const storedRefreshToken = sessionStorage.getItem('refresh_token')
    const storedUserInfo = sessionStorage.getItem('user_info')
    
    console.log('=== Auth Initialization Start ===')
    console.log('StoredToken:', storedToken)
    console.log('StoredRefreshToken:', storedRefreshToken)
    console.log('StoredUserInfo:', storedUserInfo)
    
    // 如果没有存储的认证信息，直接返回
    if (!storedToken || !storedUserInfo) {
      console.log('No stored auth data found, clearing state')
      clearAuthState()
      return
    }
    
    try {
      // 恢复本地状态
      const parsedUserInfo = JSON.parse(storedUserInfo)
      console.log('Parsed user info:', parsedUserInfo)
      
      token.value = storedToken
      refreshToken.value = storedRefreshToken
      user.value = parsedUserInfo
      
      console.log('Local auth state restored:')
      console.log('- Token:', !!token.value)
      console.log('- User:', user.value)
      console.log('- IsAuthenticated:', isAuthenticated.value)
      
      // 验证token是否仍然有效
      console.log('Validating token...')
      const isValid = await getCurrentUser()
      
      if (!isValid) {
        console.log('Token validation failed, clearing auth state')
        clearAuthState()
      } else {
        console.log('✅ Auth state successfully restored and validated')
        console.log('Final isAuthenticated:', isAuthenticated.value)
      }
    } catch (error) {
      console.error('❌ Failed to restore auth state:', error)
      // 如果恢复失败，清除所有状态
      clearAuthState()
    }
    
    console.log('=== Auth Initialization End ===')
    console.log('Final state - isAuthenticated:', isAuthenticated.value)
  }

  /**
   * 用户登录
   */
  async function login(credentials: LoginRequest): Promise<boolean> {
    isLoading.value = true
    try {
      const response = await authApi.login(credentials)
      
      if (response.success && response.data) {
        // 保存认证信息
        user.value = response.data.user
        token.value = response.data.token
        refreshToken.value = response.data.refreshToken
        
        // 保存到本地存储
        sessionStorage.setItem('auth_token', response.data.token)
        sessionStorage.setItem('refresh_token', response.data.refreshToken)
        sessionStorage.setItem('user_info', JSON.stringify(response.data.user))
        
        ElMessage.success(response.message || '登录成功')
        return true
      } else {
        ElMessage.error(response.message || '登录失败')
        return false
      }
    } catch (error) {
      console.error('Login error:', error)
      ElMessage.error('登录过程中发生错误')
      return false
    } finally {
      isLoading.value = false
    }
  }

  /**
   * 用户注册
   */
  async function register(userData: RegisterRequest): Promise<boolean> {
    isLoading.value = true
    try {
      const response = await authApi.register(userData)
      
      if (response.success && response.data) {
        // 保存认证信息
        user.value = response.data.user
        token.value = response.data.token
        refreshToken.value = response.data.refreshToken
        
        // 保存到本地存储
        sessionStorage.setItem('auth_token', response.data.token)
        sessionStorage.setItem('refresh_token', response.data.refreshToken)
        sessionStorage.setItem('user_info', JSON.stringify(response.data.user))
        
        ElMessage.success(response.message || '注册成功')
        return true
      } else {
        ElMessage.error(response.message || '注册失败')
        return false
      }
    } catch (error) {
      console.error('Register error:', error)
      ElMessage.error('注册过程中发生错误')
      return false
    } finally {
      isLoading.value = false
    }
  }

  /**
   * 用户退出
   */
  async function logout(): Promise<boolean> {
    isLoading.value = true
    try {
      const response = await authApi.logout()
      
      if (response.success) {
        // 清除状态
        clearAuthState()
        ElMessage.success(response.message || '退出成功')
        return true
      } else {
        ElMessage.error(response.message || '退出失败')
        return false
      }
    } catch (error) {
      console.error('Logout error:', error)
      // 即使API失败也要清除本地状态
      clearAuthState()
      ElMessage.warning('退出时发生错误，但已清除本地数据')
      return true
    } finally {
      isLoading.value = false
    }
  }

  /**
   * 获取当前用户信息
   */
  async function getCurrentUser(): Promise<boolean> {
    if (!token.value) {
      console.log('No token available for user validation')
      return false
    }
    
    isLoading.value = true
    try {
      const response = await authApi.getCurrentUser()
      
      if (response.success && response.data) {
        user.value = response.data.user
        // 更新本地存储的用户信息
        sessionStorage.setItem('user_info', JSON.stringify(response.data.user))
        console.log('User validation successful')
        return true
      } else {
        // token无效，清除认证状态
        console.log('User validation failed:', response.message)
        clearAuthState()
        return false
      }
    } catch (error) {
      console.error('Get current user error:', error)
      // 网络错误时不清除状态，保持离线状态
      // 但如果是401错误（未授权），则清除状态
      if (error instanceof Error && error.message.includes('401')) {
        console.log('Token expired or invalid, clearing auth state')
        clearAuthState()
        return false
      }
      return false
    } finally {
      isLoading.value = false
    }
  }

  /**
   * 更新用户资料
   */
  async function updateProfile(updates: UpdateProfileRequest): Promise<boolean> {
    if (!isAuthenticated.value) {
      ElMessage.error('请先登录')
      return false
    }
    
    isLoading.value = true
    try {
      const response = await authApi.updateProfile(updates)
      
      if (response.success && response.data) {
        user.value = response.data.user
        sessionStorage.setItem('user_info', JSON.stringify(response.data.user))
        ElMessage.success(response.message || '资料更新成功')
        return true
      } else {
        ElMessage.error(response.message || '更新失败')
        return false
      }
    } catch (error) {
      console.error('Update profile error:', error)
      ElMessage.error('更新过程中发生错误')
      return false
    } finally {
      isLoading.value = false
    }
  }

  /**
   * 修改密码
   */
  async function changePassword(passwordData: ChangePasswordRequest): Promise<boolean> {
    if (!isAuthenticated.value) {
      ElMessage.error('请先登录')
      return false
    }
    
    isLoading.value = true
    try {
      const response = await authApi.changePassword(passwordData)
      
      if (response.success) {
        ElMessage.success(response.message || '密码修改成功')
        return true
      } else {
        ElMessage.error(response.message || '密码修改失败')
        return false
      }
    } catch (error) {
      console.error('Change password error:', error)
      ElMessage.error('修改密码过程中发生错误')
      return false
    } finally {
      isLoading.value = false
    }
  }

  /**
   * 获取用户模型历史
   */
  async function getUserModelHistory(page = 1, pageSize = 10): Promise<{
    list: UserModelHistory[]
    total: number
    page: number
    pageSize: number
  } | null> {
    if (!isAuthenticated.value) {
      ElMessage.error('请先登录')
      return null
    }
    
    try {
      const response = await authApi.getUserModelHistory(page, pageSize)
      
      if (response.success && response.data) {
        return response.data
      } else {
        ElMessage.error(response.error || '获取历史记录失败')
        return null
      }
    } catch (error) {
      console.error('Get user model history error:', error)
      ElMessage.error('获取历史记录时发生错误')
      return null
    }
  }

  /**
   * 获取用户统计信息
   */
  async function getUserStats(): Promise<UserStats | null> {
    if (!isAuthenticated.value) {
      ElMessage.error('请先登录')
      return null
    }
    
    try {
      const response = await authApi.getUserStats()
      
      if (response.success && response.data) {
        return response.data
      } else {
        ElMessage.error(response.error || '获取统计信息失败')
        return null
      }
    } catch (error) {
      console.error('Get user stats error:', error)
      ElMessage.error('获取统计信息时发生错误')
      return null
    }
  }

  /**
   * 调试方法 - 检查当前状态
   */
  function debugAuthState() {
    console.log('=== Debug Auth State ===')
    console.log('token.value:', token.value)
    console.log('user.value:', user.value)
    console.log('isAuthenticated.value:', isAuthenticated.value)
    console.log('sessionStorage auth_token:', sessionStorage.getItem('auth_token'))
    console.log('sessionStorage user_info:', sessionStorage.getItem('user_info'))
    console.log('========================')
  }

  /**
   * 清除认证状态
   */
  function clearAuthState() {
    user.value = null
    token.value = null
    refreshToken.value = null
    
    // 清除会话存储
    sessionStorage.removeItem('auth_token')
    sessionStorage.removeItem('refresh_token')
    sessionStorage.removeItem('user_info')
  }

  /**
   * 检查权限
   */
  function hasPermission(permission: string): boolean {
    if (!isAuthenticated.value) return false
    
    // 这里可以根据实际需求实现权限检查逻辑
    // 目前简单返回已认证状态
    return true
  }

  /**
   * 检查是否为管理员
   */
  function isAdmin(): boolean {
    if (!isAuthenticated.value || !user.value) return false
    
    // 这里可以根据实际需求检查用户角色
    // 目前简单检查用户名
    return user.value.username === 'admin'
  }

  return {
    // 状态
    user: readonly(user),
    token: readonly(token),
    refreshToken: readonly(refreshToken),
    isLoading: readonly(isLoading),
    
    // 计算属性
    isAuthenticated,
    currentUser,
    
    // 方法
    initAuth,
    login,
    register,
    logout,
    getCurrentUser,
    updateProfile,
    changePassword,
    getUserModelHistory,
    getUserStats,
    clearAuthState,
    debugAuthState,
    hasPermission,
    isAdmin
  }
})