import { PrismaClient } from '@prisma/client';
import { ScriptRepository } from './repository';
import { ModuleRepository } from '../module/repository';
import { createScriptSchema, updateScriptSchema } from '@/utils/validation';
import { badRequest, conflict, notFound } from '@/middleware/errorHandler';
import { z } from 'zod';
import { logger } from '@/utils/logger';

type CreateScriptData = z.infer<typeof createScriptSchema>;
type UpdateScriptData = z.infer<typeof updateScriptSchema>;

export class ScriptService {
  private scriptRepo: ScriptRepository;
  private moduleRepo: ModuleRepository;

  constructor(prisma: PrismaClient) {
    this.scriptRepo = new ScriptRepository(prisma);
    this.moduleRepo = new ModuleRepository(prisma);
  }

  async createScript(data: CreateScriptData) {
    // Validate input
    const validatedData = createScriptSchema.parse(data);

    // Check if module exists
    const module = await this.moduleRepo.findById(validatedData.moduleId);
    if (!module) {
      throw notFound('Module not found');
    }

    // Check if script name already exists in this module
    const existingScript = await this.scriptRepo.findByModuleAndName(
      validatedData.moduleId,
      validatedData.name
    );
    if (existingScript) {
      throw conflict('Script with this name already exists in this module');
    }

    // Validate script steps
    if (!validatedData.steps || validatedData.steps.length === 0) {
      throw badRequest('Script must have at least one step');
    }

    // Validate each step
    for (const step of validatedData.steps) {
      if (!step.id || !step.name || !step.action) {
        throw badRequest('Each step must have id, name, and action');
      }

      // Validate selectors based on action
      if (['click', 'type', 'assert_text'].includes(step.action) &&
          (!step.selectors || step.selectors.length === 0)) {
        throw badRequest(`Step '${step.name}' requires at least one selector`);
      }

      // Validate value for type action
      if (step.action === 'type' && !step.value) {
        throw badRequest(`Step '${step.name}' with type action requires a value`);
      }

      // Validate expectedValue for assert_text action
      if (step.action === 'assert_text' && !step.expectedValue) {
        throw badRequest(`Step '${step.name}' with assert_text action requires expectedValue`);
      }
    }

    // Create script
    const script = await this.scriptRepo.create(validatedData);
    logger.info('Script created', {
      scriptId: script.id,
      moduleId: script.moduleId,
      name: script.name,
      priority: script.priority,
      stepCount: script.steps.length,
    });

    return script;
  }

  async getScript(scriptId: string) {
    const script = await this.scriptRepo.findById(scriptId);
    if (!script) {
      throw notFound('Script not found');
    }

    return script;
  }

  async getScriptWithExecutions(scriptId: string, limit: number = 10) {
    const script = await this.scriptRepo.findWithExecutions(scriptId, limit);
    if (!script) {
      throw notFound('Script not found');
    }

    return script;
  }

  async listScripts(moduleId: string, priority?: string) {
    // Check if module exists
    const module = await this.moduleRepo.findById(moduleId);
    if (!module) {
      throw notFound('Module not found');
    }

    return this.scriptRepo.findByModule(moduleId, priority);
  }

  async updateScript(scriptId: string, data: UpdateScriptData) {
    // Validate input
    const validatedData = updateScriptSchema.parse(data);

    // Check if script exists
    const existingScript = await this.scriptRepo.findById(scriptId);
    if (!existingScript) {
      throw notFound('Script not found');
    }

    // If updating name, check for uniqueness
    if (validatedData.name && validatedData.name !== existingScript.name) {
      const nameExists = await this.scriptRepo.findByModuleAndName(
        existingScript.moduleId,
        validatedData.name
      );
      if (nameExists) {
        throw conflict('Script with this name already exists in this module');
      }
    }

    // Validate steps if provided
    if (validatedData.steps) {
      if (validatedData.steps.length === 0) {
        throw badRequest('Script must have at least one step');
      }

      // Validate each step
      for (const step of validatedData.steps) {
        if (!step.id || !step.name || !step.action) {
          throw badRequest('Each step must have id, name, and action');
        }

        // Validate selectors based on action
        if (['click', 'type', 'assert_text'].includes(step.action) &&
            (!step.selectors || step.selectors.length === 0)) {
          throw badRequest(`Step '${step.name}' requires at least one selector`);
        }
      }
    }

    const updatedScript = await this.scriptRepo.update(scriptId, validatedData);
    logger.info('Script updated', {
      scriptId,
      changes: Object.keys(validatedData),
    });

    return updatedScript;
  }

