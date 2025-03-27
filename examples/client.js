/**
 * 智能模型网关系统 - 示例客户端
 * 
 * 这个示例客户端展示了如何使用gRPC客户端连接到模型网关服务，
 * 并发送不同类型的请求。
 */
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const readline = require('readline');

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

// 创建命令行接口
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// 示例查询
const exampleQueries = [
  '今天天气怎么样？',
  '解释一下量子计算的基本原理',
  '请详细分析人工智能在医疗领域的应用，包括诊断、治疗和药物研发等方面，并讨论其伦理问题和未来发展趋势。'
];

// 辅助函数：发送查询请求
function processQuery(query, metadata = {}) {
  return new Promise((resolve, reject) => {
    console.log(`\n发送查询: "${query}"`);
    
    const request = {
      request_id: uuidv4(),
      query,
      metadata
    };
    
    const startTime = Date.now();
    
    client.processQuery(request, { deadline: Date.now() + config.timeout }, (error, response) => {
      const duration = Date.now() - startTime;
      
      if (error) {
        console.error(`错误: ${error.message}`);
        reject(error);
        return;
      }
      
      console.log('\n查询结果:');
      console.log(`响应: ${response.response}`);
      console.log(`复杂度评分: ${response.complexity_score}`);
      console.log(`使用的模型: ${response.model_used}`);
      console.log(`成本: $${response.cost}`);
      console.log(`处理时间: ${duration}ms`);
      
      resolve(response);
    });
  });
}

// 辅助函数：获取模型能力
function getModelCapabilities() {
  return new Promise((resolve, reject) => {
    console.log('\n获取模型能力...');
    
    client.getModelCapabilities({}, (error, response) => {
      if (error) {
        console.error(`错误: ${error.message}`);
        reject(error);
        return;
      }
      
      console.log('\n可用模型能力:');
      console.log(`支持的能力: ${response.capabilities.join(', ')}`);
      console.log('\n提供商:');
      
      response.providers.forEach(provider => {
        console.log(`- ${provider.provider_name}`);
        console.log(`  能力: ${provider.capabilities.join(', ')}`);
      });
      
      resolve(response);
    });
  });
}

// 辅助函数：评估查询复杂度
function evaluateComplexity(query) {
  return new Promise((resolve, reject) => {
    console.log(`\n评估查询复杂度: "${query}"`);
    
    const request = {
      query,
      features: ['length', 'domain_knowledge', 'grammar_complexity']
    };
    
    client.evaluateComplexity(request, (error, response) => {
      if (error) {
        console.error(`错误: ${error.message}`);
        reject(error);
        return;
      }
      
      console.log('\n复杂度评估结果:');
      console.log(`复杂度评分: ${response.complexity_score}`);
      console.log(`复杂度因素: ${response.complexity_factors.join(', ')}`);
      
      resolve(response);
    });
  });
}

// 显示主菜单
function showMainMenu() {
  console.log('\n===== 智能模型网关系统 - 示例客户端 =====');
  console.log('1. 发送简单查询');
  console.log('2. 发送中等复杂度查询');
  console.log('3. 发送高复杂度查询');
  console.log('4. 发送自定义查询');
  console.log('5. 获取模型能力');
  console.log('6. 评估查询复杂度');
  console.log('7. 设置预算限制');
  console.log('8. 退出');
  
  rl.question('\n请选择操作 (1-8): ', handleMenuChoice);
}

// 当前元数据
let currentMetadata = {};

// 处理菜单选择
function handleMenuChoice(choice) {
  switch (choice) {
    case '1':
      processQuery(exampleQueries[0], currentMetadata)
        .catch(console.error)
        .finally(() => setTimeout(showMainMenu, 1000));
      break;
      
    case '2':
      processQuery(exampleQueries[1], currentMetadata)
        .catch(console.error)
        .finally(() => setTimeout(showMainMenu, 1000));
      break;
      
    case '3':
      processQuery(exampleQueries[2], currentMetadata)
        .catch(console.error)
        .finally(() => setTimeout(showMainMenu, 1000));
      break;
      
    case '4':
      rl.question('\n请输入您的查询: ', query => {
        processQuery(query, currentMetadata)
          .catch(console.error)
          .finally(() => setTimeout(showMainMenu, 1000));
      });
      break;
      
    case '5':
      getModelCapabilities()
        .catch(console.error)
        .finally(() => setTimeout(showMainMenu, 1000));
      break;
      
    case '6':
      rl.question('\n请输入要评估的查询: ', query => {
        evaluateComplexity(query)
          .catch(console.error)
          .finally(() => setTimeout(showMainMenu, 1000));
      });
      break;
      
    case '7':
      rl.question('\n请输入预算限制 (美元): ', budget => {
        currentMetadata.budget = budget;
        console.log(`预算已设置为 $${budget}`);
        setTimeout(showMainMenu, 500);
      });
      break;
      
    case '8':
      console.log('\n感谢使用智能模型网关系统！');
      rl.close();
      process.exit(0);
      break;
      
    default:
      console.log('\n无效的选择，请重试。');
      setTimeout(showMainMenu, 500);
  }
}

// 启动客户端
console.log(`连接到服务器: ${config.serverAddress}`);
showMainMenu();

// 处理退出
process.on('SIGINT', () => {
  console.log('\n\n正在退出...');
  rl.close();
  process.exit(0);
});