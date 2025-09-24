<template>
  <div class="home-view">
    <!-- 主横幅 -->
    <section class="hero-section">
      <div class="hero-content">
        <h1 class="hero-title">
          <el-icon><Compass /></el-icon>
          3D模型生成器
        </h1>
        <p class="hero-subtitle">
          使用AI技术，轻松将文本描述或2D图片转换为精美的3D模型
        </p>
        <div class="hero-buttons">
          <el-button 
            type="primary" 
            size="large"
            @click="$router.push('/text-to-3d')"
          >
            <el-icon><EditPen /></el-icon>
            文本转3D
          </el-button>
          <el-button 
            type="success" 
            size="large"
            @click="$router.push('/image-to-3d')"
          >
            <el-icon><Picture /></el-icon>
            图片转3D
          </el-button>
        </div>
      </div>
      
      <!-- 3D演示区域 -->
      <div class="hero-demo">
        <ModelViewer 
          :model="demoModel" 
          :height="400"
          :config="{ enableAnimation: true }"
        />
      </div>
    </section>
    
    <!-- 功能特性 -->
    <section class="features-section">
      <div class="container">
        <h2 class="section-title">
          <el-icon><Star /></el-icon>
          核心功能
        </h2>
        
        <div class="features-grid">
          <div class="feature-card">
            <div class="feature-icon">
              <el-icon size="48"><EditPen /></el-icon>
            </div>
            <h3>文本转3D</h3>
            <p>输入文字描述，AI自动理解并生成对应的3D模型，支持多种风格选择</p>
            <el-button type="primary" plain @click="$router.push('/text-to-3d')">
              立即体验
            </el-button>
          </div>
          
          <div class="feature-card">
            <div class="feature-icon">
              <el-icon size="48"><Picture /></el-icon>
            </div>
            <h3>图片转3D</h3>
            <p>上传2D图片，智能分析并重建为立体的3D模型，保持原始特征</p>
            <el-button type="success" plain @click="$router.push('/image-to-3d')">
              立即体验
            </el-button>
          </div>
          
          <div class="feature-card">
            <div class="feature-icon">
              <el-icon size="48"><View /></el-icon>
            </div>
            <h3>实时预览</h3>
            <p>强大的3D查看器，支持旋转、缩放、材质调整等多种交互操作</p>
            <el-button type="info" plain @click="scrollToDemo">
              查看演示
            </el-button>
          </div>
          
          <div class="feature-card">
            <div class="feature-icon">
              <el-icon size="48"><Download /></el-icon>
            </div>
            <h3>多格式导出</h3>
            <p>支持OBJ、STL、GLTF等主流3D格式，兼容各种建模软件和3D打印机</p>
            <el-button type="warning" plain @click="$router.push('/gallery')">
              查看画廊
            </el-button>
          </div>
        </div>
      </div>
    </section>
    
    <!-- 使用流程 -->
    <section class="workflow-section">
      <div class="container">
        <h2 class="section-title">
          <el-icon><Operation /></el-icon>
          使用流程
        </h2>
        
        <div class="workflow-steps">
          <div class="step">
            <div class="step-number">1</div>
            <div class="step-content">
              <h3>输入内容</h3>
              <p>输入文本描述或上传图片</p>
            </div>
          </div>
          
          <div class="step-arrow">
            <el-icon><ArrowRight /></el-icon>
          </div>
          
          <div class="step">
            <div class="step-number">2</div>
            <div class="step-content">
              <h3>AI处理</h3>
              <p>AI分析并生成3D模型</p>
            </div>
          </div>
          
          <div class="step-arrow">
            <el-icon><ArrowRight /></el-icon>
          </div>
          
          <div class="step">
            <div class="step-number">3</div>
            <div class="step-content">
              <h3>预览调整</h3>
              <p>实时预览并调整参数</p>
            </div>
          </div>
          
          <div class="step-arrow">
            <el-icon><ArrowRight /></el-icon>
          </div>
          
          <div class="step">
            <div class="step-number">4</div>
            <div class="step-content">
              <h3>导出使用</h3>
              <p>下载模型文件使用</p>
            </div>
          </div>
        </div>
      </div>
    </section>
    

  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import {
  Compass,
  EditPen,
  Picture,
  Star,
  View,
  Download,
  Operation,
  ArrowRight
} from '@element-plus/icons-vue'
import { useModel3DStore } from '../stores/model3d'
import ModelViewer from '../components/ModelViewer.vue'
import { generateMockGeometry, generateMockMaterial } from '../api/model3d'
import type { Model3D } from '../types/3d'

