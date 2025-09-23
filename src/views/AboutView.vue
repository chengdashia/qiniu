<template>
  <div class="about-view">
    <div class="view-header">
      <div class="container">
        <el-breadcrumb separator="/">
          <el-breadcrumb-item :to="{ path: '/' }">首页</el-breadcrumb-item>
          <el-breadcrumb-item>关于</el-breadcrumb-item>
        </el-breadcrumb>
        
        <h1 class="page-title">
          <el-icon><InfoFilled /></el-icon>
          关于 3D模型生成器
        </h1>
      </div>
    </div>
    
    <div class="view-content">
      <div class="container">
        <div class="content-sections">
          <!-- 项目介绍 -->
          <el-card class="section-card">
            <template #header>
              <h2><el-icon><Promotion /></el-icon>项目介绍</h2>
            </template>
            
            <div class="section-content">
              <p>
                3D模型生成器是一个基于人工智能技术的创新应用，旨在让每个人都能轻松创建专业级的3D模型。
                无论您是游戏开发者、设计师、教育工作者还是3D打印爱好者，都能通过简单的文字描述或图片上传，
                快速获得高质量的3D模型。
              </p>
              
              <div class="features-highlight">
                <div class="feature-item">
                  <el-icon size="32" color="#409eff"><EditPen /></el-icon>
                  <h4>文本转3D</h4>
                  <p>输入文字描述，AI自动生成对应3D模型</p>
                </div>
                
                <div class="feature-item">
                  <el-icon size="32" color="#67c23a"><Picture /></el-icon>
                  <h4>图片转3D</h4>
                  <p>上传2D图片，智能重建立体模型</p>
                </div>
                
                <div class="feature-item">
                  <el-icon size="32" color="#e6a23c"><View /></el-icon>
                  <h4>实时预览</h4>
                  <p>强大的3D查看器，支持多种交互操作</p>
                </div>
                
                <div class="feature-item">
                  <el-icon size="32" color="#f56c6c"><Download /></el-icon>
                  <h4>多格式导出</h4>
                  <p>支持OBJ、STL、GLTF等主流格式</p>
                </div>
              </div>
            </div>
          </el-card>
          
          <!-- 技术栈 -->
          <el-card class="section-card">
            <template #header>
              <h2><el-icon><Setting /></el-icon>技术栈</h2>
            </template>
            
            <div class="section-content">
              <div class="tech-grid">
                <div class="tech-category">
                  <h4>前端框架</h4>
                  <div class="tech-tags">
                    <el-tag>Vue 3</el-tag>
                    <el-tag>TypeScript</el-tag>
                    <el-tag>Vite</el-tag>
                  </div>
                </div>
                
                <div class="tech-category">
                  <h4>UI组件</h4>
                  <div class="tech-tags">
                    <el-tag type="success">Element Plus</el-tag>
                    <el-tag type="success">Vue Router</el-tag>
                    <el-tag type="success">Pinia</el-tag>
                  </div>
                </div>
                
                <div class="tech-category">
                  <h4>3D渲染</h4>
                  <div class="tech-tags">
                    <el-tag type="warning">Three.js</el-tag>
                    <el-tag type="warning">WebGL</el-tag>
                  </div>
                </div>
                
                <div class="tech-category">
                  <h4>AI服务</h4>
                  <div class="tech-tags">
                    <el-tag type="danger">Meshy AI</el-tag>
                    <el-tag type="danger">智能缓存</el-tag>
                  </div>
                </div>
              </div>
            </div>
          </el-card>
          
          <!-- 使用指南 -->
          <el-card class="section-card">
            <template #header>
              <h2><el-icon><Document /></el-icon>使用指南</h2>
            </template>
            
            <div class="section-content">
              <el-timeline>
                <el-timeline-item timestamp="第一步" placement="top">
                  <el-card>
                    <h4>选择生成方式</h4>
                    <p>根据您的需求选择"文本转3D"或"图片转3D"功能</p>
                  </el-card>
                </el-timeline-item>
                
                <el-timeline-item timestamp="第二步" placement="top">
                  <el-card>
                    <h4>输入内容</h4>
                    <p>文本方式：输入详细的物体描述<br>图片方式：上传清晰的2D图片</p>
                  </el-card>
                </el-timeline-item>
                
                <el-timeline-item timestamp="第三步" placement="top">
                  <el-card>
                    <h4>设置参数</h4>
                    <p>选择生成质量、风格等参数，点击生成按钮</p>
                  </el-card>
                </el-timeline-item>
                
                <el-timeline-item timestamp="第四步" placement="top">
                  <el-card>
                    <h4>预览和导出</h4>
                    <p>在3D查看器中预览模型，满意后导出为所需格式</p>
                  </el-card>
                </el-timeline-item>
              </el-timeline>
            </div>
          </el-card>
          
          <!-- 常见问题 -->
          <el-card class="section-card">
            <template #header>
              <h2><el-icon><QuestionFilled /></el-icon>常见问题</h2>
            </template>
            
            <div class="section-content">
              <el-collapse>
                <el-collapse-item title="支持哪些3D模型格式？" name="1">
                  <p>
                    目前支持以下格式的导出：
                  </p>
                  <ul>
                    <li><strong>OBJ</strong> - 广泛支持的基础格式，适用于大多数3D软件</li>
                    <li><strong>STL</strong> - 3D打印的标准格式</li>
                    <li><strong>GLTF</strong> - 现代Web3D标准，支持材质和动画</li>
                  </ul>
                </el-collapse-item>
                
                <el-collapse-item title="生成一个模型需要多长时间？" name="2">
                  <p>
                    生成时间取决于所选质量和模型复杂度：
                  </p>
                  <ul>
                    <li><strong>低质量</strong> - 约15-30秒</li>
                    <li><strong>中等质量</strong> - 约30-60秒</li>
                    <li><strong>高质量</strong> - 约1-3分钟</li>
                  </ul>
                </el-collapse-item>
                
                <el-collapse-item title="如何提高生成质量？" name="3">
                  <div>
                    <p><strong>文本转3D：</strong></p>
                    <ul>
                      <li>提供详细、具体的描述</li>
                      <li>包含颜色、材质、风格等信息</li>
                      <li>避免过于抽象或模糊的表述</li>
                    </ul>
                    
                    <p><strong>图片转3D：</strong></p>
                    <ul>
                      <li>使用高分辨率、清晰的图片</li>
                      <li>确保物体在图片中完整可见</li>
                      <li>避免过于复杂的背景</li>
                    </ul>
                  </div>
                </el-collapse-item>
                
                <el-collapse-item title="生成的模型可以商用吗？" name="4">
                  <p>
                    生成的3D模型的使用权限取决于：
                  </p>
                  <ul>
                    <li>您的输入内容是否具有版权</li>
                    <li>AI服务提供商的使用条款</li>
                    <li>当地相关的法律法规</li>
                  </ul>
                  <p>建议在商用前仔细阅读相关条款并咨询法律专业人士。</p>
                </el-collapse-item>
              </el-collapse>
            </div>
          </el-card>
          
          <!-- 联系我们 -->
          <el-card class="section-card">
            <template #header>
              <h2><el-icon><Message /></el-icon>联系我们</h2>
            </template>
            
            <div class="section-content">
              <div class="contact-grid">
                <div class="contact-item">
                  <el-icon size="24" color="#409eff"><Message /></el-icon>
                  <div>
                    <h4>技术支持</h4>
                    <p>遇到技术问题？我们随时为您提供帮助</p>
                    <el-button type="primary" plain>联系支持</el-button>
                  </div>
                </div>
                
                <div class="contact-item">
                  <el-icon size="24" color="#67c23a"><Star /></el-icon>
                  <div>
                    <h4>功能建议</h4>
                    <p>有好的想法？告诉我们如何改进产品</p>
                    <el-button type="success" plain>提交建议</el-button>
                  </div>
                </div>
                
                <div class="contact-item">
                  <el-icon size="24" color="#e6a23c"><Warning /></el-icon>
                  <div>
                    <h4>问题反馈</h4>
                    <p>发现了bug？帮助我们改进用户体验</p>
                    <el-button type="warning" plain>报告问题</el-button>
                  </div>
                </div>
              </div>
            </div>
          </el-card>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  InfoFilled,
  Promotion,
  EditPen,
  Picture,
  View,
  Download,
  Setting,
  Document,
  QuestionFilled,
  Message,
  Star,
  Warning
} from '@element-plus/icons-vue'
</script>

