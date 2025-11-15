# 📊 MCP Monitor - Real-time Observability for MCP Servers

> **Production-ready monitoring, debugging, and performance analysis for Model Context Protocol (MCP) servers**

[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![Tests](https://img.shields.io/badge/tests-15%2F15%20passing-brightgreen.svg)]()
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

## 📖 Overview

**MCP Monitor** is a lightweight, open-source observability platform for Model Context Protocol (MCP) servers. It provides real-time monitoring, performance metrics, error tracking, and debugging capabilities - think "htop" for MCP servers.

### Why MCP Monitor?

As MCP adoption grows, server observability becomes critical for:

- **Production Debugging**: Track down issues in real-time
- **Performance Optimization**: Identify bottlenecks and slow tools
- **Error Monitoring**: Catch and diagnose failures
- **Usage Analytics**: Understand which tools are called most
- **Capacity Planning**: Monitor request rates and latency

### Key Features

✅ **Real-time Terminal Dashboard** - Beautiful blessed-based UI with live metrics
✅ **HTTP/WebSocket API** - Programmatic access to metrics
✅ **Automatic Instrumentation** - Zero-code integration via interceptor
✅ **Performance Metrics** - P50/P95/P99 latency, RPS, error rates
✅ **Tool Analytics** - Per-tool success rates, call counts, avg duration
✅ **Resource Tracking** - Monitor file access, bytes transferred
✅ **Prompt Monitoring** - Track prompt calls and token usage
✅ **Error Logging** - Capture and categorize all errors
✅ **Metrics Export** - JSON export for analysis and archival

## 🚀 Quick Start

### Installation

```bash
# Clone repository
git clone <repository-url>
cd mcp-monitor

# Install dependencies
npm install

# Build TypeScript
npm run build
```

### Basic Usage

#### 1. Interactive Dashboard

Launch a real-time terminal dashboard:

```bash
node dist/cli.js dashboard --name "My MCP Server" --port 3000
```

Press `r` to reset metrics, `q` to quit.

#### 2. Monitoring Server

Start an HTTP API server for remote monitoring:

```bash
node dist/cli.js server --port 3000
```

Access metrics at:
- API: `http://localhost:3000/api/metrics`
- Export: `http://localhost:3000/api/export`
- WebSocket: `ws://localhost:3000`

#### 3. Instrument Your MCP Server

```javascript
import { TelemetryCollector, MCPInterceptor } from 'mcp-monitor';

// Your MCP server
const myServer = {
  tools: {
    'read-file': async (params) => { /* ... */ },
    'write-file': async (params) => { /* ... */ }
  }
};

// Create collector
const collector = new TelemetryCollector({
  serverName: 'My MCP Server',
  port: 3000,
  retentionDays: 7,
  enableWebUI: true,
  enableMetricsExport: true
});

// Instrument server (automatic monitoring)
const interceptor = new MCPInterceptor(collector);
const monitoredServer = interceptor.instrument(myServer);

// Use monitoredServer instead of myServer - all calls are now monitored!
await monitoredServer.tools['read-file']({ path: '/tmp/file.txt' });
```

## 📊 Dashboard Preview

```
╔═══════════════════════════════════════════════════════════╗
║   MCP MONITOR - Real-time Observability for MCP Servers  ║
╚═══════════════════════════════════════════════════════════╝

┌─ 📊 Server Overview ─────────┐  ┌─ 🔧 Tool Metrics ──────────┐
│ Server: My MCP Server        │  │ Tool         Calls  Errors │
│ Uptime: 5m 23s               │  │ read-file    142    3      │
│                              │  │ write-file   89     0      │
│ Requests:                    │  │ list-dir     67     1      │
│   Total: 298                 │  └────────────────────────────┘
│   Success: 294               │
│   Failed: 4                  │  ┌─ ⚡ Latency (ms) ──────────┐
│                              │  │ Avg: 45.2ms                │
│ Performance:                 │  │ P50: 38ms                  │
│   Avg Latency: 45.2ms        │  │ P95: 127ms                 │
│   Error Rate: 1.34%          │  │ P99: 203ms                 │
│   Success Rate: 98.66%       │  └────────────────────────────┘
│                              │
│ Current:                     │  ┌─ ⚠️  Recent Errors ─────────┐
│   Requests/min: 56           │  │ [10:42:15] tool:read-file  │
│   Requests/sec: 0.93         │  │   File not found           │
│                              │  │ [10:41:32] tool:list-dir   │
│ Press 'r' to reset, 'q' quit │  │   Permission denied        │
└──────────────────────────────┘  └────────────────────────────┘
```

## 🔧 CLI Commands

### `dashboard`

Launch interactive terminal dashboard with live metrics.

```bash
node dist/cli.js dashboard [options]
```

**Options:**
- `-n, --name <name>` - Server name (default: "MCP Server")
- `-p, --port <port>` - API server port (default: 3000)
- `--no-api` - Disable API server

**Keyboard shortcuts:**
- `r` - Reset all metrics
- `q` / `Escape` / `Ctrl+C` - Quit

### `server`

Start HTTP API server for programmatic access to metrics.

```bash
node dist/cli.js server [options]
```

**Options:**
- `-n, --name <name>` - Server name (default: "MCP Server")
- `-p, --port <port>` - Server port (default: 3000)
- `-r, --retention <days>` - Data retention in days (default: 7)

**Endpoints:**
- `GET /health` - Health check
- `GET /api/metrics` - Current metrics (JSON)
- `GET /api/export` - Export all metrics (download)
- `POST /api/tool-call` - Record tool call
- `POST /api/resource-access` - Record resource access
- `POST /api/prompt-call` - Record prompt call
- `POST /api/reset` - Reset all metrics
- `WebSocket /` - Real-time metrics stream

### `status`

Get current status from a running monitor server.

```bash
node dist/cli.js status <url> [options]
```

**Options:**
- `--json` - Output as JSON

**Example:**
```bash
node dist/cli.js status http://localhost:3000
```

### `export`

Export metrics from a running monitor server to a file.

```bash
node dist/cli.js export <url> [options]
```

**Options:**
- `-o, --output <file>` - Output file (default: `mcp-metrics-{timestamp}.json`)

**Example:**
```bash
node dist/cli.js export http://localhost:3000 -o metrics.json
```

## 📈 Metrics Collected

### Tool Metrics
- **Call count** - Total invocations
- **Success/error count** - Status tracking
- **Average duration** - Performance analysis
- **Last called** - Timestamp
- **Error messages** - Debugging

### Resource Metrics
- **Access count** - Total accesses
- **Success/error count** - Status tracking
- **Bytes transferred** - Data volume
- **Average duration** - Performance

### Prompt Metrics
- **Call count** - Total invocations
- **Success/error count** - Status tracking
- **Average duration** - Performance
- **Token count** - Usage tracking

### Performance Metrics
- **Average latency** - Mean response time
- **P50/P95/P99 latency** - Percentile analysis
- **Requests per second** - Throughput
- **Error rate** - Reliability metric
- **Success rate** - Quality metric

### Server Metrics
- **Uptime** - Server running time
- **Total requests** - All-time count
- **Requests per minute** - Current load
- **Error log** - Recent errors with timestamps

## 🔌 API Integration

### HTTP API

Record telemetry from external MCP servers:

```bash
# Record a tool call
curl -X POST http://localhost:3000/api/tool-call \
  -H "Content-Type: application/json" \
  -d '{
    "toolName": "read-file",
    "params": {"path": "/tmp/test.txt"},
    "status": "success",
    "duration": 123
  }'

# Get current metrics
curl http://localhost:3000/api/metrics
```

### WebSocket Real-time Stream

```javascript
const ws = new WebSocket('ws://localhost:3000');

ws.on('message', (data) => {
  const message = JSON.parse(data);

  if (message.type === 'metrics') {
    console.log('Server metrics:', message.data);
  } else if (message.type === 'tool_call') {
    console.log('Tool called:', message.data.toolName);
  } else if (message.type === 'error') {
    console.error('Error occurred:', message.data);
  }
});
```

### Programmatic Usage

```javascript
import { TelemetryCollector } from 'mcp-monitor';

const collector = new TelemetryCollector(config);

// Record tool call
collector.recordToolCall({
  toolName: 'read-file',
  params: { path: '/tmp/file.txt' },
  status: 'success',
  duration: 123,
  result: { content: '...' }
});

// Get metrics
const metrics = collector.getMetrics();
console.log(`Total requests: ${metrics.totalRequests}`);
console.log(`Success rate: ${metrics.performance.successRate}%`);

// Export as JSON
const exported = collector.exportMetrics();
fs.writeFileSync('metrics.json', exported);

// Reset metrics
collector.reset();
```

## 🧪 Testing & Validation

### Run Tests

```bash
npm test
```

### Test Results

```
📊 Test Summary:
   Total: 15
   ✓ Passed: 15
   ✗ Failed: 0
   Pass Rate: 100%
```

### What's Tested

- ✅ Collector instantiation and configuration
- ✅ Tool call recording and aggregation
- ✅ Resource access tracking
- ✅ Prompt call monitoring
- ✅ Error tracking and logging
- ✅ Performance metrics calculation
- ✅ Success/error rate calculation
- ✅ Metrics export to JSON
- ✅ Metrics reset functionality
- ✅ Interceptor tool wrapping
- ✅ Interceptor error handling
- ✅ HTTP server start/stop
- ✅ Multi-tool aggregation
- ✅ Uptime tracking
- ✅ Multiple tool type separation

## 📊 Example Output

### JSON Export

```json
{
  "serverName": "Example MCP Server",
  "uptime": 323000,
  "totalRequests": 298,
  "successfulRequests": 294,
  "failedRequests": 4,
  "avgResponseTime": 45.2,
  "requestsPerMinute": 56,
  "tools": [
    {
      "name": "read-file",
      "callCount": 142,
      "successCount": 139,
      "errorCount": 3,
      "avgDuration": 38.7,
      "lastCalled": 1700000000000,
      "errors": ["File not found", "Permission denied"]
    }
  ],
  "performance": {
    "avgLatency": 45.2,
    "p50Latency": 38,
    "p95Latency": 127,
    "p99Latency": 203,
    "requestsPerSecond": 0.93,
    "errorRate": 1.34,
    "successRate": 98.66
  }
}
```

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   MCP Server (Your Code)                │
└───────────────────────┬─────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│               MCPInterceptor (Middleware)               │
│         Wraps tools/resources/prompts                   │
└───────────────────────┬─────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│            TelemetryCollector (Core Engine)             │
│  - Collects metrics                                     │
│  - Aggregates statistics                                │
│  - Calculates performance                               │
└──────┬──────────────────────────────────┬───────────────┘
       │                                  │
       ▼                                  ▼
┌─────────────────┐              ┌──────────────────────┐
│  MonitorServer  │              │  MonitorDashboard    │
│  (HTTP/WS API)  │              │  (Terminal UI)       │
└─────────────────┘              └──────────────────────┘
```

## 🚦 Use Cases

### 1. Development Debugging

Monitor your MCP server during development to catch issues early:

```bash
node dist/cli.js dashboard --name "Dev Server"
```

### 2. Production Monitoring

Deploy the monitoring API alongside your MCP server:

```javascript
const server = new MonitorServer(collector, config);
await server.start();

// Export metrics every hour
setInterval(() => {
  fs.writeFileSync(
    `metrics-${Date.now()}.json`,
    collector.exportMetrics()
  );
}, 3600000);
```

### 3. Performance Analysis

Identify slow tools and optimize:

```javascript
const metrics = collector.getMetrics();

// Find slowest tools
const slowTools = metrics.tools
  .sort((a, b) => b.avgDuration - a.avgDuration)
  .slice(0, 5);

console.log('Slowest tools:', slowTools);
```

### 4. CI/CD Integration

Fail builds if error rate exceeds threshold:

```javascript
const metrics = collector.getMetrics();

if (metrics.performance.errorRate > 5) {
  console.error(`Error rate too high: ${metrics.performance.errorRate}%`);
  process.exit(1);
}
```

## 🔒 Security

- **No data persistence** - All metrics stored in memory
- **No external dependencies** for core monitoring
- **Local-only by default** - Binds to localhost
- **Configurable retention** - Auto-cleanup old data
- **No auth required** - Designed for trusted environments

> **Note**: For production use, add authentication middleware to the HTTP server.

## 📝 Configuration

```typescript
const config: MonitorConfig = {
  serverName: 'My MCP Server',    // Server identifier
  port: 3000,                      // API server port
  retentionDays: 7,                // Data retention (auto-cleanup)
  enableWebUI: true,               // Enable web interface
  enableMetricsExport: true,       // Allow metrics export
  alerting: {                      // Optional alerting
    errorRateThreshold: 5,         // Alert if error rate > 5%
    latencyThreshold: 1000         // Alert if latency > 1000ms
  }
};
```

## 🤝 Contributing

Contributions welcome! Please read CONTRIBUTING.md for guidelines.

## 📄 License

MIT License - see LICENSE file for details

## 🔗 Resources

- [Model Context Protocol Docs](https://modelcontextprotocol.io/)
- [MCP Observability Guide](https://signoz.io/blog/mcp-observability-with-otel/)
- [Blessed Terminal UI](https://github.com/chjj/blessed)

---

**Built with ❤️ for the MCP community**
