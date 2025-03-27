/**
 * 模型路由服务
 * 负责根据查询复杂度和其他因素选择最合适的模型
 */
const { logger } = require('../utils/logger');
const { Errors } = require('../utils/errors');
const config = require('../config');

/**
 * 模型路由服务类
 */
class ModelRouterService {
  constructor() {
    this.routingStrategy = config.routingStrategy;
    this.modelProviders = config.modelProviders;
    this.activeConnections = new Map(); // 跟踪活跃连接数
    this.modelStats = new Map(); // 跟踪模型性能统计
  }

  /**
   * 根据复杂度选择模型
   * @param {number} complexityScore - 复杂度评分
   * @param {Array} complexityFactors - 复杂度因素
   * @param {Object} metadata - 请求元数据
   * @returns {Object} 选择的模型信息
   */
  selectModelByComplexity(complexityScore, complexityFactors, metadata) {
    logger.debug('根据复杂度选择模型', { complexityScore, complexityFactors });

    // 获取复杂度阈值
    const { lowComplexityThreshold, highComplexityThreshold } = this.routingStrategy;

    // 根据复杂度范围选择模型类型
    let modelType;
    if (complexityScore < lowComplexityThreshold) {
      modelType = 'local'; // 低复杂度：本地模型
    } else if (complexityScore < highComplexityThreshold) {
      modelType = 'hybrid'; // 中等复杂度：混合模型
    } else {
      modelType = 'remote'; // 高复杂度：远程高性能模型
    }

    // 获取可用的模型提供商
    const availableProviders = this.getAvailableProviders(modelType, metadata);
    
    if (availableProviders.length === 0) {
      throw Errors.modelUnavailable(`没有可用的${modelType}类型模型提供商`);
    }

    // 选择最佳模型提供商
    const selectedProvider = this.selectBestProvider(availableProviders, complexityScore, metadata);
    
    logger.info('已选择模型', { 
      provider: selectedProvider.name, 
      modelType, 
      complexityScore 
    });

    return {
      provider: selectedProvider.name,
      modelType,
      modelConfig: selectedProvider.config,
      estimatedCost: this.estimateCost(selectedProvider.config, complexityScore, metadata)
    };
  }

  /**
   * 获取可用的模型提供商
   * @param {string} modelType - 模型类型
   * @param {Object} metadata - 请求元数据
   * @returns {Array} 可用的提供商列表
   */
  getAvailableProviders(modelType, metadata) {
    // 根据模型类型筛选提供商
    const providers = Object.entries(this.modelProviders)
      .filter(([name, config]) => {
        // 检查提供商是否支持所需的模型类型
        const supportsModelType = config.supportedModelTypes 
          ? config.supportedModelTypes.includes(modelType)
          : true; // 默认支持所有类型
        
        // 检查提供商是否在线
        const isOnline = config.status !== 'offline';
        
        // 检查是否超出并发限制
        const currentConnections = this.activeConnections.get(name) || 0;
        const withinConnectionLimit = currentConnections < (config.maxConcurrentQueries || 10);
        
        return supportsModelType && isOnline && withinConnectionLimit;
      })
      .map(([name, config]) => ({ name, config }));
    
    return providers;
  }

  /**
   * 选择最佳提供商
   * @param {Array} providers - 可用提供商列表
   * @param {number} complexityScore - 复杂度评分
   * @param {Object} metadata - 请求元数据
   * @returns {Object} 选择的提供商
   */
  selectBestProvider(providers, complexityScore, metadata) {
    // 如果只有一个提供商，直接返回
    if (providers.length === 1) {
      return providers[0];
    }

    // 计算每个提供商的得分
    const scoredProviders = providers.map(provider => {
      // 获取性能统计
      const stats = this.modelStats.get(provider.name) || {
        avgResponseTime: 500, // 默认值
        successRate: 0.95,    // 默认值
        costEfficiency: 0.8   // 默认值
      };
      
      // 计算负载均衡因子
      const currentLoad = this.activeConnections.get(provider.name) || 0;
      const maxLoad = provider.config.maxConcurrentQueries || 10;
      const loadFactor = 1 - (currentLoad / maxLoad);
      
      // 计算成本因子
      const costFactor = provider.config.costEfficiency || 0.5;
      
      // 计算性能因子
      const performanceFactor = stats.successRate * (1000 / (stats.avgResponseTime + 100));
      
      // 计算总得分 (权重可以根据需要调整)
      const score = (loadFactor * 0.4) + (costFactor * 0.3) + (performanceFactor * 0.3);
      
      return { ...provider, score };
    });
    
    // 按得分排序并返回最高分的提供商
    scoredProviders.sort((a, b) => b.score - a.score);
    return scoredProviders[0];
  }

