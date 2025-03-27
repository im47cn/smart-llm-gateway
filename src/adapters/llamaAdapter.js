/**
 * Llama 本地模型适配器
 * 用于与本地部署的 Llama 模型通信
 */
const { LocalModelAdapter } = require('./localAdapter');
const { logger } = require('../utils/logger');

class LlamaAdapter extends LocalModelAdapter {
  /**
   * 创建 Llama 适配器
   * @param {string} providerName - 提供商名称
   * @param {Object} config - 适配器配置
   */
  constructor(providerName, config) {
    super(providerName, config);
    
    // Llama 特定配置
    this.defaultModel = config.defaultModel || 'llama2-7b';
    this.supportedModels = config.supportedModels || ['llama2-7b', 'llama2-13b', 'llama2-70b'];
    
    logger.info(`初始化 Llama 适配器`, {
      defaultModel: this.defaultModel,
      supportedModels: this.supportedModels
    });
  }
  
  /**
   * 准备请求数据
   * @protected
   * @override
   * @param {string} modelName - 模型名称
   * @param {Object} query - 查询对象
   * @param {Object} options - 调用选项
   * @returns {Object} 请求数据
   */
  _prepareRequestData(modelName, query, options) {
    // 使用指定的模型或默认模型
    const model = this.supportedModels.includes(modelName) ? modelName : this.defaultModel;
    
    // Llama 特定的请求格式
    return {
      model,
      prompt: query.text,
      max_tokens: options.maxTokens || 1000,
      temperature: options.temperature || 0.7,
      top_p: options.topP || 0.9,
      stop: options.stopSequences || [],
      stream: false
    };
  }
  
  /**
   * 处理模型响应
   * @protected
   * @override
   * @param {Object} response - 响应数据
   * @param {Object} query - 原始查询
   * @returns {Object} 处理后的响应
   */
  _processResponse(response, query) {
    // Llama 特定的响应处理
    if (!response || !response.generated_text) {
      logger.warn('Llama 响应格式异常', { response });
      return { text: '模型响应格式异常', error: true };
    }
    
    return {
      text: response.generated_text,
      usage: response.usage || {
        prompt_tokens: Math.ceil(query.text.length / 4),
        completion_tokens: Math.ceil(response.generated_text.length / 4),
        total_tokens: Math.ceil((query.text.length + response.generated_text.length) / 4)
      }
    };
  }
  
  /**
   * 发送请求到 Llama 服务
   * @private
   * @override
   * @param {Object} requestData - 请求数据
   * @returns {Promise<Object>} 响应数据
   */
  async _makeRequest(requestData) {
    try {
      // Llama 使用不同的端点
      const response = await this.client.post('/completions', requestData);
      return response.data;
    } catch (error) {
      if (error.response) {
        // 服务器响应了错误状态码
        throw new Error(`Llama 服务器错误: ${error.response.status} - ${error.response.data.error || error.response.statusText}`);
      } else if (error.request) {
        // 请求已发送但没有收到响应
        throw new Error(`Llama 服务无响应: ${error.message}`);
      } else {
        // 请求配置出错
        throw new Error(`Llama 请求错误: ${error.message}`);
      }
    }
  }
}

module.exports = { LlamaAdapter };