  async deleteScript(scriptId: string) {
    const script = await this.scriptRepo.findById(scriptId);
    if (!script) {
      throw notFound('Script not found');
    }

    await this.scriptRepo.delete(scriptId);
    logger.info('Script deleted', {
      scriptId,
      moduleId: script.moduleId,
      name: script.name,
    });

    return { success: true, message: 'Script deleted successfully' };
  }

  async getScriptStats(scriptId: string) {
    const script = await this.scriptRepo.findById(scriptId);
    if (!script) {
      throw notFound('Script not found');
    }

    return this.scriptRepo.getScriptStats(scriptId);
  }

  async searchScripts(projectId: string, query: string) {
    if (!query || query.trim().length < 2) {
      throw badRequest('Search query must be at least 2 characters');
    }

    return this.scriptRepo.searchAcrossProject(projectId, query.trim());
  }

  async getScriptsByStatus(status: string, page: number = 1, limit: number = 10) {
    const validStatuses = ['PASS', 'FAIL', 'SKIP', 'PENDING'];
    if (!validStatuses.includes(status)) {
      throw badRequest(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
    }

    return this.scriptRepo.findByStatus(status, page, limit);
  }

  async getScriptsByPriority(minPriority: string, maxPriority: string) {
    const validPriorities = ['P0', 'P1', 'P2'];
    if (!validPriorities.includes(minPriority) || !validPriorities.includes(maxPriority)) {
      throw badRequest(`Invalid priorities. Must be one of: ${validPriorities.join(', ')}`);
    }

    return this.scriptRepo.findByPriorityRange(minPriority, maxPriority);
  }

  async duplicateScript(scriptId: string, targetModuleId: string, newName: string) {
    const sourceScript = await this.scriptRepo.findById(scriptId);
    if (!sourceScript) {
      throw notFound('Source script not found');
    }

    // Check if target module exists
    const targetModule = await this.moduleRepo.findById(targetModuleId);
    if (!targetModule) {
      throw notFound('Target module not found');
    }

    // Check if script name already exists in target module
    const nameExists = await this.scriptRepo.findByModuleAndName(targetModuleId, newName);
    if (nameExists) {
      throw conflict('Script with this name already exists in target module');
    }

    // Create new script
    const newScript = await this.scriptRepo.create({
      moduleId: targetModuleId,
      name: newName,
      description: sourceScript.description,
      priority: sourceScript.priority,
      steps: sourceScript.steps,
    });

    logger.info('Script duplicated', {
      sourceScriptId: scriptId,
      newScriptId: newScript.id,
      targetModuleId,
      newName,
    });

    return newScript;
  }

  async getScriptsByEnvironment(environment: string) {
    if (!environment || environment.trim().length === 0) {
      throw badRequest('Environment must be specified');
    }

    return this.scriptRepo.findByEnvironment(environment.trim());
  }

  async validateScriptSteps(steps: any[]) {
    if (!steps || steps.length === 0) {
      throw badRequest('Script must have at least one step');
    }

    const errors = [];
    for (const step of steps) {
      const stepErrors = [];

      if (!step.id || typeof step.id !== 'number') {
        stepErrors.push('Step must have a numeric id');
      }

      if (!step.name || typeof step.name !== 'string') {
        stepErrors.push('Step must have a name');
      }

      if (!step.action || !['navigate', 'click', 'type', 'assert_text', 'screenshot', 'wait'].includes(step.action)) {
        stepErrors.push('Step must have a valid action');
      }

      // Validate selectors
      if (['click', 'type', 'assert_text'].includes(step.action)) {
        if (!step.selectors || !Array.isArray(step.selectors) || step.selectors.length === 0) {
          stepErrors.push('This action requires at least one selector');
        } else {
          for (const selector of step.selectors) {
            if (!selector.type || !['id', 'css', 'xpath', 'text'].includes(selector.type)) {
              stepErrors.push('Selector must have a valid type');
            }
            if (!selector.value) {
              stepErrors.push('Selector must have a value');
            }
          }
        }
      }

      // Validate value for type action
      if (step.action === 'type' && !step.value) {
        stepErrors.push('Type action requires a value');
      }

      // Validate expectedValue for assert_text action
      if (step.action === 'assert_text' && !step.expectedValue) {
        stepErrors.push('Assert text action requires expectedValue');
      }

      // Validate timeout
      if (step.timeout && (typeof step.timeout !== 'number' || step.timeout < 1000 || step.timeout > 60000)) {
        stepErrors.push('Timeout must be between 1000 and 60000 milliseconds');
      }

      if (stepErrors.length > 0) {
        errors.push({
          stepId: step.id || 'unknown',
          stepName: step.name || 'unknown',
          errors: stepErrors,
        });
      }
    }

    if (errors.length > 0) {
      throw badRequest('Script validation failed', errors);
    }

    return { valid: true, message: 'Script steps are valid' };
  }
}