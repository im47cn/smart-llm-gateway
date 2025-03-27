/**
 * 服务实现注册
 */
const modelGatewayService = require('./modelGatewayService');

/**
 * 注册所有服务到gRPC服务器
 * @param {grpc.Server} server - gRPC服务器实例
 * @param {Object} protoDescriptor - 协议描述符
 */
function registerServices(server, protoDescriptor) {
  server.addService(
    protoDescriptor.ModelGatewayService.service, 
    modelGatewayService
  );
}

module.exports = {
  registerServices
};