import { PrismaClient } from '@prisma/client';
import { logger } from './logger';

export abstract class BaseRepository<T, CreateData, UpdateData> {
  protected prisma: PrismaClient;
  protected model: any;

  constructor(prisma: PrismaClient, model: any) {
    this.prisma = prisma;
    this.model = model;
  }

  async findById(id: string): Promise<T | null> {
    try {
      return await this.model.findUnique({
        where: { id },
      });
    } catch (error) {
      logger.error(`Error finding ${this.model.name} by id`, { id, error });
      throw error;
    }
  }

  async findMany(filter: any = {}, options: any = {}): Promise<T[]> {
    try {
      return await this.model.findMany({
        where: filter,
        ...options,
      });
    } catch (error) {
      logger.error(`Error finding many ${this.model.name}`, { filter, error });
      throw error;
    }
  }

  async create(data: CreateData): Promise<T> {
    try {
      const result = await this.model.create({
        data,
      });
      logger.info(`Created ${this.model.name}`, { id: result.id });
      return result;
    } catch (error) {
      logger.error(`Error creating ${this.model.name}`, { data, error });
      throw error;
    }
  }

  async update(id: string, data: UpdateData): Promise<T> {
    try {
      const result = await this.model.update({
        where: { id },
        data,
      });
      logger.info(`Updated ${this.model.name}`, { id });
      return result;
    } catch (error) {
      logger.error(`Error updating ${this.model.name}`, { id, data, error });
      throw error;
    }
  }

  async delete(id: string): Promise<T> {
    try {
      const result = await this.model.delete({
        where: { id },
      });
      logger.info(`Deleted ${this.model.name}`, { id });
      return result;
    } catch (error) {
      logger.error(`Error deleting ${this.model.name}`, { id, error });
      throw error;
    }
  }

  async count(filter: any = {}): Promise<number> {
    try {
      return await this.model.count({
        where: filter,
      });
    } catch (error) {
      logger.error(`Error counting ${this.model.name}`, { filter, error });
      throw error;
    }
  }

  async exists(id: string): Promise<boolean> {
    const count = await this.count({ id });
    return count > 0;
  }

  async paginate(filter: any = {}, page: number = 1, limit: number = 10, orderBy: any = {}): Promise<{
    data: T[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const skip = (page - 1) * limit;

    try {
      const [data, total] = await Promise.all([
        this.model.findMany({
          where: filter,
          skip,
          take: limit,
          orderBy,
        }),
        this.model.count({ where: filter }),
      ]);

      return {
        data,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    } catch (error) {
      logger.error(`Error paginating ${this.model.name}`, { filter, page, limit, error });
      throw error;
    }
  }
}

export abstract class SoftDeleteRepository<T, CreateData, UpdateData> extends BaseRepository<T, CreateData, UpdateData> {
  async softDelete(id: string): Promise<T> {
    try {
      const result = await this.model.update({
        where: { id },
        data: { deletedAt: new Date() },
      });
      logger.info(`Soft deleted ${this.model.name}`, { id });
      return result;
    } catch (error) {
      logger.error(`Error soft deleting ${this.model.name}`, { id, error });
      throw error;
    }
  }

  async findMany(filter: any = {}, options: any = {}): Promise<T[]> {
    // Automatically filter out deleted records
    const where = {
      ...filter,
      deletedAt: null,
    };

    return super.findMany(where, options);
  }

  async count(filter: any = {}): Promise<number> {
    const where = {
      ...filter,
      deletedAt: null,
    };

    return super.count(where);
  }
}