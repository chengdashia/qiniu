<script setup lang="ts">
import { useAuthStore } from './stores/auth'
// 导入必要的图标
import {
  Compass,
  House,
  EditPen,
  Picture,
  Upload,
  Collection,
  InfoFilled,
  User,
  Setting,
  SwitchButton,
  ArrowDown
} from '@element-plus/icons-vue'

const authStore = useAuthStore()

// 用户退出
const handleLogout = async () => {
  await authStore.logout()
  // 退出后可以考虑跳转到首页或登录页
}
</script>

<template>
  <div id="app">
    <!-- 导航栏 -->
    <el-header class="app-header">
      <div class="header-content">
        <div class="logo">
          <el-icon size="32"><Compass /></el-icon>
          <h1>3D模型生成器</h1>
        </div>
        
        <el-menu
          mode="horizontal"
          :default-active="$route.path"
          class="nav-menu"
          router
        >
          <el-menu-item index="/">
            <el-icon><House /></el-icon>
            <span>首页</span>
          </el-menu-item>
          <el-menu-item index="/text-to-3d">
            <el-icon><EditPen /></el-icon>
            <span>文本转3D</span>
          </el-menu-item>
          <el-menu-item index="/image-to-3d">
            <el-icon><Picture /></el-icon>
            <span>图片色3D</span>
          </el-menu-item>
          <el-menu-item index="/upload-3d">
            <el-icon><Upload /></el-icon>
            <span>3D模型上传</span>
          </el-menu-item>
          <el-menu-item index="/gallery">
            <el-icon><Collection /></el-icon>
            <span>模型画廊</span>
          </el-menu-item>
          <el-menu-item index="/about">
            <el-icon><InfoFilled /></el-icon>
            <span>关于</span>
          </el-menu-item>
        </el-menu>
        
        <!-- 用户认证菜单 -->
        <div class="auth-menu">
          <!-- 未登录状态 -->
          <div v-if="!authStore.isAuthenticated" class="auth-buttons">
            <el-button type="text" @click="$router.push('/auth/login')">
              登录
            </el-button>
            <el-button type="primary" @click="$router.push('/auth/register')">
              注册
            </el-button>
          </div>
          
          <!-- 已登录状态 -->
          <el-dropdown v-else trigger="click" class="user-dropdown">
            <div class="user-info">
              <el-avatar
                :size="32"
                :src="authStore.currentUser?.avatar"
                class="user-avatar"
              >
                <el-icon><User /></el-icon>
              </el-avatar>
              <span class="username">{{ authStore.currentUser?.username }}</span>
              <el-icon class="dropdown-icon"><ArrowDown /></el-icon>
            </div>
            
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item @click="$router.push('/profile')">
                  <el-icon><User /></el-icon>
                  个人中心
                </el-dropdown-item>
                <el-dropdown-item @click="$router.push('/profile')">
                  <el-icon><Setting /></el-icon>
                  设置
                </el-dropdown-item>
                <el-dropdown-item divided @click="handleLogout">
                  <el-icon><SwitchButton /></el-icon>
                  退出登录
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </div>
    </el-header>
    
    <!-- 主要内容区域 -->
    <el-main class="app-main">
      <router-view />
    </el-main>
    
    <!-- 页脚 -->
    <el-footer class="app-footer">
      <div class="footer-content">
        <p>&copy; 2024 3D模型生成器. 基于AI技术，让3D创作更简单。</p>
      </div>
    </el-footer>
  </div>
</template>

<style scoped>
#app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.app-header {
  background: #fff;
  border-bottom: 1px solid #e0e0e0;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  padding: 0;
  height: 60px;
  line-height: 60px;
}

.header-content {
  max-width: 1400px;
  margin: 0 auto;
  padding: 0 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 100%;
  gap: 24px;
}

.logo {
  display: flex;
  align-items: center;
  gap: 12px;
  color: #409eff;
}

.logo h1 {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
}

.nav-menu {
  border: none;
  background: transparent;
}

.nav-menu .el-menu-item {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 60px;
  line-height: 60px;
  border-bottom: none;
}

.nav-menu .el-menu-item:hover {
  background-color: #f5f7fa;
}

.nav-menu .el-menu-item.is-active {
  color: #409eff;
  border-bottom: 2px solid #409eff;
}

/* 认证菜单样式 */
.auth-menu {
  display: flex;
  align-items: center;
  gap: 12px;
}

.auth-buttons {
  display: flex;
  align-items: center;
  gap: 12px;
}

.user-dropdown {
  cursor: pointer;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 6px;
  transition: background-color 0.3s ease;
}

.user-info:hover {
  background-color: #f5f7fa;
}

.user-avatar {
  flex-shrink: 0;
}

.username {
  font-size: 14px;
  font-weight: 500;
  color: #2c3e50;
  max-width: 100px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dropdown-icon {
  font-size: 12px;
  color: #909399;
  transition: transform 0.3s ease;
}

.user-dropdown.is-opened .dropdown-icon {
  transform: rotate(180deg);
}

.app-main {
  flex: 1;
  padding: 0;
  background: #f8f9fa;
}

.app-footer {
  background: #2c3e50;
  color: #ecf0f1;
  padding: 20px 0;
  text-align: center;
  margin-top: auto;
}

.footer-content {
  max-width: 1400px;
  margin: 0 auto;
  padding: 0 24px;
}

.footer-content p {
  margin: 0;
  font-size: 14px;
  opacity: 0.8;
}

@media (max-width: 768px) {
  .header-content {
    padding: 0 16px;
    flex-direction: column;
    height: auto;
    gap: 16px;
    padding-top: 12px;
    padding-bottom: 12px;
  }
  
  .app-header {
    height: auto;
    line-height: normal;
  }
  
  .logo h1 {
    font-size: 1.1rem;
  }
  
  .nav-menu {
    width: 100%;
    justify-content: center;
  }
  
  .nav-menu .el-menu-item {
    height: 40px;
    line-height: 40px;
    padding: 0 12px;
  }
  
  .auth-menu {
    width: 100%;
    justify-content: center;
  }
  
  .auth-buttons {
    flex: 1;
    justify-content: center;
  }
  
  .user-dropdown {
    flex: 1;
    text-align: center;
  }
}

@media (max-width: 480px) {
  .nav-menu .el-menu-item span {
    display: none;
  }
  
  .logo h1 {
    display: none;
  }
}</style>