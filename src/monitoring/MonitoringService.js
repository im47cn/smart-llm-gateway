const metricsCollector = require('./metrics/MetricsCollector');
const alertManager = require('./alerts/AlertManager');
const logger = require('../utils/logger').logger;

class MonitoringService {
  constructor() {
    this.setupEventListeners();
    this.startPeriodicChecks();
  }

  setupEventListeners() {
    // Listen for metrics updates
    metricsCollector.on('metrics-update', ({ type, metrics }) => {
      this.handleMetricsUpdate(type, metrics);
    });

    // Listen for alerts
    alertManager.on('alert', (alert) => {
      this.handleAlert(alert);
    });
  }

  startPeriodicChecks() {
    // Run checks every minute
    setInterval(() => {
      const metrics = metricsCollector.getMetricsSummary();
      this.runHealthChecks(metrics);
    }, 60000);
  }

  // Record request metrics
  recordRequest(requestData) {
    try {
      metricsCollector.recordRequest(requestData);
    } catch (error) {
      logger.error('Failed to record request metrics', { error, requestData });
    }
  }

  // Record cost
  recordCost(modelId, cost, tokens) {
    try {
      metricsCollector.recordCost(modelId, cost, tokens);
    } catch (error) {
      logger.error('Failed to record cost metrics', { error, modelId, cost });
    }
  }

  // Handle metrics updates
  handleMetricsUpdate(type, metrics) {
    try {
      switch (type) {
        case 'request':
          alertManager.checkPerformanceMetrics(metrics);
          break;
        case 'resources':
          alertManager.checkResourceMetrics(metrics);
          break;
        default:
          logger.warn('Unknown metrics type received', { type });
      }
    } catch (error) {
      logger.error('Error handling metrics update', { error, type });
    }
  }

  // Handle alerts
  handleAlert(alert) {
    try {
      // Log alert to monitoring system
      logger.warn('Alert triggered', { alert });

      // Here you would typically:
      // 1. Send notifications (email, Slack, etc.)
      // 2. Update monitoring dashboard
      // 3. Trigger any automatic remediation actions

      // For now, we'll just log it
      console.warn(`ALERT [${alert.severity}]: ${alert.message}`);
    } catch (error) {
      logger.error('Error handling alert', { error, alert });
    }
  }

  // Run health checks
  runHealthChecks(metrics) {
    try {
      // Check performance metrics
      alertManager.checkPerformanceMetrics(metrics);

      // Check resource metrics
      alertManager.checkResourceMetrics(metrics.resources);

      // Check cost metrics
      alertManager.checkCostMetrics(metrics.costs);
    } catch (error) {
      logger.error('Error running health checks', { error });
    }
  }

  // Get current metrics
  getMetrics() {
    return metricsCollector.getMetricsSummary();
  }

  // Get active alerts
  getActiveAlerts() {
    return alertManager.getActiveAlerts();
  }

  // Update alert thresholds
  updateAlertThresholds(thresholds) {
    alertManager.updateThresholds(thresholds);
  }

  // Get system health status
  getHealthStatus() {
    const metrics = this.getMetrics();
    const activeAlerts = this.getActiveAlerts();

    const criticalAlerts = activeAlerts.filter(alert => alert.severity === 'critical');
    const highAlerts = activeAlerts.filter(alert => alert.severity === 'high');

    let status = 'healthy';
    if (criticalAlerts.length > 0) {
      status = 'critical';
    } else if (highAlerts.length > 0) {
      status = 'degraded';
    }

    return {
      status,
      timestamp: new Date().toISOString(),
      metrics: {
        requestCount: metrics.performance.requestCount,
        errorRate: metrics.performance.errorRate,
        averageLatency: metrics.performance.averageLatency,
      },
      activeAlerts: activeAlerts.length,
      criticalAlerts: criticalAlerts.length,
      highAlerts: highAlerts.length,
    };
  }

  // Get detailed system status
  getDetailedStatus() {
    return {
      health: this.getHealthStatus(),
      metrics: this.getMetrics(),
      alerts: this.getActiveAlerts(),
    };
  }
}

module.exports = new MonitoringService();