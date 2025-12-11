import { PrismaClient } from '@prisma/client';
import { VersionRepository } from './repository';
import { ModuleRepository } from '../module/repository';
import { createVersionSchema, updateVersionSchema } from '@/utils/validation';
import { badRequest, conflict, notFound } from '@/middleware/errorHandler';
import { z } from 'zod';
import { logger } from '@/utils/logger';

type CreateVersionData = z.infer<typeof createVersionSchema>;
type UpdateVersionData = z.infer<typeof updateVersionSchema>;

export class VersionService {
  private versionRepo: VersionRepository;
  private moduleRepo: ModuleRepository;

  constructor(prisma: PrismaClient) {
    this.versionRepo = new VersionRepository(prisma);
    this.moduleRepo = new ModuleRepository(prisma);
  }

  async createVersion(data: CreateVersionData) {
    // Validate input
    const validatedData = createVersionSchema.parse(data);

    // Check if version name already exists for this project
    const existingVersion = await this.versionRepo.findByProjectAndName(
      validatedData.projectId,
      validatedData.name
    );
    if (existingVersion) {
      throw conflict('Version with this name already exists for this project');
    }

    // Create version
    const version = await this.versionRepo.create(validatedData);
    logger.info('Version created', {
      versionId: version.id,
      projectId: version.projectId,
      name: version.name,
    });

    return version;
  }

  async getVersion(versionId: string) {
    const version = await this.versionRepo.findById(versionId);
    if (!version) {
      throw notFound('Version not found');
    }

    return version;
  }

  async getVersionWithModules(versionId: string) {
    const version = await this.versionRepo.findWithModules(versionId);
    if (!version) {
      throw notFound('Version not found');
    }

    return version;
  }

  async listVersions(projectId: string, status?: string) {
    return this.versionRepo.findByProject(projectId, status);
  }

  async getActiveVersions(projectId: string) {
    return this.versionRepo.findActiveVersions(projectId);
  }

  async getLatestVersion(projectId: string) {
    return this.versionRepo.findLatestVersion(projectId);
  }

  async updateVersion(versionId: string, data: UpdateVersionData) {
    // Validate input
    const validatedData = updateVersionSchema.parse(data);

    // Check if version exists
    const existingVersion = await this.versionRepo.findById(versionId);
    if (!existingVersion) {
      throw notFound('Version not found');
    }

    // If updating status to ACTIVE, set release date if not provided
    if (validatedData.status === 'ACTIVE' && !validatedData.releaseDate) {
      validatedData.releaseDate = new Date().toISOString();
    }

    const updatedVersion = await this.versionRepo.update(versionId, validatedData);
    logger.info('Version updated', {
      versionId,
      changes: Object.keys(validatedData),
    });

    return updatedVersion;
  }

  async deleteVersion(versionId: string) {
    const version = await this.versionRepo.findById(versionId);
    if (!version) {
      throw notFound('Version not found');
    }

    if (version.status === 'ACTIVE') {
      throw badRequest('Cannot delete active version. Archive it first.');
    }

    await this.versionRepo.delete(versionId);
    logger.info('Version deleted', {
      versionId,
      projectId: version.projectId,
      name: version.name,
    });
  }

  async duplicateVersion(versionId: string, newVersionName: string) {
    const sourceVersion = await this.versionRepo.findById(versionId);
    if (!sourceVersion) {
      throw notFound('Source version not found');
    }

    // Create new version
    const newVersion = await this.versionRepo.create({
      projectId: sourceVersion.projectId,
      name: newVersionName,
      status: 'DRAFT',
    });

    // Duplicate modules from source version
    await this.versionRepo.duplicateModules(versionId, newVersion.id);
    logger.info('Version duplicated', {
      sourceVersionId: versionId,
      newVersionId: newVersion.id,
      newVersionName,
    });

    return newVersion;
  }

  async getVersionStats(versionId: string) {
    const version = await this.versionRepo.findById(versionId);
    if (!version) {
      throw notFound('Version not found');
    }

    return this.versionRepo.getVersionStats(versionId);
  }

  async archiveVersion(versionId: string) {
    const version = await this.versionRepo.findById(versionId);
    if (!version) {
      throw notFound('Version not found');
    }

    if (version.status !== 'ACTIVE') {
      throw badRequest('Only active versions can be archived');
    }

    await this.versionRepo.update(versionId, { status: 'ARCHIVED' });
    logger.info('Version archived', { versionId, name: version.name });

    return { success: true, message: 'Version has been archived' };
  }

  async activateVersion(versionId: string) {
    const version = await this.versionRepo.findById(versionId);
    if (!version) {
      throw notFound('Version not found');
    }

    if (version.status !== 'DRAFT') {
      throw badRequest('Only draft versions can be activated');
    }

    await this.versionRepo.update(versionId, {
      status: 'ACTIVE',
      releaseDate: new Date().toISOString(),
    });
    logger.info('Version activated', { versionId, name: version.name });

    return { success: true, message: 'Version has been activated' };
  }

  async getInheritanceTree(versionId: string) {
    const version = await this.versionRepo.findWithModules(versionId);
    if (!version) {
      throw notFound('Version not found');
    }

    const modules = [];
    for (const module of version.modules) {
      const inheritanceChain = await this.moduleRepo.getInheritanceChain(module.id);
      modules.push({
        ...module,
        inheritanceChain,
      });
    }

    return {
      version,
      modules,
    };
  }
}