import { PrismaClient, Script, Execution, Baseline } from '@prisma/client';
import { BaseRepository } from '@/utils/repository';
import { createScriptSchema, updateScriptSchema } from '@/utils/validation';
import { z } from 'zod';

type CreateScriptData = z.infer<typeof createScriptSchema>;
type UpdateScriptData = z.infer<typeof updateScriptSchema>;

export class ScriptRepository extends BaseRepository<Script, CreateScriptData, UpdateScriptData> {
  constructor(prisma: PrismaClient) {
    super(prisma, prisma.script);
  }

  async findByModuleAndName(moduleId: string, name: string): Promise<Script | null> {
    return this.model.findFirst({
      where: {
        moduleId,
        name,
      },
    });
  }

  async findByModule(moduleId: string, priority?: string): Promise<Script[]> {
    return this.model.findMany({
      where: {
        moduleId,
        ...(priority && { priority }),
      },
      orderBy: [
        { priority: 'asc' },
        { name: 'asc' },
      ],
    });
  }

  async findWithExecutions(scriptId: string, limit: number = 10): Promise<(Script & {
    executions: Execution[];
  }) | null> {
    return this.model.findUnique({
      where: { id: scriptId },
      include: {
        executions: {
          orderBy: {
            startTime: 'desc',
          },
          take: limit,
        },
      },
    });
  }

  async findByStatus(status: string, page: number = 1, limit: number = 10) {
    const skip = (page - 1) * limit;

    const [scripts, total] = await Promise.all([
      this.model.findMany({
        where: {
          lastRunStatus: status,
        },
        skip,
        take: limit,
        include: {
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
        orderBy: {
          updatedAt: 'desc',
        },
      }),
      this.model.count({
        where: {
          lastRunStatus: status,
        },
      }),
    ]);

    return {
      data: scripts,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async updateLastRunStatus(scriptId: string, status: string): Promise<void> {
    await this.model.update({
      where: { id: scriptId },
      data: {
        lastRunStatus: status,
        updatedAt: new Date(),
      },
    });
  }

  async findWithBaselines(scriptId: string): Promise<(Script & {
    baselines: Baseline[];
  }) | null> {
    return this.model.findUnique({
      where: { id: scriptId },
      include: {
        baselines: {
          orderBy: {
            stepId: 'asc',
          },
        },
      },
    });
  }

  async findByPriorityRange(minPriority: string, maxPriority: string): Promise<Script[]> {
    const priorityOrder = { 'P0': 0, 'P1': 1, 'P2': 2 };
    const minValue = priorityOrder[minPriority as keyof typeof priorityOrder];
    const maxValue = priorityOrder[maxPriority as keyof typeof priorityOrder];

    const scripts = await this.model.findMany({
      where: {
        priority: {
          in: Object.keys(priorityOrder).filter(
            p => priorityOrder[p as keyof typeof priorityOrder] >= minValue &&
                  priorityOrder[p as keyof typeof priorityOrder] <= maxValue
          ),
        },
      },
      orderBy: [
        { priority: 'asc' },
        { name: 'asc' },
      ],
      include: {
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
    });

    return scripts.sort((a, b) => {
      const aPriority = priorityOrder[a.priority as keyof typeof priorityOrder];
      const bPriority = priorityOrder[b.priority as keyof typeof priorityOrder];
      return aPriority - bPriority;
    });
  }

  async getScriptStats(scriptId: string) {
    const [totalExecutions, passCount, failCount, lastExecution] = await Promise.all([
      this.prisma.execution.count({
        where: { scriptId },
      }),
      this.prisma.execution.count({
        where: { scriptId, status: 'PASS' },
      }),
      this.prisma.execution.count({
        where: { scriptId, status: 'FAIL' },
      }),
      this.prisma.execution.findFirst({
        where: { scriptId },
        orderBy: { startTime: 'desc' },
      }),
    ]);

    const successRate = totalExecutions > 0 ? (passCount / totalExecutions) * 100 : 0;

    return {
      totalExecutions,
      passCount,
      failCount,
      successRate,
      lastExecution,
    };
  }

  async searchAcrossProject(projectId: string, query: string) {
    return this.model.findMany({
      where: {
        module: {
          version: {
            projectId,
          },
        },
        OR: [
          {
            name: {
              contains: query,
              mode: 'insensitive',
            },
          },
          {
            description: {
              contains: query,
              mode: 'insensitive',
            },
          },
        ],
      },
      include: {
        module: {
          select: {
            name: true,
            version: {
              select: {
                name: true,
              },
            },
          },
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });
  }

  async findByEnvironment(environment: string) {
    return this.model.findMany({
      where: {
        executions: {
          some: {
            environment,
          },
        },
      },
      distinct: ['id'],
      include: {
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
        executions: {
          where: {
            environment,
          },
          orderBy: {
            startTime: 'desc',
          },
          take: 1,
          select: {
            id: true,
            status: true,
            startTime: true,
          },
        },
      },
    });
  }
}