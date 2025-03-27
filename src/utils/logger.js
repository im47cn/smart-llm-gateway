/**
 * 日志工具模块
 */
const pino = require('pino');
const config = require('../config');

// 创建日志记录器
const logger = pino({
  level: config.logLevel,
  transport: config.environment === 'development' 
    ? { target: 'pino-pretty' } 
    : undefined,
  timestamp: pino.stdTimeFunctions.isoTime,
  base: undefined,
  formatters: {
    level: (label) => {
      return { level: label };
    }
  }
});

// 添加请求上下文的日志记录器
function createRequestLogger(requestId) {
  return logger.child({ requestId });
}

// 导出logger对象和createRequestLogger函数
module.exports = {
  logger,
  createRequestLogger
};