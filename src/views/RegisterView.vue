<template>
  <div class="register-container">
    <div class="register-card">
      <!-- 头部 -->
      <div class="register-header">
        <div class="logo">
          <el-icon size="48" color="#409eff">
            <Compass />
          </el-icon>
        </div>
        <h1>3D模型生成器</h1>
        <p>创建您的账户，开启3D创作之旅</p>
      </div>

      <!-- 注册表单 -->
      <el-form
        ref="registerFormRef"
        :model="registerForm"
        :rules="registerRules"
        class="register-form"
        label-position="top"
        size="large"
        @keyup.enter="handleSubmit"
      >
        <el-form-item label="用户名" prop="username">
          <el-input
            v-model="registerForm.username"
            placeholder="请输入用户名（3-20位字符）"
            prefix-icon="User"
            :clearable="true"
          />
        </el-form-item>

        <el-form-item label="邮箱" prop="email">
          <el-input
            v-model="registerForm.email"
            type="email"
            placeholder="请输入邮箱地址"
            prefix-icon="Message"
            :clearable="true"
          />
        </el-form-item>

        <el-form-item label="密码" prop="password">
          <el-input
            v-model="registerForm.password"
            type="password"
            placeholder="请输入密码（至少6位）"
            prefix-icon="Lock"
            show-password
            :clearable="true"
          />
        </el-form-item>

        <el-form-item label="确认密码" prop="confirmPassword">
          <el-input
            v-model="registerForm.confirmPassword"
            type="password"
            placeholder="请再次输入密码"
            prefix-icon="Lock"
            show-password
            :clearable="true"
          />
        </el-form-item>

        <el-form-item>
          <div class="form-options">
            <el-checkbox v-model="agreeTerms">
              我同意
              <el-link type="primary" :underline="false">《用户协议》</el-link>
              和
              <el-link type="primary" :underline="false">《隐私政策》</el-link>
            </el-checkbox>
          </div>
        </el-form-item>

        <el-form-item>
          <el-button
            type="primary"
            size="large"
            :loading="authStore.isLoading"
            :disabled="authStore.isLoading || !agreeTerms"
            @click="handleSubmit"
            class="register-button"
          >
            {{ authStore.isLoading ? '注册中...' : '注册账户' }}
          </el-button>
        </el-form-item>
      </el-form>

      <!-- 登录链接 -->
      <div class="login-link">
        <span>已有账户？</span>
        <el-link type="primary" :underline="false" @click="goToLogin">
          立即登录
        </el-link>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { Compass, User, Message, Lock } from '@element-plus/icons-vue'
import { useAuthStore } from '../stores/auth'
import type { RegisterRequest } from '../types/auth'

const router = useRouter()
const authStore = useAuthStore()

// 表单引用
const registerFormRef = ref<FormInstance>()

// 表单数据
const registerForm = reactive<RegisterRequest>({
  username: '',
  email: '',
  password: '',
  confirmPassword: ''
})

// 同意条款
const agreeTerms = ref(false)

// 自定义验证器
const validateConfirmPassword = (rule: any, value: any, callback: any) => {
  if (value === '') {
    callback(new Error('请再次输入密码'))
  } else if (value !== registerForm.password) {
    callback(new Error('两次输入密码不一致'))
  } else {
    callback()
  }
}

const validateUsername = (rule: any, value: any, callback: any) => {
  const usernameRegex = /^[a-zA-Z0-9_-]+$/
  if (value === '') {
    callback(new Error('请输入用户名'))
  } else if (value.length < 3 || value.length > 20) {
    callback(new Error('用户名长度应为3-20位'))
  } else if (!usernameRegex.test(value)) {
    callback(new Error('用户名只能包含字母、数字、下划线和中划线'))
  } else {
    callback()
  }
}

const validateEmail = (rule: any, value: any, callback: any) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (value === '') {
    callback(new Error('请输入邮箱地址'))
  } else if (!emailRegex.test(value)) {
    callback(new Error('请输入有效的邮箱地址'))
  } else {
    callback()
  }
}

