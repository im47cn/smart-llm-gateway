/**
 * 模型网关服务实现
 */
const grpc = require('@grpc/grpc-js');
const { v4: uuidv4 } = require('uuid');
const { logger } = require('../utils/logger');
const { Errors } = require('../utils/errors');
const { processRequest } = require('../middleware/requestProcessor');
const config = require('../config');
const modelRouterService = require('./modelRouterService');
const { adapterManager, initializeAdapters } = require('../adapters');
const monitoringService = require('../monitoring/MonitoringService');

// 初始化模型适配器
initializeAdapters();

// 定义evaluateQueryComplexity函数
async function evaluateQueryComplexity(query, metadata) {
  const startTime = Date.now();
  try {
    // 实现查询复杂度评估
    // 这里使用简单的启发式方法作为示例
    
    // 1. 计算词汇复杂度
    const words = query.split(/\s+/);
    const wordCount = words.length;
    const avgWordLength = words.reduce((sum, word) => sum + word.length, 0) / wordCount;
    const vocabularyComplexity = Math.min(wordCount / 100, 1) * 0.5 + Math.min(avgWordLength / 10, 1) * 0.5;
    
    // 2. 语法复杂度
    const sentences = query.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const sentenceCount = Math.max(sentences.length, 1);
    const avgSentenceLength = wordCount / sentenceCount;
    const grammarComplexity = Math.min(avgSentenceLength / 20, 1);
    
    // 3. 计算最终复杂度分数
    const complexityScore = (vocabularyComplexity * 0.6 + grammarComplexity * 0.4);
    
    // 确定复杂度因素
    const complexityFactors = [];
    if (vocabularyComplexity > 0.6) complexityFactors.push('高词汇复杂度');
    if (grammarComplexity > 0.6) complexityFactors.push('复杂语法结构');
    if (wordCount > 100) complexityFactors.push('查询长度较长');
    
    const result = {
      complexityScore,
      complexityFactors
    };
    
    monitoringService.recordRequest({
      requestId: uuidv4(),
      operation: 'evaluateQueryComplexity',
      duration: Date.now() - startTime,
      success: true
    });
    
    return result;
  } catch (error) {
    monitoringService.recordRequest({
      requestId: uuidv4(),
      operation: 'evaluateQueryComplexity',
      duration: Date.now() - startTime,
      success: false,
      error: error.message
    });
    throw error;
  }
}

async function processQuery(call, callback) {
  const requestId = uuidv4();
  const startTime = Date.now();
  let success = false;
  let modelInfo = null;

  try {
    // 预处理请求
    const { request, metadata, logger: requestLogger } = processRequest(call.request);
    
    requestLogger.info('开始处理查询', { query: request.query.substring(0, 100) + '...' });
    
    // 1. 评估查询复杂度
    requestLogger.debug('开始评估查询复杂度');
    const complexityResult = await evaluateQueryComplexity(request.query, metadata);
    const { complexityScore, complexityFactors } = complexityResult;
    
    requestLogger.info('查询复杂度评估结果', {
      complexityScore,
      factors: complexityFactors
    });
    
    // 2. 根据复杂度选择模型
    requestLogger.debug('开始选择模型');
    modelInfo = modelRouterService.selectModelByComplexity(
      complexityScore,
      complexityFactors,
      metadata
    );
    
    // 应用成本控制策略
    const finalModelInfo = modelRouterService.applyCostControlStrategy(modelInfo, metadata);
    
    requestLogger.info('已选择模型', {
      provider: finalModelInfo.provider,
      modelType: finalModelInfo.modelType,
      estimatedCost: finalModelInfo.estimatedCost
    });
    
    // 3. 记录模型使用开始
    modelRouterService.recordModelUseStart(finalModelInfo.provider);
    
    // 4. 调用模型
    const modelStartTime = Date.now();
    let modelResponse;
    let actualCost = 0;
    
    try {
      const queryObject = {
        text: request.query,
        context: request.context || [],
        complexityScore
      };
      
      modelResponse = await adapterManager.callModel(
        finalModelInfo.provider,
        finalModelInfo.modelConfig?.defaultModel || 'default',
        queryObject,
        {
          maxTokens: metadata.maxTokens || 1000,
          temperature: metadata.temperature || 0.7,
          systemMessage: metadata.systemMessage,
          budget: metadata.budget
        }
      );
      
      actualCost = modelResponse.cost || finalModelInfo.estimatedCost;
      success = true;
      
    } catch (error) {
      requestLogger.error('模型调用失败', { error: error.message });
      
      const backupModel = modelRouterService.getBackupModel(
        finalModelInfo.provider,
        finalModelInfo.modelType,
        metadata
      );
      
      if (backupModel) {
        requestLogger.info('尝试使用备用模型', { provider: backupModel.provider });
        modelRouterService.recordModelUseStart(backupModel.provider);
        
        const queryObject = {
          text: request.query,
          context: request.context || [],
          complexityScore
        };
        
        modelResponse = await adapterManager.callModel(
          backupModel.provider,
          backupModel.modelConfig?.defaultModel || 'default',
          queryObject,
          {
            maxTokens: metadata.maxTokens || 1000,
            temperature: metadata.temperature || 0.7,
            systemMessage: metadata.systemMessage,
            budget: metadata.budget
          }
        );
        
        actualCost = modelResponse.cost || backupModel.estimatedCost;
        finalModelInfo = backupModel;
        finalModelInfo.isBackup = true;
        success = true;
      } else {
        throw Errors.modelUnavailable('模型调用失败，且没有可用的备用模型');
      }
    }
    
    const responseTime = Date.now() - startTime;
    const modelProcessingTime = Date.now() - modelStartTime;
    
    // 记录监控指标
    monitoringService.recordRequest({
      requestId,
      modelId: finalModelInfo.provider,
      duration: responseTime,
      modelDuration: modelProcessingTime,
      success,
      cost: actualCost,
      tokens: modelResponse.tokenUsage?.total || 0,
      complexity: complexityScore
    });

    // 5. 记录模型使用结束
    modelRouterService.recordModelUseEnd(finalModelInfo.provider, {
      responseTime: modelProcessingTime,
      success,
      costEfficiency: 1 / (actualCost || 0.001)
    });
    
    // 6. 构建响应
    const result = {
      request_id: request.request_id,
      response: modelResponse.text,
      complexity_score: complexityScore,
      model_used: finalModelInfo.provider,
      cost: actualCost,
      token_usage: modelResponse.tokenUsage || {
        input: 0,
        output: 0,
        total: 0
      },
      processing_time: responseTime
    };
    
    requestLogger.info('查询处理完成', {
      modelUsed: finalModelInfo.provider,
      complexityScore,
      cost: actualCost,
      processingTime: responseTime
    });
    
    callback(null, result);
  } catch (error) {
    const errorTime = Date.now() - startTime;
    
    // 记录错误指标
    monitoringService.recordRequest({
      requestId,
      modelId: modelInfo?.provider || 'unknown',
      duration: errorTime,
      success: false,
      error: error.message
    });

    logger.error('处理查询失败', { error: error.message, stack: error.stack });
    
    if (error.name === 'GatewayError') {
      callback({
        code: error.getGrpcStatus(),
        message: error.message,
        details: JSON.stringify(error.toErrorResponse())
      });
    } else {
      callback({
        code: grpc.status.INTERNAL,
        message: '内部服务器错误',
        details: error.message
      });
    }
  }
}

