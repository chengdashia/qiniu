import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js'
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js'
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js'
import { PLYLoader } from 'three/examples/jsm/loaders/PLYLoader.js'
import { ColladaLoader } from 'three/examples/jsm/loaders/ColladaLoader.js'

// 支持的3D文件格式
export type SupportedFormat = 'gltf' | 'glb' | 'obj' | 'fbx' | 'stl' | 'ply' | 'dae'

// 文件加载结果
export interface LoadResult {
  success: boolean
  model?: THREE.Object3D
  geometry?: THREE.BufferGeometry
  material?: THREE.Material | THREE.Material[]
  animations?: THREE.AnimationClip[]
  error?: string
  metadata?: {
    vertices: number
    faces: number
    materials: number
    textures: number
    size: string
  }
}

// 文件验证结果
export interface ValidationResult {
  isValid: boolean
  format?: SupportedFormat
  error?: string
  fileSize: number
  fileName: string
}

export class FileLoader {
  private static instance: FileLoader
  private gltfLoader = new GLTFLoader()
  private objLoader = new OBJLoader()
  private fbxLoader = new FBXLoader()
  private stlLoader = new STLLoader()
  private plyLoader = new PLYLoader()
  private colladaLoader = new ColladaLoader()

  // 最大文件大小限制 (50MB)
  private maxFileSize = 50 * 1024 * 1024

  // 支持的文件扩展名
  private supportedExtensions: Record<string, SupportedFormat> = {
    'gltf': 'gltf',
    'glb': 'glb',
    'obj': 'obj',
    'fbx': 'fbx',
    'stl': 'stl',
    'ply': 'ply',
    'dae': 'dae'
  }

  private constructor() {
    this.setupLoaders()
  }

  public static getInstance(): FileLoader {
    if (!FileLoader.instance) {
      FileLoader.instance = new FileLoader()
    }
    return FileLoader.instance
  }

  private setupLoaders() {
    // 设置加载器管理器，用于处理纹理等资源
    const loadingManager = new THREE.LoadingManager()
    
    loadingManager.onLoad = () => {
      console.log('所有资源加载完成')
    }
    
    loadingManager.onProgress = (url, loaded, total) => {
      console.log(`加载进度: ${url} (${loaded}/${total})`)
    }
    
    loadingManager.onError = (url) => {
      console.error('资源加载失败:', url)
    }

    // 应用加载管理器到各个加载器
    this.gltfLoader.manager = loadingManager
    this.objLoader.manager = loadingManager
    this.fbxLoader.manager = loadingManager
    this.stlLoader.manager = loadingManager
    this.plyLoader.manager = loadingManager
    this.colladaLoader.manager = loadingManager
  }

  /**
   * 验证文件是否为支持的3D模型格式
   */
  public validateFile(file: File): ValidationResult {
    const fileName = file.name.toLowerCase()
    const extension = fileName.split('.').pop()
    
    if (!extension || !this.supportedExtensions[extension]) {
      return {
        isValid: false,
        error: `不支持的文件格式: ${extension}。支持的格式: ${Object.keys(this.supportedExtensions).join(', ')}`,
        fileSize: file.size,
        fileName: file.name
      }
    }
    
    if (file.size > this.maxFileSize) {
      return {
        isValid: false,
        error: `文件太大: ${this.formatFileSize(file.size)}。最大支持: ${this.formatFileSize(this.maxFileSize)}`,
        fileSize: file.size,
        fileName: file.name
      }
    }
    
    return {
      isValid: true,
      format: this.supportedExtensions[extension],
      fileSize: file.size,
      fileName: file.name
    }
  }

  /**
   * 加载3D模型文件
   */
  public async loadFile(file: File, onProgress?: (progress: number) => void): Promise<LoadResult> {
    // 先验证文件
    const validation = this.validateFile(file)
    if (!validation.isValid) {
      return {
        success: false,
        error: validation.error
      }
    }

    try {
      const url = URL.createObjectURL(file)
      const result = await this.loadFromUrl(url, validation.format!, onProgress)
      URL.revokeObjectURL(url) // 清理内存
      
      // 添加元数据
      if (result.success && result.model) {
        result.metadata = this.extractMetadata(result.model, file)
      }
      
      return result
    } catch (error) {
      return {
        success: false,
        error: `文件加载失败: ${error instanceof Error ? error.message : '未知错误'}`
      }
    }
  }