const validatePassword = (rule: any, value: any, callback: any) => {
  if (value === '') {
    callback(new Error('请输入密码'))
  } else if (value.length < 6) {
    callback(new Error('密码长度至少为6位'))
  } else if (value.length > 20) {
    callback(new Error('密码长度不能超过20位'))
  } else {
    callback()
  }
}

// 表单验证规则
const registerRules: FormRules = {
  username: [
    { validator: validateUsername, trigger: 'blur' }
  ],
  email: [
    { validator: validateEmail, trigger: 'blur' }
  ],
  password: [
    { validator: validatePassword, trigger: 'blur' }
  ],
  confirmPassword: [
    { validator: validateConfirmPassword, trigger: 'blur' }
  ]
}

// 处理注册提交
const handleSubmit = async () => {
  if (!registerFormRef.value) return

  try {
    // 检查是否同意条款
    if (!agreeTerms.value) {
      ElMessage.warning('请先同意用户协议和隐私政策')
      return
    }

    // 验证表单
    const valid = await registerFormRef.value.validate()
    if (!valid) return

    // 执行注册
    const success = await authStore.register(registerForm)
    
    if (success) {
      // 注册成功，跳转到首页
      const redirect = router.currentRoute.value.query.redirect as string
      router.push(redirect || '/')
    }
  } catch (error) {
    console.error('Register submit error:', error)
    ElMessage.error('注册过程中发生错误')
  }
}

// 跳转到登录页面
const goToLogin = () => {
  router.push('/auth/login')
}

// 组件挂载时检查登录状态
onMounted(() => {
  // 如果已经登录，直接跳转到首页
  if (authStore.isAuthenticated) {
    router.push('/')
  }
})
</script>

<style scoped>
.register-container {
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.register-card {
  background: white;
  border-radius: 16px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
  padding: 40px;
  width: 100%;
  max-width: 450px;
  position: relative;
  overflow: hidden;
}

.register-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
  background: linear-gradient(90deg, #409eff, #67c23a, #e6a23c, #f56c6c);
}

.register-header {
  text-align: center;
  margin-bottom: 40px;
}

.logo {
  margin-bottom: 16px;
}

.register-header h1 {
  color: #2c3e50;
  font-size: 28px;
  font-weight: 600;
  margin: 0 0 8px 0;
}

.register-header p {
  color: #606266;
  font-size: 16px;
  margin: 0;
}

.register-form {
  margin-bottom: 24px;
}

.form-options {
  width: 100%;
}

.form-options :deep(.el-checkbox__label) {
  font-size: 14px;
  line-height: 1.5;
}

.register-button {
  width: 100%;
  height: 48px;
  font-size: 16px;
  font-weight: 500;
  border-radius: 8px;
}

.login-link {
  text-align: center;
  color: #606266;
}

.login-link span {
  margin-right: 8px;
}

/* 响应式设计 */
@media (max-width: 480px) {
  .register-container {
    padding: 16px;
  }
  
  .register-card {
    padding: 24px;
  }
  
  .register-header h1 {
    font-size: 24px;
  }
  
  .register-header p {
    font-size: 14px;
  }
}

/* 动画效果 */
.register-card {
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
.register-form :deep(.el-form-item__label) {
  color: #2c3e50;
  font-weight: 500;
  margin-bottom: 8px;
}

.register-form :deep(.el-input__wrapper) {
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  transition: all 0.3s ease;
}

.register-form :deep(.el-input__wrapper:hover) {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.register-form :deep(.el-input__wrapper.is-focus) {
  box-shadow: 0 4px 12px rgba(64, 158, 255, 0.2);
}

/* 密码强度指示器样式 */
.password-strength {
  margin-top: 8px;
  font-size: 12px;
}

.password-strength .strength-bar {
  height: 4px;
  border-radius: 2px;
  margin-top: 4px;
  background: #f0f0f0;
  overflow: hidden;
}

.password-strength .strength-fill {
  height: 100%;
  transition: all 0.3s ease;
}

.password-strength.weak .strength-fill {
  width: 33%;
  background: #f56c6c;
}

.password-strength.medium .strength-fill {
  width: 66%;
  background: #e6a23c;
}

.password-strength.strong .strength-fill {
  width: 100%;
  background: #67c23a;
}
</style>