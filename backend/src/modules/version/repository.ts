import { PrismaClient, Version, Module } from '@prisma/client';
import { BaseRepository } from '@/utils/repository';
import { createVersionSchema, updateVersionSchema } from '@/utils/validation';
import { z } from 'zod';

type CreateVersionData = z.infer<typeof createVersionSchema>;
type UpdateVersionData = z.infer<typeof updateVersionSchema>;

export class VersionRepository extends BaseRepository<Version, CreateVersionData, UpdateVersionData> {
  constructor(prisma: PrismaClient) {
    super(prisma, prisma.version);
  }

  async findByProjectAndName(projectId: string, name: string): Promise<Version | null> {
    return this.model.findFirst({
      where: {
        projectId,
        name,
      },
    });
  }

  async findByProject(projectId: string, status?: string): Promise<Version[]> {
    return this.model.findMany({
      where: {
        projectId,
        ...(status && { status }),
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findWithModules(versionId: string): Promise<(Version & { modules: Module[] }) | null> {
    return this.model.findUnique({
      where: { id: versionId },
      include: {
        modules: {
          orderBy: {
            name: 'asc',
          },
          include: {
            _count: {
              select: {
                scripts: true,
              },
            },
          },
        },
      },
    });
  }

  async findActiveVersions(projectId: string): Promise<Version[]> {
    return this.model.findMany({
      where: {
        projectId,
        status: 'ACTIVE',
      },
      orderBy: {
        releaseDate: 'desc',
      },
    });
  }

  async findLatestVersion(projectId: string): Promise<Version | null> {
    return this.model.findFirst({
      where: {
        projectId,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findParentModules(versionId: string): Promise<Module[]> {
    const version = await this.model.findUnique({
      where: { id: versionId },
      include: {
        project: {
          include: {
            versions: {
              where: {
                status: 'ACTIVE',
              },
              orderBy: {
                releaseDate: 'desc',
              },
            },
          },
        },
      },
    });

    if (!version || version.project.versions.length <= 1) {
      return [];
    }

    // Get the previous active version
    const previousVersion = version.project.versions[1];
    if (!previousVersion) {
      return [];
    }

    return this.prisma.module.findMany({
      where: {
        versionId: previousVersion.id,
      },
    });
  }

  async duplicateModules(sourceVersionId: string, targetVersionId: string): Promise<void> {
    const modules = await this.prisma.module.findMany({
      where: {
        versionId: sourceVersionId,
      },
    });

    // Create new modules inheriting from source
    for (const module of modules) {
      await this.prisma.module.create({
        data: {
          versionId: targetVersionId,
          name: module.name,
          description: module.description,
          inheritedFrom: module.id,
        },
      });
    }
  }

  async getVersionStats(versionId: string) {
    const [moduleCount, scriptCount, executionCount] = await Promise.all([
      this.prisma.module.count({
        where: { versionId },
      }),
      this.prisma.script.count({
        where: {
          module: {
            versionId,
          },
        },
      }),
      this.prisma.execution.count({
        where: {
          script: {
            module: {
              versionId,
            },
          },
        },
      }),
    ]);

    return {
      modules: moduleCount,
      scripts: scriptCount,
      executions: executionCount,
    };
  }

  async archiveOldVersions(projectId: string, keepLatest: number = 3): Promise<void> {
    const versions = await this.model.findMany({
      where: {
        projectId,
        status: 'ACTIVE',
      },
      orderBy: {
        releaseDate: 'desc',
      },
    });

    if (versions.length > keepLatest) {
      const toArchive = versions.slice(keepLatest);

      await Promise.all(
        toArchive.map(version =>
          this.model.update({
            where: { id: version.id },
            data: { status: 'ARCHIVED' },
          })
        )
      );
    }
  }
}