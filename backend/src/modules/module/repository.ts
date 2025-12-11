import { PrismaClient, Module, Script } from '@prisma/client';
import { BaseRepository } from '@/utils/repository';
import { createModuleSchema, updateModuleSchema } from '@/utils/validation';
import { z } from 'zod';

type CreateModuleData = z.infer<typeof createModuleSchema>;
type UpdateModuleData = z.infer<typeof updateModuleSchema>;

export class ModuleRepository extends BaseRepository<Module, CreateModuleData, UpdateModuleData> {
  constructor(prisma: PrismaClient) {
    super(prisma, prisma.module);
  }

  async findByVersionAndName(versionId: string, name: string): Promise<Module | null> {
    return this.model.findFirst({
      where: {
        versionId,
        name,
      },
    });
  }

  async findByVersion(versionId: string): Promise<Module[]> {
    return this.model.findMany({
      where: {
        versionId,
      },
      orderBy: {
        name: 'asc',
      },
    });
  }

  async findWithScripts(moduleId: string): Promise<(Module & { scripts: Script[] }) | null> {
    return this.model.findUnique({
      where: { id: moduleId },
      include: {
        scripts: {
          orderBy: [
            { priority: 'asc' },
            { name: 'asc' },
          ],
        },
        inheritsFrom: {
          select: {
            id: true,
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
  }

  async findInheritedModules(moduleId: string): Promise<Module[]> {
    const module = await this.model.findUnique({
      where: { id: moduleId },
      include: {
        inheritedBy: true,
      },
    });

    if (!module) {
      return [];
    }

    return module.inheritedBy;
  }

  async checkCircularInheritance(moduleId: string, inheritedFromId: string): Promise<boolean> {
    let currentId = inheritedFromId;
    const visited = new Set<string>();

    while (currentId && !visited.has(currentId)) {
      if (currentId === moduleId) {
        return true; // Circular inheritance detected
      }

      visited.add(currentId);
      const parent = await this.model.findUnique({
        where: { id: currentId },
        select: { inheritedFrom: true },
      });

      currentId = parent?.inheritedFrom || null;
    }

    return false;
  }

  async getModuleStats(moduleId: string) {
    const [scriptCount, executionCount] = await Promise.all([
      this.prisma.script.count({
        where: { moduleId },
      }),
      this.prisma.execution.count({
        where: {
          script: {
            moduleId,
          },
        },
      }),
    ]);

    return {
      scripts: scriptCount,
      executions: executionCount,
    };
  }

  async duplicateScripts(sourceModuleId: string, targetModuleId: string): Promise<void> {
    const scripts = await this.prisma.script.findMany({
      where: {
        moduleId: sourceModuleId,
      },
    });

    // Create new scripts for the target module
    for (const script of scripts) {
      await this.prisma.script.create({
        data: {
          moduleId: targetModuleId,
          name: script.name,
          description: script.description,
          priority: script.priority,
          steps: script.steps,
        },
      });
    }
  }

  async getInheritanceChain(moduleId: string): Promise<Module[]> {
    const chain: Module[] = [];
    let currentModule = await this.model.findUnique({
      where: { id: moduleId },
      include: {
        inheritsFrom: true,
      },
    });

    chain.push(currentModule!);

    while (currentModule?.inheritsFrom) {
      chain.push(currentModule.inheritsFrom);
      currentModule = await this.model.findUnique({
        where: { id: currentModule.inheritsFrom.id },
        include: {
          inheritsFrom: true,
        },
      });
    }

    return chain;
  }

  async searchInVersion(versionId: string, query: string) {
    return this.model.findMany({
      where: {
        versionId,
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
        _count: {
          select: {
            scripts: true,
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    });
  }
}