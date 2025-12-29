import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { RegionDomainService } from './region.service';

/**
 * Region Scheduler
 *
 * Handles scheduled sync of region data.
 * Runs daily at 2 AM by default (configurable via REGION_SYNC_SCHEDULE).
 */
@Injectable()
export class RegionScheduler implements OnModuleInit {
  private readonly logger = new Logger(RegionScheduler.name, {
    timestamp: true,
  });
  private readonly syncEnabled: boolean;

  constructor(
    private readonly regionService: RegionDomainService,
    private readonly configService: ConfigService,
  ) {
    this.syncEnabled = this.configService.get('region.syncEnabled') !== false;
  }

  /**
   * Run initial sync on module initialization
   */
  async onModuleInit() {
    if (!this.syncEnabled) {
      this.logger.log('Automatic sync is disabled');
      return;
    }

    this.logger.log('Running initial data sync on startup');
    try {
      await this.syncData();
    } catch (error) {
      this.logger.error('Initial sync failed:', error);
    }
  }

  /**
   * Scheduled sync - runs every day at 2 AM
   *
   * Note: For custom schedules, implement dynamic cron using ConfigService
   * and SchedulerRegistry. The @Cron decorator requires static values.
   */
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async handleScheduledSync() {
    if (!this.syncEnabled) {
      return;
    }

    this.logger.log('Running scheduled data sync');
    await this.syncData();
  }

  /**
   * Perform the actual sync
   */
  private async syncData() {
    try {
      const results = await this.regionService.syncAll();

      const summary = results
        .map(
          (r) =>
            `${r.dataType}: ${r.itemsProcessed} processed (${r.itemsCreated} new, ${r.itemsUpdated} updated)`,
        )
        .join(', ');

      this.logger.log(`Sync complete: ${summary}`);

      const errors = results.flatMap((r) => r.errors);
      if (errors.length > 0) {
        this.logger.warn(
          `Sync had ${errors.length} errors: ${errors.join(', ')}`,
        );
      }
    } catch (error) {
      this.logger.error('Scheduled sync failed:', error);
    }
  }
}
