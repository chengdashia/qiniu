import axios from 'axios'
import * as THREE from 'three'
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
   * 文本转3D模型
   */
  async textTo3D(request: TextTo3DRequest): Promise<ApiResponse<Model3DGeneration>> {
    try {
      // 模拟API调用 - 实际部署时替换为真实API调用
      console.log('发起文本转3D请求:', request)
      
      // 模拟延迟
      await new Promise(resolve => setTimeout(resolve, MOCK_DELAY))
      
      // 模拟成功响应
      const mockResponse: ApiResponse<Model3DGeneration> = {
        success: true,
        data: {
          id: `text_${Date.now()}`,
          progress: 100,
          estimatedTime: 30,
          modelUrl: 'mock://generated-model.gltf',
          textureUrl: 'mock://generated-texture.png'
        },
        message: '模型生成成功'
      }

      return mockResponse

      // 真实API调用代码（注释掉，部署时启用）
      /*
      const response = await this.client.post('/text-to-3d', {
        prompt: request.text,
        quality: request.quality,
        style: request.style
      })
      
      return {
        success: true,
        data: response.data
      }
      */
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
   * 查询生成进度
   */
  async getGenerationStatus(id: string): Promise<ApiResponse<Model3DGeneration>> {
    try {
      console.log('查询生成进度:', id)
      
      // 模拟进度查询
      await new Promise(resolve => setTimeout(resolve, 500))
      
      const mockResponse: ApiResponse<Model3DGeneration> = {
        success: true,
        data: {
          id,
          progress: 100,
          modelUrl: 'mock://completed-model.gltf'
        }
      }

      return mockResponse

      // 真实API调用
      /*
      const response = await this.client.get(`/status/${id}`)
      return {
        success: true,
        data: response.data
      }
      */
    } catch (error) {
      return {
        success: false,
        error: '查询进度失败',
        message: error instanceof Error ? error.message : '未知错误'
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