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
  
  // 初始化模型数据 - 确保示例模型在应用启动时就可用
  const model3DStore = useModel3DStore()
  model3DStore.initSampleModels()
  
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