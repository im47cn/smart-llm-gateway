/**
 * 模型适配器管理器
 * 负责注册、管理和选择适当的模型适配器
 */
const { logger } = require('../utils/logger');
const { Errors } = require('../utils/errors');

class ModelAdapterManager {
  constructor() {
    this.adapters = new Map();
    this.adaptersByType = {
      local: [],
      hybrid: [],
      remote: []
    };
    logger.info('初始化模型适配器管理器');
  }

  /**
   * 注册模型适配器
   * @param {string} providerName - 提供商名称
   * @param {BaseModelAdapter} adapter - 适配器实例
   */
  registerAdapter(providerName, adapter) {
    if (this.adapters.has(providerName)) {
      logger.warn(`提供商 ${providerName} 的适配器已存在，将被覆盖`);
    }
    
    this.adapters.set(providerName, adapter);
    
    // 按类型分类
    const adapterType = adapter.getType();
    if (this.adaptersByType[adapterType]) {
      this.adaptersByType[adapterType].push(providerName);
    } else {
      this.adaptersByType[adapterType] = [providerName];
    }
    
    logger.info(`注册 ${providerName} 适配器成功`, {
      type: adapterType,
      capabilities: adapter.getCapabilities()
    });
  }

  /**
   * 获取指定提供商的适配器
   * @param {string} providerName - 提供商名称
   * @returns {BaseModelAdapter} 适配器实例
   * @throws {GatewayError} 如果适配器不存在
   */
  getAdapter(providerName) {
    const adapter = this.adapters.get(providerName);
    if (!adapter) {
      throw Errors.modelUnavailable(`提供商 ${providerName} 的适配器不存在`);
    }
    return adapter;
  }

  /**
   * 获取所有可用的适配器
   * @param {string} [type] - 适配器类型 (local, hybrid, remote)
   * @returns {Array<{name: string, adapter: BaseModelAdapter}>} 适配器列表
   */
  getAvailableAdapters(type) {
    let providerNames;
    
    if (type && this.adaptersByType[type]) {
      providerNames = this.adaptersByType[type];
    } else {
      providerNames = Array.from(this.adapters.keys());
    }
    
    return providerNames
      .map(name => {
        const adapter = this.adapters.get(name);
        return { name, adapter };
      })
      .filter(({ adapter }) => adapter.isAvailable());
  }

  /**
   * 获取所有适配器的能力
   * @returns {Object} 按提供商分组的能力列表
   */
  getAllCapabilities() {
    const capabilities = {};
    
    for (const [name, adapter] of this.adapters.entries()) {
      capabilities[name] = {
        type: adapter.getType(),
        capabilities: adapter.getCapabilities(),
        modelTypes: adapter.getSupportedModelTypes(),
        available: adapter.isAvailable()
      };
    }
    
    return capabilities;
  }

  /**
   * 获取支持特定能力的适配器
   * @param {string} capability - 能力名称
   * @returns {Array<{name: string, adapter: BaseModelAdapter}>} 适配器列表
   */
  getAdaptersByCapability(capability) {
    return Array.from(this.adapters.entries())
      .filter(([_, adapter]) => 
        adapter.isAvailable() && 
        adapter.getCapabilities().includes(capability)
      )
      .map(([name, adapter]) => ({ name, adapter }));
  }

  /**
   * 调用指定提供商的模型
   * @param {string} providerName - 提供商名称
   * @param {string} modelName - 模型名称
   * @param {Object} query - 查询对象
   * @param {Object} options - 调用选项
   * @returns {Promise<Object>} 模型响应
   */
  async callModel(providerName, modelName, query, options = {}) {
    const adapter = this.getAdapter(providerName);
    
    if (!adapter.isAvailable()) {
      throw Errors.modelUnavailable(`提供商 ${providerName} 当前不可用`);
    }
    
    logger.debug(`调用 ${providerName} 的 ${modelName} 模型`, {
      queryLength: query.text ? query.text.length : 0
    });
    
    try {
      return await adapter.callModel(modelName, query, options);
    } catch (error) {
      logger.error(`调用 ${providerName} 的 ${modelName} 模型失败`, {
        error: error.message
      });
      throw error;
    }
  }
}

// 创建单例实例
const adapterManager = new ModelAdapterManager();

module.exports = adapterManager;