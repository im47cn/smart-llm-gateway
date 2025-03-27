/**
 * Anthropic 远程模型适配器
 * 用于与 Anthropic API 通信
 */
const { RemoteModelAdapter } = require('./remoteAdapter');
const { logger } = require('../utils/logger');

class AnthropicAdapter extends RemoteModelAdapter {
  /**
   * 创建 Anthropic 适配器
   * @param {string} providerName - 提供商名称
   * @param {Object} config - 适配器配置
   */
  constructor(providerName, config) {
    super(providerName, config);
    
    // Anthropic 特定配置
    this.defaultModel = config.defaultModel || 'claude-2';
    this.modelPricing = config.modelPricing || {
      'claude-2': {
        inputPrice: 0.008,  // 每1000个输入token的价格
        outputPrice: 0.024   // 每1000个输出token的价格
      },
      'claude-instant-1': {
        inputPrice: 0.0016,
        outputPrice: 0.0055
      },
      'claude-3-opus': {
        inputPrice: 0.015,
        outputPrice: 0.075
      },
      'claude-3-sonnet': {
        inputPrice: 0.003,
        outputPrice: 0.015
      },
      'claude-3-haiku': {
        inputPrice: 0.00025,
        outputPrice: 0.00125
      }
    };
    
    // 覆盖默认的请求头
    this.client.defaults.headers.common['x-api-key'] = this.apiKey;
    this.client.defaults.headers.common['anthropic-version'] = '2023-06-01';
    
    logger.info(`初始化 Anthropic 适配器`, {
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
    
    // 构建提示
    let prompt = '';
    
    // 添加系统提示（如果有）
    if (options.systemMessage) {
      prompt = `\n\nHuman: ${options.systemMessage}\n\nAssistant: I'll follow these instructions.\n\n`;
    }
    
    // 添加上下文（如果有）
    if (query.context && Array.isArray(query.context)) {
      for (const message of query.context) {
        if (message.role === 'user' || message.role === 'human') {
          prompt += `Human: ${message.content}\n\n`;
        } else if (message.role === 'assistant' || message.role === 'ai') {
          prompt += `Assistant: ${message.content}\n\n`;
        }
      }
    }
    
    // 添加当前查询
    prompt += `Human: ${query.text}\n\nAssistant:`;
    
    // 检查是否使用新的 Claude 3 API
    const isClaude3 = model.includes('claude-3');
    
    if (isClaude3) {
      // Claude 3 使用消息格式
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
        for (const message of query.context) {
          const role = message.role === 'user' || message.role === 'human' ? 'user' : 
                      (message.role === 'assistant' || message.role === 'ai' ? 'assistant' : message.role);
          
          messages.push({
            role,
            content: message.content
          });
        }
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
        stream: false,
        stop_sequences: options.stopSequences || []
      };
    } else {
      // 旧版 Claude API
      return {
        model,
        prompt,
        max_tokens_to_sample: options.maxTokens || 1000,
        temperature: options.temperature || 0.7,
        top_p: options.topP || 1,
        stream: false,
        stop_sequences: options.stopSequences || ["\n\nHuman:"]
      };
    }
  }
  
  /**
   * 发送请求到 Anthropic API
   * @protected
   * @override
   * @param {Object} requestData - 请求数据
   * @returns {Promise<Object>} 响应数据
   */
  async _makeRequest(requestData) {
    try {
      // 根据请求类型选择不同的端点
      const endpoint = requestData.messages ? '/v1/messages' : '/v1/complete';
      const response = await this.client.post(endpoint, requestData);
      return response.data;
    } catch (error) {
      this._handleRequestError(error);
    }
  }
  
  /**
   * 处理 Anthropic 响应
   * @protected
   * @override
   * @param {Object} response - 响应数据
   * @param {Object} query - 原始查询
   * @returns {Object} 处理后的响应
   */
  _processResponse(response, query) {
    // 检查响应格式
    if (!response) {
      logger.warn('Anthropic 响应为空');
      return { text: '模型响应为空', error: true };
    }
    
    // 提取响应文本
    let text;
    let usage = { input: 0, output: 0, total: 0 };
    
    if (response.content) {
      // Claude 3 消息格式
      text = response.content[0].text;
      
      // 提取使用量
      if (response.usage) {
        usage = {
          input: response.usage.input_tokens,
          output: response.usage.output_tokens,
          total: response.usage.input_tokens + response.usage.output_tokens
        };
      }
    } else if (response.completion) {
      // 旧版 Claude 完成格式
      text = response.completion;
      
      // 估算使用量（旧版API不提供精确使用量）
      const inputTokens = Math.ceil((query.text || '').length / 4);
      const outputTokens = Math.ceil(text.length / 4);
      
      usage = {
        input: inputTokens,
        output: outputTokens,
        total: inputTokens + outputTokens
      };
    } else {
      logger.warn('Anthropic 响应格式异常', { response });
      return { text: '模型响应格式异常', error: true };
    }
    
    return {
      text,
      model: response.model,
      usage,
      stopReason: response.stop_reason || response.stop_sequence
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
   * 处理 Anthropic 特定的错误
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
        throw new Error(`Anthropic 认证错误: ${errorMessage}`);
      } else if (statusCode === 429) {
        throw new Error(`Anthropic 速率限制: ${errorMessage}`);
      } else if (statusCode >= 500) {
        throw new Error(`Anthropic 服务器错误: ${errorMessage}`);
      } else {
        throw new Error(`Anthropic API错误 (${statusCode}): ${errorMessage}`);
      }
    } else if (error.request) {
      throw new Error(`Anthropic 请求超时或无响应: ${error.message}`);
    } else {
      throw new Error(`Anthropic 请求错误: ${error.message}`);
    }
  }
  
  /**
   * 判断是否应该重试 Anthropic 请求
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
    
    // 重试服务器错误和速率限制
    return statusCode >= 500 || statusCode === 429;
  }
}

module.exports = { AnthropicAdapter };