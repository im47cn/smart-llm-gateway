/**
 * 智能模型网关系统 - 性能测试
 * 资源使用测试脚本
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
  testDuration: 300, // 5分钟
  samplingInterval: 1000, // 1秒
  loadPatterns: [
    { name: '空闲', requestsPerSecond: 0, duration: 60 }, // 1分钟空闲
    { name: '低负载', requestsPerSecond: 1, duration: 60 }, // 1分钟低负载
    { name: '中等负载', requestsPerSecond: 5, duration: 60 }, // 1分钟中等负载
    { name: '高负载', requestsPerSecond: 10, duration: 60 }, // 1分钟高负载
    { name: '冷却', requestsPerSecond: 0, duration: 60 } // 1分钟冷却
  ],
  queryMix: [
    { query: '今天天气怎么样？', weight: 0.6 }, // 60% 简单查询
    { query: '解释一下量子计算的基本原理', weight: 0.3 }, // 30% 中等查询
    { query: '请详细分析人工智能在医疗领域的应用，包括诊断、治疗和药物研发等方面，并讨论其伦理问题和未来发展趋势。', weight: 0.1 } // 10% 复杂查询
  ],
  outputFile: path.resolve(__dirname, '../../resource-test-results.json')
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
        resourceTest: 'true'
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
    totalMem: os.totalmem(),
    cpuInfo: os.cpus()
  };
}

// 辅助函数：运行负载模式
async function runLoadPattern(pattern, resourceData) {
  console.log(`\n开始负载模式: ${pattern.name}`);
  console.log(`请求速率: ${pattern.requestsPerSecond} 请求/秒`);
  console.log(`持续时间: ${pattern.duration} 秒`);
  
  // 计算请求间隔（毫秒）
  const interval = pattern.requestsPerSecond > 0 ? 1000 / pattern.requestsPerSecond : 0;
  
  // 设置结束时间
  const endTime = Date.now() + (pattern.duration * 1000);
  
  // 开始发送请求
  let requestCount = 0;
  let successCount = 0;
  let errorCount = 0;
  
  while (Date.now() < endTime) {
    // 如果有请求要发送
    if (pattern.requestsPerSecond > 0) {
      const query = selectRandomQuery();
      requestCount++;
      
      // 发送请求（不等待响应）
      sendRequest(query)
        .then(() => {
          successCount++;
        })
        .catch(() => {
          errorCount++;
        });
      
      // 等待间隔
      if (interval > 0) {
        await new Promise(resolve => setTimeout(resolve, interval));
      }
    } else {
      // 空闲模式，只等待
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  console.log(`负载模式 ${pattern.name} 完成`);
  console.log(`发送请求: ${requestCount}, 成功: ${successCount}, 失败: ${errorCount}`);
  
  return {
    pattern: pattern.name,
    requestsPerSecond: pattern.requestsPerSecond,
    duration: pattern.duration,
    totalRequests: requestCount,
    successfulRequests: successCount,
    failedRequests: errorCount
  };
}

// 主函数
async function runResourceTest() {
  console.log('智能模型网关系统 - 资源使用测试');
  console.log(`服务器地址: ${config.serverAddress}`);
  console.log(`测试持续时间: ${config.testDuration} 秒`);
  console.log(`采样间隔: ${config.samplingInterval} 毫秒`);
  
  // 资源使用数据
  const resourceData = [];
  
  // 设置资源监控
  const resourceMonitorInterval = setInterval(() => {
    resourceData.push(collectResourceUsage());
  }, config.samplingInterval);
  
  // 运行负载模式
  const patternResults = [];
  
  for (const pattern of config.loadPatterns) {
    const result = await runLoadPattern(pattern, resourceData);
    patternResults.push(result);
  }
  
  // 停止资源监控
  clearInterval(resourceMonitorInterval);
  
  // 分析资源使用情况
  const cpuUsage = resourceData.map(data => {
    const cpuInfo = data.cpuInfo;
    const totalCpu = cpuInfo.reduce((total, cpu) => {
      return total + cpu.times.user + cpu.times.sys;
    }, 0);
    return {
      timestamp: data.timestamp,
      totalCpu,
      systemLoad: data.systemLoad[0] // 1分钟负载
    };
  });
  
  const memoryUsage = resourceData.map(data => ({
    timestamp: data.timestamp,
    rss: data.memory.rss / (1024 * 1024), // MB
    heapTotal: data.memory.heapTotal / (1024 * 1024), // MB
    heapUsed: data.memory.heapUsed / (1024 * 1024), // MB
    freeSystemMem: data.freeMem / (1024 * 1024), // MB
    totalSystemMem: data.totalMem / (1024 * 1024) // MB
  }));
  
  // 计算统计数据
  const calculateStats = (data, key) => {
    const values = data.map(item => item[key]);
    const avg = values.reduce((sum, val) => sum + val, 0) / values.length;
    const min = Math.min(...values);
    const max = Math.max(...values);
    return { avg, min, max };
  };
  
  const cpuStats = {
    systemLoad: calculateStats(cpuUsage, 'systemLoad')
  };
  
  const memoryStats = {
    rss: calculateStats(memoryUsage, 'rss'),
    heapUsed: calculateStats(memoryUsage, 'heapUsed'),
    freeSystemMem: calculateStats(memoryUsage, 'freeSystemMem')
  };
  
  // 输出结果
  console.log('\n资源使用统计:');
  console.log('CPU 使用情况:');
  console.log(`  平均系统负载: ${cpuStats.systemLoad.avg.toFixed(2)}`);
  console.log(`  最小系统负载: ${cpuStats.systemLoad.min.toFixed(2)}`);
  console.log(`  最大系统负载: ${cpuStats.systemLoad.max.toFixed(2)}`);
  
  console.log('\n内存使用情况:');
  console.log(`  平均 RSS: ${memoryStats.rss.avg.toFixed(2)} MB`);
  console.log(`  最小 RSS: ${memoryStats.rss.min.toFixed(2)} MB`);
  console.log(`  最大 RSS: ${memoryStats.rss.max.toFixed(2)} MB`);
  console.log(`  平均堆内存使用: ${memoryStats.heapUsed.avg.toFixed(2)} MB`);
  console.log(`  最小堆内存使用: ${memoryStats.heapUsed.min.toFixed(2)} MB`);
  console.log(`  最大堆内存使用: ${memoryStats.heapUsed.max.toFixed(2)} MB`);
  console.log(`  平均系统可用内存: ${memoryStats.freeSystemMem.avg.toFixed(2)} MB`);
  
  // 保存结果到文件
  const resourceTestResults = {
    timestamp: new Date().toISOString(),
    config,
    patternResults,
    resourceData: {
      cpu: cpuUsage,
      memory: memoryUsage
    },
    statistics: {
      cpu: cpuStats,
      memory: memoryStats
    }
  };
  
  fs.writeFileSync(
    config.outputFile,
    JSON.stringify(resourceTestResults, null, 2)
  );
  
  console.log(`\n资源使用测试完成，结果已保存到 ${config.outputFile}`);
}

// 运行资源使用测试
runResourceTest().catch(error => {
  console.error('资源使用测试失败:', error);
  process.exit(1);
});