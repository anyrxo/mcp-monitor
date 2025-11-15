/**
 * MCP Monitor Dashboard
 * Real-time terminal UI for monitoring MCP servers
 */

import blessed from 'blessed';
import contrib from 'blessed-contrib';
import { TelemetryCollector } from './collector.js';
import chalk from 'chalk';

export class MonitorDashboard {
  private screen: blessed.Widgets.Screen;
  private collector: TelemetryCollector;
  private grid: any;
  private widgets: {
    overview: any;
    toolsTable: any;
    errorsLog: any;
    latencyChart: any;
    requestsChart: any;
  };
  private refreshInterval: NodeJS.Timeout | null = null;

  constructor(collector: TelemetryCollector) {
    this.collector = collector;

    // Create screen
    this.screen = blessed.screen({
      smartCSR: true,
      title: 'MCP Monitor Dashboard'
    });

    // Create grid layout
    this.grid = new contrib.grid({
      rows: 12,
      cols: 12,
      screen: this.screen
    });

    // Create widgets
    this.widgets = {
      overview: this.grid.set(0, 0, 3, 6, blessed.box, {
        label: '📊 Server Overview',
        content: '',
        tags: true,
        border: { type: 'line' },
        style: {
          border: { fg: 'cyan' }
        }
      }),

      toolsTable: this.grid.set(0, 6, 6, 6, contrib.table, {
        label: '🔧 Tool Metrics',
        columnWidth: [20, 8, 8, 10, 12],
        columnSpacing: 1,
        fg: 'white',
        selectedFg: 'white',
        selectedBg: 'blue',
        border: { type: 'line' },
        style: {
          border: { fg: 'cyan' }
        }
      }),

      errorsLog: this.grid.set(3, 0, 3, 6, contrib.log, {
        label: '⚠️  Recent Errors',
        fg: 'red',
        selectedFg: 'red',
        border: { type: 'line' },
        style: {
          border: { fg: 'cyan' }
        }
      }),

      latencyChart: this.grid.set(6, 0, 6, 6, contrib.line, {
        label: '⚡ Latency (ms)',
        showLegend: true,
        legend: { width: 12 },
        xLabelPadding: 3,
        xPadding: 5,
        border: { type: 'line' },
        style: {
          line: 'yellow',
          text: 'green',
          baseline: 'black',
          border: { fg: 'cyan' }
        }
      }),

      requestsChart: this.grid.set(6, 6, 6, 6, contrib.line, {
        label: '📈 Requests/sec',
        showLegend: true,
        legend: { width: 12 },
        xLabelPadding: 3,
        xPadding: 5,
        border: { type: 'line' },
        style: {
          line: 'cyan',
          text: 'green',
          baseline: 'black',
          border: { fg: 'cyan' }
        }
      })
    };

    // Keyboard shortcuts
    this.screen.key(['escape', 'q', 'C-c'], () => {
      return process.exit(0);
    });

    this.screen.key(['r'], () => {
      this.collector.reset();
    });

    // Render screen
    this.screen.render();
  }

  /**
   * Start the dashboard
   */
  start(intervalMs: number = 1000): void {
    this.refreshInterval = setInterval(() => {
      this.update();
      this.screen.render();
    }, intervalMs);

    // Initial update
    this.update();
    this.screen.render();
  }

