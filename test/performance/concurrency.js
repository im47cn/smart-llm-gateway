/**
 * 智能模型网关系统 - 性能测试
 * 并发测试脚本
 */
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');

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

// 测试配置
const config = {
  serverAddress: 'localhost:50051',
  concurrencyLevels: [1, 5, 10, 20, 50, 100],
  queriesPerLevel: 50,
  queryMix: [
    { query: '今天天气怎么样？', weight: 0.6 }, // 60% 简单查询
    { query: '解释一下量子计算的基本原理', weight: 0.3 }, // 30% 中等查询
    { query: '请详细分析人工智能在医疗领域的应用，包括诊断、治疗和药物研发等方面，并讨论其伦理问题和未来发展趋势。', weight: 0.1 } // 10% 复杂查询
  ],
  outputFile: path.resolve(__dirname, '../../concurrency-test-results.json')
};

// 创建客户端
function createClient() {
  return new modelGateway.ModelGatewayService(
    config.serverAddress,
    grpc.credentials.createInsecure()
  );
}

// 辅助函数：随机选择查询
function selectRandomQuery() {
  const random = Math.random();
  let cumulativeWeight = 0;
  
  for (const queryOption of config.queryMix) {
    cumulativeWeight += queryOption.weight;
    if (random < cumulativeWeight) {
      return queryOption.query;
    }
  }
  
  return config.queryMix[0].query; // 默认返回第一个
}

// 辅助函数：发送请求
function sendRequest(client, query) {
  return new Promise((resolve, reject) => {
    const request = {
      request_id: uuidv4(),
      query,
      metadata: {
        concurrencyTest: 'true'
      }
    };
    
    const startTime = process.hrtime.bigint();
    
    client.processQuery(request, (error, response) => {
      const endTime = process.hrtime.bigint();
      const duration = Number(endTime - startTime) / 1000000; // 转换为毫秒
      
      if (error) {
        reject({ error, duration });
      } else {
        resolve({
          response,
          duration,
          modelUsed: response.model_used,
          complexityScore: response.complexity_score,
          cost: response.cost
        });
      }
    });
  });
}

// 辅助函数：运行单个并发级别测试
async function runConcurrencyLevel(concurrencyLevel) {
  console.log(`\n开始并发测试: ${concurrencyLevel} 并发请求`);
  
  // 创建多个客户端
  const clients = Array(concurrencyLevel).fill().map(() => createClient());
  
  // 准备请求
  const requests = Array(config.queriesPerLevel).fill().map(() => ({
    query: selectRandomQuery(),
    client: clients[Math.floor(Math.random() * clients.length)]
  }));
  
  console.log(`发送 ${requests.length} 个请求，并发级别 ${concurrencyLevel}`);
  
  // 记录开始时间
  const startTime = process.hrtime.bigint();
  
  // 并发发送请求
  const results = await Promise.allSettled(
    requests.map(req => sendRequest(req.client, req.query))
  );
  
  // 记录结束时间
  const endTime = process.hrtime.bigint();
  const totalDuration = Number(endTime - startTime) / 1000000; // 转换为毫秒
  
  // 处理结果
  const successResults = results
    .filter(r => r.status === 'fulfilled')
    .map(r => r.value);
  
  const errorResults = results
    .filter(r => r.status === 'rejected')
    .map(r => r.reason);
  
  // 计算统计数据
  const durations = successResults.map(r => r.duration).sort((a, b) => a - b);
  const totalResponseTime = durations.reduce((sum, d) => sum + d, 0);
  const avgDuration = durations.length > 0 ? totalResponseTime / durations.length : 0;
  const minDuration = durations.length > 0 ? durations[0] : 0;
  const maxDuration = durations.length > 0 ? durations[durations.length - 1] : 0;
  const medianDuration = durations.length > 0 ? durations[Math.floor(durations.length / 2)] : 0;
  const p95Duration = durations.length > 0 ? durations[Math.floor(durations.length * 0.95)] : 0;
  const p99Duration = durations.length > 0 ? durations[Math.floor(durations.length * 0.99)] : 0;
  
  // 计算吞吐量
  const throughput = (successResults.length / totalDuration) * 1000; // 每秒请求数
  
  // 计算错误率
  const errorRate = (errorResults.length / results.length) * 100;
  
  // 输出结果
  console.log('\n测试结果:');
  console.log(`总请求数: ${results.length}`);
  console.log(`成功请求: ${successResults.length}`);
  console.log(`失败请求: ${errorResults.length}`);
  console.log(`错误率: ${errorRate.toFixed(2)}%`);
  console.log(`总执行时间: ${totalDuration.toFixed(2)} ms`);
  console.log(`吞吐量: ${throughput.toFixed(2)} 请求/秒`);
  console.log(`平均响应时间: ${avgDuration.toFixed(2)} ms`);
  console.log(`最小响应时间: ${minDuration.toFixed(2)} ms`);
  console.log(`最大响应时间: ${maxDuration.toFixed(2)} ms`);
  console.log(`中位数响应时间: ${medianDuration.toFixed(2)} ms`);
  console.log(`95%响应时间: ${p95Duration.toFixed(2)} ms`);
  console.log(`99%响应时间: ${p99Duration.toFixed(2)} ms`);
  
  // 模型使用情况
  const modelUsage = {};
  successResults.forEach(result => {
    const model = result.modelUsed;
    modelUsage[model] = (modelUsage[model] || 0) + 1;
  });
  
  console.log('\n模型使用情况:');
  Object.entries(modelUsage).forEach(([model, count]) => {
    const percentage = (count / successResults.length) * 100;
    console.log(`${model}: ${count} 次 (${percentage.toFixed(2)}%)`);
  });
  
  return {
    concurrencyLevel,
    totalRequests: results.length,
    successfulRequests: successResults.length,
    failedRequests: errorResults.length,
    errorRate,
    totalDuration,
    throughput,
    statistics: {
      avgDuration,
      minDuration,
      maxDuration,
      medianDuration,
      p95Duration,
      p99Duration
    },
    modelUsage: Object.entries(modelUsage).map(([model, count]) => ({
      model,
      count,
      percentage: (count / successResults.length) * 100
    }))
  };
}

// 主函数
async function runConcurrencyTest() {
  console.log('智能模型网关系统 - 并发测试');
  console.log(`服务器地址: ${config.serverAddress}`);
  
  const allResults = [];
  
  for (const concurrencyLevel of config.concurrencyLevels) {
    const result = await runConcurrencyLevel(concurrencyLevel);
    allResults.push(result);
    
    // 在高并发测试之间暂停一下，让系统恢复
    if (concurrencyLevel > 20) {
      console.log('\n系统冷却中，等待30秒...');
      await new Promise(resolve => setTimeout(resolve, 30000));
    }
  }
  
  // 保存结果到文件
  const concurrencyTestResults = {
    timestamp: new Date().toISOString(),
    config,
    results: allResults
  };
  
  fs.writeFileSync(
    config.outputFile,
    JSON.stringify(concurrencyTestResults, null, 2)
  );
  
  console.log(`\n并发测试完成，结果已保存到 ${config.outputFile}`);
}

// 运行并发测试
runConcurrencyTest().catch(error => {
  console.error('并发测试失败:', error);
  process.exit(1);
});