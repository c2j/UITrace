import { PrismaClient, ExecutionLog } from '@prisma/client';
import { BaseRepository } from '@/utils/repository';

export type ExecutionLogData = {
  executionId: string;
  level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
  message: string;
  stepId?: number;
  timestamp?: Date;
};

export class ExecutionLogRepository extends BaseRepository<ExecutionLog, ExecutionLogData, never> {
  constructor(prisma: PrismaClient) {
    super(prisma, prisma.executionLog);
  }

  async findByExecution(
    executionId: string,
    options?: {
      level?: string;
      stepId?: number;
      limit?: number;
      offset?: number;
    }
  ): Promise<ExecutionLog[]> {
    const where: any = { executionId };

    if (options?.level) {
      where.level = options.level;
    }

    if (options?.stepId !== undefined) {
      where.stepId = options.stepId;
    }

    return this.model.findMany({
      where,
      orderBy: {
        timestamp: 'asc',
      },
      take: options?.limit,
      skip: options?.offset,
    });
  }

  async findByExecutionWithPagination(
    executionId: string,
    page: number = 1,
    limit: number = 100,
    level?: string,
    stepId?: number
  ): Promise<{
    data: ExecutionLog[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const skip = (page - 1) * limit;
    const where: any = { executionId };

    if (level) {
      where.level = level;
    }

    if (stepId !== undefined) {
      where.stepId = stepId;
    }

    const [logs, total] = await Promise.all([
      this.model.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          timestamp: 'asc',
        },
      }),
      this.model.count({ where }),
    ]);

    return {
      data: logs,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findByLevel(level: string, page: number = 1, limit: number = 50): Promise<{
    data: ExecutionLog[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      this.model.findMany({
        where: { level },
        skip,
        take: limit,
        orderBy: {
          timestamp: 'desc',
        },
        include: {
          execution: {
            select: {
              id: true,
              status: true,
              environment: true,
              script: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      }),
      this.model.count({ where: { level } }),
    ]);

    return {
      data: logs,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findByTimeRange(
    startDate: Date,
    endDate: Date,
    page: number = 1,
    limit: number = 100
  ): Promise<{
    data: ExecutionLog[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      this.model.findMany({
        where: {
          timestamp: {
            gte: startDate,
            lte: endDate,
          },
        },
        skip,
        take: limit,
        orderBy: {
          timestamp: 'desc',
        },
      }),
      this.model.count({
        where: {
          timestamp: {
            gte: startDate,
            lte: endDate,
          },
        },
      }),
    ]);

    return {
      data: logs,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findByStep(executionId: string, stepId: number): Promise<ExecutionLog[]> {
    return this.model.findMany({
      where: {
        executionId,
        stepId,
      },
      orderBy: {
        timestamp: 'asc',
      },
    });
  }

  async createBatch(logs: Omit<ExecutionLogData, 'timestamp'>[]): Promise<void> {
    const logsWithTimestamp = logs.map(log => ({
      ...log,
      timestamp: new Date(),
    }));

    await this.model.createMany({
      data: logsWithTimestamp,
    });
  }

  async createLogWithTimestamp(log: ExecutionLogData): Promise<ExecutionLog> {
    return this.model.create({
      data: {
        ...log,
        timestamp: log.timestamp || new Date(),
      },
    });
  }

  async getErrorLogs(executionId: string): Promise<ExecutionLog[]> {
    return this.model.findMany({
      where: {
        executionId,
        level: 'ERROR',
      },
      orderBy: {
        timestamp: 'asc',
      },
    });
  }

  async getRecentLogs(limit: number = 50): Promise<ExecutionLog[]> {
    return this.model.findMany({
      take: limit,
      orderBy: {
        timestamp: 'desc',
      },
      include: {
        execution: {
          select: {
            id: true,
            status: true,
            script: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });
  }

  async getLogStats(
    executionId?: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<{
      total: number;
      debug: number;
      info: number;
      warn: number;
      error: number;
    }> {
    const where: any = {};

    if (executionId) {
      where.executionId = executionId;
    }

    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) {
        where.timestamp.gte = startDate;
      }
      if (endDate) {
        where.timestamp.lte = endDate;
      }
    }

    const [
      total,
      debugCount,
      infoCount,
      warnCount,
      errorCount,
    ] = await Promise.all([
      this.model.count({ where }),
      this.model.count({ where: { ...where, level: 'DEBUG' } }),
      this.model.count({ where: { ...where, level: 'INFO' } }),
      this.model.count({ where: { ...where, level: 'WARN' } }),
      this.model.count({ where: { ...where, level: 'ERROR' } }),
    ]);

    return {
      total,
      debug: debugCount,
      info: infoCount,
      warn: warnCount,
      error: errorCount,
    };
  }

  async searchLogs(query: string, page: number = 1, limit: number = 50): Promise<{
    data: ExecutionLog[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      this.model.findMany({
        where: {
          message: {
            contains: query,
            mode: 'insensitive',
          },
        },
        skip,
        take: limit,
        orderBy: {
          timestamp: 'desc',
        },
        include: {
          execution: {
            select: {
              id: true,
              status: true,
              script: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      }),
      this.model.count({
        where: {
          message: {
            contains: query,
            mode: 'insensitive',
          },
        },
      }),
    ]);

    return {
      data: logs,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async deleteOldLogs(retentionDays: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const result = await this.model.deleteMany({
      where: {
        timestamp: {
          lt: cutoffDate,
        },
      },
    });

    return result.count;
  }

  async getLogLevelsForExecution(executionId: string): Promise<string[]> {
    const logs = await this.model.findMany({
      where: { executionId },
      select: { level: true },
      distinct: ['level'],
    });

    return logs.map(log => log.level);
  }

  async exportLogs(executionId: string): Promise<ExecutionLog[]> {
    return this.model.findMany({
      where: { executionId },
      orderBy: {
        timestamp: 'asc',
      },
      include: {
        execution: {
          select: {
            id: true,
            status: true,
            environment: true,
            triggeredBy: true,
            script: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });
  }

  async getStepTransitionLogs(executionId: string): Promise<ExecutionLog[]> {
    // Get logs that indicate step transitions
    return this.model.findMany({
      where: {
        executionId,
        message: {
          contains: 'Step',
        },
        level: 'INFO',
      },
      orderBy: {
        timestamp: 'asc',
      },
    });
  }
}