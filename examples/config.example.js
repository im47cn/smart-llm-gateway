/**
 * 智能模型网关系统 - 示例配置文件
 * 
 * 这个文件展示了系统的各种配置选项。
 * 实际使用时，请根据您的环境和需求进行调整。
 */

module.exports = {
  // 服务器配置
  server: {
    port: 50051, // gRPC 服务端口
    host: '0.0.0.0', // 监听地址
    maxConcurrentRequests: 1000, // 最大并发请求数
    requestTimeout: 30000, // 请求超时时间（毫秒）
    keepaliveTime: 10000, // keepalive 时间（毫秒）
    maxReceiveMessageSize: 10 * 1024 * 1024, // 最大接收消息大小（10MB）
    maxSendMessageSize: 10 * 1024 * 1024 // 最大发送消息大小（10MB）
  },
  
  // 路由策略配置
  routingStrategy: {
    lowComplexityThreshold: 0.3, // 低复杂度阈值
    highComplexityThreshold: 0.7, // 高复杂度阈值
    costEfficiencyWeight: 0.3, // 成本效率权重
    performanceWeight: 0.4, // 性能权重
    reliabilityWeight: 0.3, // 可靠性权重
    defaultTimeout: 10000, // 默认超时时间（毫秒）
    retryCount: 1, // 重试次数
    retryDelay: 1000 // 重试延迟（毫秒）
  },
  
  // 模型提供商配置
  modelProviders: {
    // OpenAI 配置
    'openai': {
      status: 'online', // 状态：online, offline, degraded
      apiKey: process.env.OPENAI_API_KEY || 'your-api-key-here',
      baseUrl: 'https://api.openai.com/v1',
      defaultModel: 'gpt-4',
      supportedModels: ['gpt-4', 'gpt-3.5-turbo'],
      supportedModelTypes: ['remote'],
      maxConcurrentQueries: 50,
      baseCostPerQuery: 0.02,
      maxCostPerQuery: 0.5,
      timeout: 15000,
      retryCount: 2,
      retryDelay: 1000,
      costEfficiency: 0.6,
      capabilities: [
        'text_generation',
        'code_generation',
        'reasoning',
        'summarization'
      ]
    },
    
    // Anthropic 配置
    'anthropic': {
      status: 'online',
      apiKey: process.env.ANTHROPIC_API_KEY || 'your-api-key-here',
      baseUrl: 'https://api.anthropic.com',
      defaultModel: 'claude-2',
      supportedModels: ['claude-2', 'claude-instant-1'],
      supportedModelTypes: ['hybrid', 'remote'],
      maxConcurrentQueries: 30,
      baseCostPerQuery: 0.03,
      maxCostPerQuery: 0.6,
      timeout: 20000,
      retryCount: 1,
      retryDelay: 1000,
      costEfficiency: 0.7,
      capabilities: [
        'text_generation',
        'reasoning',
        'summarization',
        'long_context'
      ]
    },
    
    // 本地模型配置
    'local': {
      status: 'online',
      modelPath: './models/local-model',
      defaultModel: 'llama-7b',
      supportedModels: ['llama-7b', 'bert-base'],
      supportedModelTypes: ['local'],
      maxConcurrentQueries: 10,
      baseCostPerQuery: 0.001,
      maxCostPerQuery: 0.01,
      timeout: 5000,
      retryCount: 0,
      costEfficiency: 0.9,
      capabilities: [
        'text_generation',
        'classification',
        'embedding'
      ]
    },
    
    // BERT 模型配置
    'bert': {
      status: 'online',
      modelPath: './models/bert',
      defaultModel: 'bert-base',
      supportedModels: ['bert-base', 'bert-large'],
      supportedModelTypes: ['local'],
      maxConcurrentQueries: 20,
      baseCostPerQuery: 0.0005,
      maxCostPerQuery: 0.005,
      timeout: 2000,
      retryCount: 0,
      costEfficiency: 0.95,
      capabilities: [
        'classification',
        'embedding',
        'token_classification'
      ]
    }
  },
  
  // 复杂度评估配置
  complexityEvaluation: {
    enableMachineLearning: true, // 启用机器学习模型
    modelPath: './models/complexity-model',
    features: [
      'length',
      'vocabulary_diversity',
      'grammar_complexity',
      'domain_knowledge',
      'multi_part_question'
    ],
    weights: {
      length: 0.2,
      vocabulary_diversity: 0.2,
      grammar_complexity: 0.2,
      domain_knowledge: 0.3,
      multi_part_question: 0.1
    },
    thresholds: {
      length: {
        short: 50,
        medium: 200,
        long: 500
      },
      vocabulary_diversity: {
        low: 0.3,
        medium: 0.5,
        high: 0.7
      }
    }
  },
  
  // 监控配置
  monitoring: {
    enabled: true,
    metricsInterval: 1000, // 指标收集间隔（毫秒）
    logLevel: 'info', // 日志级别：debug, info, warn, error
    alertThresholds: {
      error: {
        rate: 0.1, // 10% 错误率
        interval: 5 * 60 * 1000 // 5分钟
      },
      latency: {
        threshold: 2000, // 2秒
        percentile: 95 // 95th 百分位
      },
      cost: {
        daily: 1000, // $1000/天
        monthly: 20000 // $20000/月
      },
      memory: {
        usage: 0.9 // 90% 内存使用率
      },
      cpu: {
        usage: 0.8 // 80% CPU 使用率
      }
    },
    notifications: {
      email: {
        enabled: false,
        recipients: ['admin@example.com'],
        smtpConfig: {
          host: 'smtp.example.com',
          port: 587,
          secure: false,
          auth: {
            user: 'alerts@example.com',
            pass: 'your-password-here'
          }
        }
      },
      slack: {
        enabled: false,
        webhookUrl: 'https://hooks.slack.com/services/your-webhook-url'
      }
    }
  },
  
  // 缓存配置
  cache: {
    enabled: true,
    type: 'memory', // memory, redis
    ttl: 3600, // 缓存生存时间（秒）
    maxSize: 1000, // 最大缓存项数
    redis: {
      host: 'localhost',
      port: 6379,
      password: '',
      db: 0
    }
  },
  
  // 安全配置
  security: {
    enableRequestValidation: true,
    enableContentFiltering: true,
    maxQueryLength: 10000, // 最大查询长度
    sensitivePatterns: [
      /exec\s*\(/i,
      /eval\s*\(/i,
      /system\s*\(/i
    ],
    rateLimiting: {
      enabled: true,
      windowMs: 60000, // 1分钟
      maxRequests: 100 // 每个窗口最大请求数
    },
    authentication: {
      enabled: false,
      type: 'api_key', // api_key, jwt
      apiKeys: [
        'your-api-key-1',
        'your-api-key-2'
      ],
      jwt: {
        secret: 'your-jwt-secret',
        expiresIn: '1d'
      }
    }
  },
  
  // 日志配置
  logging: {
    level: 'info', // debug, info, warn, error
    format: 'json', // json, text
    destination: 'console', // console, file
    file: {
      path: './logs/gateway.log',
      maxSize: '10m',
      maxFiles: 5
    }
  }
};