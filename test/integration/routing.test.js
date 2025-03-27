/**
 * 智能模型网关系统 - 集成测试
 * 测试不同复杂度的查询路由到不同模型的场景
 */
const { v4: uuidv4 } = require('uuid');

// 模拟模型适配器
const mockCallModel = jest.fn();
jest.mock('../../src/adapters', () => {
  const mockAdapterManager = {
    callModel: mockCallModel.mockImplementation((provider, model, query, options) => {
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

describe('模型路由集成测试', () => {
  let modelGatewayService;
  let modelRouterService;
  
  beforeEach(() => {
    // 清除所有模块缓存
    jest.resetModules();
    
    // 重置模拟函数
    mockCallModel.mockClear();
    
    // 动态导入服务实现，避免模块缓存问题
    modelRouterService = require('../../src/services/modelRouterService');
    modelGatewayService = require('../../src/services/modelGatewayService');
  });
  
  test('低复杂度查询应该路由到本地模型', async () => {
    // 模拟低复杂度查询
    const request = {
      request_id: uuidv4(),
      query: '今天天气怎么样？',
      metadata: {}
    };
    
    // 模拟复杂度评估结果
    jest.spyOn(modelGatewayService, 'evaluateQueryComplexity').mockResolvedValue({
      complexityScore: 0.2, // 低于阈值
      complexityFactors: ['short_query', 'simple_grammar']
    });
    
    // 调用处理函数
    await new Promise((resolve) => {
      modelGatewayService.processQuery(
        { request },
        (error, response) => {
          expect(error).toBeNull();
          expect(response).toBeDefined();
          expect(mockCallModel).toHaveBeenCalled();
          
          // 验证调用了本地模型
          const callArgs = mockCallModel.mock.calls[0];
          expect(callArgs[0]).toBe('local');
          
          resolve();
        }
      );
    });
  });
  
  test('中等复杂度查询应该路由到混合模型', async () => {
    // 模拟中等复杂度查询
    const request = {
      request_id: uuidv4(),
      query: '解释一下量子力学的基本原理',
      metadata: {}
    };
    
    // 模拟复杂度评估结果
    jest.spyOn(modelGatewayService, 'evaluateQueryComplexity').mockResolvedValue({
      complexityScore: 0.5, // 中等复杂度
      complexityFactors: ['domain_knowledge', 'medium_length']
    });
    
    // 调用处理函数
    await new Promise((resolve) => {
      modelGatewayService.processQuery(
        { request },
        (error, response) => {
          expect(error).toBeNull();
          expect(response).toBeDefined();
          expect(mockCallModel).toHaveBeenCalled();
          
          // 验证调用了混合模型（anthropic）
          const callArgs = mockCallModel.mock.calls[0];
          expect(callArgs[0]).toBe('anthropic');
          
          resolve();
        }
      );
    });
  });
  
  test('高复杂度查询应该路由到远程高性能模型', async () => {
    // 模拟高复杂度查询
    const request = {
      request_id: uuidv4(),
      query: '请详细分析人工智能在医疗领域的应用，包括诊断、治疗和药物研发等方面，并讨论其伦理问题和未来发展趋势。',
      metadata: {}
    };
    
    // 模拟复杂度评估结果
    jest.spyOn(modelGatewayService, 'evaluateQueryComplexity').mockResolvedValue({
      complexityScore: 0.9, // 高复杂度
      complexityFactors: ['domain_knowledge', 'long_query', 'complex_request', 'multi_part_question']
    });
    
    // 调用处理函数
    await new Promise((resolve) => {
      modelGatewayService.processQuery(
        { request },
        (error, response) => {
          expect(error).toBeNull();
          expect(response).toBeDefined();
          expect(mockCallModel).toHaveBeenCalled();
          
          // 验证调用了远程高性能模型（openai 或 anthropic）
          const callArgs = mockCallModel.mock.calls[0];
          expect(['openai', 'anthropic']).toContain(callArgs[0]);
          
          resolve();
        }
      );
    });
  });
  
  test('当预算有限时应该选择更便宜的模型', async () => {
    // 模拟高复杂度查询但有预算限制
    const request = {
      request_id: uuidv4(),
      query: '请详细分析人工智能在医疗领域的应用',
      metadata: {
        budget: '0.01' // 非常低的预算
      }
    };
    
    // 模拟复杂度评估结果
    jest.spyOn(modelGatewayService, 'evaluateQueryComplexity').mockResolvedValue({
      complexityScore: 0.8, // 高复杂度
      complexityFactors: ['domain_knowledge', 'complex_request']
    });
    
    // 调用处理函数
    await new Promise((resolve) => {
      modelGatewayService.processQuery(
        { request },
        (error, response) => {
          // 由于预算限制，可能会降级到更便宜的模型或返回错误
          if (error) {
            expect(error.message).toContain('预算');
          } else {
            expect(response).toBeDefined();
            expect(mockCallModel).toHaveBeenCalled();
            
            // 验证调用了更便宜的模型（可能是local）
            const callArgs = mockCallModel.mock.calls[0];
            expect(callArgs[0]).toBe('local');
          }
          
          resolve();
        }
      );
    });
  });
});