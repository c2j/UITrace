import { PrismaClient } from '@prisma/client';
import { ProjectRepository } from './repository';
import { VersionRepository } from '../version/repository';
import { createProjectSchema, updateProjectSchema } from '@/utils/validation';
import { badRequest, conflict, notFound } from '@/middleware/errorHandler';
import { z } from 'zod';
import { logger } from '@/utils/logger';

type CreateProjectData = z.infer<typeof createProjectSchema>;
type UpdateProjectData = z.infer<typeof updateProjectSchema>;

export class ProjectService {
  private projectRepo: ProjectRepository;
  private versionRepo: VersionRepository;

  constructor(prisma: PrismaClient) {
    this.projectRepo = new ProjectRepository(prisma);
    this.versionRepo = new VersionRepository(prisma);
  }

  async createProject(data: CreateProjectData) {
    // Validate input
    const validatedData = createProjectSchema.parse(data);

    // Check if project name already exists
    const existingProject = await this.projectRepo.findByName(validatedData.name);
    if (existingProject) {
      throw conflict('Project with this name already exists');
    }

    // Create project
    const project = await this.projectRepo.create(validatedData);
    logger.info('Project created', { projectId: project.id, name: project.name });

    return project;
  }

  async getProject(projectId: string) {
    const project = await this.projectRepo.findById(projectId);
    if (!project) {
      throw notFound('Project not found');
    }

    return project;
  }

  async getProjectWithVersions(projectId: string) {
    const project = await this.projectRepo.findWithVersions(projectId);
    if (!project) {
      throw notFound('Project not found');
    }

    return project;
  }

  async listProjects(page: number = 1, limit: number = 10) {
    return this.projectRepo.findManyWithVersions({}, page, limit);
  }

  async listProjectsWithVersionCount() {
    return this.projectRepo.findWithVersionCount();
  }

  async updateProject(projectId: string, data: UpdateProjectData) {
    // Validate input
    const validatedData = updateProjectSchema.parse(data);

    // Check if project exists
    const existingProject = await this.projectRepo.findById(projectId);
    if (!existingProject) {
      throw notFound('Project not found');
    }

    // If updating name, check for uniqueness
    if (validatedData.name && validatedData.name !== existingProject.name) {
      const nameExists = await this.projectRepo.findByName(validatedData.name);
      if (nameExists) {
        throw conflict('Project with this name already exists');
      }
    }

    const updatedProject = await this.projectRepo.update(projectId, validatedData);
    logger.info('Project updated', { projectId, changes: Object.keys(validatedData) });

    return updatedProject;
  }

  async deleteProject(projectId: string) {
    // Check if project exists
    const project = await this.projectRepo.findById(projectId);
    if (!project) {
      throw notFound('Project not found');
    }

    // Check if project has active versions
    const versions = await this.versionRepo.findByProject(projectId, 'ACTIVE');
    if (versions.length > 0) {
      throw badRequest('Cannot delete project with active versions. Archive versions first.');
    }

    await this.projectRepo.deleteWithVersions(projectId);
    logger.info('Project deleted', { projectId, name: project.name });
  }

  async searchProjects(query: string, page: number = 1, limit: number = 10) {
    if (!query || query.trim().length < 2) {
      throw badRequest('Search query must be at least 2 characters');
    }

    return this.projectRepo.search(query.trim(), page, limit);
  }

  async getProjectStats(projectId: string) {
    const project = await this.projectRepo.findById(projectId);
    if (!project) {
      throw notFound('Project not found');
    }

    const versions = await this.versionRepo.findByProject(projectId);
    let totalModules = 0;
    let totalScripts = 0;
    let totalExecutions = 0;

    for (const version of versions) {
      const stats = await this.versionRepo.getVersionStats(version.id);
      totalModules += stats.modules;
      totalScripts += stats.scripts;
      totalExecutions += stats.executions;
    }

    return {
      project: {
        id: project.id,
        name: project.name,
        icon: project.icon,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
      },
      versions: {
        total: versions.length,
        active: versions.filter(v => v.status === 'ACTIVE').length,
        archived: versions.filter(v => v.status === 'ARCHIVED').length,
        draft: versions.filter(v => v.status === 'DRAFT').length,
      },
      modules: totalModules,
      scripts: totalScripts,
      executions: totalExecutions,
    };
  }

  async archiveProject(projectId: string) {
    const project = await this.projectRepo.findById(projectId);
    if (!project) {
      throw notFound('Project not found');
    }

    // Archive all active versions
    await this.versionRepo.archiveOldVersions(projectId, 0);
    logger.info('Project archived', { projectId, name: project.name });

    return { success: true, message: 'All project versions have been archived' };
  }
}