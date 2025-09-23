import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { ElMessage } from 'element-plus'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('../views/HomeView.vue'),
      meta: {
        title: '3D模型生成器',
        requiresAuth: false
      }
    },
    {
      path: '/text-to-3d',
      name: 'text-to-3d',
      component: () => import('../views/TextTo3DView.vue'),
      meta: {
        title: '文本转3D',
        requiresAuth: true
      }
    },
    {
      path: '/image-to-3d',
      name: 'image-to-3d',
      component: () => import('../views/ImageTo3DView.vue'),
      meta: {
        title: '图片转3D',
        requiresAuth: true
      }
    },
    {
      path: '/upload-3d',
      name: 'upload-3d',
      component: () => import('../views/Upload3DView.vue'),
      meta: {
        title: '3D模型上传',
        requiresAuth: true
      }
    },
    {
      path: '/gallery',
      name: 'gallery',
      component: () => import('../views/GalleryView.vue'),
      meta: {
        title: '模型画廊',
        requiresAuth: false
      }
    },
    {
      path: '/model/:id',
      name: 'model-detail',
      component: () => import('../views/ModelDetailView.vue'),
      meta: {
        title: '模型详情',
        requiresAuth: false
      }
    },
    {
      path: '/profile',
      name: 'profile',
      component: () => import('../views/ProfileView.vue'),
      meta: {
        title: '个人中心',
        requiresAuth: true
      }
    },
    {
      path: '/about',
      name: 'about',
      component: () => import('../views/AboutView.vue'),
      meta: {
        title: '关于',
        requiresAuth: false
      }
    },
    // 认证相关路由
    {
      path: '/auth',
      redirect: '/auth/login'
    },
    {
      path: '/auth/login',
      name: 'login',
      component: () => import('../views/LoginView.vue'),
      meta: {
        title: '用户登录',
        requiresAuth: false,
        hideForAuth: true // 已登录用户不显示
      }
    },
    {
      path: '/auth/register',
      name: 'register',
      component: () => import('../views/RegisterView.vue'),
      meta: {
        title: '用户注册',
        requiresAuth: false,
        hideForAuth: true // 已登录用户不显示
      }
    },
    // 404页面
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      component: () => import('../views/NotFoundView.vue'),
      meta: {
        title: '页面不存在',
        requiresAuth: false
      }
    }
  ]
})

// 路由守卫
router.beforeEach(async (to, from, next) => {
  // 设置页面标题
  if (to.meta?.title) {
    document.title = `${to.meta.title} - 3D模型生成器`
  }
  
  const authStore = useAuthStore()
  
  // 检查是否需要认证
  if (to.meta?.requiresAuth) {
    if (!authStore.isAuthenticated) {
      ElMessage.warning('请先登录')
      next({
        name: 'login',
        query: { redirect: to.fullPath }
      })
      return
    }
  }
  
  // 已登录用户访问登录/注册页面时重定向到首页
  if (to.meta?.hideForAuth && authStore.isAuthenticated) {
    next({ name: 'home' })
    return
  }
  
  next()
})

// 路由后置守卫
router.afterEach((to) => {
  // 这里可以添加页面访问统计等逻辑
  console.log(`Navigated to: ${to.path}`)
})

export default router