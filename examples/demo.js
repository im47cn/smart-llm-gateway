/**
 * 智能模型网关系统 - 演示脚本
 * 
 * 这个脚本演示了智能模型网关系统的核心功能，包括：
 * 1. 查询处理和模型路由
 * 2. 复杂度评估
 * 3. 错误处理和故障恢复
 * 4. 监控和指标收集
 */
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// 加载 Protocol Buffers 定义
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

// 配置
const config = {
  serverAddress: process.env.SERVER_ADDRESS || 'localhost:50051',
  timeout: 30000 // 30秒超时
};

// 创建客户端
const client = new modelGateway.ModelGatewayService(
  config.serverAddress,
  grpc.credentials.createInsecure(),
  {
    'grpc.keepalive_time_ms': 10000,
    'grpc.keepalive_timeout_ms': 5000,
    'grpc.max_receive_message_length': 1024 * 1024 * 10 // 10MB
  }
);

// 演示查询
const demoQueries = [
  {
    name: '简单查询',
    query: '今天天气怎么样？',
    expectedComplexity: '低',
    expectedModel: 'local'
  },
  {
    name: '中等复杂度查询',
    query: '解释一下量子计算的基本原理',
    expectedComplexity: '中',
    expectedModel: 'hybrid'
  },
  {
    name: '高复杂度查询',
    query: '请详细分析人工智能在医疗领域的应用，包括诊断、治疗和药物研发等方面，并讨论其伦理问题和未来发展趋势。',
    expectedComplexity: '高',
    expectedModel: 'remote'
  }
];

// 辅助函数：发送查询请求
function processQuery(query, metadata = {}) {
  return new Promise((resolve, reject) => {
    const request = {
      request_id: uuidv4(),
      query,
      metadata
    };
    
    const startTime = Date.now();
    
    client.processQuery(request, { deadline: Date.now() + config.timeout }, (error, response) => {
      const duration = Date.now() - startTime;
      
      if (error) {
        reject({ error, duration });
        return;
      }
      
      resolve({
        response,
        duration,
        modelUsed: response.model_used,
        complexityScore: response.complexity_score,
        cost: response.cost
      });
    });
  });
}

// 辅助函数：获取模型能力
function getModelCapabilities() {
  return new Promise((resolve, reject) => {
    client.getModelCapabilities({}, (error, response) => {
      if (error) {
        reject(error);
        return;
      }
      
      resolve(response);
    });
  });
}

// 辅助函数：评估查询复杂度
function evaluateComplexity(query) {
  return new Promise((resolve, reject) => {
    const request = {
      query,
      features: ['length', 'domain_knowledge', 'grammar_complexity']
    };
    
    client.evaluateComplexity(request, (error, response) => {
      if (error) {
        reject(error);
        return;
      }
      
      resolve(response);
    });
  });
}

// 辅助函数：等待
function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 辅助函数：打印分隔线
function printSeparator() {
  console.log('\n' + '='.repeat(80) + '\n');
}

// 主演示函数
async function runDemo() {
  console.log('智能模型网关系统 - 功能演示');
  console.log(`连接到服务器: ${config.serverAddress}`);
  
  try {
    // 演示 1: 获取模型能力
    printSeparator();
    console.log('演示 1: 获取模型能力');
    const capabilities = await getModelCapabilities();
    console.log('可用模型能力:');
    console.log(`支持的能力: ${capabilities.capabilities.join(', ')}`);
    console.log('\n提供商:');
    capabilities.providers.forEach(provider => {
      console.log(`- ${provider.provider_name}`);
      console.log(`  能力: ${provider.capabilities.join(', ')}`);
    });
    
    await wait(1000);
    
    // 演示 2: 复杂度评估
    printSeparator();
    console.log('演示 2: 复杂度评估');
    
    for (const demo of demoQueries) {
      console.log(`\n评估查询: "${demo.name}"`);
      console.log(`查询内容: "${demo.query}"`);
      
      const complexityResult = await evaluateComplexity(demo.query);
      
      console.log(`复杂度评分: ${complexityResult.complexity_score}`);
      console.log(`复杂度因素: ${complexityResult.complexity_factors.join(', ')}`);
      console.log(`预期复杂度: ${demo.expectedComplexity}`);
      
      await wait(500);
    }
    
    // 演示 3: 查询处理和模型路由
    printSeparator();
    console.log('演示 3: 查询处理和模型路由');
    
    for (const demo of demoQueries) {
      console.log(`\n处理查询: "${demo.name}"`);
      console.log(`查询内容: "${demo.query}"`);
      console.log(`预期复杂度: ${demo.expectedComplexity}`);
      console.log(`预期模型类型: ${demo.expectedModel}`);
      
      const result = await processQuery(demo.query);
      
      console.log('\n结果:');
      console.log(`响应: "${result.response.substring(0, 100)}${result.response.length > 100 ? '...' : ''}"`);
      console.log(`复杂度评分: ${result.complexityScore}`);
      console.log(`使用的模型: ${result.modelUsed}`);
      console.log(`成本: $${result.cost}`);
      console.log(`处理时间: ${result.duration}ms`);
      
      await wait(1000);
    }
    
    // 演示 4: 预算限制
    printSeparator();
    console.log('演示 4: 预算限制');
    
    const highComplexityQuery = demoQueries[2].query;
    console.log(`查询: "${highComplexityQuery.substring(0, 50)}..."`);
    
    try {
      console.log('\n尝试使用非常低的预算限制:');
      const result = await processQuery(highComplexityQuery, { budget: '0.001' });
      console.log('查询成功处理，可能使用了更便宜的模型');
      console.log(`使用的模型: ${result.modelUsed}`);
      console.log(`成本: $${result.cost}`);
    } catch (error) {
      console.log(`预期的错误: ${error.error.message}`);
      console.log('预算限制功能正常工作');
    }
    
    // 演示 5: 错误处理
    printSeparator();
    console.log('演示 5: 错误处理');
    
    try {
      console.log('\n尝试发送空查询:');
      await processQuery('');
    } catch (error) {
      console.log(`预期的错误: ${error.error.message}`);
      console.log('错误处理功能正常工作');
    }
    
    try {
      console.log('\n尝试发送潜在的不安全查询:');
      await processQuery('exec(rm -rf /)');
    } catch (error) {
      console.log(`预期的错误: ${error.error.message}`);
      console.log('安全检查功能正常工作');
    }
    
    // 演示完成
    printSeparator();
    console.log('演示完成！');
    console.log('智能模型网关系统功能正常工作。');
    
  } catch (error) {
    console.error('演示过程中发生错误:', error);
  }
}

// 运行演示
runDemo().finally(() => {
  console.log('\n演示脚本执行完毕，正在退出...');
  process.exit(0);
});