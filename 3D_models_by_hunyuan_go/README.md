##### 提交文生3D
```shell
  curl -X POST http://127.0.0.1:5000/api/submit-text \
  -H "Content-Type: application/json" \
  -d '{
    "prompt":"奔腾的骏马",
    "polish": true,
    "enable_pbr": true,
    "face_count": 400000,
    "generate_type": "Normal"
  }'
```
##### 提交图生3D（URL）
```shell
curl -X POST http://127.0.0.1:5000/api/submit-image-url \
  -H "Content-Type: application/json" \
  -d '{"image_url":"https://example.com/your.png"}'
```

##### 提交图生3D（本地上传）
```shell
curl -X POST http://127.0.0.1:5000/api/submit-image \
  -F "file=@/path/to/local.png" \
  -F "result_format=GLB" \
  -F "enable_pbr=true" \
  -F "prompt=Q版/卡通版"
```
##### 查询状态
```shell
curl http://127.0.0.1:5000/api/status/<job_id>
```

##### 下载第 0 个结果文件到本地
（因为可能一次生成多张3D图）
```shell
#curl -fSLOJ "http://127.0.0.1:5000/api/download/<job_id>/0"
curl -OJ http://127.0.0.1:5000/api/download/<job_id>/0

```

#### 环境变量

自行根据  `.env`配置环境变量

#### 执行代码

```shell
go mod tidy

go run main.go
```

