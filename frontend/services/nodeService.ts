import { apiClient, ApiResponse } from './api';
import { wsManager } from './api';

// Types for server nodes
export interface ServerNode {
  id: string;
  name: string;
  ip: string;
  status: 'ONLINE' | 'OFFLINE' | 'BUSY' | 'MAINTENANCE';
  os: 'windows' | 'mac' | 'linux';
  browsers: string[];
  lastHeartbeat: string;
  hardwareStats?: {
    cpuUsage: number;
    memUsage: number;
    diskUsage: number;
  };
  capabilities: {
    maxSessions: number;
    activeSessions: number;
    supportedBrowsers: string[];
    environments: string[];
  };
}

export interface NodeAction {
  action: 'restart' | 'shutdown' | 'maintenance' | 'online';
}

export interface NodeRegistration {
  name: string;
  ip: string;
  os: string;
  browsers: string[];
  capabilities: {
    maxSessions: number;
    supportedBrowsers: string[];
    environments: string[];
  };
}

export interface NodeWebSocketMessage {
  type: 'heartbeat' | 'status' | 'execution_start' | 'execution_end' | 'log' | 'error';
  nodeId: string;
  timestamp: string;
  data: any;
}

// Node service
export const nodeService = {
  // Get all nodes
  async getNodes(): Promise<ApiResponse<ServerNode[]>> {
    return apiClient.get<ServerNode[]>('/nodes');
  },

  // Get node by ID
  async getNode(nodeId: string): Promise<ApiResponse<ServerNode>> {
    return apiClient.get<ServerNode>(`/nodes/${nodeId}`);
  },

  // Register new node
  async registerNode(data: NodeRegistration): Promise<ApiResponse<ServerNode>> {
    return apiClient.post<ServerNode>('/nodes/register', data);
  },

  // Update node
  async updateNode(nodeId: string, data: Partial<ServerNode>): Promise<ApiResponse<ServerNode>> {
    return apiClient.put<ServerNode>(`/nodes/${nodeId}`, data);
  },

  // Delete node
  async deleteNode(nodeId: string): Promise<ApiResponse<void>> {
    return apiClient.delete<void>(`/nodes/${nodeId}`);
  },

  // Perform action on node
  async performAction(nodeId: string, action: NodeAction): Promise<ApiResponse<void>> {
    return apiClient.post<void>(`/nodes/${nodeId}/action`, action);
  },

  // Get node health metrics
  async getNodeMetrics(nodeId: string): Promise<ApiResponse<any>> {
    return apiClient.get<any>(`/nodes/${nodeId}/metrics`);
  },

  // Get node execution history
  async getNodeExecutions(
    nodeId: string,
    params?: {
      limit?: number;
      offset?: number;
      status?: string;
    }
  ): Promise<ApiResponse<any[]>> {
    return apiClient.get<any[]>(`/nodes/${nodeId}/executions`, params);
  },

  // Scan for new nodes in network
  async scanNetwork(ipRange?: string): Promise<ApiResponse<{ jobId: string }>> {
    return apiClient.post<{ jobId: string }>('/nodes/scan', { ipRange });
  },
};

// WebSocket service for real-time node updates
export class NodeWebSocketService {
  private ws: WebSocket | null = null;
  private nodeId: string | null = null;
  private callbacks: Record<string, ((data: any) => void)[]> = {
    status: [],
    heartbeat: [],
    execution: [],
    log: [],
  };

  // Connect to node-specific WebSocket
  async connect(nodeId: string): Promise<void> {
    this.nodeId = nodeId;

    // Register callbacks
    await wsManager.connect('/ws', (message: NodeWebSocketMessage) => {
      if (message.nodeId === nodeId) {
        this.handleMessage(message);
      }
    });

    // Send initial status request
    wsManager.send({
      type: 'subscribe',
      nodeId,
      events: ['status', 'heartbeat', 'execution', 'log'],
    });
  }

