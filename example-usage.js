#!/usr/bin/env node

/**
 * Example: Using MCP Monitor with an MCP Server
 * Demonstrates how to integrate monitoring into your MCP server
 */

import { TelemetryCollector, MCPInterceptor, MonitorServer } from './dist/index.js';

// Example MCP Server
const myMCPServer = {
  tools: {
    'read-file': async (params) => {
      console.log(`Reading file: ${params.path}`);
      // Simulate file reading
      await new Promise(resolve => setTimeout(resolve, Math.random() * 200));

      if (Math.random() > 0.9) {
        throw new Error('File not found');
      }

      return { content: 'File contents here...', size: 1024 };
    },

    'write-file': async (params) => {
      console.log(`Writing file: ${params.path}`);
      await new Promise(resolve => setTimeout(resolve, Math.random() * 300));

      if (Math.random() > 0.95) {
        throw new Error('Permission denied');
      }

      return { success: true, bytesWritten: params.content.length };
    },

    'list-directory': async (params) => {
      console.log(`Listing directory: ${params.path}`);
      await new Promise(resolve => setTimeout(resolve, Math.random() * 150));

      return {
        files: ['file1.txt', 'file2.txt', 'file3.txt'],
        count: 3
      };
    }
  },

  resources: {
    'config://app.json': async () => {
      await new Promise(resolve => setTimeout(resolve, 50));
      return JSON.stringify({ version: '1.0.0', env: 'production' });
    }
  },

  prompts: {
    'code-review': async (args) => {
      await new Promise(resolve => setTimeout(resolve, Math.random() * 500));
      return `Reviewing code for: ${args.file}`;
    }
  }
};

async function main() {
  console.log('🚀 MCP Monitor Example\n');

  // 1. Create telemetry collector
  const collector = new TelemetryCollector({
    serverName: 'Example MCP Server',
    port: 3000,
    retentionDays: 7,
    enableWebUI: true,
    enableMetricsExport: true
  });

  // 2. Instrument your MCP server
  const interceptor = new MCPInterceptor(collector);
  const monitoredServer = interceptor.instrument(myMCPServer);

  // 3. Start monitoring API server
  const monitorServer = new MonitorServer(collector, {
    serverName: 'Example MCP Server',
    port: 3000,
    retentionDays: 7,
    enableWebUI: true,
    enableMetricsExport: true
  });

  await monitorServer.start();

  console.log('✓ Monitoring server started');
  console.log('  API: http://localhost:3000/api/metrics');
  console.log('  Export: http://localhost:3000/api/export');
  console.log('  WebSocket: ws://localhost:3000\n');

  // 4. Simulate MCP server activity
  console.log('📊 Simulating MCP server activity...\n');

  const tools = Object.keys(monitoredServer.tools);
  let callCount = 0;

  const interval = setInterval(async () => {
    try {
      // Randomly call tools
      const tool = tools[Math.floor(Math.random() * tools.length)];

      if (tool === 'read-file') {
        await monitoredServer.tools[tool]({ path: `/tmp/file${Math.floor(Math.random() * 10)}.txt` });
      } else if (tool === 'write-file') {
        await monitoredServer.tools[tool]({ path: '/tmp/output.txt', content: 'Hello World' });
      } else if (tool === 'list-directory') {
        await monitoredServer.tools[tool]({ path: '/tmp' });
      }

      callCount++;

      // Print stats every 10 calls
      if (callCount % 10 === 0) {
        const metrics = collector.getMetrics();
        console.log(`\n📈 Stats after ${callCount} calls:`);
        console.log(`  Total Requests: ${metrics.totalRequests}`);
        console.log(`  Success Rate: ${metrics.performance.successRate.toFixed(2)}%`);
        console.log(`  Avg Latency: ${metrics.performance.avgLatency.toFixed(2)}ms`);
        console.log(`  Errors: ${metrics.errors.length}`);

        if (metrics.tools.length > 0) {
          console.log('\n  Top Tools:');
          metrics.tools
            .sort((a, b) => b.callCount - a.callCount)
            .slice(0, 3)
            .forEach(tool => {
              console.log(`    ${tool.name}: ${tool.callCount} calls (${tool.errorCount} errors)`);
            });
        }
      }
    } catch (error) {
      // Errors are automatically tracked
    }
  }, 1000); // Call every second

  // Run for 60 seconds then print final stats
  setTimeout(async () => {
    clearInterval(interval);

    const metrics = collector.getMetrics();

    console.log('\n' + '='.repeat(60));
    console.log('\n📊 Final Statistics:\n');
    console.log(`  Server: ${metrics.serverName}`);
    console.log(`  Uptime: ${Math.floor(metrics.uptime / 1000)}s`);
    console.log(`  Total Requests: ${metrics.totalRequests}`);
    console.log(`  Successful: ${metrics.successfulRequests}`);
    console.log(`  Failed: ${metrics.failedRequests}`);
    console.log(`  Success Rate: ${metrics.performance.successRate.toFixed(2)}%`);
    console.log(`  Error Rate: ${metrics.performance.errorRate.toFixed(2)}%`);

    console.log('\n  Performance:');
    console.log(`    Avg Latency: ${metrics.performance.avgLatency.toFixed(2)}ms`);
    console.log(`    P50 Latency: ${metrics.performance.p50Latency.toFixed(2)}ms`);
    console.log(`    P95 Latency: ${metrics.performance.p95Latency.toFixed(2)}ms`);
    console.log(`    P99 Latency: ${metrics.performance.p99Latency.toFixed(2)}ms`);
    console.log(`    Requests/sec: ${metrics.performance.requestsPerSecond.toFixed(2)}`);

    if (metrics.tools.length > 0) {
      console.log('\n  Tool Breakdown:');
      metrics.tools.forEach(tool => {
        const successRate = (tool.successCount / tool.callCount * 100).toFixed(0);
        console.log(`    ${tool.name}:`);
        console.log(`      Calls: ${tool.callCount}`);
        console.log(`      Success Rate: ${successRate}%`);
        console.log(`      Avg Duration: ${tool.avgDuration.toFixed(2)}ms`);
      });
    }

    if (metrics.errors.length > 0) {
      console.log(`\n  Total Errors: ${metrics.errors.length}`);
      console.log('\n  Recent Errors:');
      metrics.errors.slice(-5).forEach(error => {
        const time = new Date(error.timestamp).toLocaleTimeString();
        console.log(`    [${time}] ${error.type}:${error.name} - ${error.error}`);
      });
    }

    console.log('\n' + '='.repeat(60));
    console.log('\n✓ Metrics exported to: http://localhost:3000/api/export');
    console.log('✓ View live metrics at: http://localhost:3000/api/metrics\n');

    await monitorServer.stop();
    process.exit(0);
  }, 60000); // 60 seconds

  // Graceful shutdown
  process.on('SIGINT', async () => {
    clearInterval(interval);
    await monitorServer.stop();
    process.exit(0);
  });
}

main().catch(console.error);
