import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import * as THREE from 'three'
import type { Model3D, TextTo3DRequest, ImageTo3DRequest, Upload3DRequest, ExportFormat } from '../types/3d'
import { model3DApi, model3DCache, generateMockGeometry, generateMockMaterial } from '../api/model3d'
import type { LoadResult } from '../utils/fileLoader'
import { useAuthStore } from './auth'
import { ElMessage } from 'element-plus'

export const useModel3DStore = defineStore('model3d', () => {
  // 获取认证store
  const authStore = useAuthStore()
  // 状态
  const models = ref<Model3D[]>([])
  const currentModel = ref<Model3D | null>(null)
  const isGenerating = ref(false)
  const generationProgress = ref(0)
  const generationMessage = ref('')

  // 初始化时添加一些示例模型
  function initSampleModels() {
    if (models.value.length === 0) {
      const sampleData = [
        { text: '一个立方体机器人', type: 'text' as const },
        { text: '蓝色的球形物体', type: 'text' as const },
        { text: '红色的圆环形状', type: 'text' as const },
        { text: '绿色的圆锥体建筑', type: 'text' as const },
        { text: '紫色的多面体水晶', type: 'text' as const },
        { text: '可爱的小狗模型', type: 'image' as const },
        { text: '现代家具设计', type: 'image' as const }
      ]
      
      sampleData.forEach((data, index) => {
        const geometry = generateMockGeometry(data.type, data.text)
        const material = generateMockMaterial(data.text)
        
        const sampleModel: Model3D = {
          id: `sample_${data.type}_${index}`,
          name: data.text,
          type: data.type,
          sourceContent: data.text,
          geometry,
          material,
          createdAt: new Date(Date.now() - index * 60000), // 错开时间
          status: 'completed',
          userId: 'demo_samples' // 示例模型的特殊用户ID
        }
        
        models.value.push(sampleModel)
      })
      
      // 设置第一个为当前模型
      const firstModel = models.value[0]
      if (firstModel) {
        setCurrentModel(firstModel)
      }
      
      console.log('🎨 示例模型已初始化:', models.value.length, '个模型')
    }
  }

  // 计算属性
  const completedModels = computed(() => 
    models.value.filter(model => model.status === 'completed')
  )
  
  const failedModels = computed(() => 
    models.value.filter(model => model.status === 'failed')
  )

  const generatingModels = computed(() => 
    models.value.filter(model => model.status === 'generating')
  )
  
  // 公共模型（示例模型 + 已完成的所有模型）
  const publicModels = computed(() => 
    models.value.filter(model => 
      model.status === 'completed' && 
      (model.userId === 'demo_samples' || model.userId) // 示例模型和所有用户的模型都可公开展示
    )
  )
  
  // 当前用户的模型
  const userModels = computed(() => {
    const currentUserId = authStore.currentUser?.id
    if (!currentUserId) return []
    return models.value.filter(model => model.userId === currentUserId)
  })
  
  const userCompletedModels = computed(() => {
    const currentUserId = authStore.currentUser?.id
    if (!currentUserId) return []
    return models.value.filter(model => 
      model.userId === currentUserId && model.status === 'completed'
    )
  })

  // 操作方法

  /**
   * 文本转3D模型
   */
  async function generateFromText(request: TextTo3DRequest): Promise<Model3D | null> {
    // 检查用户认证
    if (!authStore.isAuthenticated) {
      ElMessage.warning('请先登录后再使用此功能')
      return null
    }
    
    isGenerating.value = true
    generationProgress.value = 0
    generationMessage.value = '正在生成3D模型...'

    try {
      // 使用新的prompt字段，如果没有则回退到text字段
      const promptText = request.prompt || request.text || ''
      
      // 检查缓存
      const cached = model3DCache.checkTextCache(promptText)
      if (cached) {
        generationMessage.value = '从缓存中获取模型'
        const model = createModelFromCache('text', promptText, cached.geometry, cached.material)
        addModel(model)
        setCurrentModel(model)
        return model
      }

      // 创建模型记录
      const model: Model3D = {
        id: `text_${Date.now()}`,
        name: `文本生成: ${promptText.substring(0, 20)}...`,
        type: 'text',
        sourceContent: promptText,
        createdAt: new Date(),
        status: 'generating',
        userId: authStore.currentUser?.id // 添加用户ID
      }

      addModel(model)
      setCurrentModel(model)

      // 模拟进度更新
      const progressInterval = setInterval(() => {
        generationProgress.value += 10
        if (generationProgress.value >= 90) {
          clearInterval(progressInterval)
        }
      }, 200)

      // 调用API（目前使用模拟数据）
      const response = await model3DApi.textTo3D(request)
      clearInterval(progressInterval)

      if (response.success) {
        // 生成模拟几何体和材质
        const geometry = generateMockGeometry('text', promptText)
        const material = generateMockMaterial(promptText)

        // 更新模型
        model.geometry = geometry
        model.material = material
        model.status = 'completed'
        
        // 缓存结果
        model3DCache.cacheTextResult(promptText, geometry, material)
        
        generationProgress.value = 100
        generationMessage.value = '模型生成成功！'
        
        return model
      } else {
        model.status = 'failed'
        generationMessage.value = response.error || '生成失败'
        return null
      }
    } catch (error) {
      console.error('文本转3D失败:', error)
      if (currentModel.value) {
        currentModel.value.status = 'failed'
      }
      generationMessage.value = '生成过程中发生错误'
      return null
    } finally {
      isGenerating.value = false
      setTimeout(() => {
        generationProgress.value = 0
        generationMessage.value = ''
      }, 3000)
    }
  }

  /**
   * 图片转3D模型
   */
  async function generateFromImage(request: ImageTo3DRequest): Promise<Model3D | null> {
    // 检查用户认证
    if (!authStore.isAuthenticated) {
      ElMessage.warning('请先登录后再使用此功能')
      return null
    }
    
    isGenerating.value = true
    generationProgress.value = 0
    generationMessage.value = '正在分析图片并生成3D模型...'

    try {
      // 检查缓存
      const cached = await model3DCache.checkImageCache(request.imageFile)
      if (cached) {
        generationMessage.value = '从缓存中获取模型'
        const model = createModelFromCache('image', request.imageFile.name, cached.geometry, cached.material)
        addModel(model)
        setCurrentModel(model)
        return model
      }

      // 创建模型记录
      const model: Model3D = {
        id: `image_${Date.now()}`,
        name: `图片生成: ${request.imageFile.name}`,
        type: 'image',
        sourceContent: URL.createObjectURL(request.imageFile),
        createdAt: new Date(),
        status: 'generating',
        userId: authStore.currentUser?.id // 添加用户ID
      }

      addModel(model)
      setCurrentModel(model)

      // 模拟进度更新
      const progressInterval = setInterval(() => {
        generationProgress.value += 8
        if (generationProgress.value >= 90) {
          clearInterval(progressInterval)
        }
      }, 300)

      // 调用API
      const response = await model3DApi.imageeTo3D(request)
      clearInterval(progressInterval)

      if (response.success) {
        // 生成模拟几何体和材质
        const geometry = generateMockGeometry('image', request.imageFile.name)
        const material = generateMockMaterial(request.imageFile.name)

        // 更新模型
        model.geometry = geometry
        model.material = material
        model.status = 'completed'
        
        // 缓存结果
        await model3DCache.cacheImageResult(request.imageFile, geometry, material)
        
        generationProgress.value = 100
        generationMessage.value = '模型生成成功！'
        
        return model
      } else {
        model.status = 'failed'
        generationMessage.value = response.error || '生成失败'
        return null
      }
    } catch (error) {
      console.error('图片转3D失败:', error)
      if (currentModel.value) {
        currentModel.value.status = 'failed'
      }
      generationMessage.value = '生成过程中发生错误'
      return null
    } finally {
      isGenerating.value = false
      setTimeout(() => {
        generationProgress.value = 0
        generationMessage.value = ''
      }, 3000)
    }
  }

  /**
   * 从缓存创建模型
   */
  function createModelFromCache(
    type: 'text' | 'image', 
    sourceContent: string, 
    geometry: THREE.BufferGeometry, 
    material: THREE.Material
  ): Model3D {
    return {
      id: `cached_${type}_${Date.now()}`,
      name: `缓存${type === 'text' ? '文本' : '图片'}: ${sourceContent.substring(0, 20)}...`,
      type,
      sourceContent,
      geometry,
      material,
      createdAt: new Date(),
      status: 'completed',
      userId: authStore.currentUser?.id // 添加用户ID
    }
  }

  /**
   * 从上传的文件创建3D模型
   */
  function createUploadedModel(request: Upload3DRequest, loadResult: LoadResult): Model3D | null {
    // 检查用户认证
    if (!authStore.isAuthenticated) {
      ElMessage.warning('请先登录后再使用此功能')
      return null
    }
    
    if (!loadResult.success || !loadResult.model) {
      return null
    }

    // 创建模型记录
    const model: Model3D = {
      id: `upload_${Date.now()}`,
      name: request.name || request.file.name.split('.')[0] || 'Unnamed Model',
      type: 'upload',
      sourceContent: request.file.name,
      createdAt: new Date(),
      status: 'completed',
      userId: authStore.currentUser?.id, // 添加用户ID
      fileInfo: {
        originalName: request.file.name,
        size: request.file.size,
        format: request.file.name.split('.').pop()?.toLowerCase() || 'unknown',
        metadata: loadResult.metadata
      }
    }

    // 处理加载的模型
    if (loadResult.geometry) {
      model.geometry = loadResult.geometry
    }
    if (loadResult.material) {
      model.material = Array.isArray(loadResult.material) ? loadResult.material[0] : loadResult.material
    }

    // 如果有完整的模型对象，提取geometry和material
    if (loadResult.model && !model.geometry) {
      loadResult.model.traverse((child) => {
        if (child instanceof THREE.Mesh && child.geometry) {
          if (!model.geometry) {
            model.geometry = child.geometry
            model.material = child.material as THREE.Material
          }
        }
      })
    }

    addModel(model)
    setCurrentModel(model)
    return model
  }

  /**
   * 导出模型
   */
  async function exportModel(model: Model3D, format: ExportFormat): Promise<string | null> {
    if (!model.geometry || !model.material) {
      throw new Error('模型数据不完整，无法导出')
    }

    try {
      // 这里可以集成ThreeViewer的导出功能
      // 目前返回模拟的导出数据
      const exportData = `# ${format.toUpperCase()} Export
# Model: ${model.name}
# Generated at: ${new Date().toISOString()}

# Mock export data for ${format} format`
      return exportData
    } catch (error) {
      console.error('模型导出失败:', error)
      return null
    }
  }

  /**
   * 添加模型到列表
   */
  function addModel(model: Model3D) {
    models.value.unshift(model) // 新模型添加到前面
  }

  /**
   * 设置当前模型
   */
  function setCurrentModel(model: Model3D | null) {
    currentModel.value = model
  }

  /**
   * 删除模型
   */
  function removeModel(id: string) {
    const index = models.value.findIndex(model => model.id === id)
    if (index > -1) {
      const removedModel = models.value.splice(index, 1)[0]
      
      // 如果删除的是当前模型，清空当前模型
      if (currentModel.value?.id === id) {
        currentModel.value = null
      }
      
      // 清理资源
      if (removedModel && removedModel.geometry) {
        removedModel.geometry.dispose()
      }
      if (removedModel && removedModel.material) {
        (removedModel.material as any).dispose?.()
      }
    }
  }

  /**
   * 清空所有模型
   */
  function clearModels() {
    // 清理资源
    models.value.forEach(model => {
      if (model.geometry) {
        model.geometry.dispose()
      }
      if (model.material) {
        (model.material as any).dispose?.()
      }
    })
    
    models.value = []
    currentModel.value = null
  }

  /**
   * 根据ID获取模型
   */
  function getModelById(id: string): Model3D | undefined {
    return models.value.find(model => model.id === id)
  }

  return {
    // 状态
    models,
    currentModel,
    isGenerating,
    generationProgress,
    generationMessage,
    
    // 计算属性
    completedModels,
    failedModels,
    generatingModels,
    publicModels, // 公共模型（包括示例模型）
    userModels,
    userCompletedModels,
    
    // 方法
    initSampleModels,
    generateFromText,
    generateFromImage,
    createUploadedModel,
    exportModel,
    addModel,
    setCurrentModel,
    removeModel,
    clearModels,
    getModelById
  }
})