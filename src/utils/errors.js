/**
 * 错误处理工具
 */

// 错误代码映射到gRPC状态码
const ErrorCodeToGrpcStatus = {
  INVALID_REQUEST: 3, // INVALID_ARGUMENT
  MODEL_UNAVAILABLE: 14, // UNAVAILABLE
  COMPLEXITY_EVALUATION_FAILED: 2, // UNKNOWN
  COST_LIMIT_EXCEEDED: 8, // RESOURCE_EXHAUSTED
};

// 自定义错误类
class GatewayError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
    this.name = 'GatewayError';
  }

  // 获取对应的gRPC状态码
  getGrpcStatus() {
    return ErrorCodeToGrpcStatus[this.code] || 2; // 默认为UNKNOWN
  }

  // 转换为ErrorResponse消息
  toErrorResponse() {
    return {
      code: this.code,
      message: this.message
    };
  }
}

// 预定义错误
const Errors = {
  invalidRequest: (message = '无效的请求') => 
    new GatewayError('INVALID_REQUEST', message),
  
  modelUnavailable: (message = '模型不可用') => 
    new GatewayError('MODEL_UNAVAILABLE', message),
  
  complexityEvaluationFailed: (message = '复杂度评估失败') => 
    new GatewayError('COMPLEXITY_EVALUATION_FAILED', message),
  
  costLimitExceeded: (message = '超出成本限制') => 
    new GatewayError('COST_LIMIT_EXCEEDED', message),
};

module.exports = {
  GatewayError,
  Errors
};