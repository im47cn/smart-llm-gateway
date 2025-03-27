/**
 * 本地模型适配器基类
 * 为本地模型提供通用功能
 */
const axios = require('axios');
const { backOff } = require('exponential-backoff');
const { BaseModelAdapter } = require('./baseAdapter');
const { logger } = require('../utils/logger');
const { Errors } = require('../utils/errors');

class LocalModelAdapter extends BaseModelAdapter {
  /**
   * 创建本地模型适配器
   * @param {string} providerName - 提供商名称
   * @param {Object} config - 适配器配置
   */
  constructor(providerName, config) {
    super(providerName, config);
    
    this.endpoint = config.endpoint;
    this.timeout = config.timeout || 30000;
    this.retryConfig = config.retryConfig || {
      maxRetries: 2,
      initialDelayMs: 1000
    };
    
    // 创建 axios 实例
    this.client = axios.create({
      baseURL: this.endpoint,
      timeout: this.timeout,
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    logger.info(`初始化本地模型适配器: ${providerName}`, {
      endpoint: this.endpoint,
      timeout: this.timeout
    });
  }
  
  /**
   * 调用本地模型
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
    
    try {
      // 准备请求数据
      const requestData = this._prepareRequestData(modelName, query, options);
      
      // 使用指数退避策略进行重试
      const response = await backOff(() => this._makeRequest(requestData), {
        numOfAttempts: this.retryConfig.maxRetries,
        startingDelay: this.retryConfig.initialDelayMs,
        timeMultiple: 2,
        retry: (error) => {
          logger.warn(`调用本地模型失败，准备重试`, {
            provider: this.providerName,
            error: error.message
          });
          return true;
        }
      });
      
      // 处理响应
      const result = this._processResponse(response, query);
      
      // 计算token使用量（简化实现）
      tokenUsage = this._calculateTokenUsage(query, result);
      
      success = true;
      return {
        text: result.text || result.response || result.result,
        model: modelName,
        provider: this.providerName,
        processingTime: Date.now() - startTime,
        tokenUsage,
        rawResponse: result
      };
    } catch (error) {
      logger.error(`调用本地模型失败`, {
        provider: this.providerName,
        model: modelName,
        error: error.message
      });
      
      throw Errors.modelUnavailable(`调用本地模型 ${this.providerName} 失败: ${error.message}`);
    } finally {
      this._recordConnectionEnd();
      
      // 记录调用统计
      logger.debug(`本地模型调用完成`, {
        provider: this.providerName,
        model: modelName,
        success,
        processingTime: Date.now() - startTime,
        tokenUsage
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
    // 基本实现，子类可以覆盖
    return {
      model: modelName,
      query: query.text,
      options: {
        ...options,
        max_tokens: options.maxTokens || 1000,
        temperature: options.temperature || 0.7
      }
    };
  }
  
  /**
   * 发送请求到本地模型服务
   * @private
   * @param {Object} requestData - 请求数据
   * @returns {Promise<Object>} 响应数据
   */
  async _makeRequest(requestData) {
    try {
      const response = await this.client.post('/generate', requestData);
      return response.data;
    } catch (error) {
      if (error.response) {
        // 服务器响应了错误状态码
        throw new Error(`服务器错误: ${error.response.status} - ${error.response.data.error || error.response.statusText}`);
      } else if (error.request) {
        // 请求已发送但没有收到响应
        throw new Error(`无响应: ${error.message}`);
      } else {
        // 请求配置出错
        throw new Error(`请求错误: ${error.message}`);
      }
    }
  }
  
  /**
   * 处理模型响应
   * @protected
   * @param {Object} response - 响应数据
   * @param {Object} query - 原始查询
   * @returns {Object} 处理后的响应
   */
  _processResponse(response, query) {
    // 基本实现，子类可以覆盖
    return response;
  }
  
  /**
   * 计算token使用量
   * @private
   * @param {Object} query - 查询对象
   * @param {Object} result - 响应结果
   * @returns {Object} token使用量
   */
  _calculateTokenUsage(query, result) {
    // 简化实现，实际应从模型响应中获取或使用更准确的计算方法
    const inputTokens = query.text ? Math.ceil(query.text.length / 4) : 0;
    const outputText = result.text || result.response || result.result || '';
    const outputTokens = Math.ceil(outputText.length / 4);
    
    return {
      input: inputTokens,
      output: outputTokens,
      total: inputTokens + outputTokens
    };
  }
}

module.exports = { LocalModelAdapter };