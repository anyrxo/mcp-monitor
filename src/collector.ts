/**
 * MCP Telemetry Collector
 * Collects and aggregates MCP server telemetry data
 */

import { EventEmitter } from 'events';
import { nanoid } from 'nanoid';
import {
  MCPToolCall,
  MCPResourceAccess,
  MCPPromptCall,
  ServerMetrics,
  ToolMetrics,
  ResourceMetrics,
  PromptMetrics,
  ErrorLog,
  PerformanceMetrics,
  MonitorConfig
} from './types.js';

export class TelemetryCollector extends EventEmitter {
  private toolCalls: MCPToolCall[] = [];
  private resourceAccesses: MCPResourceAccess[] = [];
  private promptCalls: MCPPromptCall[] = [];
  private errors: ErrorLog[] = [];
  private startTime: number;
  private config: MonitorConfig;

  // Performance tracking
  private latencies: number[] = [];
  private requestTimestamps: number[] = [];

  constructor(config: MonitorConfig) {
    super();
    this.config = config;
    this.startTime = Date.now();

    // Cleanup old data periodically
    setInterval(() => this.cleanup(), 60000); // Every minute
  }

  /**
   * Record a tool call
   */
  recordToolCall(call: Omit<MCPToolCall, 'id' | 'timestamp'>): void {
    const toolCall: MCPToolCall = {
      id: nanoid(),
      timestamp: Date.now(),
      ...call
    };

    this.toolCalls.push(toolCall);
    this.recordRequest(toolCall.duration);

    if (toolCall.status === 'error') {
      this.recordError({
        type: 'tool',
        name: toolCall.toolName,
        error: toolCall.error || 'Unknown error'
      });
    }

    this.emit('tool_call', toolCall);
  }

  /**
   * Record a resource access
   */
  recordResourceAccess(access: Omit<MCPResourceAccess, 'id' | 'timestamp'>): void {
    const resourceAccess: MCPResourceAccess = {
      id: nanoid(),
      timestamp: Date.now(),
      ...access
    };

    this.resourceAccesses.push(resourceAccess);
    this.recordRequest(resourceAccess.duration);

    if (resourceAccess.status === 'error') {
      this.recordError({
        type: 'resource',
        name: resourceAccess.resourceUri,
        error: resourceAccess.error || 'Unknown error'
      });
    }

    this.emit('resource_access', resourceAccess);
  }

  /**
   * Record a prompt call
   */
  recordPromptCall(call: Omit<MCPPromptCall, 'id' | 'timestamp'>): void {
    const promptCall: MCPPromptCall = {
      id: nanoid(),
      timestamp: Date.now(),
      ...call
    };

    this.promptCalls.push(promptCall);
    this.recordRequest(promptCall.duration);

    if (promptCall.status === 'error') {
      this.recordError({
        type: 'prompt',
        name: promptCall.promptName,
        error: promptCall.error || 'Unknown error'
      });
    }

    this.emit('prompt_call', promptCall);
  }

  /**
   * Record an error
   */
  private recordError(error: Omit<ErrorLog, 'id' | 'timestamp'>): void {
    const errorLog: ErrorLog = {
      id: nanoid(),
      timestamp: Date.now(),
      ...error
    };

    this.errors.push(errorLog);
    this.emit('mcp_error', errorLog);
  }

  /**
   * Record request metrics
   */
  private recordRequest(duration?: number): void {
    const now = Date.now();
    this.requestTimestamps.push(now);

    if (duration !== undefined) {
      this.latencies.push(duration);
    }
  }

  /**
   * Get current server metrics
   */
  getMetrics(): ServerMetrics {
    const now = Date.now();
    const uptime = now - this.startTime;

    // Calculate tool metrics
    const toolMetrics = this.calculateToolMetrics();
    const resourceMetrics = this.calculateResourceMetrics();
    const promptMetrics = this.calculatePromptMetrics();
    const performance = this.calculatePerformance();

    const totalRequests = this.toolCalls.length + this.resourceAccesses.length + this.promptCalls.length;
    const successfulRequests = [
      ...this.toolCalls.filter(c => c.status === 'success'),
      ...this.resourceAccesses.filter(r => r.status === 'success'),
      ...this.promptCalls.filter(p => p.status === 'success')
    ].length;

    return {
      serverName: this.config.serverName,
      uptime,
      totalRequests,
      successfulRequests,
      failedRequests: totalRequests - successfulRequests,
      avgResponseTime: this.calculateAvgDuration(),
      requestsPerMinute: this.calculateRequestsPerMinute(),
      tools: toolMetrics,
      resources: resourceMetrics,
      prompts: promptMetrics,
      errors: this.errors.slice(-100), // Last 100 errors
      performance
    };
  }

  /**
   * Calculate tool metrics
   */
  private calculateToolMetrics(): ToolMetrics[] {
    const toolMap = new Map<string, ToolMetrics>();

    this.toolCalls.forEach(call => {
      const existing = toolMap.get(call.toolName) || {
        name: call.toolName,
        callCount: 0,
        successCount: 0,
        errorCount: 0,
        avgDuration: 0,
        lastCalled: 0,
        errors: []
      };

      existing.callCount++;
      if (call.status === 'success') existing.successCount++;
      if (call.status === 'error') {
        existing.errorCount++;
        if (call.error) existing.errors.push(call.error);
      }
      existing.lastCalled = Math.max(existing.lastCalled, call.timestamp);

      toolMap.set(call.toolName, existing);
    });

    // Calculate average durations
    toolMap.forEach((metrics, toolName) => {
      const durations = this.toolCalls
        .filter(c => c.toolName === toolName && c.duration !== undefined)
        .map(c => c.duration!);

      metrics.avgDuration = durations.length > 0
        ? durations.reduce((a, b) => a + b, 0) / durations.length
        : 0;
    });

    return Array.from(toolMap.values());
  }

