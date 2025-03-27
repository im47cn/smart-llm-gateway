/**
 * 测试客户端
 */
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// 加载proto文件
const PROTO_PATH = path.join(__dirname, '../proto/gateway.proto');
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true
});

const protoDescriptor = grpc.loadPackageDefinition(packageDefinition);
const modelgateway = protoDescriptor.modelgateway;

// 创建客户端
const client = new modelgateway.ModelGatewayService(
  'localhost:50051',
  grpc.credentials.createInsecure()
);

// 测试ProcessQuery
function testProcessQuery() {
  console.log('测试 ProcessQuery API...');
  
  const request = {
    request_id: uuidv4(),
    query: '这是一个测试查询，用于验证模型网关系统的功能。',
    metadata: {
      source: 'test-client',
      timestamp: new Date().toISOString()
    }
  };
  
  client.processQuery(request, (err, response) => {
    if (err) {
      console.error('处理查询失败:', err);
      return;
    }
    
    console.log('查询处理成功:');
    console.log(JSON.stringify(response, null, 2));
  });
}

// 测试GetModelCapabilities
function testGetModelCapabilities() {
  console.log('测试 GetModelCapabilities API...');
  
  client.getModelCapabilities({}, (err, response) => {
    if (err) {
      console.error('获取模型能力失败:', err);
      return;
    }
    
    console.log('获取模型能力成功:');
    console.log(JSON.stringify(response, null, 2));
  });
}

// 测试EvaluateComplexity
function testEvaluateComplexity() {
  console.log('测试 EvaluateComplexity API...');
  
  const request = {
    query: '这是一个测试查询，用于验证复杂度评估功能。这个查询包含多个句子，以便测试语法复杂度评估。我们希望系统能够正确分析这段文本的复杂度，并返回相应的评估结果。',
    features: ['vocabulary', 'grammar']
  };
  
  client.evaluateComplexity(request, (err, response) => {
    if (err) {
      console.error('复杂度评估失败:', err);
      return;
    }
    
    console.log('复杂度评估成功:');
    console.log(JSON.stringify(response, null, 2));
  });
}

// 运行所有测试
function runAllTests() {
  testProcessQuery();
  
  // 延迟执行其他测试，避免日志混淆
  setTimeout(testGetModelCapabilities, 1000);
  setTimeout(testEvaluateComplexity, 2000);
  
  // 5秒后关闭客户端
  setTimeout(() => {
    console.log('测试完成，关闭客户端');
    process.exit(0);
  }, 5000);
}

// 如果直接运行此文件，则执行测试
if (require.main === module) {
  runAllTests();
}

module.exports = {
  client,
  testProcessQuery,
  testGetModelCapabilities,
  testEvaluateComplexity,
  runAllTests
};