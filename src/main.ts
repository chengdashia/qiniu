import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from './router'
import App from './App.vue'
import 'element-plus/dist/index.css'
import { useAuthStore } from './stores/auth'
import { useModel3DStore } from './stores/model3d'

async function initApp() {
  const app = createApp(App)
  const pinia = createPinia()
  
  app.use(pinia)
  app.use(router)
  
  // 初始化认证状态 - 等待完成
  const authStore = useAuthStore()
  await authStore.initAuth()
  
  // 初始化公共画廊模型 - 尝试从API加载，失败时使用示例模型
  const model3DStore = useModel3DStore()
  await model3DStore.loadPublicGallery()
  
  // 如果用户已登录，加载个人模型
  if (authStore.isAuthenticated) {
    await model3DStore.loadUserModels()
  }
  
  // 添加全局调试方法
  if (typeof window !== 'undefined') {
    // @ts-ignore
    window.debugAuth = authStore.debugAuthState
    console.log('🐛 调试方法已添加：在控制台中输入 debugAuth() 查看认证状态')
  }
  
  app.mount('#app')
}

// 启动应用
initApp().catch(error => {
  console.error('Failed to initialize app:', error)
})