  /**
   * Calculate resource metrics
   */
  private calculateResourceMetrics(): ResourceMetrics[] {
    const resourceMap = new Map<string, ResourceMetrics>();

    this.resourceAccesses.forEach(access => {
      const existing = resourceMap.get(access.resourceUri) || {
        uri: access.resourceUri,
        accessCount: 0,
        successCount: 0,
        errorCount: 0,
        totalBytesTransferred: 0,
        avgDuration: 0
      };

      existing.accessCount++;
      if (access.status === 'success') existing.successCount++;
      if (access.status === 'error') existing.errorCount++;
      if (access.bytesTransferred) {
        existing.totalBytesTransferred += access.bytesTransferred;
      }

      resourceMap.set(access.resourceUri, existing);
    });

    // Calculate average durations
    resourceMap.forEach((metrics, uri) => {
      const durations = this.resourceAccesses
        .filter(r => r.resourceUri === uri && r.duration !== undefined)
        .map(r => r.duration!);

      metrics.avgDuration = durations.length > 0
        ? durations.reduce((a, b) => a + b, 0) / durations.length
        : 0;
    });

    return Array.from(resourceMap.values());
  }

  /**
   * Calculate prompt metrics
   */
  private calculatePromptMetrics(): PromptMetrics[] {
    const promptMap = new Map<string, PromptMetrics>();

    this.promptCalls.forEach(call => {
      const existing = promptMap.get(call.promptName) || {
        name: call.promptName,
        callCount: 0,
        successCount: 0,
        errorCount: 0,
        avgDuration: 0,
        totalTokens: 0
      };

      existing.callCount++;
      if (call.status === 'success') existing.successCount++;
      if (call.status === 'error') existing.errorCount++;
      if (call.tokensGenerated) {
        existing.totalTokens += call.tokensGenerated;
      }

      promptMap.set(call.promptName, existing);
    });

    // Calculate average durations
    promptMap.forEach((metrics, name) => {
      const durations = this.promptCalls
        .filter(p => p.promptName === name && p.duration !== undefined)
        .map(p => p.duration!);

      metrics.avgDuration = durations.length > 0
        ? durations.reduce((a, b) => a + b, 0) / durations.length
        : 0;
    });

    return Array.from(promptMap.values());
  }

  /**
   * Calculate performance metrics
   */
  private calculatePerformance(): PerformanceMetrics {
    const sortedLatencies = [...this.latencies].sort((a, b) => a - b);
    const total = this.toolCalls.length + this.resourceAccesses.length + this.promptCalls.length;
    const errors = this.errors.length;

    return {
      avgLatency: sortedLatencies.length > 0
        ? sortedLatencies.reduce((a, b) => a + b, 0) / sortedLatencies.length
        : 0,
      p50Latency: this.percentile(sortedLatencies, 0.50),
      p95Latency: this.percentile(sortedLatencies, 0.95),
      p99Latency: this.percentile(sortedLatencies, 0.99),
      requestsPerSecond: this.calculateRequestsPerSecond(),
      errorRate: total > 0 ? (errors / total) * 100 : 0,
      successRate: total > 0 ? ((total - errors) / total) * 100 : 100
    };
  }

  /**
   * Calculate percentile
   */
  private percentile(sorted: number[], p: number): number {
    if (sorted.length === 0) return 0;
    const index = Math.ceil(sorted.length * p) - 1;
    return sorted[Math.max(0, index)];
  }

  /**
   * Calculate requests per second
   */
  private calculateRequestsPerSecond(): number {
    const now = Date.now();
    const oneSecondAgo = now - 1000;
    const recentRequests = this.requestTimestamps.filter(t => t >= oneSecondAgo);
    return recentRequests.length;
  }

  /**
   * Calculate requests per minute
   */
  private calculateRequestsPerMinute(): number {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    const recentRequests = this.requestTimestamps.filter(t => t >= oneMinuteAgo);
    return recentRequests.length;
  }

  /**
   * Calculate average duration
   */
  private calculateAvgDuration(): number {
    if (this.latencies.length === 0) return 0;
    return this.latencies.reduce((a, b) => a + b, 0) / this.latencies.length;
  }

  /**
   * Cleanup old data
   */
  private cleanup(): void {
    const retentionMs = this.config.retentionDays * 24 * 60 * 60 * 1000;
    const cutoff = Date.now() - retentionMs;

    this.toolCalls = this.toolCalls.filter(c => c.timestamp >= cutoff);
    this.resourceAccesses = this.resourceAccesses.filter(r => r.timestamp >= cutoff);
    this.promptCalls = this.promptCalls.filter(p => p.timestamp >= cutoff);
    this.errors = this.errors.filter(e => e.timestamp >= cutoff);
    this.latencies = this.latencies.slice(-10000); // Keep last 10k latencies
    this.requestTimestamps = this.requestTimestamps.filter(t => t >= cutoff);
  }

  /**
   * Export metrics as JSON
   */
  exportMetrics(): string {
    return JSON.stringify(this.getMetrics(), null, 2);
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    this.toolCalls = [];
    this.resourceAccesses = [];
    this.promptCalls = [];
    this.errors = [];
    this.latencies = [];
    this.requestTimestamps = [];
    this.startTime = Date.now();
  }
}
