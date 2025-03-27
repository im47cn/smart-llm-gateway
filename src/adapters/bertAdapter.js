/**
 * BERT 本地模型适配器
 * 用于与本地部署的 BERT 模型通信
 */
const { LocalModelAdapter } = require('./localAdapter');
const { logger } = require('../utils/logger');

class BertAdapter extends LocalModelAdapter {
  /**
   * 创建 BERT 适配器
   * @param {string} providerName - 提供商名称
   * @param {Object} config - 适配器配置
   */
  constructor(providerName, config) {
    super(providerName, config);
    
    // BERT 特定配置
    this.defaultModel = config.defaultModel || 'bert-base';
    this.supportedModels = config.supportedModels || ['bert-base', 'bert-large', 'distilbert'];
    this.supportedTasks = config.supportedTasks || ['classification', 'embedding', 'ner'];
    
    logger.info(`初始化 BERT 适配器`, {
      defaultModel: this.defaultModel,
      supportedModels: this.supportedModels,
      supportedTasks: this.supportedTasks
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
    
    // 确定任务类型
    const task = options.task || 'classification';
    if (!this.supportedTasks.includes(task)) {
      logger.warn(`不支持的任务类型: ${task}，将使用默认任务类型: classification`);
    }
    
    // BERT 特定的请求格式
    const requestData = {
      model,
      text: query.text,
      task: this.supportedTasks.includes(task) ? task : 'classification'
    };
    
    // 根据任务类型添加特定参数
    if (task === 'classification') {
      requestData.labels = options.labels || [];
    } else if (task === 'embedding') {
      requestData.pooling = options.pooling || 'mean';
    } else if (task === 'ner') {
      requestData.entities = options.entities || [];
    }
    
    return requestData;
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
    // BERT 特定的响应处理
    if (!response) {
      logger.warn('BERT 响应为空');
      return { text: '模型响应为空', error: true };
    }
    
    // 根据任务类型处理响应
    const task = response.task || 'classification';
    
    if (task === 'classification') {
      // 分类任务
      if (!response.classifications || !Array.isArray(response.classifications)) {
        logger.warn('BERT 分类响应格式异常', { response });
        return { text: '分类结果格式异常', error: true };
      }
      
      // 格式化分类结果
      const classifications = response.classifications.map(c => `${c.label}: ${(c.score * 100).toFixed(2)}%`);
      return {
        text: `分类结果:\n${classifications.join('\n')}`,
        classifications: response.classifications,
        task
      };
    } else if (task === 'embedding') {
      // 嵌入任务
      if (!response.embedding || !Array.isArray(response.embedding)) {
        logger.warn('BERT 嵌入响应格式异常', { response });
        return { text: '嵌入结果格式异常', error: true };
      }
      
      return {
        text: `生成了 ${response.embedding.length} 维嵌入向量`,
        embedding: response.embedding,
        task
      };
    } else if (task === 'ner') {
      // 命名实体识别任务
      if (!response.entities || !Array.isArray(response.entities)) {
        logger.warn('BERT NER 响应格式异常', { response });
        return { text: '实体识别结果格式异常', error: true };
      }
      
      // 格式化实体识别结果
      const entities = response.entities.map(e => `${e.text} (${e.type}): ${(e.score * 100).toFixed(2)}%`);
      return {
        text: `识别到的实体:\n${entities.join('\n')}`,
        entities: response.entities,
        task
      };
    } else {
      // 未知任务
      logger.warn(`未知的任务类型: ${task}`, { response });
      return {
        text: `未知任务类型: ${task}`,
        rawResponse: response,
        error: true
      };
    }
  }
  
  /**
   * 发送请求到 BERT 服务
   * @private
   * @override
   * @param {Object} requestData - 请求数据
   * @returns {Promise<Object>} 响应数据
   */
  async _makeRequest(requestData) {
    try {
      // 根据任务类型选择不同的端点
      const endpoint = `/api/${requestData.task}`;
      const response = await this.client.post(endpoint, requestData);
      return response.data;
    } catch (error) {
      if (error.response) {
        // 服务器响应了错误状态码
        throw new Error(`BERT 服务器错误: ${error.response.status} - ${error.response.data.error || error.response.statusText}`);
      } else if (error.request) {
        // 请求已发送但没有收到响应
        throw new Error(`BERT 服务无响应: ${error.message}`);
      } else {
        // 请求配置出错
        throw new Error(`BERT 请求错误: ${error.message}`);
      }
    }
  }
}

module.exports = { BertAdapter };