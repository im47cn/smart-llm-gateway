/**
 * 基础模型适配器接口
 * 所有模型适配器必须实现这个接口
 */
const { Errors } = require('../utils/errors');
const { logger } = require('../utils/logger');

/**
 * 基础模型适配器类
 * @abstract
 */
class BaseModelAdapter {
  /**
   * 创建适配器实例
   * @param {string} providerName - 提供商名称
   * @param {Object} config - 适配器配置
   */
  constructor(providerName, config) {
    if (new.target === BaseModelAdapter) {
      throw new Error('BaseModelAdapter 是抽象类，不能直接实例化');
    }
    
    this.providerName = providerName;
    this.config = config;
    this.activeConnections = 0;
    this.maxConcurrentQueries = config.maxConcurrentQueries || 10;
    
    logger.info(`初始化 ${providerName} 适配器`);
  }
  
  /**
   * 调用模型处理查询
   * @abstract
   * @param {string} modelName - 模型名称
   * @param {Object} query - 查询对象
   * @param {Object} options - 调用选项
   * @returns {Promise<Object>} 模型响应
   */
  async callModel(modelName, query, options = {}) {
    throw new Error('子类必须实现 callModel 方法');
  }
  
  /**
   * 检查适配器是否可用
   * @returns {boolean} 是否可用
   */
  isAvailable() {
    return this.activeConnections < this.maxConcurrentQueries && 
           this.config.status !== 'offline';
  }
  
  /**
   * 获取适配器支持的能力
   * @returns {Array<string>} 支持的能力列表
   */
  getCapabilities() {
    return this.config.supportedCapabilities || [];
  }
  
  /**
   * 获取适配器类型
   * @returns {string} 适配器类型 (local, hybrid, remote)
   */
  getType() {
    return this.config.type;
  }
  
  /**
   * 获取适配器支持的模型类型
   * @returns {Array<string>} 支持的模型类型列表
   */
  getSupportedModelTypes() {
    return this.config.supportedModelTypes || [];
  }
  
  /**
   * 记录连接开始
   * @protected
   */
  _recordConnectionStart() {
    this.activeConnections++;
    logger.debug(`${this.providerName} 活跃连接数: ${this.activeConnections}`);
  }
  
  /**
   * 记录连接结束
   * @protected
   */
  _recordConnectionEnd() {
    this.activeConnections = Math.max(0, this.activeConnections - 1);
    logger.debug(`${this.providerName} 活跃连接数: ${this.activeConnections}`);
  }
  
  /**
   * 检查并发限制
   * @protected
   * @throws {GatewayError} 如果超出并发限制
   */
  _checkConcurrencyLimit() {
    if (this.activeConnections >= this.maxConcurrentQueries) {
      throw Errors.modelUnavailable(`${this.providerName} 超出并发限制`);
    }
  }
  
  /**
   * 估算查询成本
   * @param {string} modelName - 模型名称
   * @param {Object} query - 查询对象
   * @returns {number} 估算成本
   */
  estimateCost(modelName, query) {
    // 基础成本
    const baseCost = this.config.baseCostPerQuery || 0.001;
    
    // 根据查询长度调整成本
    const queryLength = query.text ? query.text.length : 0;
    const lengthFactor = 1 + (queryLength / 1000);
    
    // 计算估算成本
    const estimatedCost = baseCost * lengthFactor;
    
    // 确保不超过最大成本限制
    const maxCost = this.config.maxCostPerQuery || 0.1;
    return Math.min(estimatedCost, maxCost);
  }
}

module.exports = { BaseModelAdapter };