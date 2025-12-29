import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RegionModule } from '@qckstrt/region-provider';
import { RegionDomainService } from './region.service';
import { RegionResolver } from './region.resolver';
import { RegionScheduler } from './region.scheduler';
import { PropositionEntity } from 'src/db/entities/proposition.entity';
import { MeetingEntity } from 'src/db/entities/meeting.entity';
import { RepresentativeEntity } from 'src/db/entities/representative.entity';

/**
 * Region Domain Module
 *
 * Provides civic data management for the region.
 * Uses the region provider to fetch and sync data.
 */
@Module({
  imports: [
    RegionModule.forRootAsync(),
    TypeOrmModule.forFeature([
      PropositionEntity,
      MeetingEntity,
      RepresentativeEntity,
    ]),
  ],
  providers: [RegionDomainService, RegionResolver, RegionScheduler],
  exports: [RegionDomainService],
})
export class RegionDomainModule {}
