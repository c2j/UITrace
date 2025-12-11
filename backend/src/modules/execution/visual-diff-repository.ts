import { PrismaClient, VisualDiff } from '@prisma/client';
import { BaseRepository } from '@/utils/repository';

export type VisualDiffData = {
  executionId: string;
  stepId: number;
  baselineKey: string;
  actualKey: string;
  diffKey?: string;
  diffPercentage: number;
  tolerance: number;
  approved?: boolean;
};

export type UpdateVisualDiffData = {
  diffKey?: string;
  diffPercentage?: number;
  approved?: boolean;
};

export class VisualDiffRepository extends BaseRepository<VisualDiff, VisualDiffData, UpdateVisualDiffData> {
  constructor(prisma: PrismaClient) {
    super(prisma, prisma.visualDiff);
  }

  async findByExecution(executionId: string): Promise<VisualDiff[]> {
    return this.model.findMany({
      where: { executionId },
      orderBy: {
        stepId: 'asc',
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
    });
  }

  async findByExecutionAndStep(executionId: string, stepId: number): Promise<VisualDiff | null> {
    return this.model.findFirst({
      where: {
        executionId,
        stepId,
      },
    });
  }

  async findByStatus(approved: boolean, page: number = 1, limit: number = 20): Promise<{
    data: VisualDiff[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const skip = (page - 1) * limit;

    const [diffs, total] = await Promise.all([
      this.model.findMany({
        where: { approved },
        skip,
        take: limit,
        orderBy: {
          createdAt: 'desc',
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
      this.model.count({ where: { approved } }),
    ]);

    return {
      data: diffs,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findUnapprovedDiffs(page: number = 1, limit: number = 20): Promise<{
    data: VisualDiff[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    return this.findByStatus(false, page, limit);
  }

  async findByDiffPercentage(minPercentage: number, maxPercentage: number): Promise<VisualDiff[]> {
    return this.model.findMany({
      where: {
        diffPercentage: {
          gte: minPercentage,
          lte: maxPercentage,
        },
      },
      orderBy: {
        diffPercentage: 'desc',
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
    });
  }

  async findByDateRange(
    startDate: Date,
    endDate: Date,
    page: number = 1,
    limit: number = 50
  ): Promise<{
    data: VisualDiff[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const skip = (page - 1) * limit;

    const [diffs, total] = await Promise.all([
      this.model.findMany({
        where: {
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
        },
        skip,
        take: limit,
        orderBy: {
          createdAt: 'desc',
        },
      }),
      this.model.count({
        where: {
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
        },
      }),
    ]);

    return {
      data: diffs,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async createDiff(diffData: VisualDiffData): Promise<VisualDiff> {
    return this.model.create({
      data: {
        ...diffData,
        approved: diffData.approved ?? false,
      },
    });
  }

  async updateApproval(diffId: string, approved: boolean, approvedBy?: string): Promise<VisualDiff> {
    return this.model.update({
      where: { id: diffId },
      data: {
        approved,
        // In a real implementation, we might track who approved it
      },
    });
  }

  async batchUpdateApproval(diffIds: string[], approved: boolean): Promise<number> {
    const result = await this.model.updateMany({
      where: {
        id: {
          in: diffIds,
        },
      },
      data: {
        approved,
      },
    });

    return result.count;
  }

  async getDiffStats(filter?: {
    executionId?: string;
    startDate?: Date;
    endDate?: Date;
    approved?: boolean;
  }): Promise<{
      total: number;
      approved: number;
      pending: number;
      averageDiffPercentage: number;
      maxDiffPercentage: number;
      failingDiffs: number; // Diffs above threshold
    }> {
    const where: any = {};

    if (filter?.executionId) {
      where.executionId = filter.executionId;
    }

    if (filter?.startDate || filter?.endDate) {
      where.createdAt = {};
      if (filter.startDate) {
        where.createdAt.gte = filter.startDate;
      }
      if (filter.endDate) {
        where.createdAt.lte = filter.endDate;
      }
    }

    if (filter?.approved !== undefined) {
      where.approved = filter.approved;
    }

    const [stats] = await this.model.aggregate({
      where,
      _avg: {
        diffPercentage: true,
      },
      _max: {
        diffPercentage: true,
      },
      _count: {
        id: true,
      },
    });

    const [approvedCount, pendingCount, failingCount] = await Promise.all([
      this.model.count({
        where: { ...where, approved: true },
      }),
      this.model.count({
        where: { ...where, approved: false },
      }),
      this.model.count({
        where: {
          ...where,
          diffPercentage: {
            gt: 5.0, // Threshold for failing diffs
          },
        },
      }),
    ]);

    return {
      total: stats._count.id || 0,
      approved: approvedCount,
      pending: pendingCount,
      averageDiffPercentage: stats._avg.diffPercentage || 0,
      maxDiffPercentage: stats._max.diffPercentage || 0,
      failingDiffs: failingCount,
    };
  }

  async getDiffsNeedingReview(limit: number = 10): Promise<VisualDiff[]> {
    return this.model.findMany({
      where: {
        approved: false,
        diffPercentage: {
          gt: 0.1, // Only diffs with some difference need review
        },
      },
      take: limit,
      orderBy: {
        diffPercentage: 'desc',
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
                module: {
                  select: {
                    name: true,
                    version: {
                      select: {
                        name: true,
                        project: {
                          select: {
                            name: true,
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });
  }

  async findDiffsForScript(scriptId: string, page: number = 1, limit: number = 20): Promise<{
    data: VisualDiff[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const skip = (page - 1) * limit;

    const [diffs, total] = await Promise.all([
      this.model.findMany({
        where: {
          execution: {
            scriptId,
          },
        },
        skip,
        take: limit,
        orderBy: {
          createdAt: 'desc',
        },
        include: {
          execution: {
            select: {
              id: true,
              status: true,
              environment: true,
            },
          },
        },
      }),
      this.model.count({
        where: {
          execution: {
            scriptId,
          },
        },
      }),
    ]);

    return {
      data: diffs,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findDiffsForStep(scriptId: string, stepId: number, limit: number = 10): Promise<VisualDiff[]> {
    return this.model.findMany({
      where: {
        stepId,
        execution: {
          scriptId,
        },
      },
      take: limit,
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        execution: {
          select: {
            id: true,
            status: true,
            environment: true,
          },
        },
      },
    });
  }

  async getDiffTrendAnalysis(days: number = 30): Promise<{
    date: string;
    totalDiffs: number;
    averageDiffPercentage: number;
    approvedDiffs: number;
    failingDiffs: number;
  }[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const dailyStats = await this.model.groupBy({
      by: ['createdAt'],
      where: {
        createdAt: {
          gte: startDate,
        },
      },
      _count: {
        id: true,
      },
      _avg: {
        diffPercentage: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    // This is a simplified version. In a real implementation, you'd use SQL date functions
    return dailyStats.map(stat => ({
      date: stat.createdAt.toISOString().split('T')[0],
      totalDiffs: stat._count.id,
      averageDiffPercentage: stat._avg.diffPercentage || 0,
      approvedDiffs: 0, // Would need separate query
      failingDiffs: 0, // Would need separate query
    }));
  }

  async approveOrRejectDiff(diffId: string, approved: boolean, reason?: string): Promise<VisualDiff> {
    const diff = await this.model.update({
      where: { id: diffId },
      data: {
        approved,
      },
    });

    // In a real implementation, you might store the approval reason in a separate table
    return diff;
  }

  async autoApproveDiffs(threshold: number = 0.01): Promise<number> {
    // Auto-approve diffs with very small differences
    const result = await this.model.updateMany({
      where: {
        approved: false,
        diffPercentage: {
          lte: threshold,
        },
      },
      data: {
        approved: true,
      },
    });

    return result.count;
  }

  async deleteOldDiffs(retentionDays: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    // Only delete approved diffs that are older than retention period
    const result = await this.model.deleteMany({
      where: {
        createdAt: {
          lt: cutoffDate,
        },
        approved: true,
      },
    });

    return result.count;
  }

  async exportDiffs(executionId?: string, format: 'json' | 'csv' = 'json'): Promise<any> {
    const where = executionId ? { executionId } : {};

    const diffs = await this.model.findMany({
      where,
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
                module: {
                  select: {
                    name: true,
                    version: {
                      select: {
                        name: true,
                        project: {
                          select: {
                            name: true,
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (format === 'csv') {
      // Convert to CSV format
      const headers = [
        'ID',
        'Execution ID',
        'Script Name',
        'Project',
        'Version',
        'Module',
        'Step ID',
        'Diff Percentage',
        'Status',
        'Created At',
      ];

      const rows = diffs.map(diff => [
        diff.id,
        diff.executionId,
        diff.execution.script.name,
        diff.execution.script.module.version.project.name,
        diff.execution.script.module.version.name,
        diff.execution.script.module.name,
        diff.stepId,
        diff.diffPercentage,
        diff.approved ? 'Approved' : 'Pending',
        diff.createdAt.toISOString(),
      ]);

      return { headers, rows };
    }

    return diffs;
  }
}