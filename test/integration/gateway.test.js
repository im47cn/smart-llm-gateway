/**
 * 智能模型网关系统 - 集成测试
 * 测试完整的请求处理流程
 */
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { promisify } = require('util');

// 模拟模型适配器
jest.mock('../../src/adapters', () => {
  const mockAdapterManager = {
    callModel: jest.fn().mockImplementation((provider, model, query, options) => {
      return Promise.resolve({
        text: `Mock response from ${provider} model`,
        cost: 0.05,
        tokenUsage: {
          input: 10,
          output: 20,
          total: 30
        }
      });
    }),
    getAdapters: jest.fn().mockReturnValue({
      'openai': { name: 'openai', status: 'online' },
      'anthropic': { name: 'anthropic', status: 'online' },
      'local': { name: 'local', status: 'online' }
    })
  };
  
  return {
    adapterManager: mockAdapterManager,
    initializeAdapters: jest.fn()
  };
});

// 模拟配置
jest.mock('../../src/config', () => ({
  port: 50051,
  routingStrategy: {
    lowComplexityThreshold: 0.3,
    highComplexityThreshold: 0.7
  },
  modelProviders: {
    'openai': {
      status: 'online',
      supportedModelTypes: ['remote'],
      maxConcurrentQueries: 10,
      baseCostPerQuery: 0.02,
      maxCostPerQuery: 0.1
    },
    'anthropic': {
      status: 'online',
      supportedModelTypes: ['hybrid', 'remote'],
      maxConcurrentQueries: 5,
      baseCostPerQuery: 0.03,
      maxCostPerQuery: 0.15
    },
    'local': {
      status: 'online',
      supportedModelTypes: ['local'],
      maxConcurrentQueries: 20,
      baseCostPerQuery: 0.001,
      maxCostPerQuery: 0.01
    }
  }
}));

// 加载 gRPC 服务
const PROTO_PATH = path.resolve(__dirname, '../../proto/gateway.proto');
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true
});

const protoDescriptor = grpc.loadPackageDefinition(packageDefinition);
const modelGateway = protoDescriptor.modelgateway;

describe('模型网关集成测试', () => {
  let client;
  let server;
  
  beforeAll(async () => {
    // 启动服务器
    server = new grpc.Server();
    
    // 动态导入服务实现，避免模块缓存问题
    const modelGatewayService = require('../../src/services/modelGatewayService');
    
    server.addService(modelGateway.ModelGatewayService.service, {
      processQuery: modelGatewayService.processQuery,
      getModelCapabilities: modelGatewayService.getModelCapabilities,
      evaluateComplexity: modelGatewayService.evaluateComplexity
    });
    
    const bindPromise = promisify(server.bindAsync).bind(server);
    await bindPromise('localhost:50052', grpc.ServerCredentials.createInsecure());
    server.start();
    
    // 创建客户端
    client = new modelGateway.ModelGatewayService(
      'localhost:50052',
      grpc.credentials.createInsecure()
    );
  });
  
  afterAll(() => {
    server.forceShutdown();
  });
  
  test('应该成功处理查询请求', async () => {
    // 准备请求
    const request = {
      request_id: uuidv4(),
      query: '什么是人工智能？',
      metadata: {
        user_id: 'test-user',
        session_id: 'test-session'
      }
    };
    
    // 发送请求
    const processQueryPromise = promisify(client.processQuery).bind(client);
    const response = await processQueryPromise(request);
    
    // 验证响应
    expect(response).toBeDefined();
    expect(response.request_id).toBe(request.request_id);
    expect(response.response).toContain('Mock response from');
    expect(response.complexity_score).toBeDefined();
    expect(response.model_used).toBeDefined();
    expect(response.cost).toBeDefined();
  });
  
  test('应该获取模型能力', async () => {
    // 发送请求
    const getModelCapabilitiesPromise = promisify(client.getModelCapabilities).bind(client);
    const response = await getModelCapabilitiesPromise({});
    
    // 验证响应
    expect(response).toBeDefined();
    expect(response.capabilities).toBeDefined();
    expect(response.providers).toBeDefined();
    expect(Array.isArray(response.providers)).toBe(true);
  });
  
  test('应该评估查询复杂度', async () => {
    // 准备请求
    const request = {
      query: '解释量子计算的基本原理和应用场景',
      features: ['length', 'domain_knowledge']
    };
    
    // 发送请求
    const evaluateComplexityPromise = promisify(client.evaluateComplexity).bind(client);
    const response = await evaluateComplexityPromise(request);
    
    // 验证响应
    expect(response).toBeDefined();
    expect(response.complexity_score).toBeDefined();
    expect(response.complexity_factors).toBeDefined();
    expect(Array.isArray(response.complexity_factors)).toBe(true);
  });
});