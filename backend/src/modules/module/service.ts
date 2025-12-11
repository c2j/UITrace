import { PrismaClient } from '@prisma/client';
import { ModuleRepository } from './repository';
import { ScriptRepository } from '../script/repository';
import { VersionRepository } from '../version/repository';
import { createModuleSchema, updateModuleSchema } from '@/utils/validation';
import { badRequest, conflict, notFound } from '@/middleware/errorHandler';
import { z } from 'zod';
import { logger } from '@/utils/logger';

type CreateModuleData = z.infer<typeof createModuleSchema>;
type UpdateModuleData = z.infer<typeof updateModuleSchema>;

export class ModuleService {
  private moduleRepo: ModuleRepository;
  private scriptRepo: ScriptRepository;
  private versionRepo: VersionRepository;

  constructor(prisma: PrismaClient) {
    this.moduleRepo = new ModuleRepository(prisma);
    this.scriptRepo = new ScriptRepository(prisma);
    this.versionRepo = new VersionRepository(prisma);
  }

  async createModule(data: CreateModuleData) {
    // Validate input
    const validatedData = createModuleSchema.parse(data);

    // Check if version exists
    const version = await this.versionRepo.findById(validatedData.versionId);
    if (!version) {
      throw notFound('Version not found');
    }

    // Check if module name already exists in this version
    const existingModule = await this.moduleRepo.findByVersionAndName(
      validatedData.versionId,
      validatedData.name
    );
    if (existingModule) {
      throw conflict('Module with this name already exists in this version');
    }

    // If inheriting, check for circular inheritance
    if (validatedData.inheritedFrom) {
      const hasCircularInheritance = await this.moduleRepo.checkCircularInheritance(
        'new-module-id', // Temporary ID for circular check
        validatedData.inheritedFrom
      );
      if (hasCircularInheritance) {
        throw badRequest('Circular inheritance detected');
      }

      // Check if source module exists
      const sourceModule = await this.moduleRepo.findById(validatedData.inheritedFrom);
      if (!sourceModule) {
        throw notFound('Source module for inheritance not found');
      }
    }

    // Create module
    const module = await this.moduleRepo.create(validatedData);
    logger.info('Module created', {
      moduleId: module.id,
      versionId: module.versionId,
      name: module.name,
      inheritedFrom: module.inheritedFrom,
    });

    // If inheriting, duplicate scripts from parent
    if (validatedData.inheritedFrom) {
      await this.moduleRepo.duplicateScripts(validatedData.inheritedFrom, module.id);
      logger.info('Scripts duplicated from parent module', {
        moduleId: module.id,
        inheritedFrom: validatedData.inheritedFrom,
      });
    }

    return module;
  }

  async getModule(moduleId: string) {
    const module = await this.moduleRepo.findById(moduleId);
    if (!module) {
      throw notFound('Module not found');
    }

    return module;
  }

  async getModuleWithScripts(moduleId: string) {
    const module = await this.moduleRepo.findWithScripts(moduleId);
    if (!module) {
      throw notFound('Module not found');
    }

    return module;
  }

  async listModules(versionId: string) {
    // Check if version exists
    const version = await this.versionRepo.findById(versionId);
    if (!version) {
      throw notFound('Version not found');
    }

    return this.moduleRepo.findByVersion(versionId);
  }

  async updateModule(moduleId: string, data: UpdateModuleData) {
    // Validate input
    const validatedData = updateModuleSchema.parse(data);

    // Check if module exists
    const existingModule = await this.moduleRepo.findById(moduleId);
    if (!existingModule) {
      throw notFound('Module not found');
    }

    // If updating name, check for uniqueness
    if (validatedData.name && validatedData.name !== existingModule.name) {
      const nameExists = await this.moduleRepo.findByVersionAndName(
        existingModule.versionId,
        validatedData.name
      );
      if (nameExists) {
        throw conflict('Module with this name already exists in this version');
      }
    }

    const updatedModule = await this.moduleRepo.update(moduleId, validatedData);
    logger.info('Module updated', {
      moduleId,
      changes: Object.keys(validatedData),
    });

    return updatedModule;
  }

  async deleteModule(moduleId: string) {
    const module = await this.moduleRepo.findById(moduleId);
    if (!module) {
      throw notFound('Module not found');
    }

    // Check if module has dependent modules
    const dependentModules = await this.moduleRepo.findInheritedModules(moduleId);
    if (dependentModules.length > 0) {
      throw badRequest(
        `Cannot delete module. It has ${dependentModules.length} dependent module(s).`
      );
    }

    await this.moduleRepo.delete(moduleId);
    logger.info('Module deleted', {
      moduleId,
      versionId: module.versionId,
      name: module.name,
    });

    return { success: true, message: 'Module deleted successfully' };
  }

  async getModuleStats(moduleId: string) {
    const module = await this.moduleRepo.findById(moduleId);
    if (!module) {
      throw notFound('Module not found');
    }

    return this.moduleRepo.getModuleStats(moduleId);
  }

  async searchModules(versionId: string, query: string) {
    if (!query || query.trim().length < 2) {
      throw badRequest('Search query must be at least 2 characters');
    }

    // Check if version exists
    const version = await this.versionRepo.findById(versionId);
    if (!version) {
      throw notFound('Version not found');
    }

    return this.moduleRepo.searchInVersion(versionId, query.trim());
  }

  async getInheritanceChain(moduleId: string) {
    const module = await this.moduleRepo.findById(moduleId);
    if (!module) {
      throw notFound('Module not found');
    }

    const chain = await this.moduleRepo.getInheritanceChain(moduleId);
    return {
      module,
      inheritanceChain: chain,
    };
  }

  async duplicateModule(moduleId: string, targetVersionId: string, newName: string) {
    const sourceModule = await this.moduleRepo.findById(moduleId);
    if (!sourceModule) {
      throw notFound('Source module not found');
    }

    // Check if target version exists
    const targetVersion = await this.versionRepo.findById(targetVersionId);
    if (!targetVersion) {
      throw notFound('Target version not found');
    }

    // Check if module name already exists in target version
    const nameExists = await this.moduleRepo.findByVersionAndName(targetVersionId, newName);
    if (nameExists) {
      throw conflict('Module with this name already exists in target version');
    }

    // Create new module
    const newModule = await this.moduleRepo.create({
      versionId: targetVersionId,
      name: newName,
      description: sourceModule.description,
      inheritedFrom: sourceModule.id,
    });

    // Duplicate scripts from source module
    await this.moduleRepo.duplicateScripts(moduleId, newModule.id);
    logger.info('Module duplicated', {
      sourceModuleId: moduleId,
      newModuleId: newModule.id,
      targetVersionId,
      newName,
    });

    return newModule;
  }

  async breakInheritance(moduleId: string) {
    const module = await this.moduleRepo.findById(moduleId);
    if (!module) {
      throw notFound('Module not found');
    }

    if (!module.inheritedFrom) {
      throw badRequest('Module does not inherit from any module');
    }

    await this.moduleRepo.update(moduleId, { inheritedFrom: null });
    logger.info('Module inheritance broken', {
      moduleId,
      previouslyInheritedFrom: module.inheritedFrom,
    });

    return { success: true, message: 'Inheritance broken successfully' };
  }
}