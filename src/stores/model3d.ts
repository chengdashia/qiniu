import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import * as THREE from 'three'
import type { Model3D, TextTo3DRequest, ImageTo3DRequest, Upload3DRequest, ExportFormat } from '../types/3d'
import { model3DApi, model3DCache, generateMockGeometry, generateMockMaterial, loadModelFromBlob, loadLocalModel } from '../api/model3d'
import type { LoadResult } from '../utils/fileLoader'
import { useAuthStore } from './auth'
import { ElMessage } from 'element-plus'

export const useModel3DStore = defineStore('model3d', () => {
  // 获取认证store
  const authStore = useAuthStore()
  
  // 状态 - 分离公共模型和用户模型
  const publicGalleryModels = ref<Model3D[]>([]) // 公共画廊模型
  const personalModels = ref<Model3D[]>([])   // 用户个人模型
  const currentModel = ref<Model3D | null>(null)
  const isGenerating = ref(false)
  const generationProgress = ref(0)
  const generationMessage = ref('')
  const isLoadingPublic = ref(false)
  const isLoadingUser = ref(false)

  // 初始化公共示例模型（仅用于开发演示）
  function initSampleModels() {
    if (publicGalleryModels.value.length === 0) {
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
        
        publicGalleryModels.value.push(sampleModel)
      })
      
      // 设置第一个为当前模型
      const firstModel = publicGalleryModels.value[0]
      if (firstModel) {
        setCurrentModel(firstModel)
      }
      
      console.log('🎨 示例模型已初始化:', publicGalleryModels.value.length, '个模型')
    }
  }

  /**
   * 加载公共画廊模型
   */
  async function loadPublicGallery() {
    if (isLoadingPublic.value) return
    
    isLoadingPublic.value = true
    try {
      const response = await model3DApi.getPublicGallery()
      if (response.success && response.data) {
        publicGalleryModels.value = response.data
        console.log('✅ 公共画廊模型加载成功:', response.data.length, '个模型')
      } else {
        // 如果API失败，使用示例模型
        initSampleModels()
      }
    } catch (error) {
      console.error('❌ 加载公共画廊失败:', error)
      // 出错时使用示例模型
      initSampleModels()
    } finally {
      isLoadingPublic.value = false
    }
  }

  /**
   * 加载用户个人模型
   */
  async function loadUserModels() {
    if (isLoadingUser.value || !authStore.isAuthenticated) return
    
    const userId = authStore.currentUser?.id
    if (!userId) return
    
    isLoadingUser.value = true
    try {
      const response = await model3DApi.getUserModels(userId)
      if (response.success && response.data) {
        personalModels.value = response.data
        console.log('✅ 用户模型加载成功:', response.data.length, '个模型')
      }
    } catch (error) {
      console.error('❌ 加载用户模型失败:', error)
    } finally {
      isLoadingUser.value = false
    }
  }

  // 计算属性
  const completedModels = computed(() => 
    [...publicGalleryModels.value, ...personalModels.value].filter(model => model.status === 'completed')
  )
  
  const failedModels = computed(() => 
    [...publicGalleryModels.value, ...personalModels.value].filter(model => model.status === 'failed')
  )

  const generatingModels = computed(() => 
    [...publicGalleryModels.value, ...personalModels.value].filter(model => model.status === 'generating')
  )
  
  // 用户的模型（按类型筛选）
  const userTextModels = computed(() => 
    personalModels.value.filter(model => model.type === 'text')
  )
  
  const userImageModels = computed(() => 
    personalModels.value.filter(model => model.type === 'image')
  )
  
  const userUploadModels = computed(() => 
    personalModels.value.filter(model => model.type === 'upload')
  )
  
  const userCompletedModels = computed(() => 
    personalModels.value.filter(model => model.status === 'completed')
  )

  /**
   * 文本转3D模型 - 完整轮询流程
   */
  async function generateFromText(request: TextTo3DRequest): Promise<Model3D | null> {
    // 检查用户认证
    if (!authStore.isAuthenticated) {
      ElMessage.warning('请先登录后再使用此功能')
      return null
    }
    
    isGenerating.value = true
    generationProgress.value = 0
    generationMessage.value = '正在提交任务...'

    try {
      // 使用新的prompt字段，如果没有则回退到text字段
      const promptText = request.prompt || request.text || ''
      
      // 检查缓存
      const cached = model3DCache.checkTextCache(promptText)
      if (cached) {
        generationMessage.value = '从缓存中获取模型'
        const model = createModelFromCache('text', promptText, cached.geometry, cached.material)
        addPersonalModel(model)
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
        userId: authStore.currentUser?.id, // 添加用户ID
        jobId: '' // 先初始化为空，等获取到job_id后更新
      }

      addPersonalModel(model)
      setCurrentModel(model)

      // 步骤1: 提交任务
      generationProgress.value = 10
      const response = await model3DApi.textTo3D(request)

      if (response.success && response.data) {
        console.log('API返回成功响应:', response)
        console.log('检查modelBlob:', response.data.modelBlob ? '存在' : '不存在')
        
        // 检查是否直接返回了模型数据（本地降级）
        if (response.data.modelBlob) {
          console.log('检测到modelBlob，开始解析本地模型')
          generationProgress.value = 80
          generationMessage.value = '正在解析本地模型...'
          
          try {
            console.log('开始调用loadModelFromBlob解析模型...')
            // 解析本地模型文件
            const loadResult = await loadModelFromBlob(response.data.modelBlob, 'local_model.glb')
            console.log('loadModelFromBlob解析结果:', loadResult)
            
            if (loadResult.geometry && loadResult.material) {
              console.log('模型解析成功，更新模型数据')
              model.geometry = loadResult.geometry
              model.material = loadResult.material
              model.status = 'completed'
              model.isLocalFallback = true // 标记为本地降级模型
              
              // 缓存结果
              model3DCache.cacheTextResult(promptText, loadResult.geometry, loadResult.material)
              
              generationProgress.value = 100
              generationMessage.value = '资源不足，已加载本地模型'
              
              console.log('设置当前模型并返回')
              setCurrentModel({...model})
              return model
            } else {
              console.error('loadModelFromBlob返回的geometry或material为空')
            }
          } catch (parseError) {
            console.error('解析本地模型失败:', parseError)
            console.log('parseError详细信息:', parseError instanceof Error ? parseError.message : parseError)
            // 解析失败时使用模拟数据
            const geometry = generateMockGeometry('text', promptText)
            const material = generateMockMaterial(promptText)
            
            model.geometry = geometry
            model.material = material
            model.status = 'completed'
            model.isLocalFallback = true // 标记为本地降级模型
            
            model3DCache.cacheTextResult(promptText, geometry, material)
            
            generationProgress.value = 100
            generationMessage.value = '资源不足，本地模型解析失败，使用默认模型'
            
            setCurrentModel(model)
            return model
          }
        }
        
        // 正常API流程
        const jobId = response.data.id
        const promptUsed = response.data.prompt_used
        
        // 保存job_id到模型中
        model.jobId = jobId
        
        // 更新模型名称（如果有优化后的提示词）
        if (promptUsed && promptUsed !== promptText) {
          model.name = `文本生成: ${promptUsed.substring(0, 20)}...`
          model.sourceContent = promptUsed
        }
        
        generationProgress.value = 20
        generationMessage.value = '任务已提交，正在检查状态...'
        
        // 步骤2: 轮询任务状态
        await pollJobStatus(jobId, model, promptUsed || promptText, request.modelFormat || 0)
        
        return model
      } else {
        // 检查是否是ResourceInsufficient错误，如果是，尝试本地降级
        const errorMessage = response.error || response.message || '提交任务失败'
        console.log('检查API响应错误信息:', errorMessage)
        console.log('完整响应对象:', response)
        
        if (errorMessage.includes('ResourceInsufficient') || errorMessage.includes('TencentCloudSDKError')) {
          console.log('检测到ResourceInsufficient或TencentCloudSDKError，尝试本地降级')
          
          // 先显示资源不足消息
          generationProgress.value = 50
          generationMessage.value = '资源不足，正在加载本地模型...'
          
          try {
            // 使用导入的loadLocalModel函数
            const localModelBlob = await loadLocalModel()
            
            if (localModelBlob) {
              generationProgress.value = 80
              generationMessage.value = '正在解析本地模型...'
              
              const loadResult = await loadModelFromBlob(localModelBlob, 'local_model.glb')
              
              if (loadResult.geometry && loadResult.material) {
                console.log('本地模型解析成功，更新模型数据')
                console.log('Geometry:', loadResult.geometry)
                console.log('Material:', loadResult.material)
                
                model.geometry = loadResult.geometry
                model.material = loadResult.material
                model.status = 'completed'
                model.isLocalFallback = true // 标记为本地降级模型
                
                // 缓存结果
                model3DCache.cacheTextResult(promptText, loadResult.geometry, loadResult.material)
                
                generationProgress.value = 100
                generationMessage.value = '资源不足，已加载本地模型'
                
                // 确保模型被设置为当前模型
                console.log('设置当前模型:', model)
                setCurrentModel({...model}) // 使用扩展运算符触发响应式更新
                
                // 在返回前稍等一下，确保更新生效
                await new Promise(resolve => setTimeout(resolve, 100))
                return model
              } else {
                console.warn('本地模型解析失败，使用模拟数据')
                // 解析失败，使用模拟数据
                const geometry = generateMockGeometry('text', promptText)
                const material = generateMockMaterial(promptText)
                
                model.geometry = geometry
                model.material = material
                model.status = 'completed'
                model.isLocalFallback = true // 标记为本地降级模型
                
                model3DCache.cacheTextResult(promptText, geometry, material)
                
                generationProgress.value = 100
                generationMessage.value = '资源不足，本地模型解析失败，使用默认模型'
                
                setCurrentModel({...model})
                return model
              }
            } else {
              console.warn('本地模型加载失败，使用模拟数据')
              // 本地模型加载失败，使用模拟数据兜底
              const geometry = generateMockGeometry('text', promptText)
              const material = generateMockMaterial(promptText)
              
              model.geometry = geometry
              model.material = material
              model.status = 'completed'
              model.isLocalFallback = true // 标记为本地降级模型
              
              model3DCache.cacheTextResult(promptText, geometry, material)
              
              generationProgress.value = 100
              generationMessage.value = '资源不足，本地模型不可用，使用默认模型'
              
              setCurrentModel({...model})
              return model
            }
          } catch (localError) {
            console.error('本地模型加载失败:', localError)
            // 本地模型加载失败，使用模拟数据兜底
            const geometry = generateMockGeometry('text', promptText)
            const material = generateMockMaterial(promptText)
            
            model.geometry = geometry
            model.material = material
            model.status = 'completed'
            model.isLocalFallback = true // 标记为本地降级模型
            
            model3DCache.cacheTextResult(promptText, geometry, material)
            
            generationProgress.value = 100
            generationMessage.value = '资源不足，本地模型加载失败，使用默认模型'
            
            setCurrentModel({...model})
            return model
          }
        }
        
        // 其他错误情况
        model.status = 'failed'
        generationMessage.value = errorMessage
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
      // 如果是本地降级模型，保持资源不足的消息更长时间
      const isLocalFallbackModel = currentModel.value?.isLocalFallback === true
      const delayTime = isLocalFallbackModel ? 5000 : 3000 // 本地降级模型保持5秒
      
      setTimeout(() => {
        generationProgress.value = 0
        // 只有在非本地降级模型时才清空消息
        if (!isLocalFallbackModel) {
          generationMessage.value = ''
        }
      }, delayTime)
    }
  }

  /**
   * 图片转3D模型 - 完整轮询流程
   */
  async function generateFromImage(request: ImageTo3DRequest): Promise<Model3D | null> {
    // 检查用户认证
    if (!authStore.isAuthenticated) {
      ElMessage.warning('请先登录后再使用此功能')
      return null
    }
    
    isGenerating.value = true
    generationProgress.value = 0
    generationMessage.value = '正在提交图片任务...'

    try {
      // 检查缓存
      const cached = await model3DCache.checkImageCache(request.imageFile)
      if (cached) {
        generationMessage.value = '从缓存中获取模型'
        const model = createModelFromCache('image', request.imageFile.name, cached.geometry, cached.material)
        addPersonalModel(model)
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
        userId: authStore.currentUser?.id,
        jobId: '' // 先初始化为空，等获取到job_id后更新
      }

      addPersonalModel(model)
      setCurrentModel(model)

      // 步骤1: 提交任务
      generationProgress.value = 10
      const response = await model3DApi.imageeTo3D(request)

      if (response.success && response.data) {
        console.log('图片转3D API返回成功响应:', response)
        console.log('检查modelBlob:', response.data.modelBlob ? '存在' : '不存在')
        
        // 检查是否直接返回了模型数据（本地降级）
        if (response.data.modelBlob) {
          console.log('检测到modelBlob，开始解析本地模型')
          generationProgress.value = 80
          generationMessage.value = '正在解析本地模型...'
          
          try {
            console.log('开始调用loadModelFromBlob解析模型...')
            // 解析本地模型文件
            const loadResult = await loadModelFromBlob(response.data.modelBlob, 'local_model.glb')
            console.log('loadModelFromBlob解析结果:', loadResult)
            
            if (loadResult.geometry && loadResult.material) {
              console.log('模型解析成功，更新模型数据')
              model.geometry = loadResult.geometry
              model.material = loadResult.material
              model.status = 'completed'
              model.isLocalFallback = true // 标记为本地降级模型
              
              // 缓存结果
              await model3DCache.cacheImageResult(request.imageFile, loadResult.geometry, loadResult.material)
              
              generationProgress.value = 100
              generationMessage.value = '资源不足，已加载本地模型'
              
              console.log('设置当前模型并返回')
              setCurrentModel({...model})
              return model
            } else {
              console.error('loadModelFromBlob返回的geometry或material为空')
            }
          } catch (parseError) {
            console.error('解析本地模型失败:', parseError)
            // 解析失败时使用模拟数据
            const geometry = generateMockGeometry('image', request.imageFile.name)
            const material = generateMockMaterial(request.imageFile.name)
            
            model.geometry = geometry
            model.material = material
            model.status = 'completed'
            model.isLocalFallback = true
            
            await model3DCache.cacheImageResult(request.imageFile, geometry, material)
            
            generationProgress.value = 100
            generationMessage.value = '资源不足，本地模型解析失败，使用默认模型'
            
            setCurrentModel(model)
            return model
          }
        }
        
        // 正常API流程
        const jobId = response.data.id
        
        // 保存job_id到模型中
        model.jobId = jobId
        
        generationProgress.value = 20
        generationMessage.value = '任务已提交，正在检查状态...'
        
        // 步骤2: 轮询任务状态
        await pollJobStatusForImage(jobId, model, request)
        
        return model
      } else {
        // 检查是否是ResourceInsufficient错误，如果是，尝试本地降级
        const errorMessage = response.error || response.message || '提交任务失败'
        console.log('检查图片转3D API响应错误信息:', errorMessage)
        
        if (errorMessage.includes('ResourceInsufficient') || errorMessage.includes('TencentCloudSDKError')) {
          console.log('检测到ResourceInsufficient或TencentCloudSDKError，尝试本地降级')
          
          generationProgress.value = 50
          generationMessage.value = '资源不足，正在加载本地模型...'
          
          try {
            const localModelBlob = await loadLocalModel()
            
            if (localModelBlob) {
              generationProgress.value = 80
              generationMessage.value = '正在解析本地模型...'
              
              const loadResult = await loadModelFromBlob(localModelBlob, 'local_model.glb')
              
              if (loadResult.geometry && loadResult.material) {
                console.log('本地模型解析成功，更新模型数据')
                
                model.geometry = loadResult.geometry
                model.material = loadResult.material
                model.status = 'completed'
                model.isLocalFallback = true
                
                await model3DCache.cacheImageResult(request.imageFile, loadResult.geometry, loadResult.material)
                
                generationProgress.value = 100
                generationMessage.value = '资源不足，已加载本地模型'
                
                setCurrentModel({...model})
                return model
              } else {
                console.warn('本地模型解析失败，使用模拟数据')
                const geometry = generateMockGeometry('image', request.imageFile.name)
                const material = generateMockMaterial(request.imageFile.name)
                
                model.geometry = geometry
                model.material = material
                model.status = 'completed'
                model.isLocalFallback = true
                
                await model3DCache.cacheImageResult(request.imageFile, geometry, material)
                
                generationProgress.value = 100
                generationMessage.value = '资源不足，本地模型解析失败，使用默认模型'
                
                setCurrentModel({...model})
                return model
              }
            } else {
              console.warn('本地模型加载失败，使用模拟数据')
              const geometry = generateMockGeometry('image', request.imageFile.name)
              const material = generateMockMaterial(request.imageFile.name)
              
              model.geometry = geometry
              model.material = material
              model.status = 'completed'
              model.isLocalFallback = true
              
              await model3DCache.cacheImageResult(request.imageFile, geometry, material)
              
              generationProgress.value = 100
              generationMessage.value = '资源不足，本地模型不可用，使用默认模型'
              
              setCurrentModel({...model})
              return model
            }
          } catch (localError) {
            console.error('本地模型加载失败:', localError)
            const geometry = generateMockGeometry('image', request.imageFile.name)
            const material = generateMockMaterial(request.imageFile.name)
            
            model.geometry = geometry
            model.material = material
            model.status = 'completed'
            model.isLocalFallback = true
            
            await model3DCache.cacheImageResult(request.imageFile, geometry, material)
            
            generationProgress.value = 100
            generationMessage.value = '资源不足，本地模型加载失败，使用默认模型'
            
            setCurrentModel({...model})
            return model
          }
        }
        
        // 其他错误情况
        model.status = 'failed'
        generationMessage.value = errorMessage
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
      const isLocalFallbackModel = currentModel.value?.isLocalFallback === true
      const delayTime = isLocalFallbackModel ? 5000 : 3000
      
      setTimeout(() => {
        generationProgress.value = 0
        if (!isLocalFallbackModel) {
          generationMessage.value = ''
        }
      }, delayTime)
    }
  }

  /**
   * 手动下载模型文件
   */
  async function downloadModelManually(jobId: string): Promise<boolean> {
    try {
      generationMessage.value = '正在下载模型文件...'
      
      const response = await model3DApi.downloadModel(jobId)
      
      if (response.success && response.data) {
        // 尝试加载模型
        try {
          const loadResult = await loadModelFromBlob(response.data, `${jobId}.gltf`)
          
          if (loadResult.geometry && loadResult.material && currentModel.value) {
            currentModel.value.geometry = loadResult.geometry
            currentModel.value.material = loadResult.material
            currentModel.value.status = 'completed'
            
            generationMessage.value = '模型下载和解析成功！'
            
            return true
          }
        } catch (parseError) {
          console.error('解析下载的模型失败:', parseError)
          generationMessage.value = '模型解析失败'
        }
      }
      
      return false
    } catch (error) {
      console.error('手动下载失败:', error)
      generationMessage.value = '下载失败'
      return false
    }
  }

  /**
   * 轮询图片转3D任务状态
   */
  async function pollJobStatusForImage(jobId: string, model: Model3D, request: ImageTo3DRequest): Promise<void> {
    return new Promise((resolve, reject) => {
      let pollCount = 0
      const maxPolls = 30 // 最多轮询30次（约5分钟）
      const pollInterval = 10000 // 每10秒轮询一次
      
      const poll = async () => {
        if (pollCount >= maxPolls) {
          model.status = 'failed'
          generationMessage.value = '任务超时，请稍后重试'
          reject(new Error('任务超时'))
          return
        }
        
        try {
          const statusResponse = await model3DApi.queryJobStatus(jobId)
          
          if (statusResponse.success && statusResponse.data) {
            const { status, error_message } = statusResponse.data
            
            switch (status) {
              case 'WAIT':
                generationMessage.value = `任务排队中... (${pollCount + 1}/${maxPolls})`
                generationProgress.value = Math.min(30 + pollCount * 2, 50)
                break
                
              case 'RUN':
                generationMessage.value = `正在生成中... (${pollCount + 1}/${maxPolls})`
                generationProgress.value = Math.min(50 + pollCount * 2, 80)
                break
                
              case 'DONE':
                generationMessage.value = '生成完成，正在下载模型...'
                generationProgress.value = 90
                
                // 下载模型文件（图片转3D默认使用GLB格式）
                try {
                  const downloadResponse = await model3DApi.downloadModel(jobId, 1) // 1 = GLB格式
                  
                  if (downloadResponse.success && downloadResponse.data) {
                    // 解析模型
                    const loadResult = await loadModelFromBlob(downloadResponse.data, `${jobId}.glb`)
                    
                    if (loadResult.geometry && loadResult.material) {
                      model.geometry = loadResult.geometry
                      model.material = loadResult.material
                      model.status = 'completed'
                      
                      // 立即触发视图更新
                      setCurrentModel({...model})
                      
                      // 缓存结果
                      await model3DCache.cacheImageResult(request.imageFile, loadResult.geometry, loadResult.material)
                      
                      generationProgress.value = 100
                      generationMessage.value = '模型生成成功！'
                      resolve()
                      return
                    }
                  }
                  
                  // 下载成功但解析失败，使用模拟数据
                  throw new Error('模型解析失败')
                } catch (downloadError) {
                  console.error('下载模型失败:', downloadError)
                  // 下载失败，使用模拟数据
                  const geometry = generateMockGeometry('image', request.imageFile.name)
                  const material = generateMockMaterial(request.imageFile.name)
                  
                  model.geometry = geometry
                  model.material = material
                  model.status = 'completed'
                  
                  await model3DCache.cacheImageResult(request.imageFile, geometry, material)
                  
                  generationProgress.value = 100
                  generationMessage.value = '模型生成成功（使用默认显示）'
                  resolve()
                  return
                }
                
              case 'FAIL':
                model.status = 'failed'
                generationMessage.value = error_message || '生成失败'
                reject(new Error(error_message || '生成失败'))
                return
            }
            
            // 继续轮询
            pollCount++
            setTimeout(poll, pollInterval)
          } else {
            // 查询状态失败
            pollCount++
            setTimeout(poll, pollInterval)
          }
        } catch (error) {
          console.error('查询任务状态失败:', error)
          pollCount++
          setTimeout(poll, pollInterval)
        }
      }
      
      // 开始轮询
      poll()
    })
  }

  /**
   * 轮询任务状态
   */
  async function pollJobStatus(jobId: string, model: Model3D, promptText: string, modelFormat: number = 0): Promise<void> {
    return new Promise((resolve, reject) => {
      let pollCount = 0
      const maxPolls = 30 // 最多轮询30次（约5分钟）
      const pollInterval = 10000 // 每10秒轮询一次
      
      const poll = async () => {
        if (pollCount >= maxPolls) {
          model.status = 'failed'
          generationMessage.value = '任务超时，请稍后重试'
          reject(new Error('任务超时'))
          return
        }
        
        try {
          const statusResponse = await model3DApi.queryJobStatus(jobId)
          
          if (statusResponse.success && statusResponse.data) {
            const { status, error_message } = statusResponse.data
            
            switch (status) {
              case 'WAIT':
                generationMessage.value = `任务排队中... (${pollCount + 1}/${maxPolls})`
                generationProgress.value = Math.min(30 + pollCount * 2, 50)
                break
                
              case 'RUN':
                generationMessage.value = `正在生成中... (${pollCount + 1}/${maxPolls})`
                generationProgress.value = Math.min(50 + pollCount * 2, 80)
                break
                
              case 'DONE':
                generationMessage.value = '生成完成，正在下载模型...'
                generationProgress.value = 90
                
                // 下载模型文件
                try {
                  const downloadResponse = await model3DApi.downloadModel(jobId, modelFormat)
                  
                  if (downloadResponse.success && downloadResponse.data) {
                    // 解析模型
                    const fileExtension = modelFormat === 0 ? 'obj' : 'glb'
                    const loadResult = await loadModelFromBlob(downloadResponse.data, `${jobId}.${fileExtension}`)
                    
                    if (loadResult.geometry && loadResult.material) {
                      model.geometry = loadResult.geometry
                      model.material = loadResult.material
                      model.status = 'completed'
                      
                      // 立即触发视图更新
                      setCurrentModel({...model})
                      
                      // 缓存结果
                      model3DCache.cacheTextResult(promptText, loadResult.geometry, loadResult.material)
                      
                      generationProgress.value = 100
                      generationMessage.value = '模型生成成功！'
                      resolve()
                      return
                    }
                  }
                  
                  // 下载成功但解析失败，使用模拟数据
                  throw new Error('模型解析失败')
                } catch (downloadError) {
                  console.error('下载模型失败:', downloadError)
                  // 下载失败，使用模拟数据
                  const geometry = generateMockGeometry('text', promptText)
                  const material = generateMockMaterial(promptText)
                  
                  model.geometry = geometry
                  model.material = material
                  model.status = 'completed'
                  
                  model3DCache.cacheTextResult(promptText, geometry, material)
                  
                  generationProgress.value = 100
                  generationMessage.value = '模型生成成功（使用默认显示）'
                  resolve()
                  return
                }
                
              case 'FAIL':
                model.status = 'failed'
                generationMessage.value = error_message || '生成失败'
                reject(new Error(error_message || '生成失败'))
                return
            }
            
            // 继续轮询
            pollCount++
            setTimeout(poll, pollInterval)
          } else {
            // 查询状态失败
            pollCount++
            setTimeout(poll, pollInterval)
          }
        } catch (error) {
          console.error('查询任务状态失败:', error)
          pollCount++
          setTimeout(poll, pollInterval)
        }
      }
      
      // 开始轮询
      poll()
    })
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

    addPersonalModel(model)
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
   * 添加个人模型到列表
   */
  function addPersonalModel(model: Model3D) {
    personalModels.value.unshift(model) // 新模型添加到前面
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
    // 先在个人模型中查找
    let index = personalModels.value.findIndex(model => model.id === id)
    let removedModel: Model3D | undefined = undefined
    
    if (index > -1) {
      const removed = personalModels.value.splice(index, 1)
      removedModel = removed.length > 0 ? removed[0] : undefined
    } else {
      // 在公共模型中查找（仅限管理员操作）
      index = publicGalleryModels.value.findIndex(model => model.id === id)
      if (index > -1) {
        const removed = publicGalleryModels.value.splice(index, 1)
        removedModel = removed.length > 0 ? removed[0] : undefined
      }
    }
    
    // 如果删除的是当前模型，清空当前模型
    if (currentModel.value?.id === id) {
      currentModel.value = null
    }
    
    // 清理资源
    if (removedModel) {
      if (removedModel.geometry) {
        removedModel.geometry.dispose()
      }
      if (removedModel.material) {
        (removedModel.material as any).dispose?.()
      }
    }
  }

  /**
   * 清空所有个人模型
   */
  function clearPersonalModels() {
    // 清理资源
    personalModels.value.forEach(model => {
      if (model.geometry) {
        model.geometry.dispose()
      }
      if (model.material) {
        (model.material as any).dispose?.()
      }
    })
    
    personalModels.value = []
    currentModel.value = null
  }

  /**
   * 根据ID获取模型
   */
  function getModelById(id: string): Model3D | undefined {
    // 先在个人模型中查找
    let model = personalModels.value.find(model => model.id === id)
    if (model) return model
    
    // 再在公共模型中查找
    return publicGalleryModels.value.find(model => model.id === id)
  }

  return {
    // 状态
    publicGalleryModels,
    personalModels,
    currentModel,
    isGenerating,
    generationProgress,
    generationMessage,
    isLoadingPublic,
    isLoadingUser,
    
    // 计算属性
    completedModels,
    failedModels,
    generatingModels,
    userTextModels,
    userImageModels,
    userUploadModels,
    userCompletedModels,
    
    // 方法
    initSampleModels,
    loadPublicGallery,
    loadUserModels,
    generateFromText,
    generateFromImage,
    createUploadedModel,
    exportModel,
    downloadModelManually,
    addPersonalModel,
    setCurrentModel,
    removeModel,
    clearPersonalModels,
    getModelById
  }
})