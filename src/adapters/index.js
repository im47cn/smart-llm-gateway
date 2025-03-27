/**
 * 模型适配器初始化模块
 * 负责初始化和注册所有模型适配器
 */
const config = require('../config');
const { logger } = require('../utils/logger');
const adapterManager = require('./adapterManager');
const { LlamaAdapter } = require('./llamaAdapter');
const { BertAdapter } = require('./bertAdapter');
const { OpenAIAdapter } = require('./openaiAdapter');
const { AnthropicAdapter } = require('./anthropicAdapter');

/**
 * 初始化所有模型适配器
 * @returns {Object} 适配器管理器实例
 */
function initializeAdapters() {
  logger.info('开始初始化模型适配器');
  
  try {
    // 初始化本地模型适配器
    if (config.modelProviders['local-llama']) {
      const llamaAdapter = new LlamaAdapter('local-llama', config.modelProviders['local-llama']);
      adapterManager.registerAdapter('local-llama', llamaAdapter);
    }
    
    if (config.modelProviders['local-bert']) {
      const bertAdapter = new BertAdapter('local-bert', config.modelProviders['local-bert']);
      adapterManager.registerAdapter('local-bert', bertAdapter);
    }
    
    // 初始化远程模型适配器
    if (config.modelProviders['remote-openai']) {
      const openaiAdapter = new OpenAIAdapter('remote-openai', config.modelProviders['remote-openai']);
      adapterManager.registerAdapter('remote-openai', openaiAdapter);
    }
    
    if (config.modelProviders['remote-anthropic']) {
      const anthropicAdapter = new AnthropicAdapter('remote-anthropic', config.modelProviders['remote-anthropic']);
      adapterManager.registerAdapter('remote-anthropic', anthropicAdapter);
    }
    
    // 初始化混合模型适配器（如果有）
    // 这里可以添加其他混合模型适配器的初始化代码
    
    logger.info('模型适配器初始化完成', {
      adapterCount: adapterManager.adapters.size,
      adapters: Array.from(adapterManager.adapters.keys())
    });
    
    return adapterManager;
  } catch (error) {
    logger.error('初始化模型适配器失败', {
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
}

module.exports = {
  adapterManager,
  initializeAdapters
};