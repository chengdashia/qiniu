import axios from 'axios'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js'
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js'
import type { 
  TextTo3DRequest, 
  ImageTo3DRequest, 
  ApiResponse, 
  Model3DGeneration,
  Model3D 
} from '../types/3d'

// 模拟API延迟
const MOCK_DELAY = 2000

// 模拟的API基础URL（实际部署时替换为真实API）
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://api.meshy.ai/v1'

class Model3DApi {
  private apiKey: string = import.meta.env.VITE_MESHY_API_KEY || 'mock-api-key'

  // 创建axios实例
  private client = axios.create({
    baseURL: API_BASE_URL,
    headers: {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json'
    },
    timeout: 30000
  })

  /**
   * 文本转3D模型 - 简化流程
   */
  async textTo3D(request: TextTo3DRequest): Promise<ApiResponse<{id: string, modelBlob?: Blob, prompt_used?: string}>> {
    try {
      console.log('发起文本转3D请求:', {
        prompt: request.prompt || request.text,
        polish: request.polish, // 提示词优化
        enable_pbr: request.enable_pbr,
        face_count: request.face_count,
        generate_type: request.generate_type
      })
      
      // 步骤1: 调用本地后端API提交任务
      const submitResponse = await this.client.post('/api/submit-text', {
        prompt: request.prompt || request.text,
        polish: request.polish,
        enable_pbr: request.enable_pbr,
        face_count: request.face_count,
        generate_type: request.generate_type
      })
      
      if (!submitResponse.data.ok) {
        throw new Error(submitResponse.data.error || '提交任务失败')
      }
      
      const jobId = submitResponse.data.job_id
      const promptUsed = submitResponse.data.prompt_used
      
      console.log('任务提交成功，job_id:', jobId)
      
      // 步骤2: 直接尝试下载模型文件
      try {
        const downloadResponse = await this.client.get(`/api/download/${jobId}/0`, {
          responseType: 'blob',
          timeout: 120000 // 2分钟超时
        })
        
        if (downloadResponse.data) {
          console.log('模型文件下载成功')
          return {
            success: true,
            data: {
              id: jobId,
              modelBlob: downloadResponse.data,
              prompt_used: promptUsed
            },
            message: '3D模型生成并下载成功'
          }
        }
      } catch (downloadError) {
        console.error('下载模型文件失败:', downloadError)
        // 下载失败，返回job_id以便后续处理
        return {
          success: true,
          data: {
            id: jobId,
            prompt_used: promptUsed
          },
          message: '任务提交成功，但下载失败，请稍后重试'
        }
      }
      
      return {
        success: true,
        data: {
          id: jobId,
          prompt_used: promptUsed
        },
        message: '任务提交成功'
      }
    } catch (error) {
      console.error('文本转3D API错误:', error)
      return {
        success: false,
        error: '文本转3D生成失败',
        message: error instanceof Error ? error.message : '未知错误'
      }
    }
  }

  /**
   * 查询任务状态
   */
  async queryJobStatus(jobId: string): Promise<ApiResponse<any>> {
    try {
      const response = await this.client.get(`/api/status/${jobId}`)
      
      if (response.data.ok) {
        return {
          success: true,
          data: response.data,
          message: '查询成功'
        }
      } else {
        throw new Error(response.data.error || '查询失败')
      }
    } catch (error) {
      console.error('查询任务状态错误:', error)
      return {
        success: false,
        error: '查询任务状态失败',
        message: error instanceof Error ? error.message : '未知错误'
      }
    }
  }

  /**
   * 下载3D模型文件
   */
  async downloadModel(jobId: string, index: number = 0): Promise<ApiResponse<Blob>> {
    try {
      const response = await this.client.get(`/api/download/${jobId}/${index}`, {
        responseType: 'blob',
        timeout: 120000 // 2分钟超时
      })
      
      if (response.data) {
        return {
          success: true,
          data: response.data,
          message: '模型下载成功'
        }
      } else {
        throw new Error('下载数据为空')
      }
    } catch (error) {
      console.error('下载模型文件错误:', error)
      return {
        success: false,
        error: '下载模型文件失败',
        message: error instanceof Error ? error.message : '未知错误'
      }
    }
  }