// 其他函数保持不变...

module.exports = {
  processQuery,
  getModelCapabilities: (call, callback) => {
    const startTime = Date.now();
    try {
      // 从配置中获取模型提供商信息
      const providers = Object.entries(config.modelProviders).map(([name, providerConfig]) => {
        return {
          provider_name: name,
          capabilities: providerConfig.supportedCapabilities || []
        };
      });
      
      // 汇总所有能力
      const allCapabilities = new Set();
      providers.forEach(provider => {
        provider.capabilities.forEach(capability => {
          allCapabilities.add(capability);
        });
      });
      
      const response = {
        capabilities: Array.from(allCapabilities),
        providers: providers
      };
      
      callback(null, response);
      
      monitoringService.recordRequest({
        requestId: uuidv4(),
        operation: 'getModelCapabilities',
        duration: Date.now() - startTime,
        success: true
      });
    } catch (error) {
      logger.error('获取模型能力失败', { error: error.message });
      
      monitoringService.recordRequest({
        requestId: uuidv4(),
        operation: 'getModelCapabilities',
        duration: Date.now() - startTime,
        success: false,
        error: error.message
      });
      
      callback({
        code: grpc.status.INTERNAL,
        message: '获取模型能力失败',
        details: error.message
      });
    }
  },
  evaluateComplexity: (call, callback) => {
    const startTime = Date.now();
    try {
      const { query, features } = call.request;
      logger.info('评估查询复杂度', { queryLength: query.length });
      
      // 实现复杂度评估算法
      // 这里使用简单的启发式方法作为示例
      
      // 1. 计算词汇复杂度（基于词数和平均词长）
      const words = query.split(/\s+/);
      const wordCount = words.length;
      const avgWordLength = words.reduce((sum, word) => sum + word.length, 0) / wordCount;
      const vocabularyComplexity = Math.min(wordCount / 100, 1) * 0.5 + Math.min(avgWordLength / 10, 1) * 0.5;
      
      // 2. 语法复杂度（基于句子数量和平均句子长度）
      const sentences = query.split(/[.!?]+/).filter(s => s.trim().length > 0);
      const sentenceCount = sentences.length;
      const avgSentenceLength = wordCount / sentenceCount;
      const grammarComplexity = Math.min(avgSentenceLength / 20, 1);
      
      // 3. 计算最终复杂度分数（0-1范围）
      const complexityScore = (vocabularyComplexity * 0.6 + grammarComplexity * 0.4);
      
      // 确定复杂度因素
      const complexityFactors = [];
      if (vocabularyComplexity > 0.6) complexityFactors.push('高词汇复杂度');
      if (grammarComplexity > 0.6) complexityFactors.push('复杂语法结构');
      if (wordCount > 100) complexityFactors.push('查询长度较长');
      
      const response = {
        complexity_score: complexityScore,
        complexity_factors: complexityFactors
      };
      
      logger.info('复杂度评估完成', {
        complexityScore,
        factors: complexityFactors
      });
      
      callback(null, response);
      
      monitoringService.recordRequest({
        requestId: uuidv4(),
        operation: 'evaluateComplexity',
        duration: Date.now() - startTime,
        success: true
      });
    } catch (error) {
      logger.error('复杂度评估失败', { error: error.message });
      
      monitoringService.recordRequest({
        requestId: uuidv4(),
        operation: 'evaluateComplexity',
        duration: Date.now() - startTime,
        success: false,
        error: error.message
      });
      
      callback({
        code: grpc.status.INTERNAL,
        message: '复杂度评估失败',
        details: error.message
      });
    }
  },
  evaluateQueryComplexity
};