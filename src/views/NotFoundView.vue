<template>
  <div class="not-found-container">
    <div class="not-found-content">
      <div class="error-icon">
        <el-icon size="120" color="#409eff">
          <Warning />
        </el-icon>
      </div>
      
      <h1 class="error-title">404</h1>
      <h2 class="error-subtitle">页面不存在</h2>
      <p class="error-description">
        抱歉，您访问的页面不存在或已被移除。
      </p>
      
      <div class="error-actions">
        <el-button type="primary" size="large" @click="goHome">
          <el-icon><House /></el-icon>
          返回首页
        </el-button>
        <el-button size="large" @click="goBack">
          <el-icon><ArrowLeft /></el-icon>
          返回上页
        </el-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import { Warning, House, ArrowLeft } from '@element-plus/icons-vue'

const router = useRouter()

const goHome = () => {
  router.push('/')
}

const goBack = () => {
  router.back()
}
</script>

<style scoped>
.not-found-container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 20px;
}

.not-found-content {
  text-align: center;
  background: white;
  border-radius: 16px;
  padding: 60px 40px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
  max-width: 500px;
  width: 100%;
}

.error-icon {
  margin-bottom: 24px;
}

.error-title {
  font-size: 72px;
  font-weight: 800;
  color: #409eff;
  margin: 0 0 16px 0;
  line-height: 1;
}

.error-subtitle {
  font-size: 24px;
  font-weight: 600;
  color: #2c3e50;
  margin: 0 0 16px 0;
}

.error-description {
  color: #606266;
  font-size: 16px;
  margin: 0 0 32px 0;
  line-height: 1.6;
}

.error-actions {
  display: flex;
  gap: 16px;
  justify-content: center;
  flex-wrap: wrap;
}

@media (max-width: 480px) {
  .not-found-content {
    padding: 40px 24px;
  }
  
  .error-title {
    font-size: 56px;
  }
  
  .error-subtitle {
    font-size: 20px;
  }
  
  .error-actions {
    flex-direction: column;
    align-items: center;
  }
  
  .error-actions .el-button {
    width: 100%;
    max-width: 200px;
  }
}
</style>