  /**
   * 图片转3D模型
   */
  async imageeTo3D(request: ImageTo3DRequest): Promise<ApiResponse<Model3DGeneration>> {
    try {
      console.log('发起图片转3D请求:', request.imageFile.name)
      
      // 模拟延迟
      await new Promise(resolve => setTimeout(resolve, MOCK_DELAY + 1000))
      
      // 模拟成功响应
      const mockResponse: ApiResponse<Model3DGeneration> = {
        success: true,
        data: {
          id: `image_${Date.now()}`,
          progress: 100,
          estimatedTime: 45,
          modelUrl: 'mock://generated-from-image.gltf',
          textureUrl: 'mock://extracted-texture.png'
        },
        message: '模型生成成功'
      }

      return mockResponse

      // 真实API调用代码（注释掉，部署时启用）
      /*
      const formData = new FormData()
      formData.append('image', request.imageFile)
      formData.append('quality', request.quality)
      formData.append('preserve_colors', request.preserveColors.toString())
      
      const response = await this.client.post('/image-to-3d', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      })
      
      return {
        success: true,
        data: response.data
      }
      */
    } catch (error) {
      console.error('图片转3D API错误:', error)
      return {
        success: false,
        error: '图片转3D生成失败',
        message: error instanceof Error ? error.message : '未知错误'
      }
    }
  }

  /**
   * 获取公共模型画廊（不需要认证）
   */
  async getPublicGallery(): Promise<ApiResponse<Model3D[]>> {
    try {
      console.log('获取公共模型画廊')
      
      // 模拟延迟
      await new Promise(resolve => setTimeout(resolve, 800))
      
      // 模拟公共模型数据
      const publicModels: Model3D[] = [
        {
          id: 'public_1',
          name: '经典立方体机器人',
          type: 'text',
          sourceContent: '一个立方体机器人',
          createdAt: new Date(Date.now() - 86400000), // 1天前
          status: 'completed',
          userId: 'public',
          geometry: generateMockGeometry('text', '一个立方体机器人'),
          material: generateMockMaterial('一个立方体机器人')
        },
        {
          id: 'public_2', 
          name: '蓝色球体',
          type: 'text',
          sourceContent: '蓝色的球形物体',
          createdAt: new Date(Date.now() - 172800000), // 2天前
          status: 'completed',
          userId: 'public',
          geometry: generateMockGeometry('text', '蓝色的球形物体'),
          material: generateMockMaterial('蓝色的球形物体')
        },
        {
          id: 'public_3',
          name: '红色圆环',
          type: 'text', 
          sourceContent: '红色的圆环形状',
          createdAt: new Date(Date.now() - 259200000), // 3天前
          status: 'completed',
          userId: 'public',
          geometry: generateMockGeometry('text', '红色的圆环形状'),
          material: generateMockMaterial('红色的圆环形状')
        },
        {
          id: 'public_4',
          name: '绿色圆锥建筑',
          type: 'text',
          sourceContent: '绿色的圆锥体建筑',
          createdAt: new Date(Date.now() - 345600000), // 4天前
          status: 'completed',
          userId: 'public',
          geometry: generateMockGeometry('text', '绿色的圆锥体建筑'),
          material: generateMockMaterial('绿色的圆锥体建筑')
        },
        {
          id: 'public_5',
          name: '紫色水晶',
          type: 'text',
          sourceContent: '紫色的多面体水晶',
          createdAt: new Date(Date.now() - 432000000), // 5天前
          status: 'completed',
          userId: 'public',
          geometry: generateMockGeometry('text', '紫色的多面体水晶'),
          material: generateMockMaterial('紫色的多面体水晶')
        },
        {
          id: 'public_6',
          name: '可爱小狗模型',
          type: 'image',
          sourceContent: '可爱的小狗照片',
          createdAt: new Date(Date.now() - 518400000), // 6天前
          status: 'completed',
          userId: 'public',
          geometry: generateMockGeometry('image', '可爱的小狗照片'),
          material: generateMockMaterial('可爱的小狗照片')
        },
        {
          id: 'public_7',
          name: '现代家具设计',
          type: 'image',
          sourceContent: '现代家具设计图片',
          createdAt: new Date(Date.now() - 604800000), // 7天前
          status: 'completed',
          userId: 'public',
          geometry: generateMockGeometry('image', '现代家具设计图片'),
          material: generateMockMaterial('现代家具设计图片')
        }
      ]
      
      return {
        success: true,
        data: publicModels,
        message: '获取公共模型成功'
      }
      
      // 真实API调用代码（注释掉，部署时启用）
      /*
      const response = await this.client.get('/public/gallery')
      return {
        success: true,
        data: response.data.models
      }
      */
    } catch (error) {
      console.error('获取公共模型画廊失败:', error)
      return {
        success: false,
        error: '获取公共模型失败',
        message: error instanceof Error ? error.message : '未知错误',
        data: []
      }
    }
  }

