const EventEmitter = require('events');
const os = require('os');

class MetricsCollector extends EventEmitter {
  constructor() {
    super();
    this.metrics = {
      performance: {
        requestCount: 0,
        errorCount: 0,
        latencies: [],
        lastMinuteRequests: [],
      },
      resources: {
        cpu: [],
        memory: {},
        heap: {},
      },
      models: new Map(),
      costs: new Map(),
    };

    this.startResourceMonitoring();
  }

  // Performance Metrics
  recordRequest({ modelId, duration, success, cost, tokens }) {
    const timestamp = Date.now();
    
    // Update general metrics
    this.metrics.performance.requestCount++;
    if (!success) this.metrics.performance.errorCount++;
    this.metrics.performance.latencies.push(duration);
    this.metrics.performance.lastMinuteRequests.push({ timestamp, duration });

    // Clean up old metrics
    this.cleanupOldMetrics();

    // Update model-specific metrics
    if (modelId) {
      const modelMetrics = this.metrics.models.get(modelId) || {
        requestCount: 0,
        errorCount: 0,
        totalLatency: 0,
        costs: [],
      };

      modelMetrics.requestCount++;
      if (!success) modelMetrics.errorCount++;
      modelMetrics.totalLatency += duration;
      
      if (cost) {
        modelMetrics.costs.push({ timestamp, cost, tokens });
      }

      this.metrics.models.set(modelId, modelMetrics);
    }

    // Emit metrics update event
    this.emit('metrics-update', {
      type: 'request',
      modelId,
      metrics: this.getMetricsSummary(),
    });
  }

  // Resource Monitoring
  startResourceMonitoring() {
    setInterval(() => {
      const cpuUsage = process.cpuUsage();
      const memUsage = process.memoryUsage();
      const systemMemory = os.totalmem() - os.freemem();

      this.metrics.resources.cpu.push({
        timestamp: Date.now(),
        user: cpuUsage.user,
        system: cpuUsage.system,
      });

      this.metrics.resources.memory = {
        system: systemMemory,
        process: memUsage.rss,
      };

      this.metrics.resources.heap = {
        used: memUsage.heapUsed,
        total: memUsage.heapTotal,
      };

      // Keep only last hour of CPU metrics
      if (this.metrics.resources.cpu.length > 3600) {
        this.metrics.resources.cpu.shift();
      }

      this.emit('metrics-update', {
        type: 'resources',
        metrics: this.getResourceMetrics(),
      });
    }, 1000); // Update every second
  }

  // Cost Tracking
  recordCost(modelId, cost, tokens) {
    const costMetrics = this.metrics.costs.get(modelId) || {
      totalCost: 0,
      totalTokens: 0,
      history: [],
    };

    costMetrics.totalCost += cost;
    costMetrics.totalTokens += tokens;
    costMetrics.history.push({
      timestamp: Date.now(),
      cost,
      tokens,
    });

    this.metrics.costs.set(modelId, costMetrics);
  }

  // Cleanup old metrics
  cleanupOldMetrics() {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;

    // Clean up last minute requests
    this.metrics.performance.lastMinuteRequests = 
      this.metrics.performance.lastMinuteRequests.filter(
        req => req.timestamp > oneMinuteAgo
      );

    // Keep only last 1000 latency measurements
    if (this.metrics.performance.latencies.length > 1000) {
      this.metrics.performance.latencies = 
        this.metrics.performance.latencies.slice(-1000);
    }
  }

  // Metrics Retrieval
  getMetricsSummary() {
    const latencies = this.metrics.performance.latencies;
    const avgLatency = latencies.length > 0
      ? latencies.reduce((a, b) => a + b, 0) / latencies.length
      : 0;

    return {
      performance: {
        requestCount: this.metrics.performance.requestCount,
        errorRate: this.metrics.performance.errorCount / this.metrics.performance.requestCount || 0,
        averageLatency: avgLatency,
        requestsPerMinute: this.metrics.performance.lastMinuteRequests.length,
      },
      resources: this.getResourceMetrics(),
      models: Array.from(this.metrics.models.entries()).map(([modelId, metrics]) => ({
        modelId,
        requestCount: metrics.requestCount,
        errorRate: metrics.errorCount / metrics.requestCount || 0,
        averageLatency: metrics.totalLatency / metrics.requestCount || 0,
      })),
      costs: Array.from(this.metrics.costs.entries()).map(([modelId, metrics]) => ({
        modelId,
        totalCost: metrics.totalCost,
        totalTokens: metrics.totalTokens,
      })),
    };
  }

  getResourceMetrics() {
    return {
      cpu: this.metrics.resources.cpu.slice(-60), // Last minute of CPU metrics
      memory: this.metrics.resources.memory,
      heap: this.metrics.resources.heap,
    };
  }
}

module.exports = new MetricsCollector();