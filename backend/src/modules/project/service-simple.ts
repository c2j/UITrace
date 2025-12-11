import { PrismaClient } from '@prisma/client';
import { ProjectRepository } from './repository';
import { VersionRepository } from '../version/repository';
import { badRequest, conflict, notFound } from '../../middleware/errorHandler';
import { z } from 'zod';
import { logger } from '../../utils/logger';

// Direct validation schemas (no path alias issues)
const createProjectSchema = z.object({
  name: z.string().min(2).max(100),
  icon: z.string().max(50).optional(),
});

const updateProjectSchema = createProjectSchema.partial();

type CreateProjectData = z.infer<typeof createProjectSchema>;
type UpdateProjectData = z.infer<typeof updateProjectSchema>;

export class ProjectService {
  private repository: ProjectRepository;
  private versionRepository: VersionRepository;
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient();
    this.repository = new ProjectRepository(this.prisma);
    this.versionRepository = new VersionRepository(this.prisma);
  }

  async createProject(data: CreateProjectData) {
    logger.info('Creating new project', { name: data.name });

    // Check if project with same name already exists
    const existingProject = await this.prisma.project.findFirst({
      where: { name: data.name }
    });

    if (existingProject) {
      throw conflict('Project with this name already exists');
    }

    const project = await this.repository.create(data);
    logger.info('Project created successfully', { projectId: project.id });

    return project;
  }

  async getProject(projectId: string) {
    const project = await this.repository.findById(projectId);
    if (!project) {
      throw notFound('Project not found');
    }
    return project;
  }

  async getAllProjects() {
    return this.repository.findAll();
  }

  async updateProject(projectId: string, data: UpdateProjectData) {
    // Validate if project exists
    await this.getProject(projectId);

    // Check if name is being updated and if it conflicts
    if (data.name) {
      const existingProject = await this.prisma.project.findFirst({
        where: {
          name: data.name,
          id: { not: projectId }
        }
      });

      if (existingProject) {
        throw conflict('Project with this name already exists');
      }
    }

    const project = await this.repository.update(projectId, data);
    logger.info('Project updated successfully', { projectId });

    return project;
  }

  async deleteProject(projectId: string) {
    // Validate if project exists
    await this.getProject(projectId);

    await this.repository.delete(projectId);
    logger.info('Project deleted successfully', { projectId });
  }

  async getProjectWithVersions(projectId: string) {
    const project = await this.repository.findByIdWithVersions(projectId);
    if (!project) {
      throw notFound('Project not found');
    }
    return project;
  }

  async getProjectStats(projectId: string) {
    const project = await this.getProject(projectId);

    // Get script count and execution stats
    const [scriptCount, executionStats] = await Promise.all([
      this.repository.getScriptCount(projectId),
      this.repository.getExecutionStats(projectId)
    ]);

    return {
      project,
      scriptCount,
      executionStats,
      passRate: executionStats.totalExecutions > 0
        ? (executionStats.passedExecutions / executionStats.totalExecutions) * 100
        : 0
    };
  }
}