  /**
   * 获取用户个人模型历史（需要认证）
   */
  async getUserModels(userId: string): Promise<ApiResponse<Model3D[]>> {
    try {
      console.log('获取用户模型历史:', userId)
      
      // 模拟延迟
      await new Promise(resolve => setTimeout(resolve, 600))
      
      // 模拟用户个人模型数据（这里应该根据实际用户返回）
      const userModels: Model3D[] = []
      
      return {
        success: true,
        data: userModels,
        message: '获取用户模型成功'
      }
      
      // 真实API调用代码（注释掉，部署时启用）
      /*
      const response = await this.client.get(`/users/${userId}/models`)
      return {
        success: true,
        data: response.data.models
      }
      */
    } catch (error) {
      console.error('获取用户模型失败:', error)
      return {
        success: false,
        error: '获取用户模型失败',
        message: error instanceof Error ? error.message : '未知错误',
        data: []
      }
    }
  }
}

/**
 * 模拟生成几何体数据（用于开发测试）
 */
export function generateMockGeometry(type: 'text' | 'image', input: string): THREE.BufferGeometry {
  // 根据输入内容生成不同的几何体
  const hash = hashCode(input)
  const shapes = ['box', 'sphere', 'torus', 'cone', 'cylinder', 'octahedron', 'dodecahedron', 'icosahedron']
  const shapeIndex = Math.abs(hash) % shapes.length
  
  // 添加一些随机变化
  const scale = 0.8 + (Math.abs(hash % 1000) / 1000) * 0.4 // 0.8-1.2
  const detail = Math.max(16, Math.abs(hash % 64))
  
  let geometry: THREE.BufferGeometry
  
  switch (shapes[shapeIndex]) {
    case 'sphere':
      geometry = new THREE.SphereGeometry(scale, detail, detail)
      break
    case 'torus':
      geometry = new THREE.TorusGeometry(scale, scale * 0.4, detail, detail * 2)
      break
    case 'cone':
      geometry = new THREE.ConeGeometry(scale, scale * 2, detail)
      break
    case 'cylinder':
      geometry = new THREE.CylinderGeometry(scale, scale * 0.8, scale * 2, detail)
      break
    case 'octahedron':
      geometry = new THREE.OctahedronGeometry(scale, 2)
      break
    case 'dodecahedron':
      geometry = new THREE.DodecahedronGeometry(scale, 1)
      break
    case 'icosahedron':
      geometry = new THREE.IcosahedronGeometry(scale, 1)
      break
    default:
      // 创建简单的立方体
      geometry = new THREE.BoxGeometry(scale, scale, scale)
  }
  
  // 确保几何体有法向量
  if (!geometry.attributes.normal) {
    geometry.computeVertexNormals()
  }
  
  return geometry
}

/**
 * 生成随机材质
 */
