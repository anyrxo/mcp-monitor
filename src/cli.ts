#!/usr/bin/env node

/**
 * MCP Monitor CLI
 * Command-line interface for MCP server monitoring
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { TelemetryCollector } from './collector.js';
import { MonitorServer } from './server.js';
import { MonitorDashboard } from './dashboard.js';
import { MonitorConfig, ServerMetrics } from './types.js';

const program = new Command();

const banner = `
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   ${chalk.cyan('███╗   ███╗ ██████╗██████╗     ███╗   ███╗ ██████╗ ███╗   ██╗')}   ║
║   ${chalk.cyan('████╗ ████║██╔════╝██╔══██╗    ████╗ ████║██╔═══██╗████╗  ██║')}   ║
║   ${chalk.cyan('██╔████╔██║██║     ██████╔╝    ██╔████╔██║██║   ██║██╔██╗ ██║')}   ║
║   ${chalk.cyan('██║╚██╔╝██║██║     ██╔═══╝     ██║╚██╔╝██║██║   ██║██║╚██╗██║')}   ║
║   ${chalk.cyan('██║ ╚═╝ ██║╚██████╗██║         ██║ ╚═╝ ██║╚██████╔╝██║ ╚████║')}   ║
║   ${chalk.cyan('╚═╝     ╚═╝ ╚═════╝╚═╝         ╚═╝     ╚═╝ ╚═════╝ ╚═╝  ╚═══╝')}   ║
║                                                           ║
║   ${chalk.white('Real-time Observability for MCP Servers')}               ║
║   ${chalk.gray('Monitor • Debug • Optimize')}                             ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
`;

program
  .name('mcp-monitor')
  .description('Real-time observability and monitoring for MCP servers')
  .version('1.0.0');

// Dashboard command
program
  .command('dashboard')
  .description('Launch interactive terminal dashboard')
  .option('-n, --name <name>', 'Server name', 'MCP Server')
  .option('-p, --port <port>', 'API server port', '3000')
  .option('--no-api', 'Disable API server')
  .action(async (options) => {
    console.log(banner);

    const config: MonitorConfig = {
      serverName: options.name,
      port: parseInt(options.port),
      retentionDays: 7,
      enableWebUI: false,
      enableMetricsExport: true
    };

    const collector = new TelemetryCollector(config);
    const dashboard = new MonitorDashboard(collector);

    // Start API server if enabled
    if (options.api) {
      const server = new MonitorServer(collector, config);
      await server.start();
      console.log(chalk.green(`✓ API server running on ${server.getURL()}\n`));
    }

    console.log(chalk.cyan('Starting dashboard...\n'));
    dashboard.start(1000);

    // Graceful shutdown
    process.on('SIGINT', () => {
      dashboard.destroy();
      process.exit(0);
    });
  });

// Server command
program
  .command('server')
  .description('Start monitoring API server')
  .option('-n, --name <name>', 'Server name', 'MCP Server')
  .option('-p, --port <port>', 'Server port', '3000')
  .option('-r, --retention <days>', 'Data retention in days', '7')
  .action(async (options) => {
    console.log(banner);

    const config: MonitorConfig = {
      serverName: options.name,
      port: parseInt(options.port),
      retentionDays: parseInt(options.retention),
      enableWebUI: true,
      enableMetricsExport: true
    };

    const collector = new TelemetryCollector(config);
    const server = new MonitorServer(collector, config);

    await server.start();

    console.log(chalk.green(`\n✓ MCP Monitor server running`));
    console.log(chalk.cyan(`\nEndpoints:`));
    console.log(`  API:       ${server.getURL()}/api/metrics`);
    console.log(`  WebSocket: ws://localhost:${config.port}`);
    console.log(`  Export:    ${server.getURL()}/api/export`);
    console.log(chalk.gray(`\nPress Ctrl+C to stop\n`));

    // Graceful shutdown
    process.on('SIGINT', async () => {
      console.log(chalk.yellow('\n\nShutting down...'));
      await server.stop();
      process.exit(0);
    });
  });

// Export command
program
  .command('export <url>')
  .description('Export metrics from a running monitor server')
  .option('-o, --output <file>', 'Output file', `mcp-metrics-${Date.now()}.json`)
  .action(async (url, options) => {
    try {
      const response = await fetch(`${url}/api/export`);

      if (!response.ok) {
        console.error(chalk.red(`Error: ${response.statusText}`));
        process.exit(1);
      }

      const data = await response.text();
      const fs = await import('fs/promises');
      await fs.writeFile(options.output, data, 'utf-8');

      console.log(chalk.green(`✓ Metrics exported to ${options.output}`));
    } catch (error) {
      console.error(chalk.red(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`));
      process.exit(1);
    }
  });

// Status command
program
  .command('status <url>')
  .description('Get current status from a running monitor server')
  .option('--json', 'Output as JSON')
  .action(async (url, options) => {
    try {
      const response = await fetch(`${url}/api/metrics`);

      if (!response.ok) {
        console.error(chalk.red(`Error: ${response.statusText}`));
        process.exit(1);
      }

      const metrics = await response.json() as ServerMetrics;

      if (options.json) {
        console.log(JSON.stringify(metrics, null, 2));
      } else {
        console.log(chalk.cyan('\n📊 Server Status\n'));
        console.log(`${chalk.white('Server:')} ${metrics.serverName}`);
        console.log(`${chalk.white('Uptime:')} ${formatUptime(metrics.uptime)}`);
        console.log(`${chalk.white('Total Requests:')} ${metrics.totalRequests}`);
        console.log(`${chalk.white('Success Rate:')} ${metrics.performance.successRate.toFixed(2)}%`);
        console.log(`${chalk.white('Avg Latency:')} ${metrics.performance.avgLatency.toFixed(2)}ms`);
        console.log(`${chalk.white('Requests/min:')} ${metrics.requestsPerMinute}`);

        if (metrics.tools.length > 0) {
          console.log(chalk.cyan('\n🔧 Top Tools:\n'));
          metrics.tools
            .sort((a: any, b: any) => b.callCount - a.callCount)
            .slice(0, 5)
            .forEach((tool: any) => {
              console.log(`  ${tool.name}: ${tool.callCount} calls (${tool.errorCount} errors)`);
            });
        }

        if (metrics.errors.length > 0) {
          console.log(chalk.cyan('\n⚠️  Recent Errors:\n'));
          metrics.errors.slice(-5).forEach((error: any) => {
            const time = new Date(error.timestamp).toLocaleTimeString();
            console.log(chalk.red(`  [${time}] ${error.type}:${error.name} - ${error.error}`));
          });
        }

        console.log('');
      }
    } catch (error) {
      console.error(chalk.red(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`));
      process.exit(1);
    }
  });

function formatUptime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

program.parse();
