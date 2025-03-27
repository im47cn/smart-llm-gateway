/**
 * 智能模型网关系统 - 性能测试
 * 基准测试脚本
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
  iterations: 100,
  warmupIterations: 10,
  queryTypes: [
    {
      name: '简单查询',
      query: '今天天气怎么样？',
      expectedComplexity: 'low'
    },
    {
      name: '中等查询',
      query: '解释一下量子计算的基本原理',
      expectedComplexity: 'medium'
    },
    {
      name: '复杂查询',
      query: '请详细分析人工智能在医疗领域的应用，包括诊断、治疗和药物研发等方面，并讨论其伦理问题和未来发展趋势。',
      expectedComplexity: 'high'
    }
  ],
  outputFile: path.resolve(__dirname, '../../benchmark-results.json')
};

// 创建客户端
const client = new modelGateway.ModelGatewayService(
  config.serverAddress,
  grpc.credentials.createInsecure()
);

// 辅助函数：发送请求
function sendRequest(query) {
  return new Promise((resolve, reject) => {
    const request = {
      request_id: uuidv4(),
      query,
      metadata: {
        benchmark: 'true'
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

// 辅助函数：运行单个测试
async function runTest(queryType) {
  console.log(`\n开始测试: ${queryType.name}`);
  console.log(`查询: ${queryType.query.substring(0, 50)}${queryType.query.length > 50 ? '...' : ''}`);
  
  // 预热
  console.log(`预热中 (${config.warmupIterations} 次迭代)...`);
  for (let i = 0; i < config.warmupIterations; i++) {
    try {
      await sendRequest(queryType.query);
      process.stdout.write('.');
    } catch (error) {
      process.stdout.write('x');
    }
  }
  
  // 正式测试
  console.log(`\n开始基准测试 (${config.iterations} 次迭代)...`);
  
  const results = [];
  const durations = [];
  const costs = [];
  const models = new Map();
  
  for (let i = 0; i < config.iterations; i++) {
    try {
      const result = await sendRequest(queryType.query);
      results.push(result);
      durations.push(result.duration);
      costs.push(result.cost);
      
      // 记录模型使用情况
      const modelCount = models.get(result.modelUsed) || 0;
      models.set(result.modelUsed, modelCount + 1);
      
      process.stdout.write('.');
    } catch (error) {
      process.stdout.write('x');
    }
    
    // 每10次迭代暂停一下，避免过度请求
    if (i > 0 && i % 10 === 0) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  // 计算统计数据
  durations.sort((a, b) => a - b);
  const totalDuration = durations.reduce((sum, d) => sum + d, 0);
  const avgDuration = totalDuration / durations.length;
  const minDuration = durations[0];
  const maxDuration = durations[durations.length - 1];
  const medianDuration = durations[Math.floor(durations.length / 2)];
  const p95Duration = durations[Math.floor(durations.length * 0.95)];
  const p99Duration = durations[Math.floor(durations.length * 0.99)];
  
  // 计算成本统计
  const totalCost = costs.reduce((sum, c) => sum + c, 0);
  const avgCost = totalCost / costs.length;
  
  // 模型使用统计
  const modelUsage = Array.from(models.entries()).map(([model, count]) => ({
    model,
    count,
    percentage: (count / config.iterations) * 100
  }));
  
  // 输出结果
  console.log('\n测试结果:');
  console.log(`总请求数: ${results.length}`);
  console.log(`平均响应时间: ${avgDuration.toFixed(2)} ms`);
  console.log(`最小响应时间: ${minDuration.toFixed(2)} ms`);
  console.log(`最大响应时间: ${maxDuration.toFixed(2)} ms`);
  console.log(`中位数响应时间: ${medianDuration.toFixed(2)} ms`);
  console.log(`95%响应时间: ${p95Duration.toFixed(2)} ms`);
  console.log(`99%响应时间: ${p99Duration.toFixed(2)} ms`);
  console.log(`平均成本: $${avgCost.toFixed(5)}`);
  console.log(`总成本: $${totalCost.toFixed(5)}`);
  
  console.log('\n模型使用情况:');
  modelUsage.forEach(({ model, count, percentage }) => {
    console.log(`${model}: ${count} 次 (${percentage.toFixed(2)}%)`);
  });
  
  return {
    queryType: queryType.name,
    query: queryType.query,
    expectedComplexity: queryType.expectedComplexity,
    totalRequests: results.length,
    statistics: {
      avgDuration,
      minDuration,
      maxDuration,
      medianDuration,
      p95Duration,
      p99Duration,
      avgCost,
      totalCost
    },
    modelUsage
  };
}

// 主函数
async function runBenchmark() {
  console.log('智能模型网关系统 - 基准测试');
  console.log(`服务器地址: ${config.serverAddress}`);
  console.log(`迭代次数: ${config.iterations}`);
  console.log(`预热迭代次数: ${config.warmupIterations}`);
  
  const allResults = [];
  
  for (const queryType of config.queryTypes) {
    const result = await runTest(queryType);
    allResults.push(result);
  }
  
  // 保存结果到文件
  const benchmarkResults = {
    timestamp: new Date().toISOString(),
    config,
    results: allResults
  };
  
  fs.writeFileSync(
    config.outputFile,
    JSON.stringify(benchmarkResults, null, 2)
  );
  
  console.log(`\n基准测试完成，结果已保存到 ${config.outputFile}`);
}

// 运行基准测试
runBenchmark().catch(error => {
  console.error('基准测试失败:', error);
  process.exit(1);
});