export function generateMockMaterial(input: string): THREE.Material {
  const hash = hashCode(input)
  
  // 更丰富的颜色调色板
  const colorPalettes = [
    [0xff6b6b, 0xff8e8e, 0xffb3b3], // 红色系
    [0x4ecdc4, 0x6fe4dc, 0x95f1ea], // 青色系
    [0x45b7d1, 0x6bc5d8, 0x91d3df], // 蓝色系
    [0xf9ca24, 0xfad946, 0xfbe868], // 黄色系
    [0xf0932b, 0xf3a549, 0xf6b767], // 橙色系
    [0xeb4d4b, 0xef6b69, 0xf38987], // 深红系
    [0x6c5ce7, 0x8b7bea, 0xaa99ed], // 紫色系
    [0xa29bfe, 0xb4affe, 0xc6c3fe], // 淡紫系
    [0x26de81, 0x4de393, 0x74e8a5], // 绿色系
    [0xfd79a8, 0xfe92b8, 0xfeabc8]  // 粉色系
  ]
  
  const paletteIndex = Math.abs(hash) % colorPalettes.length
  const palette = colorPalettes[paletteIndex]
  if (!palette) {
    // 默认颜色
    const color = 0x4ecdc4
    return new THREE.MeshPhongMaterial({
      color,
      shininess: 100,
      transparent: true,
      opacity: 0.9
    })
  }
  
  const colorIndex = Math.abs(hash >> 8) % palette.length
  const color = palette[colorIndex]
  
  // 随机材质类型
  const materialTypes = ['phong', 'standard', 'physical']
  const materialType = materialTypes[Math.abs(hash >> 16) % materialTypes.length]
  
  const baseProps = {
    color,
    transparent: true,
    opacity: 0.85 + (Math.abs(hash % 100) / 100) * 0.15 // 0.85-1.0
  }
  
  switch (materialType) {
    case 'standard':
      return new THREE.MeshStandardMaterial({
        ...baseProps,
        metalness: (Math.abs(hash % 50) / 50) * 0.3, // 0-0.3
        roughness: 0.2 + (Math.abs(hash % 80) / 80) * 0.6 // 0.2-0.8
      })
    
    case 'physical':
      return new THREE.MeshPhysicalMaterial({
        ...baseProps,
        metalness: (Math.abs(hash % 40) / 40) * 0.4,
        roughness: 0.1 + (Math.abs(hash % 70) / 70) * 0.7,
        clearcoat: (Math.abs(hash % 30) / 30) * 0.5
      })
    
    default: // phong
      return new THREE.MeshPhongMaterial({
        ...baseProps,
        shininess: 50 + (Math.abs(hash % 150))
      })
  }
}

/**
 * 简单的字符串哈希函数
 */
function hashCode(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // 转换为32位整数
  }
  return hash
}

/**
 * 智能缓存系统（基于之前的策略）
 */
class Model3DCache {
  private textCache = new Map<string, { 
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    timestamp: number 
  }>()
  
  private imageCache = new Map<string, { 
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    timestamp: number 
  }>()

  private CACHE_TTL = 24 * 60 * 60 * 1000 // 24小时

  /**
   * 检查文本缓存
   */
  checkTextCache(text: string): { geometry: THREE.BufferGeometry, material: THREE.Material } | null {
    const normalizedText = text.toLowerCase().trim()
    const cached = this.textCache.get(normalizedText)
    
    if (cached && (Date.now() - cached.timestamp) < this.CACHE_TTL) {
      console.log('命中文本缓存:', normalizedText)
      return { geometry: cached.geometry, material: cached.material }
    }
    
    return null
  }

  /**
   * 缓存文本结果
   */
  cacheTextResult(text: string, geometry: THREE.BufferGeometry, material: THREE.Material) {
    const normalizedText = text.toLowerCase().trim()
    this.textCache.set(normalizedText, {
      geometry: geometry.clone(),
      material: material.clone(),
      timestamp: Date.now()
    })
  }

