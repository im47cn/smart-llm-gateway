# 智能模型网关部署指南

本文档提供了智能模型网关系统的部署和配置指南，包括环境要求、安装步骤、配置选项和最佳实践。

## 目录

1. [环境要求](#1-环境要求)
2. [安装步骤](#2-安装步骤)
3. [配置选项](#3-配置选项)
4. [部署模式](#4-部署模式)
5. [安全配置](#5-安全配置)
6. [监控和日志](#6-监控和日志)
7. [性能调优](#7-性能调优)
8. [故障排除](#8-故障排除)
9. [升级指南](#9-升级指南)
10. [生产环境最佳实践](#10-生产环境最佳实践)

## 1. 环境要求

### 1.1 系统要求

- **操作系统**: Linux, macOS, 或 Windows
- **Node.js**: v14.0.0 或更高版本
- **内存**: 最小 2GB，推荐 4GB 或更多
- **存储**: 最小 1GB 可用空间
- **网络**: 稳定的互联网连接（用于远程模型调用）

### 1.2 依赖项

- **Node.js 和 npm**: 用于运行服务和安装依赖
- **Protocol Buffers**: 用于编译 .proto 文件
- **gRPC 工具**: 用于 gRPC 服务

### 1.3 外部服务

- **模型提供商 API**: 如 OpenAI, Anthropic 等（可选，取决于配置）
- **Redis**: 用于缓存（可选）
- **监控系统**: 如 Prometheus, Grafana（可选）

## 2. 安装步骤

### 2.1 获取代码

```bash
# 克隆仓库
git clone https://github.com/your-org/model-gateway.git
cd model-gateway
```

### 2.2 安装依赖

```bash
# 安装 Node.js 依赖
npm install

# 安装 Protocol Buffers 编译器 (如果尚未安装)
# Ubuntu/Debian
sudo apt-get install -y protobuf-compiler

# macOS
brew install protobuf

# Windows (使用 chocolatey)
choco install protoc
```

### 2.3 配置环境变量

```bash
# 复制环境变量示例文件
cp .env.example .env

# 编辑 .env 文件，设置必要的环境变量
# 主要包括模型提供商 API 密钥和服务配置
```

### 2.4 生成 Protocol Buffers 代码

```bash
npm run proto
```

### 2.5 构建和启动服务

```bash
# 开发模式
npm run dev

# 生产模式
npm start
```

## 3. 配置选项

### 3.1 环境变量

主要环境变量:

| 变量名 | 描述 | 默认值 | 示例 |
|--------|------|--------|------|
| PORT | gRPC 服务端口 | 50051 | 50051 |
| NODE_ENV | 环境模式 | development | production |
| LOG_LEVEL | 日志级别 | info | debug, info, warn, error |
| OPENAI_API_KEY | OpenAI API 密钥 | - | sk-... |
| ANTHROPIC_API_KEY | Anthropic API 密钥 | - | sk-ant-... |
| REDIS_URL | Redis 连接 URL（用于缓存） | - | redis://localhost:6379 |

### 3.2 配置文件

系统使用 `src/config/index.js` 作为主要配置文件。您可以参考 `examples/config.example.js` 了解所有可用的配置选项。

主要配置部分:

- **服务器配置**: 端口、主机、超时等
- **路由策略**: 复杂度阈值、权重等
- **模型提供商**: API 密钥、基础 URL、支持的模型等
- **复杂度评估**: 特征、权重、阈值等
- **监控配置**: 指标间隔、告警阈值等
- **缓存配置**: TTL、最大大小等
- **安全配置**: 请求验证、内容过滤等
- **日志配置**: 级别、格式、目标等

### 3.3 模型提供商配置

每个模型提供商的配置示例:

```javascript
'openai': {
  status: 'online',
  apiKey: process.env.OPENAI_API_KEY,
  baseUrl: 'https://api.openai.com/v1',
  defaultModel: 'gpt-4',
  supportedModels: ['gpt-4', 'gpt-3.5-turbo'],
  supportedModelTypes: ['remote'],
  maxConcurrentQueries: 50,
  baseCostPerQuery: 0.02,
  maxCostPerQuery: 0.5,
  timeout: 15000,
  retryCount: 2,
  retryDelay: 1000,
  costEfficiency: 0.6,
  capabilities: [
    'text_generation',
    'code_generation',
    'reasoning',
    'summarization'
  ]
}
```

## 4. 部署模式

### 4.1 开发环境

适用于本地开发和测试:

```bash
# 启动开发服务器（自动重启）
npm run dev
```

### 4.2 单节点生产环境

适用于小型部署:

```bash
# 使用 PM2 启动服务
npm install -g pm2
pm2 start ecosystem.config.js
```

示例 `ecosystem.config.js`:

```javascript
module.exports = {
  apps: [{
    name: 'model-gateway',
    script: 'src/index.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 50051
    }
  }]
};
```

### 4.3 Docker 部署

使用 Docker 容器化部署:

```bash
# 构建 Docker 镜像
docker build -t model-gateway .

# 运行容器
docker run -p 50051:50051 --env-file .env model-gateway
```

示例 `Dockerfile`:

```dockerfile
FROM node:16-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run proto

EXPOSE 50051
CMD ["node", "src/index.js"]
```

### 4.4 Kubernetes 部署

适用于大规模部署:

```yaml
# model-gateway-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: model-gateway
spec:
  replicas: 3
  selector:
    matchLabels:
      app: model-gateway
  template:
    metadata:
      labels:
        app: model-gateway
    spec:
      containers:
      - name: model-gateway
        image: model-gateway:latest
        ports:
        - containerPort: 50051
        env:
        - name: NODE_ENV
          value: "production"
        - name: PORT
          value: "50051"
        # 添加其他环境变量
        resources:
          requests:
            memory: "512Mi"
            cpu: "500m"
          limits:
            memory: "1Gi"
            cpu: "1000m"
```

```bash
# 应用 Kubernetes 配置
kubectl apply -f model-gateway-deployment.yaml
```

## 5. 安全配置

### 5.1 API 密钥管理

- 使用环境变量或安全的密钥管理系统存储 API 密钥
- 定期轮换 API 密钥
- 限制 API 密钥的权限范围

### 5.2 请求验证和内容过滤

在配置文件中启用请求验证和内容过滤:

```javascript
security: {
  enableRequestValidation: true,
  enableContentFiltering: true,
  maxQueryLength: 10000,
  sensitivePatterns: [
    /exec\s*\(/i,
    /eval\s*\(/i,
    /system\s*\(/i
  ]
}
```

### 5.3 网络安全

- 使用 TLS/SSL 加密 gRPC 连接
- 配置防火墙限制访问
- 使用 API 网关进行额外的安全控制

示例 TLS 配置:

```javascript
const server = new grpc.Server();
// ... 添加服务 ...

const credentials = grpc.ServerCredentials.createSsl(
  fs.readFileSync('path/to/server.crt'),
  [{
    private_key: fs.readFileSync('path/to/server.key'),
    cert_chain: fs.readFileSync('path/to/server.crt')
  }],
  true // 要求客户端认证
);

server.bindAsync('0.0.0.0:50051', credentials, () => {
  server.start();
});
```

## 6. 监控和日志

### 6.1 日志配置

配置日志系统:

```javascript
logging: {
  level: 'info', // debug, info, warn, error
  format: 'json', // json, text
  destination: 'file', // console, file
  file: {
    path: './logs/gateway.log',
    maxSize: '10m',
    maxFiles: 5
  }
}
```

### 6.2 监控配置

配置监控系统:

```javascript
monitoring: {
  enabled: true,
  metricsInterval: 1000, // 指标收集间隔（毫秒）
  alertThresholds: {
    error: {
      rate: 0.1, // 10% 错误率
      interval: 5 * 60 * 1000 // 5分钟
    },
    latency: {
      threshold: 2000, // 2秒
      percentile: 95 // 95th 百分位
    }
  }
}
```

### 6.3 集成外部监控系统

#### Prometheus 集成

安装 Prometheus 客户端:

```bash
npm install prom-client
```

配置 Prometheus 指标导出:

```javascript
const prometheus = require('prom-client');
const express = require('express');
const app = express();

// 创建指标
const requestCounter = new prometheus.Counter({
  name: 'model_gateway_requests_total',
  help: 'Total number of requests',
  labelNames: ['model', 'status']
});

// 导出指标
app.get('/metrics', (req, res) => {
  res.set('Content-Type', prometheus.register.contentType);
  res.end(prometheus.register.metrics());
});

app.listen(9090);
```

## 7. 性能调优

### 7.1 Node.js 性能优化

- 使用 `--max-old-space-size` 增加 Node.js 内存限制
- 启用 Node.js 集群模式利用多核 CPU
- 调整 GC 参数优化内存使用

示例启动命令:

```bash
NODE_OPTIONS="--max-old-space-size=4096" node src/index.js
```

### 7.2 gRPC 性能优化

- 调整 keepalive 参数
- 配置适当的消息大小限制
- 使用双向流处理大量请求

```javascript
const server = new grpc.Server({
  'grpc.keepalive_time_ms': 10000,
  'grpc.keepalive_timeout_ms': 5000,
  'grpc.max_receive_message_length': 1024 * 1024 * 10, // 10MB
  'grpc.max_send_message_length': 1024 * 1024 * 10 // 10MB
});
```

### 7.3 缓存策略

配置缓存以提高性能:

```javascript
cache: {
  enabled: true,
  type: 'redis', // memory, redis
  ttl: 3600, // 缓存生存时间（秒）
  maxSize: 1000, // 最大缓存项数（仅用于内存缓存）
  redis: {
    host: 'localhost',
    port: 6379,
    password: '',
    db: 0
  }
}
```

## 8. 故障排除

### 8.1 常见问题

#### 服务无法启动

- 检查端口是否被占用
- 验证环境变量和配置文件
- 检查 Node.js 版本兼容性

#### 模型调用失败

- 验证 API 密钥是否有效
- 检查网络连接
- 查看模型提供商状态页面

#### 性能问题

- 检查系统资源使用情况
- 分析日志中的慢请求
- 调整并发限制和超时设置

### 8.2 日志分析

使用日志分析工具识别问题:

```bash
# 查找错误日志
grep "error" logs/gateway.log

# 分析慢请求
grep "processing time" logs/gateway.log | sort -k 5 -n -r | head -10
```

### 8.3 健康检查

实现健康检查端点:

```javascript
app.get('/health', (req, res) => {
  const healthStatus = monitoringService.getHealthStatus();
  res.status(healthStatus.status === 'healthy' ? 200 : 503)
     .json(healthStatus);
});
```

## 9. 升级指南

### 9.1 版本升级步骤

1. 备份当前配置和数据
2. 查看发布说明了解重大变更
3. 更新代码库
4. 安装新依赖
5. 重新生成 Protocol Buffers 代码
6. 更新配置文件
7. 测试新版本
8. 部署升级

```bash
# 备份配置
cp .env .env.backup
cp src/config/index.js src/config/index.js.backup

# 更新代码
git pull

# 安装依赖
npm install

# 重新生成 Protocol Buffers 代码
npm run proto

# 测试
npm test

# 重启服务
npm restart
```

### 9.2 回滚流程

如果升级失败，执行回滚:

```bash
# 回滚代码
git checkout v1.x.x

# 恢复配置
cp .env.backup .env
cp src/config/index.js.backup src/config/index.js

# 安装依赖
npm install

# 重新生成 Protocol Buffers 代码
npm run proto

# 重启服务
npm restart
```

## 10. 生产环境最佳实践

### 10.1 高可用性配置

- 部署多个服务实例
- 使用负载均衡器分发流量
- 实现自动扩缩容
- 配置健康检查和自动恢复

### 10.2 资源管理

- 设置适当的资源限制
- 监控资源使用情况
- 实现自动告警
- 定期优化资源配置

### 10.3 成本控制

- 配置预算限制
- 监控 API 使用成本
- 优化缓存策略减少 API 调用
- 定期审查成本报告

### 10.4 备份和恢复

- 定期备份配置和数据
- 测试恢复流程
- 实现灾难恢复计划
- 保存多个版本的备份

### 10.5 安全最佳实践

- 定期更新依赖和安全补丁
- 实施最小权限原则
- 定期进行安全审计
- 监控异常访问模式