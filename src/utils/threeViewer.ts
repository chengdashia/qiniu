import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js'
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js'
import { OBJExporter } from 'three/examples/jsm/exporters/OBJExporter.js'
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js'
import type { ViewerConfig, ExportFormat } from '../types/3d'

export class ThreeViewer {
  private container: HTMLElement
  private scene!: THREE.Scene
  private camera!: THREE.PerspectiveCamera
  private renderer!: THREE.WebGLRenderer
  private controls!: OrbitControls
  private currentModel: THREE.Object3D | null = null
  private config: ViewerConfig
  private isWireframe: boolean = false
  private originalMaterials: Map<THREE.Mesh, THREE.Material | THREE.Material[]> = new Map()

  constructor(container: HTMLElement, config: Partial<ViewerConfig> = {}) {
    this.container = container
    this.config = {
      enableControls: true,
      enableAnimation: true,
      backgroundColor: '#f0f0f0',
      cameraPosition: { x: 5, y: 5, z: 5 },
      lightIntensity: 1,
      ...config
    }

    this.init()
  }

  private init() {
    // 创建场景
    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(this.config.backgroundColor)

    // 获取容器尺寸
    const width = this.container.clientWidth || 300
    const height = this.container.clientHeight || 200
    const aspect = width / height
    
    // 创建相机
    this.camera = new THREE.PerspectiveCamera(75, aspect, 0.1, 1000)
    this.camera.position.set(
      this.config.cameraPosition.x,
      this.config.cameraPosition.y,
      this.config.cameraPosition.z
    )

    // 创建渲染器
    this.renderer = new THREE.WebGLRenderer({ 
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true
    })
    this.renderer.setSize(width, height)
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    this.renderer.setClearColor(this.config.backgroundColor, 1)
    this.container.appendChild(this.renderer.domElement)

    // 创建控制器
    if (this.config.enableControls) {
      this.controls = new OrbitControls(this.camera, this.renderer.domElement)
      this.controls.enableDamping = true
      this.controls.dampingFactor = 0.05
    }

    // 添加光源
    this.setupLights()

    // 开始渲染循环
    this.animate()

    // 处理窗口大小变化
    window.addEventListener('resize', this.onWindowResize.bind(this))
  }

  private setupLights() {
    // 环境光
    const ambientLight = new THREE.AmbientLight(0x404040, 0.6)
    this.scene.add(ambientLight)

    // 方向光
    const directionalLight = new THREE.DirectionalLight(0xffffff, this.config.lightIntensity)
    directionalLight.position.set(10, 10, 5)
    directionalLight.castShadow = true
    directionalLight.shadow.mapSize.width = 2048
    directionalLight.shadow.mapSize.height = 2048
    this.scene.add(directionalLight)

    // 点光源
    const pointLight = new THREE.PointLight(0xffffff, 0.5, 100)
    pointLight.position.set(-10, 10, -10)
    this.scene.add(pointLight)
  }

  private animate() {
    requestAnimationFrame(this.animate.bind(this))
    
    if (this.controls) {
      this.controls.update()
    }

    // 如果启用动画，让模型缓慢旋转
    if (this.config.enableAnimation && this.currentModel) {
      this.currentModel.rotation.y += 0.01
    }

    this.renderer.render(this.scene, this.camera)
  }

  private onWindowResize() {
    const width = this.container.clientWidth || 300
    const height = this.container.clientHeight || 200

    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(width, height)
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  }

  // 加载模型
  public loadModel(geometry: THREE.BufferGeometry, material?: THREE.Material) {
    // 清除当前模型
    if (this.currentModel) {
      this.scene.remove(this.currentModel)
    }
    
    // 重置线框模式状态
    this.isWireframe = false
    this.originalMaterials.clear()

    // 创建材质（如果未提供）
    if (!material) {
      material = new THREE.MeshPhongMaterial({ 
        color: 0x00ff00, 
        shininess: 100,
        transparent: true,
        opacity: 0.9
      })
    }

    // 创建网格
    const mesh = new THREE.Mesh(geometry, material)
    mesh.castShadow = true
    mesh.receiveShadow = true

    // 居中模型
    const box = new THREE.Box3().setFromObject(mesh)
    const center = box.getCenter(new THREE.Vector3())
    mesh.position.sub(center)

    // 添加到场景
    this.scene.add(mesh)
    this.currentModel = mesh

    // 调整相机位置以适应模型
    this.fitCameraToModel()
  }

