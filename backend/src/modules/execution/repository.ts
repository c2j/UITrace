import { PrismaClient, Execution, ExecutionLog, VisualDiff, Script } from '@prisma/client';
import { BaseRepository } from '@/utils/repository';
import { ExecutionStatus, LogLevel } from '@prisma/client';

export type ExecutionData = {
  scriptId: string;
  status?: ExecutionStatus;
  environment: string;
  triggeredBy: string;
  nodeId?: string;
  qualityScore?: number;
  traceFileKey?: string;
};

export type UpdateExecutionData = {
  status?: ExecutionStatus;
  endTime?: Date;
  durationMs?: number;
  qualityScore?: number;
  traceFileKey?: string;
};

export class ExecutionRepository extends BaseRepository<Execution, ExecutionData, UpdateExecutionData> {
  constructor(prisma: PrismaClient) {
    super(prisma, prisma.execution);
  }

  async findByScript(scriptId: string, status?: ExecutionStatus): Promise<Execution[]> {
    return this.model.findMany({
      where: {
        scriptId,
        ...(status && { status }),
      },
      orderBy: {
        startTime: 'desc',
      },
      include: {
        script: {
          select: {
            id: true,
            name: true,
            priority: true,
          },
        },
      },
    });
  }

  async findWithLogs(executionId: string): Promise<(Execution & {
    logs: ExecutionLog[];
    visualDiffs?: VisualDiff[];
  }) | null> {
    return this.model.findUnique({
      where: { id: executionId },
      include: {
        logs: {
          orderBy: {
            timestamp: 'asc',
          },
        },
        visualDiffs: true,
      },
    });
  }

