#!/usr/bin/env node

/**
 * Comprehensive test suite for MCP Monitor
 * Tests all core functionality
 */

import { TelemetryCollector } from './dist/collector.js';
import { MCPInterceptor } from './dist/interceptor.js';
import { MonitorServer } from './dist/server.js';

// Test results tracking
let testsRun = 0;
let testsPassed = 0;
let testsFailed = 0;

function test(name, fn) {
  testsRun++;
  try {
    fn();
    testsPassed++;
    console.log(`✓ ${name}`);
  } catch (error) {
    testsFailed++;
    console.log(`✗ ${name}`);
    console.error(`  Error: ${error.message}`);
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

async function asyncTest(name, fn) {
  testsRun++;
  try {
    await fn();
    testsPassed++;
    console.log(`✓ ${name}`);
  } catch (error) {
    testsFailed++;
    console.log(`✗ ${name}`);
    console.error(`  Error: ${error.message}`);
  }
}

console.log('\n🧪 MCP Monitor Test Suite\n');

// Test 1: Collector instantiation
test('Collector can be instantiated', () => {
  const collector = new TelemetryCollector({
    serverName: 'test-server',
    port: 3000,
    retentionDays: 7,
    enableWebUI: false,
    enableMetricsExport: true
  });
  assert(collector !== null, 'Collector should be instantiable');
});

// Test 2: Record tool call
test('Can record tool call', () => {
  const collector = new TelemetryCollector({
    serverName: 'test',
    port: 3000,
    retentionDays: 1,
    enableWebUI: false,
    enableMetricsExport: true
  });

  collector.recordToolCall({
    toolName: 'test-tool',
    params: { foo: 'bar' },
    status: 'success',
    duration: 100
  });

  const metrics = collector.getMetrics();
  assert(metrics.totalRequests === 1, 'Should have 1 request');
  assert(metrics.tools.length === 1, 'Should have 1 tool metric');
  assert(metrics.tools[0].name === 'test-tool', 'Tool name should match');
});

// Test 3: Record resource access
test('Can record resource access', () => {
  const collector = new TelemetryCollector({
    serverName: 'test',
    port: 3000,
    retentionDays: 1,
    enableWebUI: false,
    enableMetricsExport: true
  });

  collector.recordResourceAccess({
    resourceUri: 'file:///test.txt',
    operation: 'read',
    status: 'success',
    duration: 50,
    bytesTransferred: 1024
  });

  const metrics = collector.getMetrics();
  assert(metrics.totalRequests === 1, 'Should have 1 request');
  assert(metrics.resources.length === 1, 'Should have 1 resource metric');
  assert(metrics.resources[0].totalBytesTransferred === 1024, 'Bytes should match');
});

// Test 4: Record prompt call
test('Can record prompt call', () => {
  const collector = new TelemetryCollector({
    serverName: 'test',
    port: 3000,
    retentionDays: 1,
    enableWebUI: false,
    enableMetricsExport: true
  });

  collector.recordPromptCall({
    promptName: 'test-prompt',
    args: { input: 'hello' },
    status: 'success',
    duration: 200,
    tokensGenerated: 50
  });

  const metrics = collector.getMetrics();
  assert(metrics.totalRequests === 1, 'Should have 1 request');
  assert(metrics.prompts.length === 1, 'Should have 1 prompt metric');
  assert(metrics.prompts[0].totalTokens === 50, 'Tokens should match');
});

// Test 5: Error tracking
test('Can track errors', () => {
  const collector = new TelemetryCollector({
    serverName: 'test',
    port: 3000,
    retentionDays: 1,
    enableWebUI: false,
    enableMetricsExport: true
  });

  collector.recordToolCall({
    toolName: 'failing-tool',
    params: {},
    status: 'error',
    error: 'Test error',
    duration: 10
  });

  const metrics = collector.getMetrics();
  assert(metrics.errors.length === 1, 'Should have 1 error');
  assert(metrics.errors[0].type === 'tool', 'Error type should be tool');
  assert(metrics.failedRequests === 1, 'Should have 1 failed request');
});

// Test 6: Performance metrics
test('Can calculate performance metrics', () => {
  const collector = new TelemetryCollector({
    serverName: 'test',
    port: 3000,
    retentionDays: 1,
    enableWebUI: false,
    enableMetricsExport: true
  });

  // Record multiple calls with different latencies
  [10, 20, 30, 40, 50, 100, 200, 300, 400, 500].forEach(latency => {
    collector.recordToolCall({
      toolName: 'test-tool',
      params: {},
      status: 'success',
      duration: latency
    });
  });

  const metrics = collector.getMetrics();
  assert(metrics.performance.avgLatency > 0, 'Should have avg latency');
  assert(metrics.performance.p50Latency > 0, 'Should have p50 latency');
  assert(metrics.performance.p95Latency > 0, 'Should have p95 latency');
  assert(metrics.performance.p99Latency > 0, 'Should have p99 latency');
});

// Test 7: Success rate calculation
test('Can calculate success rate', () => {
  const collector = new TelemetryCollector({
    serverName: 'test',
    port: 3000,
    retentionDays: 1,
    enableWebUI: false,
    enableMetricsExport: true
  });

  // 8 successful, 2 failed
  for (let i = 0; i < 8; i++) {
    collector.recordToolCall({
      toolName: 'tool',
      params: {},
      status: 'success',
      duration: 100
    });
  }

  for (let i = 0; i < 2; i++) {
    collector.recordToolCall({
      toolName: 'tool',
      params: {},
      status: 'error',
      error: 'Test error',
      duration: 50
    });
  }

  const metrics = collector.getMetrics();
  assert(metrics.performance.successRate === 80, 'Success rate should be 80%');
  assert(metrics.performance.errorRate === 20, 'Error rate should be 20%');
});

// Test 8: Metrics export
test('Can export metrics as JSON', () => {
  const collector = new TelemetryCollector({
    serverName: 'test',
    port: 3000,
    retentionDays: 1,
    enableWebUI: false,
    enableMetricsExport: true
  });

  collector.recordToolCall({
    toolName: 'test',
    params: {},
    status: 'success',
    duration: 100
  });

  const exported = collector.exportMetrics();
  assert(typeof exported === 'string', 'Export should be string');

  const parsed = JSON.parse(exported);
  assert(parsed.serverName === 'test', 'Exported data should contain server name');
  assert(parsed.totalRequests === 1, 'Exported data should contain requests');
});

// Test 9: Metrics reset
test('Can reset metrics', () => {
  const collector = new TelemetryCollector({
    serverName: 'test',
    port: 3000,
    retentionDays: 1,
    enableWebUI: false,
    enableMetricsExport: true
  });

  collector.recordToolCall({
    toolName: 'test',
    params: {},
    status: 'success',
    duration: 100
  });

  let metrics = collector.getMetrics();
  assert(metrics.totalRequests === 1, 'Should have 1 request before reset');

  collector.reset();

  metrics = collector.getMetrics();
  assert(metrics.totalRequests === 0, 'Should have 0 requests after reset');
});

// Test 10: Interceptor wrapping
test('Interceptor can wrap tools', async () => {
  const collector = new TelemetryCollector({
    serverName: 'test',
    port: 3000,
    retentionDays: 1,
    enableWebUI: false,
    enableMetricsExport: true
  });

  const interceptor = new MCPInterceptor(collector);

  const server = {
    tools: {
      'test-tool': async (params) => {
        return { result: 'success', params };
      }
    }
  };

  const instrumented = interceptor.instrument(server);

  await instrumented.tools['test-tool']({ input: 'test' });

  const metrics = collector.getMetrics();
  assert(metrics.totalRequests === 1, 'Should have recorded 1 tool call');
  assert(metrics.tools[0].name === 'test-tool', 'Tool name should match');
});

// Test 11: Interceptor error handling
test('Interceptor captures errors', async () => {
  const collector = new TelemetryCollector({
    serverName: 'test',
    port: 3000,
    retentionDays: 1,
    enableWebUI: false,
    enableMetricsExport: true
  });

  const interceptor = new MCPInterceptor(collector);

  const server = {
    tools: {
      'failing-tool': async () => {
        throw new Error('Test error');
      }
    }
  };

  const instrumented = interceptor.instrument(server);

  try {
    await instrumented.tools['failing-tool']({});
  } catch (error) {
    // Expected
  }

  const metrics = collector.getMetrics();
  assert(metrics.errors.length === 1, 'Should have captured error');
  assert(metrics.errors[0].error === 'Test error', 'Error message should match');
});

// Test 12: Server can start and stop
await asyncTest('Server can start and stop', async () => {
  const collector = new TelemetryCollector({
    serverName: 'test',
    port: 3001, // Different port to avoid conflicts
    retentionDays: 1,
    enableWebUI: false,
    enableMetricsExport: true
  });

  const server = new MonitorServer(collector, {
    serverName: 'test',
    port: 3001,
    retentionDays: 1,
    enableWebUI: false,
    enableMetricsExport: true
  });

  await server.start();
  assert(server.getURL() === 'http://localhost:3001', 'Server URL should be correct');

  await server.stop();
});

// Test 13: Tool metrics aggregation
test('Tool metrics are aggregated correctly', () => {
  const collector = new TelemetryCollector({
    serverName: 'test',
    port: 3000,
    retentionDays: 1,
    enableWebUI: false,
    enableMetricsExport: true
  });

  // Record multiple calls to same tool
  collector.recordToolCall({
    toolName: 'read-file',
    params: { path: 'file1.txt' },
    status: 'success',
    duration: 100
  });

  collector.recordToolCall({
    toolName: 'read-file',
    params: { path: 'file2.txt' },
    status: 'success',
    duration: 200
  });

  collector.recordToolCall({
    toolName: 'read-file',
    params: { path: 'file3.txt' },
    status: 'error',
    error: 'File not found',
    duration: 50
  });

  const metrics = collector.getMetrics();
  const readFileTool = metrics.tools.find(t => t.name === 'read-file');

  assert(readFileTool !== undefined, 'Tool should exist');
  assert(readFileTool.callCount === 3, 'Should have 3 calls');
  assert(readFileTool.successCount === 2, 'Should have 2 successes');
  assert(readFileTool.errorCount === 1, 'Should have 1 error');
  assert(readFileTool.avgDuration === 116.66666666666667, 'Avg duration should be ~116.67ms');
});

// Test 14: Uptime tracking
test('Uptime is tracked correctly', async () => {
  const collector = new TelemetryCollector({
    serverName: 'test',
    port: 3000,
    retentionDays: 1,
    enableWebUI: false,
    enableMetricsExport: true
  });

  // Wait 100ms
  await new Promise(resolve => setTimeout(resolve, 100));

  const metrics = collector.getMetrics();
  assert(metrics.uptime >= 100, 'Uptime should be at least 100ms');
});

// Test 15: Multiple tool types
test('Different tool types are tracked separately', () => {
  const collector = new TelemetryCollector({
    serverName: 'test',
    port: 3000,
    retentionDays: 1,
    enableWebUI: false,
    enableMetricsExport: true
  });

  collector.recordToolCall({
    toolName: 'tool-a',
    params: {},
    status: 'success',
    duration: 100
  });

  collector.recordToolCall({
    toolName: 'tool-b',
    params: {},
    status: 'success',
    duration: 200
  });

  collector.recordToolCall({
    toolName: 'tool-c',
    params: {},
    status: 'success',
    duration: 300
  });

  const metrics = collector.getMetrics();
  assert(metrics.tools.length === 3, 'Should have 3 different tools');
  assert(metrics.tools.every(t => t.callCount === 1), 'Each tool should have 1 call');
});

// Print summary
console.log('\n' + '='.repeat(50));
console.log(`\n📊 Test Summary:`);
console.log(`   Total: ${testsRun}`);
console.log(`   ✓ Passed: ${testsPassed}`);
console.log(`   ✗ Failed: ${testsFailed}`);
console.log(`   Pass Rate: ${Math.round((testsPassed / testsRun) * 100)}%\n`);

if (testsFailed > 0) {
  process.exit(1);
}
