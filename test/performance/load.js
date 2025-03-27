/**
 * 智能模型网关系统 - 性能测试
 * 负载测试脚本
 */
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const os = require('os');

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
  loadLevels: [
    { name: '低负载', requestsPerSecond: 1, duration: 60 }, // 1 RPS, 1分钟
    { name: '中等负载', requestsPerSecond: 5, duration: 60 }, // 5 RPS, 1分钟
    { name: '高负载', requestsPerSecond: 10, duration: 60 }, // 10 RPS, 1分钟
    { name: '极限负载', requestsPerSecond: 20, duration: 30 } // 20 RPS, 30秒
  ],
  queryMix: [
    { query: '今天天气怎么样？', weight: 0.6 }, // 60% 简单查询
    { query: '解释一下量子计算的基本原理', weight: 0.3 }, // 30% 中等查询
    { query: '请详细分析人工智能在医疗领域的应用，包括诊断、治疗和药物研发等方面，并讨论其伦理问题和未来发展趋势。', weight: 0.1 } // 10% 复杂查询
  ],
  outputFile: path.resolve(__dirname, '../../load-test-results.json')
};

// 创建客户端
const client = new modelGateway.ModelGatewayService(
  config.serverAddress,
  grpc.credentials.createInsecure()
);

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
function sendRequest(query) {
  return new Promise((resolve, reject) => {
    const request = {
      request_id: uuidv4(),
      query,
      metadata: {
        loadTest: 'true'
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

// 辅助函数：收集系统资源使用情况
function collectResourceUsage() {
  const cpuUsage = process.cpuUsage();
  const memUsage = process.memoryUsage();
  
  return {
    timestamp: Date.now(),
    cpu: {
      user: cpuUsage.user,
      system: cpuUsage.system
    },
    memory: {
      rss: memUsage.rss,
      heapTotal: memUsage.heapTotal,
      heapUsed: memUsage.heapUsed
    },
    systemLoad: os.loadavg(),
    freeMem: os.freemem(),
    totalMem: os.totalmem()
  };
}

// 辅助函数：运行单个负载级别测试
async function runLoadLevel(loadLevel) {
  console.log(`\n开始负载测试: ${loadLevel.name}`);
  console.log(`请求速率: ${loadLevel.requestsPerSecond} 请求/秒`);
  console.log(`持续时间: ${loadLevel.duration} 秒`);
  
  const results = [];
  const errors = [];
  const resourceUsage = [];
  
  // 计算请求间隔（毫秒）
  const interval = 1000 / loadLevel.requestsPerSecond;
  
  // 设置结束时间
  const endTime = Date.now() + (loadLevel.duration * 1000);
  
  // 设置资源监控间隔
  const resourceMonitorInterval = setInterval(() => {
    resourceUsage.push(collectResourceUsage());
  }, 1000);
  
  // 开始发送请求
  let requestCount = 0;
  let successCount = 0;
  let errorCount = 0;
  
  while (Date.now() < endTime) {
    const query = selectRandomQuery();
    requestCount++;
    
    // 发送请求（不等待响应）
    sendRequest(query)
      .then(result => {
        successCount++;
        results.push(result);
        process.stdout.write('.');
      })
      .catch(error => {
        errorCount++;
        errors.push(error);
        process.stdout.write('x');
      });
    
    // 等待间隔
    await new Promise(resolve => setTimeout(resolve, interval));
    
    // 每10个请求输出一次状态
    if (requestCount % 10 === 0) {
      const elapsedSeconds = (Date.now() - (endTime - loadLevel.duration * 1000)) / 1000;
      const currentRPS = requestCount / elapsedSeconds;
      process.stdout.write(` [${requestCount}请求, ${currentRPS.toFixed(2)}RPS] `);
    }
  }
  
  // 等待所有请求完成
  console.log('\n等待剩余请求完成...');
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  // 停止资源监控
  clearInterval(resourceMonitorInterval);
  
  // 计算统计数据
  const durations = results.map(r => r.duration).sort((a, b) => a - b);
  const totalDuration = durations.reduce((sum, d) => sum + d, 0);
  const avgDuration = durations.length > 0 ? totalDuration / durations.length : 0;
  const minDuration = durations.length > 0 ? durations[0] : 0;
  const maxDuration = durations.length > 0 ? durations[durations.length - 1] : 0;
  const medianDuration = durations.length > 0 ? durations[Math.floor(durations.length / 2)] : 0;
  const p95Duration = durations.length > 0 ? durations[Math.floor(durations.length * 0.95)] : 0;
  const p99Duration = durations.length > 0 ? durations[Math.floor(durations.length * 0.99)] : 0;
  
  // 计算错误率
  const errorRate = requestCount > 0 ? (errorCount / requestCount) * 100 : 0;
  
  // 计算实际RPS
  const actualTestDuration = (Date.now() - (endTime - loadLevel.duration * 1000)) / 1000;
  const actualRPS = requestCount / actualTestDuration;
  
  // 输出结果
  console.log('\n测试结果:');
  console.log(`总请求数: ${requestCount}`);
  console.log(`成功请求: ${successCount}`);
  console.log(`失败请求: ${errorCount}`);
  console.log(`错误率: ${errorRate.toFixed(2)}%`);
  console.log(`实际RPS: ${actualRPS.toFixed(2)}`);
  console.log(`平均响应时间: ${avgDuration.toFixed(2)} ms`);
  console.log(`最小响应时间: ${minDuration.toFixed(2)} ms`);
  console.log(`最大响应时间: ${maxDuration.toFixed(2)} ms`);
  console.log(`中位数响应时间: ${medianDuration.toFixed(2)} ms`);
  console.log(`95%响应时间: ${p95Duration.toFixed(2)} ms`);
  console.log(`99%响应时间: ${p99Duration.toFixed(2)} ms`);
  
  return {
    loadLevel: loadLevel.name,
    targetRPS: loadLevel.requestsPerSecond,
    actualRPS,
    duration: loadLevel.duration,
    totalRequests: requestCount,
    successfulRequests: successCount,
    failedRequests: errorCount,
    errorRate,
    statistics: {
      avgDuration,
      minDuration,
      maxDuration,
      medianDuration,
      p95Duration,
      p99Duration
    },
    resourceUsage
  };
}

// 主函数
async function runLoadTest() {
  console.log('智能模型网关系统 - 负载测试');
  console.log(`服务器地址: ${config.serverAddress}`);
  
  const allResults = [];
  
  for (const loadLevel of config.loadLevels) {
    const result = await runLoadLevel(loadLevel);
    allResults.push(result);
    
    // 在高负载测试之间暂停一下，让系统恢复
    if (loadLevel.requestsPerSecond > 5) {
      console.log('\n系统冷却中，等待30秒...');
      await new Promise(resolve => setTimeout(resolve, 30000));
    }
  }
  
  // 保存结果到文件
  const loadTestResults = {
    timestamp: new Date().toISOString(),
    config,
    results: allResults
  };
  
  fs.writeFileSync(
    config.outputFile,
    JSON.stringify(loadTestResults, null, 2)
  );
  
  console.log(`\n负载测试完成，结果已保存到 ${config.outputFile}`);
}

// 运行负载测试
runLoadTest().catch(error => {
  console.error('负载测试失败:', error);
  process.exit(1);
});