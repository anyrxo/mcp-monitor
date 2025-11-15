/**
 * MCP Monitor Types
 * Telemetry and monitoring data structures for MCP servers
 */

export interface MCPToolCall {
  id: string;
  timestamp: number;
  toolName: string;
  params: Record<string, any>;
  duration?: number;
  status: 'pending' | 'success' | 'error';
  error?: string;
  result?: any;
  metadata?: {
    modelName?: string;
    userId?: string;
    sessionId?: string;
  };
}

export interface MCPResourceAccess {
  id: string;
  timestamp: number;
  resourceUri: string;
  operation: 'read' | 'write' | 'list';
  duration?: number;
  status: 'success' | 'error';
  error?: string;
  bytesTransferred?: number;
}

export interface MCPPromptCall {
  id: string;
  timestamp: number;
  promptName: string;
  args: Record<string, any>;
  duration?: number;
  status: 'success' | 'error';
  error?: string;
  tokensGenerated?: number;
}

export interface PerformanceMetrics {
  avgLatency: number;
  p50Latency: number;
  p95Latency: number;
  p99Latency: number;
  requestsPerSecond: number;
  errorRate: number;
  successRate: number;
}

export interface ServerMetrics {
  serverName: string;
  uptime: number;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  avgResponseTime: number;
  requestsPerMinute: number;
  tools: ToolMetrics[];
  resources: ResourceMetrics[];
  prompts: PromptMetrics[];
  errors: ErrorLog[];
  performance: PerformanceMetrics;
}

export interface ToolMetrics {
  name: string;
  callCount: number;
  successCount: number;
  errorCount: number;
  avgDuration: number;
  lastCalled: number;
  errors: string[];
}

export interface ResourceMetrics {
  uri: string;
  accessCount: number;
  successCount: number;
  errorCount: number;
  totalBytesTransferred: number;
  avgDuration: number;
}

export interface PromptMetrics {
  name: string;
  callCount: number;
  successCount: number;
  errorCount: number;
  avgDuration: number;
  totalTokens: number;
}

export interface ErrorLog {
  id: string;
  timestamp: number;
  type: 'tool' | 'resource' | 'prompt' | 'server';
  name: string;
  error: string;
  stackTrace?: string;
}

export interface MonitorConfig {
  serverName: string;
  port: number;
  retentionDays: number;
  enableWebUI: boolean;
  enableMetricsExport: boolean;
  alerting?: {
    errorRateThreshold: number;
    latencyThreshold: number;
  };
}

export interface Alert {
  id: string;
  timestamp: number;
  severity: 'critical' | 'high' | 'medium' | 'low';
  type: 'error_rate' | 'latency' | 'server_down';
  message: string;
  resolved: boolean;
}
