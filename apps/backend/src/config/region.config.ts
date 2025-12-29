import { registerAs } from '@nestjs/config';

/**
 * Region Configuration
 *
 * Controls which region provider is used and sync settings.
 */
export default registerAs('region', () => ({
  // Region provider selection (example, california, etc.)
  provider: process.env.REGION_PROVIDER || 'example',

  // Sync schedule (cron expression)
  // Default: Every day at 2 AM
  syncSchedule: process.env.REGION_SYNC_SCHEDULE || '0 2 * * *',

  // Enable/disable automatic sync
  syncEnabled: process.env.REGION_SYNC_ENABLED !== 'false',

  // Port for the region service
  port: Number.parseInt(process.env.REGION_PORT || '3004', 10),
}));