<style scoped>
.about-view {
  min-height: 100vh;
  background: #f8f9fa;
}

.view-header {
  background: white;
  border-bottom: 1px solid #e0e0e0;
  padding: 24px 0;
}

.container {
  max-width: 1000px;
  margin: 0 auto;
  padding: 0 24px;
}

.page-title {
  margin: 16px 0 0 0;
  font-size: 2rem;
  color: #2c3e50;
  display: flex;
  align-items: center;
  gap: 12px;
}

.view-content {
  padding: 32px 0;
}

.content-sections {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.section-card {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.section-card :deep(.el-card__header) {
  background: #f8f9fa;
  border-bottom: 1px solid #e0e0e0;
}

.section-card h2 {
  margin: 0;
  color: #2c3e50;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 1.25rem;
}

.section-content {
  line-height: 1.6;
}

.section-content p {
  color: #666;
  margin-bottom: 16px;
}

.features-highlight {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 24px;
  margin-top: 24px;
}

.feature-item {
  text-align: center;
  padding: 20px;
  background: #f8f9fa;
  border-radius: 8px;
}

.feature-item h4 {
  margin: 12px 0 8px 0;
  color: #303133;
}

.feature-item p {
  margin: 0;
  font-size: 14px;
  color: #666;
}

.tech-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 24px;
}

.tech-category h4 {
  margin: 0 0 12px 0;
  color: #303133;
}

.tech-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.contact-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 24px;
}

.contact-item {
  display: flex;
  gap: 16px;
  align-items: flex-start;
  padding: 20px;
  background: #f8f9fa;
  border-radius: 8px;
}

.contact-item div {
  flex: 1;
}

.contact-item h4 {
  margin: 0 0 8px 0;
  color: #303133;
}

.contact-item p {
  margin: 0 0 12px 0;
  font-size: 14px;
  color: #666;
}

.section-content ul {
  margin: 8px 0;
  padding-left: 20px;
}

.section-content li {
  margin-bottom: 4px;
  color: #666;
}

.section-content li strong {
  color: #303133;
}

:deep(.el-timeline-item__content) {
  padding-bottom: 20px;
}

:deep(.el-collapse-item__header) {
  font-weight: 500;
  color: #303133;
}

@media (max-width: 768px) {
  .container {
    padding: 0 16px;
  }
  
  .page-title {
    font-size: 1.5rem;
  }
  
  .features-highlight {
    grid-template-columns: 1fr;
  }
  
  .tech-grid {
    grid-template-columns: 1fr;
  }
  
  .contact-grid {
    grid-template-columns: 1fr;
  }
  
  .contact-item {
    flex-direction: column;
    text-align: center;
  }
}
</style>