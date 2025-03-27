const express = require('express');
const monitoringService = require('./MonitoringService');
const logger = require('../utils/logger').logger;

class MonitoringAPI {
  constructor() {
    this.router = express.Router();
    this.initializeRoutes();
  }

  initializeRoutes() {
    // Health check endpoint
    this.router.get('/health', this.getHealthCheck.bind(this));

    // Metrics endpoints
    this.router.get('/metrics', this.getMetrics.bind(this));
    this.router.get('/metrics/performance', this.getPerformanceMetrics.bind(this));
    this.router.get('/metrics/resources', this.getResourceMetrics.bind(this));
    this.router.get('/metrics/costs', this.getCostMetrics.bind(this));

    // Alerts endpoints
    this.router.get('/alerts', this.getAlerts.bind(this));
    this.router.post('/alerts/:alertId/resolve', this.resolveAlert.bind(this));

    // System status endpoint
    this.router.get('/status', this.getSystemStatus.bind(this));

    // Alert thresholds management
    this.router.get('/thresholds', this.getThresholds.bind(this));
    this.router.put('/thresholds', this.updateThresholds.bind(this));
  }

  // Health Check Handler
  async getHealthCheck(req, res) {
    try {
      const health = monitoringService.getHealthStatus();
      const statusCode = health.status === 'healthy' ? 200 :
                        health.status === 'degraded' ? 200 : 503;

      res.status(statusCode).json(health);
    } catch (error) {
      logger.error('Health check failed', { error });
      res.status(500).json({
        status: 'error',
        message: 'Failed to get health status',
        timestamp: new Date().toISOString()
      });
    }
  }

  // Metrics Handlers
  async getMetrics(req, res) {
    try {
      const metrics = monitoringService.getMetrics();
      res.json(metrics);
    } catch (error) {
      logger.error('Failed to get metrics', { error });
      res.status(500).json({
        error: 'Failed to retrieve metrics'
      });
    }
  }

  async getPerformanceMetrics(req, res) {
    try {
      const metrics = monitoringService.getMetrics();
      res.json(metrics.performance);
    } catch (error) {
      logger.error('Failed to get performance metrics', { error });
      res.status(500).json({
        error: 'Failed to retrieve performance metrics'
      });
    }
  }

  async getResourceMetrics(req, res) {
    try {
      const metrics = monitoringService.getMetrics();
      res.json(metrics.resources);
    } catch (error) {
      logger.error('Failed to get resource metrics', { error });
      res.status(500).json({
        error: 'Failed to retrieve resource metrics'
      });
    }
  }

  async getCostMetrics(req, res) {
    try {
      const metrics = monitoringService.getMetrics();
      res.json(metrics.costs);
    } catch (error) {
      logger.error('Failed to get cost metrics', { error });
      res.status(500).json({
        error: 'Failed to retrieve cost metrics'
      });
    }
  }

  // Alerts Handlers
  async getAlerts(req, res) {
    try {
      const alerts = monitoringService.getActiveAlerts();
      res.json(alerts);
    } catch (error) {
      logger.error('Failed to get alerts', { error });
      res.status(500).json({
        error: 'Failed to retrieve alerts'
      });
    }
  }

  async resolveAlert(req, res) {
    try {
      const { alertId } = req.params;
      const alertManager = require('./alerts/AlertManager');
      alertManager.resolveAlert(alertId);
      res.json({ message: 'Alert resolved successfully' });
    } catch (error) {
      logger.error('Failed to resolve alert', { error });
      res.status(500).json({
        error: 'Failed to resolve alert'
      });
    }
  }

  // System Status Handler
  async getSystemStatus(req, res) {
    try {
      const status = monitoringService.getDetailedStatus();
      res.json(status);
    } catch (error) {
      logger.error('Failed to get system status', { error });
      res.status(500).json({
        error: 'Failed to retrieve system status'
      });
    }
  }

  // Thresholds Handlers
  async getThresholds(req, res) {
    try {
      const alertManager = require('./alerts/AlertManager');
      res.json(alertManager.thresholds);
    } catch (error) {
      logger.error('Failed to get thresholds', { error });
      res.status(500).json({
        error: 'Failed to retrieve thresholds'
      });
    }
  }

  async updateThresholds(req, res) {
    try {
      const newThresholds = req.body;
      monitoringService.updateAlertThresholds(newThresholds);
      res.json({
        message: 'Thresholds updated successfully',
        thresholds: newThresholds
      });
    } catch (error) {
      logger.error('Failed to update thresholds', { error });
      res.status(500).json({
        error: 'Failed to update thresholds'
      });
    }
  }

  // Get router
  getRouter() {
    return this.router;
  }
}

module.exports = new MonitoringAPI();