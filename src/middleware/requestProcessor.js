/**
 * 请求预处理中间件
 */
const { v4: uuidv4 } = require('uuid');
const { createRequestLogger } = require('../utils/logger');
const { Errors } = require('../utils/errors');
const Joi = require('joi');

// 请求验证模式
const requestSchema = Joi.object({
  request_id: Joi.string().optional(),
  query: Joi.string().required().min(1).max(10000),
  metadata: Joi.object().pattern(
    Joi.string(),
    Joi.string()
  ).optional()
});

/**
 * 标准化请求格式
 * @param {Object} request - 原始请求对象
 * @returns {Object} 标准化后的请求对象
 */
function standardizeRequest(request) {
  // 确保请求ID存在
  if (!request.request_id) {
    request.request_id = uuidv4();
  }
  
  // 确保元数据存在
  if (!request.metadata) {
    request.metadata = {};
  }
  
  // 添加时间戳
  request.metadata.timestamp = new Date().toISOString();
  
  return request;
}

/**
 * 执行初步安全检查
 * @param {Object} request - 请求对象
 * @throws {GatewayError} 如果请求不安全
 */
function performSecurityCheck(request) {
  // 验证请求格式
  const { error } = requestSchema.validate(request);
  if (error) {
    throw Errors.invalidRequest(`请求验证失败: ${error.message}`);
  }
  
  // 检查敏感内容或潜在的注入攻击
  // 这里可以添加更多安全检查逻辑
  const sensitivePatterns = [
    /exec\s*\(/i,
    /eval\s*\(/i,
    /system\s*\(/i
  ];
  
  if (sensitivePatterns.some(pattern => pattern.test(request.query))) {
    throw Errors.invalidRequest('请求包含潜在的不安全内容');
  }
}

/**
 * 提取请求元数据
 * @param {Object} request - 请求对象
 * @returns {Object} 提取的元数据
 */
function extractMetadata(request) {
  const metadata = {
    ...request.metadata,
    queryLength: request.query.length,
    wordCount: request.query.split(/\s+/).length,
    timestamp: new Date().toISOString()
  };
  
  return metadata;
}

/**
 * 请求预处理主函数
 * @param {Object} request - 原始请求对象
 * @returns {Object} 处理后的请求对象和元数据
 */
function processRequest(request) {
  // 创建请求特定的日志记录器
  const requestId = request.request_id || uuidv4();
  const requestLogger = createRequestLogger(requestId);
  
  requestLogger.info('开始处理请求');
  
  try {
    // 标准化请求
    const standardizedRequest = standardizeRequest(request);
    requestLogger.debug('请求已标准化', { requestId: standardizedRequest.request_id });
    
    // 执行安全检查
    performSecurityCheck(standardizedRequest);
    requestLogger.debug('安全检查通过');
    
    // 提取元数据
    const extractedMetadata = extractMetadata(standardizedRequest);
    requestLogger.debug('元数据已提取', { metadata: extractedMetadata });
    
    // 更新请求对象
    standardizedRequest.metadata = {
      ...standardizedRequest.metadata,
      ...extractedMetadata
    };
    
    requestLogger.info('请求预处理完成');
    
    return {
      request: standardizedRequest,
      metadata: extractedMetadata,
      logger: requestLogger
    };
  } catch (error) {
    requestLogger.error('请求预处理失败', { error: error.message });
    throw error;
  }
}

module.exports = {
  processRequest,
  standardizeRequest,
  performSecurityCheck,
  extractMetadata
};