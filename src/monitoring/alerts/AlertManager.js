const EventEmitter = require('events');
const logger = require('../../utils/logger').logger;

class AlertManager extends EventEmitter {
  constructor() {
    super();
    this.alerts = [];
    this.thresholds = {
      error: {
        rate: 0.1, // 10% error rate
        interval: 5 * 60 * 1000, // 5 minutes
      },
      latency: {
        threshold: 2000, // 2 seconds
        percentile: 95, // 95th percentile
      },
      cost: {
        daily: 1000, // $1000 per day
        monthly: 20000, // $20000 per month
      },
      memory: {
        usage: 0.9, // 90% of available memory
      },
      cpu: {
        usage: 0.8, // 80% CPU utilization
      },
    };
  }

  // Alert Generation
  generateAlert(type, severity, message, data) {
    const alert = {
      id: Date.now().toString(36) + Math.random().toString(36).substr(2),
      type,
      severity,
      message,
      data,
      timestamp: new Date().toISOString(),
      status: 'active',
    };

    this.alerts.push(alert);
    this.emit('alert', alert);

    // Log alert
    logger.warn(`Alert generated: ${message}`, {
      alertId: alert.id,
      type,
      severity,
      data,
    });

    return alert;
  }

  // Check Performance Metrics
  checkPerformanceMetrics(metrics) {
    const { performance } = metrics;

    // Check error rate
    if (performance.errorRate > this.thresholds.error.rate) {
      this.generateAlert(
        'error_rate',
        'high',
        `High error rate detected: ${(performance.errorRate * 100).toFixed(2)}%`,
        { errorRate: performance.errorRate }
      );
    }

    // Check latency
    if (performance.averageLatency > this.thresholds.latency.threshold) {
      this.generateAlert(
        'latency',
        'medium',
        `High average latency detected: ${performance.averageLatency.toFixed(2)}ms`,
        { latency: performance.averageLatency }
      );
    }
  }

  // Check Resource Usage
  checkResourceMetrics(resources) {
    // Check memory usage
    const memoryUsage = resources.memory.process / resources.memory.system;
    if (memoryUsage > this.thresholds.memory.usage) {
      this.generateAlert(
        'memory',
        'high',
        `High memory usage: ${(memoryUsage * 100).toFixed(2)}%`,
        { usage: memoryUsage }
      );
    }

    // Check CPU usage
    const cpuMetrics = resources.cpu;
    if (cpuMetrics.length > 0) {
      const lastCpuUsage = cpuMetrics[cpuMetrics.length - 1];
      const totalCpuUsage = (lastCpuUsage.user + lastCpuUsage.system) / 1000000; // Convert to seconds
      
      if (totalCpuUsage > this.thresholds.cpu.usage) {
        this.generateAlert(
          'cpu',
          'medium',
          `High CPU usage: ${(totalCpuUsage * 100).toFixed(2)}%`,
          { usage: totalCpuUsage }
        );
      }
    }
  }

  // Check Cost Metrics
  checkCostMetrics(costs) {
    let dailyTotal = 0;
    let monthlyTotal = 0;

    for (const [, metrics] of Object.entries(costs)) {
      const now = Date.now();
      const oneDayAgo = now - 24 * 60 * 60 * 1000;
      const oneMonthAgo = now - 30 * 24 * 60 * 60 * 1000;

      // Calculate daily costs
      const dailyCosts = metrics.history
        .filter(entry => entry.timestamp > oneDayAgo)
        .reduce((sum, entry) => sum + entry.cost, 0);
      
      dailyTotal += dailyCosts;

      // Calculate monthly costs
      const monthlyCosts = metrics.history
        .filter(entry => entry.timestamp > oneMonthAgo)
        .reduce((sum, entry) => sum + entry.cost, 0);
      
      monthlyTotal += monthlyCosts;
    }

    // Check daily cost threshold
    if (dailyTotal > this.thresholds.cost.daily) {
      this.generateAlert(
        'cost_daily',
        'high',
        `Daily cost threshold exceeded: $${dailyTotal.toFixed(2)}`,
        { cost: dailyTotal }
      );
    }

    // Check monthly cost threshold
    if (monthlyTotal > this.thresholds.cost.monthly) {
      this.generateAlert(
        'cost_monthly',
        'critical',
        `Monthly cost threshold exceeded: $${monthlyTotal.toFixed(2)}`,
        { cost: monthlyTotal }
      );
    }
  }

  // Update Alert Thresholds
  updateThresholds(newThresholds) {
    this.thresholds = {
      ...this.thresholds,
      ...newThresholds,
    };
  }

  // Get Active Alerts
  getActiveAlerts() {
    return this.alerts.filter(alert => alert.status === 'active');
  }

  // Resolve Alert
  resolveAlert(alertId) {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.status = 'resolved';
      alert.resolvedAt = new Date().toISOString();
      this.emit('alert-resolved', alert);
    }
  }
}

module.exports = new AlertManager();