const monitoringService = require('./MonitoringService');
const monitoringAPI = require('./MonitoringAPI');
const metricsCollector = require('./metrics/MetricsCollector');
const alertManager = require('./alerts/AlertManager');

/**
 * Initialize monitoring system
 * @param {Object} app - Express application instance
 * @param {Object} config - Monitoring configuration
 */
function initializeMonitoring(app, config = {}) {
  // Set up alert thresholds if provided
  if (config.alertThresholds) {
    alertManager.updateThresholds(config.alertThresholds);
  }

  // Mount monitoring API endpoints
  app.use('/monitoring', monitoringAPI.getRouter());

  // Set up periodic health checks
  const healthCheckInterval = config.healthCheckInterval || 60000; // Default: 1 minute
  setInterval(() => {
    const health = monitoringService.getHealthStatus();
    if (health.status !== 'healthy') {
      alertManager.generateAlert(
        'system_health',
        health.status === 'critical' ? 'critical' : 'high',
        `System health check failed: ${health.status}`,
        health
      );
    }
  }, healthCheckInterval);

  // Log initialization
  const logger = require('../utils/logger').logger;
  logger.info('Monitoring system initialized', {
    apiEndpoint: '/monitoring',
    healthCheckInterval: `${healthCheckInterval}ms`
  });
}

module.exports = {
  monitoringService,
  metricsCollector,
  alertManager,
  initializeMonitoring
};