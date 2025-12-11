import { PrismaClient, Project, Version } from '@prisma/client';
import { BaseRepository } from '@/utils/repository';
import { createProjectSchema, updateProjectSchema } from '@/utils/validation';
import { z } from 'zod';

type CreateProjectData = z.infer<typeof createProjectSchema>;
type UpdateProjectData = z.infer<typeof updateProjectSchema>;

export class ProjectRepository extends BaseRepository<Project, CreateProjectData, UpdateProjectData> {
  constructor(prisma: PrismaClient) {
    super(prisma, prisma.project);
  }

  async findByName(name: string): Promise<Project | null> {
    return this.model.findUnique({
      where: { name },
    });
  }

  async findWithVersions(projectId: string): Promise<(Project & { versions: Version[] }) | null> {
    return this.model.findUnique({
      where: { id: projectId },
      include: {
        versions: {
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    });
  }

  async findManyWithVersions(filter: any = {}, page: number = 1, limit: number = 10) {
    const skip = (page - 1) * limit;

    const [projects, total] = await Promise.all([
      this.model.findMany({
        where: filter,
        skip,
        take: limit,
        orderBy: {
          updatedAt: 'desc',
        },
        include: {
          versions: {
            select: {
              id: true,
              name: true,
              status: true,
              releaseDate: true,
              createdAt: true,
              _count: {
                select: {
                  modules: true,
                },
              },
            },
            orderBy: {
              createdAt: 'desc',
            },
            take: 5, // Only recent versions
          },
          _count: {
            select: {
              versions: true,
            },
          },
        },
      }),
      this.model.count({ where: filter }),
    ]);

    return {
      data: projects,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findWithVersionCount() {
    return this.model.findMany({
      select: {
        id: true,
        name: true,
        icon: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            versions: true,
          },
        },
        versions: {
          select: {
            id: true,
            name: true,
            status: true,
            _count: {
              select: {
                modules: true,
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
          take: 1, // Latest version
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });
  }

  async deleteWithVersions(projectId: string): Promise<void> {
    // This will cascade delete versions, modules, and scripts
    await this.model.delete({
      where: { id: projectId },
    });
  }

  async search(query: string, page: number = 1, limit: number = 10) {
    const skip = (page - 1) * limit;

    const [projects, total] = await Promise.all([
      this.model.findMany({
        where: {
          OR: [
            {
              name: {
                contains: query,
                mode: 'insensitive',
              },
            },
          ],
        },
        skip,
        take: limit,
        include: {
          _count: {
            select: {
              versions: true,
            },
          },
        },
        orderBy: {
          updatedAt: 'desc',
        },
      }),
      this.model.count({
        where: {
          OR: [
            {
              name: {
                contains: query,
                mode: 'insensitive',
              },
            },
          ],
        },
      }),
    ]);

    return {
      data: projects,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}