  // 创建示例几何体（用于测试）
  public createSampleGeometry(type: 'cube' | 'sphere' | 'torus' = 'cube'): THREE.BufferGeometry {
    switch (type) {
      case 'sphere':
        return new THREE.SphereGeometry(1, 32, 32)
      case 'torus':
        return new THREE.TorusGeometry(1, 0.4, 16, 100)
      default:
        return new THREE.BoxGeometry(1, 1, 1)
    }
  }

  private fitCameraToModel() {
    if (!this.currentModel) return

    const box = new THREE.Box3().setFromObject(this.currentModel)
    const size = box.getSize(new THREE.Vector3())
    const center = box.getCenter(new THREE.Vector3())
    const maxDim = Math.max(size.x, size.y, size.z)
    
    // 根据容器大小调整相机距离
    const containerSize = Math.min(this.container.clientWidth, this.container.clientHeight)
    const scaleFactor = containerSize < 300 ? 2.5 : 2
    const distance = maxDim * scaleFactor

    this.camera.position.set(distance, distance * 0.8, distance)
    this.camera.lookAt(center)

    if (this.controls) {
      this.controls.target.copy(center)
      this.controls.update()
    }
  }

  // 导出模型
  public exportModel(format: ExportFormat): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!this.currentModel) {
        reject(new Error('没有可导出的模型'))
        return
      }

      try {
        let result: string
        
        switch (format) {
          case 'obj':
            const objExporter = new OBJExporter()
            result = objExporter.parse(this.currentModel)
            break
            
          case 'stl':
            const stlExporter = new STLExporter()
            result = stlExporter.parse(this.currentModel)
            break
            
          case 'gltf':
            const gltfExporter = new GLTFExporter()
            gltfExporter.parse(
              this.currentModel,
              (gltf) => {
                resolve(JSON.stringify(gltf))
              },
              (error) => {
                reject(error)
              },
              { binary: false }
            )
            return
            
          default:
            reject(new Error(`不支持的导出格式: ${format}`))
            return
        }
        
        resolve(result)
      } catch (error) {
        reject(error)
      }
    })
  }

  // 切换线框模式
  public toggleWireframe(): boolean {
    if (!this.currentModel) {
      throw new Error('没有可切换线框模式的模型')
    }

    this.isWireframe = !this.isWireframe

    this.currentModel.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        if (this.isWireframe) {
          // 保存原始材质
          this.originalMaterials.set(child, child.material)
          
          // 应用线框材质
          if (Array.isArray(child.material)) {
            child.material = child.material.map(mat => {
              const wireframeMat = mat.clone()
              wireframeMat.wireframe = true
              return wireframeMat
            })
          } else {
            const wireframeMat = child.material.clone()
            wireframeMat.wireframe = true
            child.material = wireframeMat
          }
        } else {
          // 恢复原始材质
          const originalMaterial = this.originalMaterials.get(child)
          if (originalMaterial) {
            child.material = originalMaterial
            this.originalMaterials.delete(child)
          }
        }
      }
    })

    return this.isWireframe
  }

  // 获取当前线框模式状态
  public getWireframeMode(): boolean {
    return this.isWireframe
  }
  // 更新配置
  public updateConfig(newConfig: Partial<ViewerConfig>) {
    this.config = { ...this.config, ...newConfig }
    
    // 更新背景色
    if (newConfig.backgroundColor) {
      this.scene.background = new THREE.Color(newConfig.backgroundColor)
    }
    
    // 更新光照强度
    if (newConfig.lightIntensity !== undefined) {
      this.scene.traverse((child) => {
        if (child instanceof THREE.DirectionalLight) {
          child.intensity = newConfig.lightIntensity!
        }
      })
    }
  }

  // 销毁资源
  public dispose() {
    window.removeEventListener('resize', this.onWindowResize.bind(this))
    
    if (this.controls) {
      this.controls.dispose()
    }
    
    this.renderer.dispose()
    this.container.removeChild(this.renderer.domElement)
  }
}