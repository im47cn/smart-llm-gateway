# 智能模型网关 API 文档

本文档详细描述了智能模型网关系统的 API 接口、请求/响应格式和使用示例。

## 目录

1. [概述](#1-概述)
2. [接口定义](#2-接口定义)
3. [请求处理接口](#3-请求处理接口)
4. [模型能力接口](#4-模型能力接口)
5. [复杂度评估接口](#5-复杂度评估接口)
6. [错误处理](#6-错误处理)
7. [客户端示例](#7-客户端示例)
8. [最佳实践](#8-最佳实践)

## 1. 概述

智能模型网关系统使用 gRPC 和 Protocol Buffers 提供高性能的 API 接口。所有接口定义都在 `proto/gateway.proto` 文件中。

系统提供三个主要接口：
- **ProcessQuery** - 处理模型推理请求
- **GetModelCapabilities** - 获取可用模型能力
- **EvaluateComplexity** - 评估查询复杂度

## 2. 接口定义

完整的接口定义如下：

```protobuf
syntax = "proto3";

package modelgateway;

// 服务定义
service ModelGatewayService {
  // 处理查询请求
  rpc ProcessQuery(ModelRequest) returns (ModelResponse);
  
  // 获取模型能力
  rpc GetModelCapabilities(Empty) returns (ModelCapabilitiesResponse);
  
  // 评估查询复杂度
  rpc EvaluateComplexity(ComplexityEvaluationRequest) returns (ComplexityEvaluationResponse);
}
```

## 3. 请求处理接口

### 3.1 ProcessQuery

处理模型推理请求，根据查询复杂度路由到合适的模型，并返回响应。

#### 请求格式 (ModelRequest)

```protobuf
message ModelRequest {
  string request_id = 1;
  string query = 2;
  map<string, string> metadata = 3;
}
```

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| request_id | string | 否 | 请求ID，用于跟踪请求。如果不提供，系统会自动生成 |
| query | string | 是 | 查询文本，即要发送给模型的问题或指令 |
| metadata | map<string, string> | 否 | 请求元数据，可用于控制处理行为 |

**支持的元数据字段**:

| 元数据字段 | 描述 | 示例值 |
|------------|------|--------|
| budget | 请求预算限制（美元） | "0.05" |
| maxTokens | 响应最大标记数 | "1000" |
| temperature | 采样温度 | "0.7" |
| systemMessage | 系统消息（用于某些模型） | "你是一个助手" |
| preferredProvider | 首选模型提供商 | "openai" |
| timeout | 请求超时（毫秒） | "30000" |

#### 响应格式 (ModelResponse)

```protobuf
message ModelResponse {
  string request_id = 1;
  string response = 2;
  float complexity_score = 3;
  string model_used = 4;
  float cost = 5;
}
```

| 字段 | 类型 | 描述 |
|------|------|------|
| request_id | string | 请求ID，与请求中的ID相同 |
| response | string | 模型生成的响应文本 |
| complexity_score | float | 查询的复杂度评分 (0.0-1.0) |
| model_used | string | 使用的模型提供商名称 |
| cost | float | 请求处理成本（美元） |

#### 示例

**请求**:
```json
{
  "request_id": "req-123456",
  "query": "解释一下量子计算的基本原理",
  "metadata": {
    "budget": "0.05",
    "maxTokens": "500"
  }
}
```

**响应**:
```json
{
  "request_id": "req-123456",
  "response": "量子计算是一种利用量子力学原理进行计算的技术...",
  "complexity_score": 0.65,
  "model_used": "openai",
  "cost": 0.02
}
```

## 4. 模型能力接口

### 4.1 GetModelCapabilities

获取系统支持的模型能力和可用的模型提供商。

#### 请求格式 (Empty)

```protobuf
message Empty {}
```

空请求，不需要任何参数。

#### 响应格式 (ModelCapabilitiesResponse)

```protobuf
message ModelCapabilitiesResponse {
  repeated string capabilities = 1;
  repeated ModelProviderInfo providers = 2;
}

message ModelProviderInfo {
  string provider_name = 1;
  repeated string capabilities = 2;
}
```

| 字段 | 类型 | 描述 |
|------|------|------|
| capabilities | repeated string | 系统支持的所有能力列表 |
| providers | repeated ModelProviderInfo | 可用的模型提供商信息 |

**ModelProviderInfo**:

| 字段 | 类型 | 描述 |
|------|------|------|
| provider_name | string | 提供商名称 |
| capabilities | repeated string | 该提供商支持的能力列表 |

#### 示例

**请求**:
```json
{}
```

**响应**:
```json
{
  "capabilities": [
    "text_generation",
    "code_generation",
    "reasoning",
    "summarization",
    "classification",
    "embedding"
  ],
  "providers": [
    {
      "provider_name": "openai",
      "capabilities": [
        "text_generation",
        "code_generation",
        "reasoning",
        "summarization"
      ]
    },
    {
      "provider_name": "anthropic",
      "capabilities": [
        "text_generation",
        "reasoning",
        "summarization",
        "long_context"
      ]
    },
    {
      "provider_name": "local",
      "capabilities": [
        "text_generation",
        "classification",
        "embedding"
      ]
    }
  ]
}
```

## 5. 复杂度评估接口

### 5.1 EvaluateComplexity

评估查询的复杂度，返回复杂度评分和影响因素。

#### 请求格式 (ComplexityEvaluationRequest)

```protobuf
message ComplexityEvaluationRequest {
  string query = 1;
  repeated string features = 2;
}
```

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| query | string | 是 | 要评估复杂度的查询文本 |
| features | repeated string | 否 | 要考虑的特定特征列表 |

**支持的特征**:
- `length` - 查询长度
- `vocabulary_diversity` - 词汇多样性
- `grammar_complexity` - 语法复杂度
- `domain_knowledge` - 领域知识需求
- `multi_part_question` - 多部分问题

#### 响应格式 (ComplexityEvaluationResponse)

```protobuf
message ComplexityEvaluationResponse {
  float complexity_score = 1;
  repeated string complexity_factors = 2;
}
```

| 字段 | 类型 | 描述 |
|------|------|------|
| complexity_score | float | 复杂度评分 (0.0-1.0) |
| complexity_factors | repeated string | 影响复杂度的因素列表 |

#### 示例

**请求**:
```json
{
  "query": "解释一下量子计算的基本原理",
  "features": ["length", "domain_knowledge"]
}
```

**响应**:
```json
{
  "complexity_score": 0.65,
  "complexity_factors": [
    "medium_length",
    "domain_knowledge_required",
    "technical_vocabulary"
  ]
}
```

## 6. 错误处理

系统使用标准的 gRPC 错误码和自定义错误消息。

### 6.1 错误码

```protobuf
enum ErrorCode {
  OK = 0;
  INVALID_REQUEST = 1;
  MODEL_UNAVAILABLE = 2;
  COMPLEXITY_EVALUATION_FAILED = 3;
  COST_LIMIT_EXCEEDED = 4;
}

message ErrorResponse {
  ErrorCode code = 1;
  string message = 2;
}
```

| 错误码 | 描述 | 处理建议 |
|--------|------|----------|
| INVALID_REQUEST | 请求格式无效或缺少必要字段 | 检查请求格式和必填字段 |
| MODEL_UNAVAILABLE | 所需模型不可用 | 稍后重试或使用不同的模型 |
| COMPLEXITY_EVALUATION_FAILED | 复杂度评估失败 | 简化查询或提供更多上下文 |
| COST_LIMIT_EXCEEDED | 请求成本超出预算限制 | 增加预算或简化查询 |

### 6.2 错误响应示例

```json
{
  "code": 4,
  "message": "估算成本 0.08 超出预算 0.05"
}
```

## 7. 客户端示例

### 7.1 Node.js 客户端

```javascript
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');

// 加载 proto 文件
const PROTO_PATH = path.resolve(__dirname, '../proto/gateway.proto');
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true
});

const protoDescriptor = grpc.loadPackageDefinition(packageDefinition);
const modelGateway = protoDescriptor.modelgateway;

// 创建客户端
const client = new modelGateway.ModelGatewayService(
  'localhost:50051',
  grpc.credentials.createInsecure()
);

// 发送查询请求
function processQuery(query, metadata = {}) {
  return new Promise((resolve, reject) => {
    const request = {
      request_id: Date.now().toString(),
      query,
      metadata
    };
    
    client.processQuery(request, (error, response) => {
      if (error) {
        reject(error);
        return;
      }
      
      resolve(response);
    });
  });
}

// 使用示例
async function example() {
  try {
    const response = await processQuery('解释一下量子计算的基本原理', {
      budget: '0.05',
      maxTokens: '500'
    });
    
    console.log('响应:', response.response);
    console.log('复杂度:', response.complexity_score);
    console.log('使用的模型:', response.model_used);
    console.log('成本:', response.cost);
  } catch (error) {
    console.error('错误:', error);
  }
}

example();
```

### 7.2 Python 客户端

```python
import grpc
import gateway_pb2
import gateway_pb2_grpc

# 创建 gRPC 通道
channel = grpc.insecure_channel('localhost:50051')

# 创建客户端
stub = gateway_pb2_grpc.ModelGatewayServiceStub(channel)

# 创建请求
request = gateway_pb2.ModelRequest(
    request_id='req-' + str(int(time.time())),
    query='解释一下量子计算的基本原理',
    metadata={
        'budget': '0.05',
        'maxTokens': '500'
    }
)

# 发送请求
try:
    response = stub.ProcessQuery(request)
    print(f'响应: {response.response}')
    print(f'复杂度: {response.complexity_score}')
    print(f'使用的模型: {response.model_used}')
    print(f'成本: {response.cost}')
except grpc.RpcError as e:
    print(f'错误: {e.details()}')
```

## 8. 最佳实践

### 8.1 请求优化

- **设置合理的预算** - 根据查询复杂度设置适当的预算限制
- **指定最大标记数** - 控制响应长度，避免不必要的成本
- **使用请求 ID** - 为每个请求提供唯一 ID，便于跟踪和调试
- **利用元数据** - 使用元数据字段微调请求行为

### 8.2 错误处理

- **实现重试机制** - 对于临时错误（如模型不可用），实现指数退避重试
- **预算管理** - 监控成本并实现预算控制机制
- **降级策略** - 当高级模型不可用或成本过高时，准备降级到更简单的模型

### 8.3 性能优化

- **批量处理** - 当可能时，批量发送请求
- **缓存结果** - 缓存常见查询的结果
- **预热连接** - 在高负载场景下预热 gRPC 连接

### 8.4 安全考虑

- **验证输入** - 在客户端验证输入，过滤潜在的恶意内容
- **保护 API 密钥** - 安全存储和管理 API 密钥
- **监控使用情况** - 定期审查 API 使用情况和成本