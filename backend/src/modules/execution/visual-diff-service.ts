import { createReadStream, createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { PrismaClient, VisualDiff } from '@prisma/client';
import { VisualDiffRepository } from './visual-diff-repository';
import { s3Client } from '@/libs/s3';
import { logger } from '@/utils/logger';
import * as pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';

export interface VisualDiffOptions {
  tolerance?: number;
  threshold?: number;
  includeAntiAliasing?: boolean;
}

export interface DiffResult {
  diffKey: string;
  diffPercentage: number;
  hasDifferences: boolean;
  diffBuffer?: Buffer;
}

export class VisualDiffService {
  private visualDiffRepo: VisualDiffRepository;
  private defaultTolerance = 0.1;
  private defaultThreshold = 0.05;

  constructor(prisma: PrismaClient) {
    this.visualDiffRepo = new VisualDiffRepository(prisma);
  }

  async compareScreenshots(
    executionId: string,
    stepId: number,
    actualKey: string,
    baselineKey: string,
    options: VisualDiffOptions = {}
  ): Promise<DiffResult> {
    const tolerance = options.tolerance ?? this.defaultTolerance;
    const threshold = options.threshold ?? this.defaultThreshold;

    logger.info('Starting visual diff comparison', {
      executionId,
      stepId,
      actualKey,
      baselineKey,
      tolerance,
      threshold,
    });

    try {
      // Download screenshots from S3
      const [actualBuffer, baselineBuffer] = await Promise.all([
        s3Client.getScreenshot(actualKey),
        s3Client.getScreenshot(baselineKey),
      ]);

      // Parse PNG images
      const actualImg = PNG.sync.read(actualBuffer);
      const baselineImg = PNG.sync.read(baselineBuffer);

      // Ensure images have the same dimensions
      const width = Math.max(actualImg.width, baselineImg.width);
      const height = Math.max(actualImg.height, baselineImg.height);

      // Create diff image
      const diffImg = new PNG({ width, height });

      // Compare images
      const diffPixels = pixelmatch(
        actualImg.data,
        baselineImg.data,
        diffImg.data,
        width,
        height,
        {
          threshold: threshold,
          includeAA: options.includeAntiAliasing ?? true,
        }
      );

      // Calculate diff percentage
      const totalPixels = width * height;
      const diffPercentage = (diffPixels / totalPixels) * 100;

      // Create diff buffer
      const diffBuffer = PNG.sync.write(diffImg);

      // Upload diff image to S3
      const diffKey = `diffs/${executionId}/step_${stepId}_diff.png`;
      await s3Client.uploadScreenshot(diffKey, diffBuffer);

      const result: DiffResult = {
        diffKey,
        diffPercentage,
        hasDifferences: diffPixels > 0,
        diffBuffer,
      };

      logger.info('Visual diff completed', {
        executionId,
        stepId,
        diffPercentage,
        diffPixels,
        hasDifferences: result.hasDifferences,
        diffKey,
      });

      return result;
    } catch (error) {
      logger.error('Visual diff comparison failed', {
        executionId,
        stepId,
        error: error.message,
      });
      throw error;
    }
  }

  async createVisualDiff(
    executionId: string,
    stepId: number,
    baselineKey: string,
    actualKey: string,
    options: VisualDiffOptions = {}
  ): Promise<VisualDiff> {
    // Perform comparison
    const diffResult = await this.compareScreenshots(
      executionId,
      stepId,
      actualKey,
      baselineKey,
      options
    );

    // Auto-approve if difference is within tolerance
    const approved = diffResult.diffPercentage <= (options.tolerance ?? this.defaultTolerance);

    // Create visual diff record
    const visualDiff = await this.visualDiffRepo.createDiff({
      executionId,
      stepId,
      baselineKey,
      actualKey,
      diffKey: diffResult.diffKey,
      diffPercentage: diffResult.diffPercentage,
      tolerance: options.tolerance ?? this.defaultTolerance,
      approved,
    });

    logger.info('Visual diff created', {
      diffId: visualDiff.id,
      executionId,
      stepId,
      diffPercentage: diffResult.diffPercentage,
      approved,
    });

    return visualDiff;
  }

  async generateBaseline(
    scriptId: string,
    stepId: number,
    screenshotKey: string
  ): Promise<string> {
    const baselineKey = `baselines/${scriptId}/step_${stepId}_baseline.png`;

    // Download the screenshot
    const screenshotBuffer = await s3Client.getScreenshot(screenshotKey);

    // Upload as baseline
    await s3Client.uploadScreenshot(baselineKey, screenshotBuffer);

    logger.info('Baseline generated', {
      scriptId,
      stepId,
      baselineKey,
      screenshotKey,
    });

    return baselineKey;
  }

  async updateBaseline(
    diffId: string,
    newActualKey: string,
    approvedBy: string
  ): Promise<VisualDiff> {
    // Get the visual diff
    const visualDiff = await this.visualDiffRepo.findById(diffId);
    if (!visualDiff) {
      throw new Error(`Visual diff not found: ${diffId}`);
    }

    // Download new actual screenshot
    const newBuffer = await s3Client.getScreenshot(newActualKey);

    // Generate new baseline key
    const newBaselineKey = `baselines/updated_${Date.now()}_${diffId}.png`;

    // Upload as new baseline
    await s3Client.uploadScreenshot(newBaselineKey, newBuffer);

    // Update visual diff with new baseline
    const updatedDiff = await this.visualDiffRepo.update(diffId, {
      baselineKey: newBaselineKey,
      approved: true,
    });

    logger.info('Baseline updated', {
      diffId,
      newBaselineKey,
      approvedBy,
    });

    return updatedDiff;
  }

  async batchApproveDiffs(
    diffIds: string[],
    approved: boolean,
    approvedBy?: string
  ): Promise<{ approved: number; rejected: number }> {
    const result = await this.visualDiffRepo.batchUpdateApproval(diffIds, approved);

    logger.info('Batch approval completed', {
      totalProcessed: diffIds.length,
      approved: approved ? result : 0,
      rejected: !approved ? result : 0,
      approvedBy,
    });

    return {
      approved: approved ? result : 0,
      rejected: !approved ? result : 0,
    };
  }

  async autoApproveSmallDiffs(threshold: number = 0.1): Promise<number> {
    const approvedCount = await this.visualDiffRepo.autoApproveDiffs(threshold);

    logger.info('Auto-approval completed', {
      threshold,
      approvedCount,
    });

    return approvedCount;
  }

  async generateDiffReport(executionId: string): Promise<{
    summary: {
      totalSteps: number;
      diffsFound: number;
      diffsApproved: number;
      diffsPending: number;
      averageDiffPercentage: number;
    };
    diffs: Array<{
      stepId: number;
      diffPercentage: number;
      approved: boolean;
      diffKey: string;
      actualKey: string;
      baselineKey: string;
    }>;
  }> {
    // Get all visual diffs for execution
    const diffs = await this.visualDiffRepo.findByExecution(executionId);

    // Calculate summary
    const totalSteps = Math.max(...diffs.map(d => d.stepId), 0) + 1;
    const diffsFound = diffs.length;
    const diffsApproved = diffs.filter(d => d.approved).length;
    const diffsPending = diffsFound - diffsApproved;
    const averageDiffPercentage = diffs.length > 0
      ? diffs.reduce((sum, d) => sum + d.diffPercentage, 0) / diffs.length
      : 0;

    const summary = {
      totalSteps,
      diffsFound,
      diffsApproved,
      diffsPending,
      averageDiffPercentage,
    };

    const diffsDetails = diffs.map(diff => ({
      stepId: diff.stepId,
      diffPercentage: diff.diffPercentage,
      approved: diff.approved,
      diffKey: diff.diffKey,
      actualKey: diff.actualKey,
      baselineKey: diff.baselineKey,
    }));

    return {
      summary,
      diffs: diffsDetails,
    };
  }

  async createDiffAnimation(
    baselineKey: string,
    actualKey: string,
    diffKey: string,
    outputKey: string
  ): Promise<string> {
    // This would create an animated GIF showing baseline -> actual -> diff
    // Implementation would require additional libraries like 'gif-encoder'

    logger.info('Diff animation requested', {
      baselineKey,
      actualKey,
      diffKey,
      outputKey,
    });

    // For now, return the diff key
    // In a full implementation, you would:
    // 1. Download all three images
    // 2. Create animated frames
    // 3. Encode as GIF
    // 4. Upload to S3
    // 5. Return the animation key

    return diffKey;
  }

  async getDiffHeatmap(diffId: string): Promise<string> {
    const visualDiff = await this.visualDiffRepo.findById(diffId);
    if (!visualDiff || !visualDiff.diffKey) {
      throw new Error(`Visual diff not found or has no diff image: ${diffId}`);
    }

    const heatmapKey = `heatmaps/${diffId}_heatmap.png`;

    try {
      // Download diff image
      const diffBuffer = await s3Client.getScreenshot(visualDiff.diffKey);
      const diffImg = PNG.sync.read(diffBuffer);

      // Create heatmap by highlighting differences
      const heatmapImg = new PNG({
        width: diffImg.width,
        height: diffImg.height,
      });

      // Apply heatmap coloring
      for (let i = 0; i < diffImg.data.length; i += 4) {
        const r = diffImg.data[i];
        const g = diffImg.data[i + 1];
        const b = diffImg.data[i + 2];
        const a = diffImg.data[i + 3];

        // Check if this is a diff pixel (typically red in pixelmatch output)
        if (r > 100 && g < 100 && b < 100) {
          // Make it more visible with orange color
          heatmapImg.data[i] = 255;     // R
          heatmapImg.data[i + 1] = 165; // G
          heatmapImg.data[i + 2] = 0;   // B
          heatmapImg.data[i + 3] = a;   // A
        } else {
          // Make non-diff areas semi-transparent gray
          heatmapImg.data[i] = 128;
          heatmapImg.data[i + 1] = 128;
          heatmapImg.data[i + 2] = 128;
          heatmapImg.data[i + 3] = a * 0.3;
        }
      }

      const heatmapBuffer = PNG.sync.write(heatmapImg);
      await s3Client.uploadScreenshot(heatmapKey, heatmapBuffer);

      logger.info('Heatmap generated', { diffId, heatmapKey });

      return heatmapKey;
    } catch (error) {
      logger.error('Failed to generate heatmap', { diffId, error: error.message });
      throw error;
    }
  }

  async compareWithThreshold(
    actualKey: string,
    baselineKey: string,
    threshold: number
  ): Promise<{
    passed: boolean;
    diffPercentage: number;
    diffKey?: string;
  }> {
    const diffResult = await this.compareScreenshots(
      'temp',
      0,
      actualKey,
      baselineKey,
      { threshold }
    );

    return {
      passed: diffResult.diffPercentage <= threshold,
      diffPercentage: diffResult.diffPercentage,
      diffKey: diffResult.diffKey,
    };
  }

  async cleanupDiff(diffId: string): Promise<void> {
    const visualDiff = await this.visualDiffRepo.findById(diffId);
    if (!visualDiff) {
      return;
    }

    // Delete files from S3
    const keysToDelete = [
      visualDiff.actualKey,
      visualDiff.diffKey,
    ];

    // Don't delete baseline as it might be used by other diffs
    // Only delete if no other diffs reference it
    const otherDiffsUsingBaseline = await this.visualDiffRepo.findMany({
      where: {
        baselineKey: visualDiff.baselineKey,
        id: { not: diffId },
      },
    });

    if (otherDiffsUsingBaseline.length === 0) {
      keysToDelete.push(visualDiff.baselineKey);
    }

    // Delete from S3 (in batches)
    for (const key of keysToDelete) {
      try {
        await s3Client.deleteScreenshot(key);
      } catch (error) {
        logger.warn('Failed to delete screenshot from S3', {
          key,
          error: error.message,
        });
      }
    }

    // Delete from database
    await this.visualDiffRepo.delete(diffId);

    logger.info('Visual diff cleaned up', { diffId });
  }
}