  async findWithDetails(executionId: string, include?: string[]) {
    const includeOptions: any = {
      script: {
        select: {
          id: true,
          name: true,
          description: true,
          priority: true,
          steps: true,
          module: {
            select: {
              id: true,
              name: true,
              version: {
                select: {
                  id: true,
                  name: true,
                  project: {
                    select: {
                      id: true,
                      name: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    };

    if (include?.includes('logs')) {
      includeOptions.logs = {
        orderBy: {
          timestamp: 'asc',
        },
      };
    }

    if (include?.includes('diffs')) {
      includeOptions.visualDiffs = true;
    }

    if (include?.includes('node')) {
      includeOptions.node = true;
    }

    return this.model.findUnique({
      where: { id: executionId },
      include: includeOptions,
    });
  }

  async findByStatus(status: ExecutionStatus, page: number = 1, limit: number = 10) {
    const skip = (page - 1) * limit;

    const [executions, total] = await Promise.all([
      this.model.findMany({
        where: { status },
        skip,
        take: limit,
        orderBy: {
          startTime: 'desc',
        },
        include: {
          script: {
            select: {
              id: true,
              name: true,
              priority: true,
            },
          },
        },
      }),
      this.model.count({
        where: { status },
      }),
    ]);

    return {
      data: executions,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findByDateRange(startDate: Date, endDate: Date, page: number = 1, limit: number = 10) {
    const skip = (page - 1) * limit;

    const [executions, total] = await Promise.all([
      this.model.findMany({
        where: {
          startTime: {
            gte: startDate,
            lte: endDate,
          },
        },
        skip,
        take: limit,
        orderBy: {
          startTime: 'desc',
        },
        include: {
          script: {
            select: {
              id: true,
              name: true,
              priority: true,
            },
          },
        },
      }),
      this.model.count({
        where: {
          startTime: {
            gte: startDate,
            lte: endDate,
          },
        },
      }),
    ]);

    return {
      data: executions,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findByNode(nodeId: string, status?: ExecutionStatus): Promise<Execution[]> {
    return this.model.findMany({
      where: {
        nodeId,
        ...(status && { status }),
      },
      orderBy: {
        startTime: 'desc',
      },
    });
  }

  async updateStatus(executionId: string, status: ExecutionStatus): Promise<void> {
    await this.model.update({
      where: { id: executionId },
      data: { status },
    });
  }

  async markAsRunning(executionId: string): Promise<void> {
    await this.model.update({
      where: { id: executionId },
      data: {
        status: 'RUNNING',
        startTime: new Date(),
      },
    });
  }

  async markAsCompleted(
    executionId: string,
    status: ExecutionStatus,
    endTime?: Date,
    qualityScore?: number
  ): Promise<void> {
    const execution = await this.findById(executionId);
    if (!execution) {
      throw new Error('Execution not found');
    }

    const durationMs = endTime && execution.startTime
      ? endTime.getTime() - execution.startTime.getTime()
      : undefined;

    await this.model.update({
      where: { id: executionId },
      data: {
        status,
        endTime: endTime || new Date(),
        durationMs,
        qualityScore,
      },
    });
  }

  async updateLastRunStatus(scriptId: string, status: ExecutionStatus): Promise<void> {
    // Get the latest execution for this script
    const latestExecution = await this.model.findFirst({
      where: { scriptId },
      orderBy: { startTime: 'desc' },
    });

    if (latestExecution) {
      // Update the script's lastRunStatus
      await this.prisma.script.update({
        where: { id: scriptId },
        data: { lastRunStatus: status },
      });
    }
  }

  async getExecutionStats(filter?: {
    scriptId?: string;
    startDate?: Date;
    endDate?: Date;
  }) {
    const where: any = {};

    if (filter?.scriptId) {
      where.scriptId = filter.scriptId;
    }

    if (filter?.startDate || filter?.endDate) {
      where.startTime = {};
      if (filter.startDate) {
        where.startTime.gte = filter.startDate;
      }
      if (filter.endDate) {
        where.startTime.lte = filter.endDate;
      }
    }

    const [
      totalExecutions,
      passCount,
      failCount,
      skipCount,
      timeoutCount,
      averageDuration,
    ] = await Promise.all([
      this.model.count({ where }),
      this.model.count({ where: { ...where, status: 'PASS' } }),
      this.model.count({ where: { ...where, status: 'FAIL' } }),
      this.model.count({ where: { ...where, status: 'SKIP' } }),
      this.model.count({ where: { ...where, status: 'TIMEOUT' } }),
      this.model.aggregate({
        where: { ...where, durationMs: { not: null } },
        _avg: {
          durationMs: true,
        },
      }),
    ]);

    const successRate = totalExecutions > 0 ? (passCount / totalExecutions) * 100 : 0;

    return {
      total: totalExecutions,
      passed: passCount,
      failed: failCount,
      skipped: skipCount,
      timedOut: timeoutCount,
      successRate,
      averageDuration: averageDuration._avg.durationMs || 0,
    };
  }

  async getRecentExecutions(limit: number = 10): Promise<Execution[]> {
    return this.model.findMany({
      take: limit,
      orderBy: {
        startTime: 'desc',
      },
      include: {
        script: {
          select: {
            id: true,
            name: true,
            priority: true,
          },
        },
      },
    });
  }

  async findPendingExecutions(): Promise<Execution[]> {
    return this.model.findMany({
      where: {
        status: 'PENDING',
      },
      orderBy: {
        startTime: 'asc',
      },
      include: {
        script: {
          select: {
            id: true,
            name: true,
            priority: true,
            steps: true,
          },
        },
      },
    });
  }

  async findRunningExecutions(): Promise<Execution[]> {
    return this.model.findMany({
      where: {
        status: 'RUNNING',
      },
      orderBy: {
        startTime: 'asc',
      },
      include: {
        script: {
          select: {
            id: true,
            name: true,
            priority: true,
          },
        },
        node: true,
      },
    });
  }

  async getExecutionsByEnvironment(environment: string, page: number = 1, limit: number = 10) {
    const skip = (page - 1) * limit;

    const [executions, total] = await Promise.all([
      this.model.findMany({
        where: { environment },
        skip,
        take: limit,
        orderBy: {
          startTime: 'desc',
        },
        include: {
          script: {
            select: {
              id: true,
              name: true,
              priority: true,
            },
          },
        },
      }),
      this.model.count({
        where: { environment },
      }),
    ]);

    return {
      data: executions,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async cleanupOldExecutions(retentionDays: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const result = await this.model.deleteMany({
      where: {
        startTime: {
          lt: cutoffDate,
        },
      },
    });

    return result.count;
  }

  async archiveExecutions(executionIds: string[]): Promise<void> {
    // Move executions to archive table (implementation would need an archive table)
    // For now, we'll just mark them as archived
    await this.model.updateMany({
      where: {
        id: {
          in: executionIds,
        },
      },
      data: {
        // This would require adding an 'archived' field to the model
        // For now, we'll implement as a soft delete by updating a flag
      },
    });
  }
}