  // Handle incoming WebSocket messages
  private handleMessage(message: NodeWebSocketMessage): void {
    const { type, data } = message;

    // Call registered callbacks
    if (this.callbacks[type]) {
      this.callbacks[type].forEach(callback => callback(data));
    }
  }

  // Subscribe to node events
  on(event: 'status' | 'heartbeat' | 'execution' | 'log', callback: (data: any) => void): void {
    if (this.callbacks[event]) {
      this.callbacks[event].push(callback);
    }
  }

  // Unsubscribe from node events
  off(event: 'status' | 'heartbeat' | 'execution' | 'log', callback: (data: any) => void): void {
    if (this.callbacks[event]) {
      this.callbacks[event] = this.callbacks[event].filter(cb => cb !== callback);
    }
  }

  // Disconnect WebSocket
  disconnect(): void {
    if (this.nodeId) {
      wsManager.send({
        type: 'unsubscribe',
        nodeId: this.nodeId,
        events: ['status', 'heartbeat', 'execution', 'log'],
      });
    }
    wsManager.disconnect();
    this.nodeId = null;
  }
}

// Export singleton instance
export const nodeWebSocketService = new NodeWebSocketService();

// Helper functions for node display
export const nodeUtils = {
  // Format status
  formatStatus(status: string): string {
    switch (status) {
      case 'ONLINE':
        return 'Online';
      case 'OFFLINE':
        return 'Offline';
      case 'BUSY':
        return 'Busy';
      case 'MAINTENANCE':
        return 'Maintenance';
      default:
        return status;
    }
  },

  // Get status color
  getStatusColor(status: string): string {
    switch (status) {
      case 'ONLINE':
        return '#52c41a';
      case 'OFFLINE':
        return '#ff4d4f';
      case 'BUSY':
        return '#faad14';
      case 'MAINTENANCE':
        return '#666666';
      default:
        return '#666666';
    }
  },

  // Format OS
  formatOS(os: string): string {
    switch (os) {
      case 'windows':
        return 'Windows';
      case 'mac':
        return 'macOS';
      case 'linux':
        return 'Linux';
      default:
        return os;
    }
  },

  // Get OS icon
  getOSIcon(os: string): string {
    switch (os) {
      case 'windows':
        return '🪟';
      case 'mac':
        return '🍎';
      case 'linux':
        return '🐧';
      default:
        return '💻';
    }
  },

  // Format hardware usage
  formatUsage(usage: number): string {
    return `${Math.round(usage)}%`;
  },

  // Get usage color based on percentage
  getUsageColor(usage: number): string {
    if (usage < 50) return '#52c41a';
    if (usage < 80) return '#faad14';
    return '#ff4d4f';
  },

  // Format browser list
  formatBrowsers(browsers: string[]): string {
    const browserMap: Record<string, string> = {
      chromium: 'Chrome',
      firefox: 'Firefox',
      webkit: 'Safari',
    };

    return browsers
      .map(browser => browserMap[browser.toLowerCase()] || browser)
      .join(', ');
  },

  // Check if node is healthy
  isNodeHealthy(node: ServerNode): boolean {
    const now = new Date().getTime();
    const lastHeartbeat = new Date(node.lastHeartbeat).getTime();
    const diffMinutes = (now - lastHeartbeat) / (1000 * 60);

    return node.status === 'ONLINE' && diffMinutes < 5;
  },

  // Calculate node utilization
  calculateUtilization(node: ServerNode): number {
    if (!node.capabilities) return 0;
    return (node.capabilities.activeSessions / node.capabilities.maxSessions) * 100;
  },

  // Get action label
  getActionLabel(action: string): string {
    switch (action) {
      case 'restart':
        return 'Restart';
      case 'shutdown':
        return 'Shutdown';
      case 'maintenance':
        return 'Set Maintenance';
      case 'online':
        return 'Set Online';
      default:
        return action;
    }
  },
};