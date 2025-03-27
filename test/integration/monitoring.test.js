/**
 * 智能模型网关系统 - 集成测试
 * 测试监控系统的数据收集和告警功能
 */
const { v4: uuidv4 } = require('uuid');

// 模拟事件发射器
jest.mock('events', () => {
  const EventEmitter = jest.requireActual('events');
  return EventEmitter;
});

describe('监控系统集成测试', () => {
  let monitoringService;
  let metricsCollector;
  let alertManager;
  
  beforeEach(() => {
    // 清除所有模块缓存
    jest.resetModules();
    
    // 动态导入监控组件
    metricsCollector = require('../../src/monitoring/metrics/MetricsCollector');
    alertManager = require('../../src/monitoring/alerts/AlertManager');
    monitoringService = require('../../src/monitoring/MonitoringService');
    
    // 监听告警事件
    alertManager.emit = jest.fn();
    metricsCollector.emit = jest.fn();
  });
  
  test('应该正确记录请求指标', () => {
    // 准备请求数据
    const requestData = {
      requestId: uuidv4(),
      modelId: 'openai',
      duration: 500,
      success: true,
      cost: 0.05,
      tokens: 100
    };
    
    // 记录请求
    monitoringService.recordRequest(requestData);
    
    // 获取指标
    const metrics = monitoringService.getMetrics();
    
    // 验证指标
    expect(metrics).toBeDefined();
    expect(metrics.performance).toBeDefined();
    expect(metrics.performance.requestCount).toBeGreaterThan(0);
    expect(metrics.models).toBeDefined();
    
    // 验证模型特定指标
    const modelMetrics = metrics.models.find(m => m.modelId === 'openai');
    expect(modelMetrics).toBeDefined();
    expect(modelMetrics.requestCount).toBeGreaterThan(0);
    
    // 验证事件发射
    expect(metricsCollector.emit).toHaveBeenCalledWith(
      'metrics-update',
      expect.objectContaining({
        type: 'request',
        modelId: 'openai'
      })
    );
  });
  
  test('应该正确记录成本指标', () => {
    // 记录成本
    monitoringService.recordCost('openai', 0.05, 100);
    
    // 获取指标
    const metrics = monitoringService.getMetrics();
    
    // 验证成本指标
    expect(metrics.costs).toBeDefined();
    const costMetrics = metrics.costs.find(c => c.modelId === 'openai');
    expect(costMetrics).toBeDefined();
    expect(costMetrics.totalCost).toBeGreaterThan(0);
    expect(costMetrics.totalTokens).toBe(100);
  });
  
  test('应该在错误率高时触发告警', () => {
    // 模拟高错误率
    for (let i = 0; i < 10; i++) {
      monitoringService.recordRequest({
        requestId: uuidv4(),
        modelId: 'openai',
        duration: 500,
        success: i < 3 // 30% 错误率
      });
    }
    
    // 手动触发健康检查
    const metrics = monitoringService.getMetrics();
    monitoringService.runHealthChecks(metrics);
    
    // 验证告警
    expect(alertManager.emit).toHaveBeenCalledWith(
      'alert',
      expect.objectContaining({
        type: 'error_rate',
        severity: expect.any(String)
      })
    );
  });
  
  test('应该在延迟高时触发告警', () => {
    // 模拟高延迟
    for (let i = 0; i < 5; i++) {
      monitoringService.recordRequest({
        requestId: uuidv4(),
        modelId: 'openai',
        duration: 3000, // 3秒，超过阈值
        success: true
      });
    }
    
    // 手动触发健康检查
    const metrics = monitoringService.getMetrics();
    monitoringService.runHealthChecks(metrics);
    
    // 验证告警
    expect(alertManager.emit).toHaveBeenCalledWith(
      'alert',
      expect.objectContaining({
        type: 'latency',
        severity: expect.any(String)
      })
    );
  });
  
  test('应该在成本超出阈值时触发告警', () => {
    // 模拟高成本
    const alertManager = require('../../src/monitoring/alerts/AlertManager');
    
    // 修改成本阈值用于测试
    const originalThresholds = alertManager.thresholds;
    alertManager.thresholds = {
      ...originalThresholds,
      cost: {
        daily: 10, // 降低阈值以便测试
        monthly: 100
      }
    };
    
    // 记录高成本
    for (let i = 0; i < 10; i++) {
      monitoringService.recordCost('openai', 2, 1000); // 总成本 20，超过日阈值
    }
    
    // 手动触发健康检查
    const metrics = monitoringService.getMetrics();
    monitoringService.runHealthChecks(metrics);
    
    // 验证告警
    expect(alertManager.emit).toHaveBeenCalledWith(
      'alert',
      expect.objectContaining({
        type: 'cost_daily',
        severity: 'high'
      })
    );
    
    // 恢复原始阈值
    alertManager.thresholds = originalThresholds;
  });
  
  test('应该能够获取系统健康状态', () => {
    // 记录一些请求
    monitoringService.recordRequest({
      requestId: uuidv4(),
      modelId: 'openai',
      duration: 500,
      success: true
    });
    
    // 获取健康状态
    const healthStatus = monitoringService.getHealthStatus();
    
    // 验证健康状态
    expect(healthStatus).toBeDefined();
    expect(healthStatus.status).toBeDefined();
    expect(healthStatus.timestamp).toBeDefined();
    expect(healthStatus.metrics).toBeDefined();
    expect(healthStatus.metrics.requestCount).toBeGreaterThan(0);
  });
  
  test('应该能够获取详细系统状态', () => {
    // 记录一些请求
    monitoringService.recordRequest({
      requestId: uuidv4(),
      modelId: 'openai',
      duration: 500,
      success: true
    });
    
    // 获取详细状态
    const detailedStatus = monitoringService.getDetailedStatus();
    
    // 验证详细状态
    expect(detailedStatus).toBeDefined();
    expect(detailedStatus.health).toBeDefined();
    expect(detailedStatus.metrics).toBeDefined();
    expect(detailedStatus.alerts).toBeDefined();
  });
  
  test('应该能够更新告警阈值', () => {
    // 获取原始阈值
    const originalThresholds = alertManager.thresholds;
    
    // 更新阈值
    const newThresholds = {
      error: {
        rate: 0.2 // 20% 错误率
      }
    };
    
    monitoringService.updateAlertThresholds(newThresholds);
    
    // 验证阈值已更新
    expect(alertManager.thresholds.error.rate).toBe(0.2);
    
    // 恢复原始阈值
    alertManager.thresholds = originalThresholds;
  });
});