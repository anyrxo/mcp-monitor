/**
 * MCP Monitor Server
 * WebSocket server for real-time monitoring
 */

import express from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { TelemetryCollector } from './collector.js';
import { MonitorConfig } from './types.js';

export class MonitorServer {
  private app: express.Application;
  private server: Server | null = null;
  private wss: WebSocketServer | null = null;
  private collector: TelemetryCollector;
  private config: MonitorConfig;
  private clients: Set<WebSocket> = new Set();

  constructor(collector: TelemetryCollector, config: MonitorConfig) {
    this.collector = collector;
    this.config = config;
    this.app = express();

    this.setupRoutes();
  }

  /**
   * Setup Express routes
   */
  private setupRoutes(): void {
    this.app.use(express.json());

    // Health check
    this.app.get('/health', (req, res) => {
      res.json({ status: 'ok', server: this.config.serverName });
    });

    // Get current metrics
    this.app.get('/api/metrics', (req, res) => {
      res.json(this.collector.getMetrics());
    });

    // Record tool call (for external MCP servers)
    this.app.post('/api/tool-call', (req, res) => {
      try {
        this.collector.recordToolCall(req.body);
        res.json({ success: true });
      } catch (error) {
        res.status(400).json({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    // Record resource access
    this.app.post('/api/resource-access', (req, res) => {
      try {
        this.collector.recordResourceAccess(req.body);
        res.json({ success: true });
      } catch (error) {
        res.status(400).json({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    // Record prompt call
    this.app.post('/api/prompt-call', (req, res) => {
      try {
        this.collector.recordPromptCall(req.body);
        res.json({ success: true });
      } catch (error) {
        res.status(400).json({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    // Export metrics
    this.app.get('/api/export', (req, res) => {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="mcp-metrics-${Date.now()}.json"`);
      res.send(this.collector.exportMetrics());
    });

    // Reset metrics
    this.app.post('/api/reset', (req, res) => {
      this.collector.reset();
      res.json({ success: true });
    });
  }

  /**
   * Start the server
   */
  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // Start HTTP server
        this.server = this.app.listen(this.config.port, () => {
          console.log(`MCP Monitor server running on port ${this.config.port}`);
          console.log(`API: http://localhost:${this.config.port}/api/metrics`);
          console.log(`WebSocket: ws://localhost:${this.config.port}`);
        });

        // Start WebSocket server
        this.wss = new WebSocketServer({ server: this.server });

        this.wss.on('connection', (ws: WebSocket) => {
          console.log('Client connected to WebSocket');
          this.clients.add(ws);

          // Send current metrics immediately
          ws.send(JSON.stringify({
            type: 'metrics',
            data: this.collector.getMetrics()
          }));

          ws.on('close', () => {
            console.log('Client disconnected from WebSocket');
            this.clients.delete(ws);
          });

          ws.on('error', (error) => {
            console.error('WebSocket error:', error);
            this.clients.delete(ws);
          });
        });

        // Broadcast metrics every second
        setInterval(() => {
          this.broadcast({
            type: 'metrics',
            data: this.collector.getMetrics()
          });
        }, 1000);

        // Listen for collector events
        this.collector.on('tool_call', (call) => {
          this.broadcast({ type: 'tool_call', data: call });
        });

        this.collector.on('resource_access', (access) => {
          this.broadcast({ type: 'resource_access', data: access });
        });

        this.collector.on('prompt_call', (call) => {
          this.broadcast({ type: 'prompt_call', data: call });
        });

        this.collector.on('mcp_error', (error) => {
          this.broadcast({ type: 'error', data: error });
        });

        resolve();
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Stop the server
   */
  async stop(): Promise<void> {
    return new Promise((resolve) => {
      // Close all WebSocket connections
      this.clients.forEach(client => client.close());
      this.clients.clear();

      // Close WebSocket server
      if (this.wss) {
        this.wss.close();
      }

      // Close HTTP server
      if (this.server) {
        this.server.close(() => {
          console.log('MCP Monitor server stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  /**
   * Broadcast message to all connected clients
   */
  private broadcast(message: any): void {
    const data = JSON.stringify(message);
    this.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    });
  }

  /**
   * Get server URL
   */
  getURL(): string {
    return `http://localhost:${this.config.port}`;
  }
}
