/**
 * 配置文件
 */
require('dotenv').config();

const config = {
  // 服务器配置
  grpcPort: process.env.GRPC_PORT || 50051,
  environment: process.env.NODE_ENV || 'development',
  
  // 日志配置
  logLevel: process.env.LOG_LEVEL || 'info',
  
  // 模型提供商配置
  modelProviders: {
    // 默认提供商配置
    default: {
      maxCostPerQuery: parseFloat(process.env.DEFAULT_MAX_COST_PER_QUERY || '0.01'),
      maxConcurrentQueries: parseInt(process.env.DEFAULT_MAX_CONCURRENT_QUERIES || '10', 10),
      supportedCapabilities: (process.env.DEFAULT_SUPPORTED_CAPABILITIES || 'text-generation,summarization').split(',')
    },
    // 其他提供商可以在这里添加
  },
  
  // 复杂度评估配置
  complexityEvaluation: {
    defaultThreshold: parseFloat(process.env.COMPLEXITY_DEFAULT_THRESHOLD || '0.5'),
    features: (process.env.COMPLEXITY_FEATURES || 'vocabulary,grammar,abstraction,domain,context').split(',')
  },
  
  // 路由策略配置
  routingStrategy: {
    lowComplexityThreshold: parseFloat(process.env.LOW_COMPLEXITY_THRESHOLD || '0.3'),
    highComplexityThreshold: parseFloat(process.env.HIGH_COMPLEXITY_THRESHOLD || '0.7')
  }
};

module.exports = config;