  /**
   * 估算查询成本
   * @param {Object} modelConfig - 模型配置
   * @param {number} complexityScore - 复杂度评分
   * @param {Object} metadata - 请求元数据
   * @returns {number} 估算成本
   */
  estimateCost(modelConfig, complexityScore, metadata) {
    // 基础成本
    const baseCost = modelConfig.baseCostPerQuery || 0.001;
    
    // 根据复杂度调整成本
    const complexityFactor = 1 + complexityScore;
    
    // 根据查询长度调整成本
    const queryLength = metadata.queryLength || 0;
    const lengthFactor = 1 + (queryLength / 1000);
    
    // 计算估算成本
    const estimatedCost = baseCost * complexityFactor * lengthFactor;
    
    // 确保不超过最大成本限制
    const maxCost = modelConfig.maxCostPerQuery || 0.1;
    return Math.min(estimatedCost, maxCost);
  }

  /**
   * 记录模型使用开始
   * @param {string} providerName - 提供商名称
   */
  recordModelUseStart(providerName) {
    const currentCount = this.activeConnections.get(providerName) || 0;
    this.activeConnections.set(providerName, currentCount + 1);
    logger.debug('模型使用开始', { provider: providerName, activeConnections: currentCount + 1 });
  }

  /**
   * 记录模型使用结束
   * @param {string} providerName - 提供商名称
   * @param {Object} stats - 使用统计
   */
  recordModelUseEnd(providerName, stats) {
    // 更新活跃连接数
    const currentCount = this.activeConnections.get(providerName) || 1;
    this.activeConnections.set(providerName, Math.max(0, currentCount - 1));
    
    // 更新性能统计
    if (stats) {
      const currentStats = this.modelStats.get(providerName) || {
        avgResponseTime: 0,
        successRate: 1,
        costEfficiency: 0.5,
        totalCalls: 0
      };
      
      const totalCalls = currentStats.totalCalls + 1;
      
      // 计算移动平均
      const newStats = {
        avgResponseTime: ((currentStats.avgResponseTime * currentStats.totalCalls) + stats.responseTime) / totalCalls,
        successRate: ((currentStats.successRate * currentStats.totalCalls) + (stats.success ? 1 : 0)) / totalCalls,
        costEfficiency: ((currentStats.costEfficiency * currentStats.totalCalls) + stats.costEfficiency) / totalCalls,
        totalCalls
      };
      
      this.modelStats.set(providerName, newStats);
    }
    
    logger.debug('模型使用结束', { provider: providerName });
  }

  /**
   * 获取备用模型
   * @param {string} primaryProvider - 主要提供商名称
   * @param {string} modelType - 模型类型
   * @param {Object} metadata - 请求元数据
   * @returns {Object} 备用模型信息
   */
  getBackupModel(primaryProvider, modelType, metadata) {
    // 获取除主要提供商外的其他可用提供商
    const availableProviders = this.getAvailableProviders(modelType, metadata)
      .filter(provider => provider.name !== primaryProvider);
    
    if (availableProviders.length === 0) {
      // 如果没有其他同类型的提供商，尝试降级到更简单的模型类型
      const fallbackTypes = {
        'remote': 'hybrid',
        'hybrid': 'local'
      };
      
      const fallbackType = fallbackTypes[modelType];
      if (fallbackType) {
        return this.getBackupModel(primaryProvider, fallbackType, metadata);
      }
      
      // 如果没有备用选项，返回null
      return null;
    }
    
    // 选择最佳备用提供商
    const backupProvider = this.selectBestProvider(availableProviders, 0.5, metadata);
    
    return {
      provider: backupProvider.name,
      modelType,
      modelConfig: backupProvider.config,
      isBackup: true
    };
  }

  /**
   * 应用成本控制策略
   * @param {Object} modelInfo - 模型信息
   * @param {Object} metadata - 请求元数据
   * @returns {Object} 可能被调整的模型信息
   */
  applyCostControlStrategy(modelInfo, metadata) {
    // 检查是否超出预算限制
    const budget = metadata.budget ? parseFloat(metadata.budget) : Infinity;
    
    if (modelInfo.estimatedCost > budget) {
      logger.warn('估算成本超出预算', { 
        estimatedCost: modelInfo.estimatedCost, 
        budget 
      });
      
      // 尝试找到更便宜的模型
      const fallbackTypes = {
        'remote': 'hybrid',
        'hybrid': 'local'
      };
      
      const fallbackType = fallbackTypes[modelInfo.modelType];
      if (fallbackType) {
        // 获取降级模型类型的提供商
        const availableProviders = this.getAvailableProviders(fallbackType, metadata);
        
        if (availableProviders.length > 0) {
          const cheaperProvider = this.selectBestProvider(availableProviders, 0.5, metadata);
          const cheaperCost = this.estimateCost(cheaperProvider.config, 0.5, metadata);
          
          if (cheaperCost <= budget) {
            logger.info('已切换到更便宜的模型', { 
              newProvider: cheaperProvider.name, 
              newCost: cheaperCost 
            });
            
            return {
              provider: cheaperProvider.name,
              modelType: fallbackType,
              modelConfig: cheaperProvider.config,
              estimatedCost: cheaperCost,
              costControlled: true
            };
          }
        }
      }
      
      // 如果找不到更便宜的模型，抛出错误
      throw Errors.costLimitExceeded(`估算成本 ${modelInfo.estimatedCost} 超出预算 ${budget}`);
    }
    
    return modelInfo;
  }
}

// 创建单例实例
const modelRouterService = new ModelRouterService();

module.exports = modelRouterService;