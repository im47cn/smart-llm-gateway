/**
 * 智能模型网关系统入口文件
 */
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');
const config = require('./config');
const { logger } = require('./utils/logger');
const { registerServices } = require('./services');

// 加载proto文件
const PROTO_PATH = path.join(__dirname, '../proto/gateway.proto');
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true
});

const protoDescriptor = grpc.loadPackageDefinition(packageDefinition);
const modelgateway = protoDescriptor.modelgateway;

/**
 * 启动gRPC服务器
 */
function startServer() {
  const server = new grpc.Server();
  
  // 注册服务实现
  registerServices(server, modelgateway);
  
  // 绑定端口并启动服务
  server.bindAsync(
    `0.0.0.0:${config.grpcPort}`,
    grpc.ServerCredentials.createInsecure(),
    (err, port) => {
      if (err) {
        logger.error(`服务器启动失败: ${err.message}`);
        process.exit(1);
      }
      server.start();
      logger.info(`gRPC服务器运行在端口 ${port}`);
    }
  );
  
  // 优雅关闭
  const shutdown = () => {
    logger.info('正在关闭服务器...');
    server.tryShutdown(() => {
      logger.info('服务器已关闭');
      process.exit(0);
    });
  };
  
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

// 启动服务器
if (require.main === module) {
  startServer();
}

module.exports = { startServer };