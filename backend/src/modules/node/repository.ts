import { PrismaClient, ServerNode, NodeStatus } from '@prisma/client';

export class NodeRepository {
  constructor(private prisma: PrismaClient) {}

  async create(data: Omit<ServerNode, 'id' | 'createdAt' | 'updatedAt' | 'lastHeartbeat'>): Promise<ServerNode> {
    return this.prisma.serverNode.create({
      data: {
        ...data,
        lastHeartbeat: new Date(),
      },
    });
  }

  async findById(id: string): Promise<ServerNode | null> {
    return this.prisma.serverNode.findUnique({
      where: { id },
      include: {
        _count: {
          select: { executions: true }
        }
      }
    });
  }

  async findByIp(ip: string): Promise<ServerNode | null> {
    return this.prisma.serverNode.findFirst({
      where: { ip },
    });
  }

  async findAll(options?: {
    status?: NodeStatus;
    page?: number;
    limit?: number;
  }): Promise<{ nodes: ServerNode[]; total: number; page: number; limit: number }> {
    const { status, page = 1, limit = 10 } = options || {};
    const skip = (page - 1) * limit;

    const where = status ? { status } : {};

    const [nodes, total] = await Promise.all([
      this.prisma.serverNode.findMany({
        where,
        skip,
        take: limit,
        orderBy: { lastHeartbeat: 'desc' },
        include: {
          _count: {
            select: { executions: true }
          }
        }
      }),
      this.prisma.serverNode.count({ where })
    ]);

    return {
      nodes,
      total,
      page,
      limit,
    };
  }

  async update(id: string, data: Partial<ServerNode>): Promise<ServerNode> {
    return this.prisma.serverNode.update({
      where: { id },
      data: {
        ...data,
        lastHeartbeat: new Date(),
      },
    });
  }

  async updateStatus(id: string, status: NodeStatus): Promise<ServerNode> {
    return this.prisma.serverNode.update({
      where: { id },
      data: {
        status,
        lastHeartbeat: new Date(),
      },
    });
  }

  async updateLastHeartbeat(id: string): Promise<void> {
    await this.prisma.serverNode.update({
      where: { id },
      data: {
        lastHeartbeat: new Date(),
      },
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.serverNode.delete({
      where: { id },
    });
  }

  async findAvailableNodes(capabilities?: string[]): Promise<ServerNode[]> {
    const where: any = {
      status: 'ONLINE',
    };

    // If capabilities specified, find nodes that can handle them
    if (capabilities && capabilities.length > 0) {
      where.OR = capabilities.map(cap => ({
        browsers: {
          path: ['$', {
            some: {
              name: cap
            }
          }]
        }
      }));
    }

    return this.prisma.serverNode.findMany({
      where,
      orderBy: { lastHeartbeat: 'desc' },
    });
  }

  async findStaleNodes(timeoutMinutes: number = 5): Promise<ServerNode[]> {
    const threshold = new Date(Date.now() - timeoutMinutes * 60 * 1000);

    return this.prisma.serverNode.findMany({
      where: {
        lastHeartbeat: {
          lt: threshold,
        },
        status: {
          not: 'OFFLINE'
        }
      },
    });
  }

  async markOfflineStaleNodes(timeoutMinutes: number = 5): Promise<number> {
    const staleNodes = await this.findStaleNodes(timeoutMinutes);

    if (staleNodes.length === 0) {
      return 0;
    }

    // Update all stale nodes to OFFLINE
    const result = await this.prisma.serverNode.updateMany({
      where: {
        id: {
          in: staleNodes.map(node => node.id)
        },
        status: {
          not: 'OFFLINE'
        }
      },
      data: {
        status: 'OFFLINE',
      },
    });

    return result.count;
  }

  async getNodeStats(): Promise<{
    total: number;
    online: number;
    offline: number;
    busy: number;
    maintenance: number;
  }> {
    const stats = await this.prisma.serverNode.groupBy({
      by: ['status'],
      _count: {
        id: true
      }
    });

    const result = {
      total: 0,
      online: 0,
      offline: 0,
      busy: 0,
      maintenance: 0,
    };

    stats.forEach(stat => {
      result.total += stat._count.id;
      result[stat.status.toLowerCase() as keyof typeof result] = stat._count.id;
    });

    return result;
  }

  async updateHardwareStats(id: string, hardwareStats: {
    cpu: number;
    memory: number;
    disk: number;
  }): Promise<ServerNode> {
    return this.prisma.serverNode.update({
      where: { id },
      data: {
        hardwareStats,
        lastHeartbeat: new Date(),
      },
    });
  }
}