/**
 * OpenAI 远程模型适配器
 * 用于与 OpenAI API 通信
 */
const { RemoteModelAdapter } = require('./remoteAdapter');
const { logger } = require('../utils/logger');

class OpenAIAdapter extends RemoteModelAdapter {
  /**
   * 创建 OpenAI 适配器
   * @param {string} providerName - 提供商名称
   * @param {Object} config - 适配器配置
   */
  constructor(providerName, config) {
    super(providerName, config);
    
    // OpenAI 特定配置
    this.defaultModel = config.defaultModel || 'gpt-3.5-turbo';
    this.modelPricing = config.modelPricing || {
      'gpt-3.5-turbo': {
        inputPrice: 0.0015,  // 每1000个输入token的价格
        outputPrice: 0.002   // 每1000个输出token的价格
      },
      'gpt-4': {
        inputPrice: 0.03,
        outputPrice: 0.06
      },
      'gpt-4-turbo': {
        inputPrice: 0.01,
        outputPrice: 0.03
      }
    };
    
    logger.info(`初始化 OpenAI 适配器`, {
      defaultModel: this.defaultModel,
      availableModels: Object.keys(this.modelPricing)
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
    const model = this.modelPricing[modelName] ? modelName : this.defaultModel;
    
    // 检查是否是聊天模型
    const isChatModel = model.includes('gpt');
    
    if (isChatModel) {
      // 聊天模型请求格式
      const messages = [];
      
      // 添加系统消息（如果有）
      if (options.systemMessage) {
        messages.push({
          role: 'system',
          content: options.systemMessage
        });
      }
      
      // 添加上下文消息（如果有）
      if (query.context && Array.isArray(query.context)) {
        messages.push(...query.context);
      }
      
      // 添加用户消息
      messages.push({
        role: 'user',
        content: query.text
      });
      
      return {
        model,
        messages,
        max_tokens: options.maxTokens || 1000,
        temperature: options.temperature || 0.7,
        top_p: options.topP || 1,
        n: options.n || 1,
        stream: false,
        stop: options.stopSequences || null,
        presence_penalty: options.presencePenalty || 0,
        frequency_penalty: options.frequencyPenalty || 0
      };
    } else {
      // 完成模型请求格式
      return {
        model,
        prompt: query.text,
        max_tokens: options.maxTokens || 1000,
        temperature: options.temperature || 0.7,
        top_p: options.topP || 1,
        n: options.n || 1,
        stream: false,
        stop: options.stopSequences || null,
        presence_penalty: options.presencePenalty || 0,
        frequency_penalty: options.frequencyPenalty || 0
      };
    }
  }
  
  /**
   * 发送请求到 OpenAI API
   * @protected
   * @override
   * @param {Object} requestData - 请求数据
   * @returns {Promise<Object>} 响应数据
   */
  async _makeRequest(requestData) {
    try {
      // 根据请求类型选择不同的端点
      const endpoint = requestData.messages ? '/chat/completions' : '/completions';
      const response = await this.client.post(endpoint, requestData);
      return response.data;
    } catch (error) {
      this._handleRequestError(error);
    }
  }
  
  /**
   * 处理 OpenAI 响应
   * @protected
   * @override
   * @param {Object} response - 响应数据
   * @param {Object} query - 原始查询
   * @returns {Object} 处理后的响应
   */
  _processResponse(response, query) {
    // 检查响应格式
    if (!response || !response.choices || response.choices.length === 0) {
      logger.warn('OpenAI 响应格式异常', { response });
      return { text: '模型响应格式异常', error: true };
    }
    
    // 提取响应文本
    let text;
    if (response.choices[0].message) {
      // 聊天模型响应
      text = response.choices[0].message.content;
    } else {
      // 完成模型响应
      text = response.choices[0].text;
    }
    
    return {
      text,
      model: response.model,
      usage: response.usage,
      finishReason: response.choices[0].finish_reason
    };
  }
  
  /**
   * 计算请求成本
   * @protected
   * @override
   * @param {Object} tokenUsage - token使用量
   * @param {string} modelName - 模型名称
   * @returns {number} 请求成本
   */
  _calculateCost(tokenUsage, modelName) {
    // 获取模型价格
    const pricing = this.modelPricing[modelName] || this.modelPricing[this.defaultModel];
    
    // 计算输入和输出成本
    const inputCost = (tokenUsage.input / 1000) * pricing.inputPrice;
    const outputCost = (tokenUsage.output / 1000) * pricing.outputPrice;
    
    // 总成本
    return inputCost + outputCost;
  }
  
  /**
   * 处理 OpenAI 特定的错误
   * @protected
   * @override
   * @param {Error} error - 错误对象
   */
  _handleRequestError(error) {
    if (error.response) {
      const statusCode = error.response.status;
      const errorData = error.response.data.error || {};
      const errorType = errorData.type || '';
      const errorMessage = errorData.message || error.response.statusText;
      
      if (statusCode === 401) {
        throw new Error(`OpenAI 认证错误: ${errorMessage}`);
      } else if (statusCode === 429) {
        if (errorType.includes('rate_limit')) {
          throw new Error(`OpenAI 速率限制: ${errorMessage}`);
        } else if (errorType.includes('quota')) {
          throw new Error(`OpenAI 配额超限: ${errorMessage}`);
        } else {
          throw new Error(`OpenAI 请求过多: ${errorMessage}`);
        }
      } else if (statusCode >= 500) {
        throw new Error(`OpenAI 服务器错误: ${errorMessage}`);
      } else {
        throw new Error(`OpenAI API错误 (${statusCode}): ${errorMessage}`);
      }
    } else if (error.request) {
      throw new Error(`OpenAI 请求超时或无响应: ${error.message}`);
    } else {
      throw new Error(`OpenAI 请求错误: ${error.message}`);
    }
  }
  
  /**
   * 判断是否应该重试 OpenAI 请求
   * @protected
   * @override
   * @param {Error} error - 错误对象
   * @returns {boolean} 是否应该重试
   */
  _shouldRetry(error) {
    if (!error.response) {
      // 网络错误或超时
      return true;
    }
    
    const statusCode = error.response.status;
    
    // 重试服务器错误和某些速率限制
    if (statusCode >= 500) {
      return true;
    }
    
    if (statusCode === 429) {
      // 只重试速率限制错误，不重试配额超限
      const errorType = error.response.data.error?.type || '';
      return errorType.includes('rate_limit') && !errorType.includes('quota');
    }
    
    return false;
  }
}

module.exports = { OpenAIAdapter };