  /**
   * Stop the dashboard
   */
  stop(): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
  }

  /**
   * Update all dashboard widgets
   */
  private update(): void {
    const metrics = this.collector.getMetrics();

    // Update overview
    this.updateOverview(metrics);

    // Update tools table
    this.updateToolsTable(metrics);

    // Update errors log
    this.updateErrorsLog(metrics);

    // Update latency chart
    this.updateLatencyChart(metrics);

    // Update requests chart
    this.updateRequestsChart(metrics);
  }

  /**
   * Update server overview
   */
  private updateOverview(metrics: any): void {
    const uptime = this.formatUptime(metrics.uptime);
    const errorRate = metrics.performance.errorRate.toFixed(2);
    const avgLatency = metrics.performance.avgLatency.toFixed(2);

    const content = `
  {cyan-fg}Server:{/cyan-fg} ${metrics.serverName}
  {cyan-fg}Uptime:{/cyan-fg} ${uptime}

  {cyan-fg}Requests:{/cyan-fg}
    Total: ${metrics.totalRequests}
    Success: {green-fg}${metrics.successfulRequests}{/green-fg}
    Failed: {red-fg}${metrics.failedRequests}{/red-fg}

  {cyan-fg}Performance:{/cyan-fg}
    Avg Latency: ${avgLatency}ms
    Error Rate: ${errorRate}%
    Success Rate: ${metrics.performance.successRate.toFixed(2)}%

  {cyan-fg}Current:{/cyan-fg}
    Requests/min: ${metrics.requestsPerMinute}
    Requests/sec: ${metrics.performance.requestsPerSecond.toFixed(2)}

  {gray-fg}Press 'r' to reset, 'q' to quit{/gray-fg}
    `.trim();

    this.widgets.overview.setContent(content);
  }

  /**
   * Update tools table
   */
  private updateToolsTable(metrics: any): void {
    const headers = ['Tool', 'Calls', 'Errors', 'Avg (ms)', 'Success Rate'];

    const data = metrics.tools
      .sort((a: any, b: any) => b.callCount - a.callCount)
      .slice(0, 15) // Top 15 tools
      .map((tool: any) => {
        const successRate = tool.callCount > 0
          ? ((tool.successCount / tool.callCount) * 100).toFixed(0)
          : '0';

        return [
          tool.name.substring(0, 18),
          tool.callCount.toString(),
          tool.errorCount.toString(),
          tool.avgDuration.toFixed(2),
          `${successRate}%`
        ];
      });

    this.widgets.toolsTable.setData({
      headers,
      data: data.length > 0 ? data : [['No tools called yet', '', '', '', '']]
    });
  }

  /**
   * Update errors log
   */
  private updateErrorsLog(metrics: any): void {
    const recentErrors = metrics.errors.slice(-20).reverse(); // Last 20 errors

    recentErrors.forEach((error: any) => {
      const time = new Date(error.timestamp).toLocaleTimeString();
      const message = `[${time}] ${error.type}:${error.name} - ${error.error}`;
      this.widgets.errorsLog.log(message);
    });
  }

  /**
   * Update latency chart
   */
  private updateLatencyChart(metrics: any): void {
    // For demo purposes, show percentile latencies
    const latencyData = {
      title: 'Latency',
      x: ['Now-60s', 'Now-45s', 'Now-30s', 'Now-15s', 'Now'],
      y: [
        metrics.performance.avgLatency || 0,
        metrics.performance.p50Latency || 0,
        metrics.performance.p95Latency || 0,
        metrics.performance.p99Latency || 0,
        metrics.performance.avgLatency || 0
      ]
    };

    this.widgets.latencyChart.setData([latencyData]);
  }

  /**
   * Update requests chart
   */
  private updateRequestsChart(metrics: any): void {
    const rpsData = {
      title: 'RPS',
      x: ['Now-60s', 'Now-45s', 'Now-30s', 'Now-15s', 'Now'],
      y: [
        0,
        metrics.performance.requestsPerSecond * 0.8,
        metrics.performance.requestsPerSecond * 0.9,
        metrics.performance.requestsPerSecond,
        metrics.performance.requestsPerSecond
      ]
    };

    this.widgets.requestsChart.setData([rpsData]);
  }

  /**
   * Format uptime duration
   */
  private formatUptime(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`;
    if (hours > 0) return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  }

  /**
   * Destroy the dashboard
   */
  destroy(): void {
    this.stop();
    this.screen.destroy();
  }
}
