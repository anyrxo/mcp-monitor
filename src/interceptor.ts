/**
 * MCP Interceptor
 * Middleware to intercept and monitor MCP server calls
 */

import { TelemetryCollector } from './collector.js';

export interface MCPServer {
  tools?: Record<string, Function>;
  resources?: Record<string, Function>;
  prompts?: Record<string, Function>;
}

export class MCPInterceptor {
  private collector: TelemetryCollector;

  constructor(collector: TelemetryCollector) {
    this.collector = collector;
  }

  /**
   * Wrap an MCP server to intercept all calls
   */
  instrument(server: MCPServer): MCPServer {
    const instrumented: MCPServer = {};

    // Wrap tools
    if (server.tools) {
      instrumented.tools = {};
      for (const [name, tool] of Object.entries(server.tools)) {
        instrumented.tools[name] = this.wrapTool(name, tool);
      }
    }

    // Wrap resources
    if (server.resources) {
      instrumented.resources = {};
      for (const [name, resource] of Object.entries(server.resources)) {
        instrumented.resources[name] = this.wrapResource(name, resource);
      }
    }

    // Wrap prompts
    if (server.prompts) {
      instrumented.prompts = {};
      for (const [name, prompt] of Object.entries(server.prompts)) {
        instrumented.prompts[name] = this.wrapPrompt(name, prompt);
      }
    }

    return instrumented;
  }

  /**
   * Wrap a tool function to record telemetry
   */
  private wrapTool(toolName: string, tool: Function): Function {
    return async (...args: any[]) => {
      const startTime = Date.now();
      const params = args[0] || {};

      try {
        const result = await tool(...args);
        const duration = Date.now() - startTime;

        this.collector.recordToolCall({
          toolName,
          params,
          duration,
          status: 'success',
          result
        });

        return result;
      } catch (error) {
        const duration = Date.now() - startTime;

        this.collector.recordToolCall({
          toolName,
          params,
          duration,
          status: 'error',
          error: error instanceof Error ? error.message : String(error)
        });

        throw error;
      }
    };
  }

  /**
   * Wrap a resource function to record telemetry
   */
  private wrapResource(resourceName: string, resource: Function): Function {
    return async (...args: any[]) => {
      const startTime = Date.now();

      try {
        const result = await resource(...args);
        const duration = Date.now() - startTime;

        this.collector.recordResourceAccess({
          resourceUri: resourceName,
          operation: 'read',
          duration,
          status: 'success',
          bytesTransferred: typeof result === 'string' ? result.length : 0
        });

        return result;
      } catch (error) {
        const duration = Date.now() - startTime;

        this.collector.recordResourceAccess({
          resourceUri: resourceName,
          operation: 'read',
          duration,
          status: 'error',
          error: error instanceof Error ? error.message : String(error)
        });

        throw error;
      }
    };
  }

  /**
   * Wrap a prompt function to record telemetry
   */
  private wrapPrompt(promptName: string, prompt: Function): Function {
    return async (...args: any[]) => {
      const startTime = Date.now();
      const promptArgs = args[0] || {};

      try {
        const result = await prompt(...args);
        const duration = Date.now() - startTime;

        this.collector.recordPromptCall({
          promptName,
          args: promptArgs,
          duration,
          status: 'success',
          tokensGenerated: typeof result === 'string' ? result.split(/\s+/).length : 0
        });

        return result;
      } catch (error) {
        const duration = Date.now() - startTime;

        this.collector.recordPromptCall({
          promptName,
          args: promptArgs,
          duration,
          status: 'error',
          error: error instanceof Error ? error.message : String(error)
        });

        throw error;
      }
    };
  }
}
