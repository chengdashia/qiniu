<template>
  <div class="login-container">
    <div class="login-card">
      <!-- 头部 -->
      <div class="login-header">
        <div class="logo">
          <el-icon size="48" color="#409eff">
            <Compass />
          </el-icon>
        </div>
        <h1>3D模型生成器</h1>
        <p>登录您的账户开始创作</p>
      </div>

      <!-- 登录表单 -->
      <el-form
        ref="loginFormRef"
        :model="loginForm"
        :rules="loginRules"
        class="login-form"
        label-position="top"
        size="large"
        @keyup.enter="handleSubmit"
      >
        <el-form-item label="用户名" prop="username">
          <el-input
            v-model="loginForm.username"
            placeholder="请输入用户名"
            prefix-icon="User"
            :clearable="true"
          />
        </el-form-item>

        <el-form-item label="密码" prop="password">
          <el-input
            v-model="loginForm.password"
            type="password"
            placeholder="请输入密码"
            prefix-icon="Lock"
            show-password
            :clearable="true"
          />
        </el-form-item>

        <el-form-item>
          <div class="form-options">
            <el-checkbox v-model="rememberMe">记住密码</el-checkbox>
            <el-link type="primary" :underline="false">忘记密码？</el-link>
          </div>
        </el-form-item>

        <el-form-item>
          <el-button
            type="primary"
            size="large"
            :loading="authStore.isLoading"
            :disabled="authStore.isLoading"
            @click="handleSubmit"
            class="login-button"
          >
            {{ authStore.isLoading ? '登录中...' : '登录' }}
          </el-button>
        </el-form-item>
      </el-form>

      <!-- 注册链接 -->
      <div class="register-link">
        <span>还没有账户？</span>
        <el-link type="primary" :underline="false" @click="goToRegister">
          立即注册
        </el-link>
      </div>

      <!-- 演示账户信息 -->
      <div class="demo-info">
        <el-alert
          title="演示账户"
          type="info"
          :closable="false"
          show-icon
        >
          <template #default>
            <p><strong>用户名:</strong> demo_user</p>
            <p><strong>密码:</strong> password123</p>
          </template>
        </el-alert>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { Compass, User, Lock } from '@element-plus/icons-vue'
import { useAuthStore } from '../stores/auth'
import type { LoginRequest } from '../types/auth'

const router = useRouter()
const authStore = useAuthStore()

// 表单引用
const loginFormRef = ref<FormInstance>()

// 表单数据
const loginForm = reactive<LoginRequest>({
  username: '',
  password: ''
})

// 记住密码
const rememberMe = ref(false)

// 表单验证规则
const loginRules: FormRules = {
  username: [
    { required: true, message: '请输入用户名', trigger: 'blur' },
    { min: 3, max: 20, message: '用户名长度应为3-20位', trigger: 'blur' }
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 6, message: '密码长度至少为6位', trigger: 'blur' }
  ]
}

// 处理登录提交
const handleSubmit = async () => {
  if (!loginFormRef.value) return

  try {
    // 验证表单
    const valid = await loginFormRef.value.validate()
    if (!valid) return

    // 执行登录
    const success = await authStore.login(loginForm)
    
    if (success) {
      // 保存记住密码设置
      if (rememberMe.value) {
        localStorage.setItem('remembered_username', loginForm.username)
      } else {
        localStorage.removeItem('remembered_username')
      }
      
      // 登录成功，跳转到首页或之前访问的页面
      const redirect = router.currentRoute.value.query.redirect as string
      router.push(redirect || '/')
    }
  } catch (error) {
    console.error('Login submit error:', error)
    ElMessage.error('登录过程中发生错误')
  }
}

// 跳转到注册页面
const goToRegister = () => {
  router.push('/auth/register')
}

// 组件挂载时恢复记住的用户名
onMounted(() => {
  const rememberedUsername = localStorage.getItem('remembered_username')
  if (rememberedUsername) {
    loginForm.username = rememberedUsername
    rememberMe.value = true
  }
  
  // 如果已经登录，直接跳转到首页
  if (authStore.isAuthenticated) {
    router.push('/')
  }
})
</script>

<style scoped>
.login-container {
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.login-card {
  background: white;
  border-radius: 16px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
  padding: 40px;
  width: 100%;
  max-width: 420px;
  position: relative;
  overflow: hidden;
}

.login-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
  background: linear-gradient(90deg, #409eff, #67c23a, #e6a23c, #f56c6c);
}

.login-header {
  text-align: center;
  margin-bottom: 40px;
}

.logo {
  margin-bottom: 16px;
}

.login-header h1 {
  color: #2c3e50;
  font-size: 28px;
  font-weight: 600;
  margin: 0 0 8px 0;
}

.login-header p {
  color: #606266;
  font-size: 16px;
  margin: 0;
}

.login-form {
  margin-bottom: 24px;
}

.form-options {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}

.login-button {
  width: 100%;
  height: 48px;
  font-size: 16px;
  font-weight: 500;
  border-radius: 8px;
}

.register-link {
  text-align: center;
  margin-bottom: 24px;
  color: #606266;
}

.register-link span {
  margin-right: 8px;
}

.demo-info {
  margin-top: 24px;
}

.demo-info :deep(.el-alert__content) {
  padding: 0;
}

.demo-info p {
  margin: 4px 0;
  font-size: 14px;
}

/* 响应式设计 */
@media (max-width: 480px) {
  .login-container {
    padding: 16px;
  }
  
  .login-card {
    padding: 24px;
  }
  
  .login-header h1 {
    font-size: 24px;
  }
  
  .login-header p {
    font-size: 14px;
  }
}

/* 动画效果 */
.login-card {
  animation: slideIn 0.5s ease-out;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(30px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* 表单样式增强 */
.login-form :deep(.el-form-item__label) {
  color: #2c3e50;
  font-weight: 500;
  margin-bottom: 8px;
}

.login-form :deep(.el-input__wrapper) {
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  transition: all 0.3s ease;
}

.login-form :deep(.el-input__wrapper:hover) {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.login-form :deep(.el-input__wrapper.is-focus) {
  box-shadow: 0 4px 12px rgba(64, 158, 255, 0.2);
}
</style>