  /**
   * 从URL加载模型
   */
  private loadFromUrl(url: string, format: SupportedFormat, onProgress?: (progress: number) => void): Promise<LoadResult> {
    return new Promise((resolve, reject) => {
      const progressHandler = (event: ProgressEvent) => {
        if (event.lengthComputable && onProgress) {
          const progress = (event.loaded / event.total) * 100
          onProgress(progress)
        }
      }

      switch (format) {
        case 'gltf':
        case 'glb':
          this.gltfLoader.load(
            url,
            (gltf) => {
              resolve({
                success: true,
                model: gltf.scene,
                animations: gltf.animations
              })
            },
            progressHandler,
            (error) => reject(error)
          )
          break

        case 'obj':
          this.objLoader.load(
            url,
            (object) => {
              resolve({
                success: true,
                model: object
              })
            },
            progressHandler,
            (error) => reject(error)
          )
          break

        case 'fbx':
          this.fbxLoader.load(
            url,
            (object) => {
              resolve({
                success: true,
                model: object,
                animations: object.animations
              })
            },
            progressHandler,
            (error) => reject(error)
          )
          break

        case 'stl':
          this.stlLoader.load(
            url,
            (geometry) => {
              const material = new THREE.MeshPhongMaterial({ 
                color: 0x888888,
                shininess: 100
              })
              const mesh = new THREE.Mesh(geometry, material)
              resolve({
                success: true,
                model: mesh,
                geometry,
                material
              })
            },
            progressHandler,
            (error) => reject(error)
          )
          break

        case 'ply':
          this.plyLoader.load(
            url,
            (geometry) => {
              const material = new THREE.MeshPhongMaterial({ 
                color: 0x888888,
                shininess: 100,
                vertexColors: geometry.hasAttribute('color')
              })
              const mesh = new THREE.Mesh(geometry, material)
              resolve({
                success: true,
                model: mesh,
                geometry,
                material
              })
            },
            progressHandler,
            (error) => reject(error)
          )
          break

        case 'dae':
          this.colladaLoader.load(
            url,
            (collada) => {
              resolve({
                success: true,
                model: collada.scene
              })
            },
            progressHandler,
            (error) => reject(error)
          )
          break

        default:
          reject(new Error(`不支持的格式: ${format}`))
      }
    })
  }

  /**
   * 提取模型元数据
   */
  private extractMetadata(model: THREE.Object3D, file: File) {
    let vertices = 0
    let faces = 0
    let materials = 0
    const textureSet = new Set<string>()

    model.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        const geometry = child.geometry
        if (geometry) {
          vertices += geometry.attributes.position?.count || 0
          if (geometry.index) {
            faces += geometry.index.count / 3
          } else {
            faces += (geometry.attributes.position?.count || 0) / 3
          }
        }

        const material = child.material
        if (material) {
          if (Array.isArray(material)) {
            materials += material.length
            material.forEach(mat => this.extractTexturesFromMaterial(mat, textureSet))
          } else {
            materials += 1
            this.extractTexturesFromMaterial(material, textureSet)
          }
        }
      }
    })

    return {
      vertices: Math.floor(vertices),
      faces: Math.floor(faces),
      materials,
      textures: textureSet.size,
      size: this.formatFileSize(file.size)
    }
  }

  /**
   * 从材质中提取纹理信息
   */
  private extractTexturesFromMaterial(material: THREE.Material, textureSet: Set<string>) {
    const checkTexture = (texture: THREE.Texture | null) => {
      if (texture && texture.image) {
        textureSet.add(texture.image.src || 'unknown')
      }
    }

    if (material instanceof THREE.MeshStandardMaterial) {
      checkTexture(material.map)
      checkTexture(material.normalMap)
      checkTexture(material.roughnessMap)
      checkTexture(material.metalnessMap)
      checkTexture(material.emissiveMap)
      checkTexture(material.bumpMap)
      checkTexture(material.displacementMap)
    } else if (material instanceof THREE.MeshPhongMaterial ||
               material instanceof THREE.MeshLambertMaterial) {
      checkTexture(material.map)
      checkTexture(material.normalMap)
      checkTexture(material.emissiveMap)
      checkTexture(material.bumpMap)
      checkTexture(material.displacementMap)
    }
  }

  /**
   * 格式化文件大小
   */
  private formatFileSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB']
    let size = bytes
    let unitIndex = 0

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024
      unitIndex++
    }

    return `${size.toFixed(2)} ${units[unitIndex]}`
  }

  /**
   * 获取支持的文件格式列表
   */
  public getSupportedFormats(): string[] {
    return Object.keys(this.supportedExtensions)
  }

  /**
   * 获取支持的MIME类型
   */
  public getSupportedMimeTypes(): string[] {
    return [
      'model/gltf+json',
      'model/gltf-binary',
      'model/obj',
      'application/octet-stream', // for FBX, STL等二进制格式
      'text/plain' // for OBJ等文本格式
    ]
  }
}

// 导出单例实例
export const fileLoader = FileLoader.getInstance()