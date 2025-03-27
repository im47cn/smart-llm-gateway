# 智能模型网关系统

智能模型网关是一个高度灵活、可扩展的系统，用于根据用户问题复杂度智能路由到最适合的AI模型。系统能够自动评估查询复杂度，选择最合适的模型提供商，并提供完整的监控和错误处理机制。

## 系统特点

- **智能路由** - 根据查询复杂度自动选择最合适的模型
- **高可用性** - 内置故障恢复和备用模型选择机制
- **成本优化** - 智能平衡性能和成本，确保资源高效利用
- **可扩展性** - 轻松集成新的模型提供商和自定义评估逻辑
- **全面监控** - 实时性能指标、成本追踪和告警系统
- **安全可靠** - 内置请求验证和安全检查机制

## 项目结构

```
model-gateway/
├── proto/              # Protocol Buffers 定义
├── src/
│   ├── config/         # 配置文件
│   ├── middleware/     # 中间件组件
│   ├── services/       # 服务实现
│   ├── adapters/       # 模型适配器
│   ├── monitoring/     # 监控和告警系统
│   ├── routers/        # 模型路由服务
│   └── utils/          # 工具函数
├── test/
│   ├── integration/    # 集成测试
│   └── performance/    # 性能测试
├── examples/           # 示例和演示
├── docs/               # 文档
├── .env.example        # 环境变量示例
└── package.json        # 项目配置
```

## 核心组件

1. **请求预处理组件**
   - 标准化请求格式
   - 初步安全检查
   - 请求元数据提取

2. **复杂度评估引擎**
   - 多维度特征提取
   - 动态阈值配置
   - 机器学习模型支持

3. **模型路由服务**
   - 提供商管理
   - 动态负载均衡
   - 备用模型选择策略

4. **模型适配器**
   - 统一接口定义
   - 协议转换
   - 错误处理与重试机制

5. **监控与告警系统**
   - 性能指标收集
   - 成本追踪
   - 实时告警

## 快速开始

### 安装依赖

```bash
npm install
```

### 配置环境变量

```bash
cp .env.example .env
# 编辑 .env 文件设置你的配置
```

### 生成 Protocol Buffers 代码

```bash
npm run proto
```

### 启动服务

```bash
npm start
```

开发模式（自动重启）:

```bash
npm run dev
```

### 运行测试

单元测试:

```bash
npm test
```

集成测试:

```bash
npm run test:integration
```

性能测试:

```bash
npm run test:performance
```

### 运行示例

```bash
# 运行交互式客户端
node examples/client.js

# 运行演示脚本
node examples/demo.js
```

## API 接口

系统提供以下gRPC接口:

1. **ProcessQuery** - 处理模型推理请求
2. **GetModelCapabilities** - 获取可用模型能力
3. **EvaluateComplexity** - 评估查询复杂度

详细的API规范请参考 `proto/gateway.proto` 文件和 `docs/API.md` 文档。

## 监控与指标

系统提供全面的监控功能，包括:

- 请求处理时间
- 模型使用情况
- 错误率和类型
- 成本追踪
- 系统资源使用情况

监控数据可通过 MonitoringAPI 获取，也可以配置告警通知。详细信息请参考 `docs/ARCHITECTURE.md` 文档。

## 扩展指南

### 添加新的模型提供商

1. 在 `src/adapters` 目录下创建新的适配器
2. 在配置文件中添加提供商配置
3. 在模型路由服务中注册新的提供商

### 自定义复杂度评估

修改 `src/services/modelGatewayService.js` 中的 `evaluateComplexity` 方法实现自定义的复杂度评估算法。

### 自定义监控和告警

1. 在 `src/monitoring/metrics` 目录下添加新的指标收集器
2. 在 `src/monitoring/alerts` 目录下添加新的告警规则
3. 更新 `src/monitoring/MonitoringService.js` 以集成新的指标和告警

## 文档

- [API 文档](docs/API.md) - 详细的 API 规范和使用示例
- [架构文档](docs/ARCHITECTURE.md) - 系统架构和组件详解
- [部署指南](docs/DEPLOYMENT.md) - 部署和配置指南
- [风险评估](docs/risk-assessment.md) - 系统风险评估和缓解策略

## 许可证

MIT