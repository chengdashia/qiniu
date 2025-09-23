// 3D模型相关类型定义
import * as THREE from 'three'

export interface Model3D {
  id: string
  name: string
  type: 'text' | 'image' | 'upload' // 添加 upload 类型
  sourceContent: string // 文本描述、图片URL或文件名
  geometry?: THREE.BufferGeometry
  material?: THREE.Material
  mesh?: THREE.Mesh
  createdAt: Date
  status: 'generating' | 'completed' | 'failed'
  userId?: string // 模型属主的用户ID
  // 新增字段用于文件上传
  fileInfo?: {
    originalName: string
    size: number
    format: string
    metadata?: {
      vertices: number
      faces: number
      materials: number
      textures: number
    }
  }
}

export interface Upload3DRequest {
  file: File
  name?: string // 可选的自定义名称
  description?: string // 可选的描述
}

export interface TextTo3DRequest {
  prompt: string // 改为prompt以匹配API参数
  polish: boolean // 是否抛光处理
  enable_pbr: boolean // 是否启用PBR材质，默认false
  face_count: number // 面数，范围40000-500000
  generate_type: 'Normal' | 'LowPoly' | 'Geometry' | 'Sketch' // 生成类型
  // 保留原有字段以兼容旧代码
  text?: string
  quality?: 'low' | 'medium' | 'high'
  style?: string
}

export interface ImageTo3DRequest {
  imageFile: File
  quality: 'low' | 'medium' | 'high'
  preserveColors: boolean
}

export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

export interface Model3DGeneration {
  id: string
  modelUrl?: string
  textureUrl?: string
  progress: number
  estimatedTime?: number
}

// 3D查看器配置
export interface ViewerConfig {
  enableControls: boolean
  enableAnimation: boolean
  backgroundColor: string
  cameraPosition: { x: number; y: number; z: number }
  lightIntensity: number
}

// 导出格式
export type ExportFormat = 'obj' | 'stl' | 'fbx' | 'gltf'

export interface ExportOptions {
  format: ExportFormat
  includeTextures: boolean
  scale: number
}