  /**
   * 检查图片缓存（基于文件哈希）
   */
  async checkImageCache(file: File): Promise<{ geometry: THREE.BufferGeometry, material: THREE.Material } | null> {
    const fileHash = await this.generateFileHash(file)
    const cached = this.imageCache.get(fileHash)
    
    if (cached && (Date.now() - cached.timestamp) < this.CACHE_TTL) {
      console.log('命中图片缓存:', fileHash)
      return { geometry: cached.geometry, material: cached.material }
    }
    
    return null
  }

  /**
   * 缓存图片结果
   */
  async cacheImageResult(file: File, geometry: THREE.BufferGeometry, material: THREE.Material) {
    const fileHash = await this.generateFileHash(file)
    this.imageCache.set(fileHash, {
      geometry: geometry.clone(),
      material: material.clone(),
      timestamp: Date.now()
    })
  }

  /**
   * 生成文件哈希
   */
  private async generateFileHash(file: File): Promise<string> {
    const buffer = await file.arrayBuffer()
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  }

  /**
   * 清理过期缓存
   */
  cleanup() {
    const now = Date.now()
    
    for (const [key, value] of this.textCache.entries()) {
      if (now - value.timestamp > this.CACHE_TTL) {
        this.textCache.delete(key)
      }
    }
    
    for (const [key, value] of this.imageCache.entries()) {
      if (now - value.timestamp > this.CACHE_TTL) {
        this.imageCache.delete(key)
      }
    }
  }
}

// 导出单例实例
export const model3DApi = new Model3DApi()
export const model3DCache = new Model3DCache()

// 定期清理缓存
setInterval(() => {
  model3DCache.cleanup()
}, 60 * 60 * 1000) // 每小时清理一次

/**
 * 从Blob数据中加载3D模型
 */
export async function loadModelFromBlob(blob: Blob, filename: string = 'model'): Promise<{geometry?: THREE.BufferGeometry, material?: THREE.Material, model?: THREE.Object3D}> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob)
    const fileExtension = filename.toLowerCase().split('.').pop() || 'gltf'
    
    try {
      switch (fileExtension) {
        case 'gltf':
        case 'glb':
          const gltfLoader = new GLTFLoader()
          gltfLoader.load(
            url,
            (gltf) => {
              URL.revokeObjectURL(url)
              const scene = gltf.scene
              let geometry: THREE.BufferGeometry | undefined
              let material: THREE.Material | undefined
              
              // 从场景中提取第一个mesh的geometry和material
              scene.traverse((child) => {
                if (child instanceof THREE.Mesh && !geometry) {
                  geometry = child.geometry
                  material = child.material as THREE.Material
                }
              })
              
              resolve({ geometry, material, model: scene })
            },
            undefined,
            (error) => {
              URL.revokeObjectURL(url)
              reject(error)
            }
          )
          break
          
        case 'obj':
          const objLoader = new OBJLoader()
          objLoader.load(
            url,
            (object) => {
              URL.revokeObjectURL(url)
              let geometry: THREE.BufferGeometry | undefined
              let material: THREE.Material | undefined
              
              object.traverse((child) => {
                if (child instanceof THREE.Mesh && !geometry) {
                  geometry = child.geometry
                  material = child.material as THREE.Material
                }
              })
              
              resolve({ geometry, material, model: object })
            },
            undefined,
            (error) => {
              URL.revokeObjectURL(url)
              reject(error)
            }
          )
          break
          
        case 'fbx':
          const fbxLoader = new FBXLoader()
          fbxLoader.load(
            url,
            (object) => {
              URL.revokeObjectURL(url)
              let geometry: THREE.BufferGeometry | undefined
              let material: THREE.Material | undefined
              
              object.traverse((child) => {
                if (child instanceof THREE.Mesh && !geometry) {
                  geometry = child.geometry
                  material = child.material as THREE.Material
                }
              })
              
              resolve({ geometry, material, model: object })
            },
            undefined,
            (error) => {
              URL.revokeObjectURL(url)
              reject(error)
            }
          )
          break
          
        default:
          URL.revokeObjectURL(url)
          reject(new Error(`不支持的文件格式: ${fileExtension}`))
      }
    } catch (error) {
      URL.revokeObjectURL(url)
      reject(error)
    }
  })
}