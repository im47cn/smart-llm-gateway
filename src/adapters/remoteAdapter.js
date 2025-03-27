/**
 * 远程模型适配器基类
 * 为远程模型提供通用功能
 */
const axios = require('axios');
const { backOff } = require('exponential-backoff');
const { BaseModelAdapter } = require('./baseAdapter');
const { logger } = require('../utils/logger');
const { Errors } = require('../utils/errors');

class RemoteModelAdapter extends BaseModelAdapter {
  /**
   * 创建远程模型适配器
   * @param {string} providerName - 提供商名称
   * @param {Object} config - 适配器配置
   */
  constructor(providerName, config) {
    super(providerName, config);
    
    this.endpoint = config.endpoint;
    this.apiKey = config.apiKey;
    this.timeout = config.timeout || 60000;
    this.retryConfig = config.retryConfig || {
      maxRetries: 3,
      initialDelayMs: 1000
    };
    
    // 创建 axios 实例
    this.client = axios.create({
      baseURL: this.endpoint,
      timeout: this.timeout,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      }
    });
    
    // 成本追踪
    this.costTracking = {
      totalCost: 0,
      requestCount: 0,
      lastRequestCost: 0
    };
    
    logger.info(`初始化远程模型适配器: ${providerName}`, {
      endpoint: this.endpoint,
      timeout: this.timeout
    });
  }
  
  /**
   * 调用远程模型
   * @param {string} modelName - 模型名称
   * @param {Object} query - 查询对象
   * @param {Object} options - 调用选项
   * @returns {Promise<Object>} 模型响应
   */
  async callModel(modelName, query, options = {}) {
    this._checkConcurrencyLimit();
    this._recordConnectionStart();
    
    const startTime = Date.now();
    let success = false;
    let tokenUsage = { input: 0, output: 0, total: 0 };
    let cost = 0;
    
    try {
      // 准备请求数据
      const requestData = this._prepareRequestData(modelName, query, options);
      
      // 使用指数退避策略进行重试
      const response = await backOff(() => this._makeRequest(requestData), {
        numOfAttempts: this.retryConfig.maxRetries,
        startingDelay: this.retryConfig.initialDelayMs,
        timeMultiple: 2,
        retry: (error) => {
          // 判断是否应该重试
          const shouldRetry = this._shouldRetry(error);
          if (shouldRetry) {
            logger.warn(`调用远程模型失败，准备重试`, {
              provider: this.providerName,
              error: error.message
            });
          }
          return shouldRetry;
        }
      });
      
      // 处理响应
      const result = this._processResponse(response, query);
      
      // 计算token使用量
      tokenUsage = result.usage || this._calculateTokenUsage(query, result);
      
      // 计算成本
      cost = this._calculateCost(tokenUsage, modelName);
      
      // 更新成本追踪
      this._updateCostTracking(cost);
      
      success = true;
      return {
        text: result.text || result.response || result.result,
        model: modelName,
        provider: this.providerName,
        processingTime: Date.now() - startTime,
        tokenUsage,
        cost,
        rawResponse: result
      };
    } catch (error) {
      logger.error(`调用远程模型失败`, {
        provider: this.providerName,
        model: modelName,
        error: error.message
      });
      
      throw Errors.modelUnavailable(`调用远程模型 ${this.providerName} 失败: ${error.message}`);
    } finally {
      this._recordConnectionEnd();
      
      // 记录调用统计
      logger.debug(`远程模型调用完成`, {
        provider: this.providerName,
        model: modelName,
        success,
        processingTime: Date.now() - startTime,
        tokenUsage,
        cost
      });
    }
  }
  
  /**
   * 准备请求数据
   * @protected
   * @param {string} modelName - 模型名称
   * @param {Object} query - 查询对象
   * @param {Object} options - 调用选项
   * @returns {Object} 请求数据
   */
  _prepareRequestData(modelName, query, options) {
    // 基本实现，子类应该覆盖
    return {
      model: modelName,
      prompt: query.text,
      max_tokens: options.maxTokens || 1000,
      temperature: options.temperature || 0.7
    };
  }
  
  /**
   * 发送请求到远程模型服务
   * @protected
   * @param {Object} requestData - 请求数据
   * @returns {Promise<Object>} 响应数据
   */
  async _makeRequest(requestData) {
    try {
      const response = await this.client.post('/completions', requestData);
      return response.data;
    } catch (error) {
      this._handleRequestError(error);
    }
  }
  
  /**
   * 处理请求错误
   * @protected
   * @param {Error} error - 错误对象
   * @throws {Error} 处理后的错误
   */
  _handleRequestError(error) {
    if (error.response) {
      // 服务器响应了错误状态码
      const statusCode = error.response.status;
      const errorMessage = error.response.data.error || error.response.statusText;
      
      if (statusCode === 401 || statusCode === 403) {
        throw new Error(`认证错误: ${errorMessage}`);
      } else if (statusCode === 429) {
        throw new Error(`速率限制: ${errorMessage}`);
      } else if (statusCode >= 500) {
        throw new Error(`服务器错误: ${errorMessage}`);
      } else {
        throw new Error(`API错误 (${statusCode}): ${errorMessage}`);
      }
    } else if (error.request) {
      // 请求已发送但没有收到响应
      throw new Error(`请求超时或无响应: ${error.message}`);
    } else {
      // 请求配置出错
      throw new Error(`请求错误: ${error.message}`);
    }
  }
  
  /**
   * 判断是否应该重试请求
   * @protected
   * @param {Error} error - 错误对象
   * @returns {boolean} 是否应该重试
   */
  _shouldRetry(error) {
    // 默认重试服务器错误和超时
    if (!error.response) {
      // 网络错误或超时
      return true;
    }
    
    const statusCode = error.response.status;
    
    // 重试服务器错误和速率限制
    return statusCode >= 500 || statusCode === 429;
  }
  
  /**
   * 处理模型响应
   * @protected
   * @param {Object} response - 响应数据
   * @param {Object} query - 原始查询
   * @returns {Object} 处理后的响应
   */
  _processResponse(response, query) {
    // 基本实现，子类应该覆盖
    return response;
  }
  
  /**
   * 计算请求成本
   * @protected
   * @param {Object} tokenUsage - token使用量
   * @param {string} modelName - 模型名称
   * @returns {number} 请求成本
   */
  _calculateCost(tokenUsage, modelName) {
    // 基本实现，子类应该覆盖
    const baseCost = this.config.baseCostPerQuery || 0.002;
    return baseCost * (tokenUsage.total / 1000);
  }
  
  /**
   * 更新成本追踪
   * @private
   * @param {number} cost - 请求成本
   */
  _updateCostTracking(cost) {
    this.costTracking.totalCost += cost;
    this.costTracking.requestCount += 1;
    this.costTracking.lastRequestCost = cost;
    
    logger.debug(`更新成本追踪`, {
      provider: this.providerName,
      lastCost: cost,
      totalCost: this.costTracking.totalCost,
      requestCount: this.costTracking.requestCount
    });
  }
  
  /**
   * 获取成本追踪信息
   * @returns {Object} 成本追踪信息
   */
  getCostTracking() {
    return {
      ...this.costTracking,
      averageCost: this.costTracking.requestCount > 0 
        ? this.costTracking.totalCost / this.costTracking.requestCount 
        : 0
    };
  }
}

module.exports = { RemoteModelAdapter };