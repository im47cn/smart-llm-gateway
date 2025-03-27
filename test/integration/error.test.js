/**
 * 智能模型网关系统 - 集成测试
 * 测试错误处理和故障恢复机制
 */
const { v4: uuidv4 } = require('uuid');
const { Errors } = require('../../src/utils/errors');

// 模拟模型适配器
const mockCallModel = jest.fn();
jest.mock('../../src/adapters', () => {
  const mockAdapterManager = {
    callModel: mockCallModel,
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

describe('错误处理和故障恢复集成测试', () => {
  let modelGatewayService;
  let modelRouterService;
  
  beforeEach(() => {
    // 清除所有模块缓存
    jest.resetModules();
    
    // 重置模拟函数
    mockCallModel.mockReset();
    
    // 动态导入服务实现，避免模块缓存问题
    modelRouterService = require('../../src/services/modelRouterService');
    modelGatewayService = require('../../src/services/modelGatewayService');
    
    // 模拟复杂度评估结果
    jest.spyOn(modelGatewayService, 'evaluateQueryComplexity').mockResolvedValue({
      complexityScore: 0.5,
      complexityFactors: ['medium_complexity']
    });
  });
  
  test('当主要模型失败时应该使用备用模型', async () => {
    // 模拟主要模型失败，备用模型成功
    mockCallModel.mockImplementationOnce(() => {
      throw new Error('模型服务暂时不可用');
    }).mockImplementationOnce((provider, model, query, options) => {
      return Promise.resolve({
        text: `Backup model response from ${provider}`,
        cost: 0.03,
        tokenUsage: {
          input: 10,
          output: 15,
          total: 25
        }
      });
    });
    
    // 准备请求
    const request = {
      request_id: uuidv4(),
      query: '解释一下量子计算的基本原理',
      metadata: {}
    };
    
    // 调用处理函数
    await new Promise((resolve) => {
      modelGatewayService.processQuery(
        { request },
        (error, response) => {
          expect(error).toBeNull();
          expect(response).toBeDefined();
          expect(response.response).toContain('Backup model');
          expect(mockCallModel).toHaveBeenCalledTimes(2);
          
          resolve();
        }
      );
    });
  });
  
  test('当所有模型都失败时应该返回错误', async () => {
    // 模拟所有模型都失败
    mockCallModel.mockImplementation(() => {
      throw new Error('模型服务不可用');
    });
    
    // 准备请求
    const request = {
      request_id: uuidv4(),
      query: '解释一下量子计算的基本原理',
      metadata: {}
    };
    
    // 调用处理函数
    await new Promise((resolve) => {
      modelGatewayService.processQuery(
        { request },
        (error, response) => {
          expect(error).toBeDefined();
          expect(error.code).toBeDefined();
          expect(error.message).toContain('模型');
          expect(response).toBeUndefined();
          
          resolve();
        }
      );
    });
  });
  
  test('当请求无效时应该返回验证错误', async () => {
    // 准备无效请求（缺少查询）
    const request = {
      request_id: uuidv4(),
      query: '', // 空查询
      metadata: {}
    };
    
    // 调用处理函数
    await new Promise((resolve) => {
      modelGatewayService.processQuery(
        { request },
        (error, response) => {
          expect(error).toBeDefined();
          expect(error.code).toBeDefined();
          expect(error.message).toContain('请求验证失败');
          expect(response).toBeUndefined();
          
          resolve();
        }
      );
    });
  });
  
  test('当成本超出预算时应该返回成本错误', async () => {
    // 模拟复杂度评估结果（高复杂度）
    jest.spyOn(modelGatewayService, 'evaluateQueryComplexity').mockResolvedValue({
      complexityScore: 0.9,
      complexityFactors: ['high_complexity']
    });
    
    // 准备请求（低预算）
    const request = {
      request_id: uuidv4(),
      query: '详细分析人工智能在医疗领域的应用',
      metadata: {
        budget: '0.001' // 非常低的预算
      }
    };
    
    // 模拟没有可用的便宜模型
    jest.spyOn(modelRouterService, 'applyCostControlStrategy').mockImplementation(() => {
      throw Errors.costLimitExceeded('估算成本超出预算');
    });
    
    // 调用处理函数
    await new Promise((resolve) => {
      modelGatewayService.processQuery(
        { request },
        (error, response) => {
          expect(error).toBeDefined();
          expect(error.code).toBeDefined();
          expect(error.message).toContain('成本');
          expect(response).toBeUndefined();
          
          resolve();
        }
      );
    });
  });
  
  test('当复杂度评估失败时应该返回错误', async () => {
    // 模拟复杂度评估失败
    jest.spyOn(modelGatewayService, 'evaluateQueryComplexity').mockRejectedValue(
      new Error('复杂度评估失败')
    );
    
    // 准备请求
    const request = {
      request_id: uuidv4(),
      query: '解释一下量子计算的基本原理',
      metadata: {}
    };
    
    // 调用处理函数
    await new Promise((resolve) => {
      modelGatewayService.processQuery(
        { request },
        (error, response) => {
          expect(error).toBeDefined();
          expect(error.code).toBeDefined();
          expect(error.message).toContain('复杂度评估失败');
          expect(response).toBeUndefined();
          
          resolve();
        }
      );
    });
  });
  
  test('当请求包含潜在的不安全内容时应该返回错误', async () => {
    // 准备包含不安全内容的请求
    const request = {
      request_id: uuidv4(),
      query: 'exec("rm -rf /")', // 包含潜在的注入攻击
      metadata: {}
    };
    
    // 调用处理函数
    await new Promise((resolve) => {
      modelGatewayService.processQuery(
        { request },
        (error, response) => {
          expect(error).toBeDefined();
          expect(error.code).toBeDefined();
          expect(error.message).toContain('不安全');
          expect(response).toBeUndefined();
          
          resolve();
        }
      );
    });
  });
});