// Store
const model3dStore = useModel3DStore()

// 演示模型
const demoModel = ref<Model3D | null>(null)

// 生命周期
onMounted(() => {
  initDemoModel()
})

// 方法
function initDemoModel() {
  // 创建一个演示用的3D模型
  const geometry = generateMockGeometry('text', '演示模型')
  const material = generateMockMaterial('演示模型')
  
  demoModel.value = {
    id: 'demo',
    name: '演示模型',
    type: 'text',
    sourceContent: '这是一个演示用的3D模型',
    geometry,
    material,
    createdAt: new Date(),
    status: 'completed'
  }
}

function scrollToDemo() {
  const demoElement = document.querySelector('.hero-demo')
  if (demoElement) {
    demoElement.scrollIntoView({ behavior: 'smooth' })
  }
}
</script>

<style scoped>
.home-view {
  min-height: 100vh;
}

.hero-section {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 48px;
  align-items: center;
  padding: 80px 24px;
  min-height: 80vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.hero-content {
  max-width: 600px;
  margin: 0 auto;
}

.hero-title {
  font-size: 3.5rem;
  font-weight: bold;
  margin: 0 0 24px 0;
  display: flex;
  align-items: center;
  gap: 16px;
}

.hero-subtitle {
  font-size: 1.25rem;
  margin: 0 0 32px 0;
  opacity: 0.9;
  line-height: 1.6;
}

.hero-buttons {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}

.hero-demo {
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  border-radius: 16px;
  padding: 24px;
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.features-section {
  padding: 80px 24px;
  background: #f8f9fa;
}

.container {
  max-width: 1200px;
  margin: 0 auto;
}

.section-title {
  text-align: center;
  font-size: 2.5rem;
  margin: 0 0 48px 0;
  color: #2c3e50;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
}

.features-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 32px;
}

.feature-card {
  background: white;
  padding: 32px;
  border-radius: 16px;
  text-align: center;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  transition: transform 0.3s, box-shadow 0.3s;
}

.feature-card:hover {
  transform: translateY(-8px);
  box-shadow: 0 12px 24px rgba(0, 0, 0, 0.15);
}

.feature-icon {
  color: #409eff;
  margin-bottom: 24px;
}

.feature-card h3 {
  font-size: 1.5rem;
  margin: 0 0 16px 0;
  color: #2c3e50;
}

.feature-card p {
  color: #666;
  margin: 0 0 24px 0;
  line-height: 1.6;
}

.workflow-section {
  padding: 80px 24px;
  background: white;
}

.workflow-steps {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 32px;
  flex-wrap: wrap;
}

.step {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  max-width: 200px;
}

.step-number {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  background: #409eff;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
  font-weight: bold;
  margin-bottom: 16px;
}

.step-content h3 {
  margin: 0 0 8px 0;
  color: #2c3e50;
}

.step-content p {
  margin: 0;
  color: #666;
}

.step-arrow {
  color: #409eff;
  font-size: 1.5rem;
}

@media (max-width: 768px) {
  .hero-section {
    grid-template-columns: 1fr;
    text-align: center;
    padding: 40px 16px;
  }
  
  .hero-title {
    font-size: 2.5rem;
  }
  
  .hero-buttons {
    justify-content: center;
  }
  
  .workflow-steps {
    flex-direction: column;
    gap: 24px;
  }
  
  .step-arrow {
    transform: rotate(90deg);
  }
  
  .section-title {
    font-size: 2rem;
  }
}
</style>