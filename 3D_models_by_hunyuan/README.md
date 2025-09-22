##### 提交文生3D
```shell
curl -X POST http://127.0.0.1:5000/api/submit-text \
  -H "Content-Type: application/json" \
  -d '{"prompt":"steampunk style 镀铬汉服，一个被金属花包围的少女，耳饰，华丽，深蓝色，精致的现实主义，高曝光，佳能5D，电影照明，金属光泽，前景模糊，景深，光线。antique， mechanical， brass and copper tones， gears， intricate， detailed","result_format":"GLB","enable_pbr":true}'
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


