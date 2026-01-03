import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  RegionService as RegionProviderService,
  CivicDataType,
  SyncResult,
} from '@qckstrt/region-provider';
import { PropositionEntity } from 'src/db/entities/proposition.entity';
import { MeetingEntity } from 'src/db/entities/meeting.entity';
import { RepresentativeEntity } from 'src/db/entities/representative.entity';
import { RegionInfoModel, CivicDataTypeGQL } from './models/region-info.model';
import {
  PaginatedPropositions,
  PropositionStatusGQL,
} from './models/proposition.model';
import { PaginatedMeetings } from './models/meeting.model';
import { PaginatedRepresentatives } from './models/representative.model';

/**
 * Region Domain Service
 *
 * Handles civic data management for the region.
 * Syncs data from the provider and stores in the database.
 */
@Injectable()
export class RegionDomainService {
  private readonly logger = new Logger(RegionDomainService.name, {
    timestamp: true,
  });

  constructor(
    private readonly regionService: RegionProviderService,
    @InjectRepository(PropositionEntity)
    private readonly propositionRepo: Repository<PropositionEntity>,
    @InjectRepository(MeetingEntity)
    private readonly meetingRepo: Repository<MeetingEntity>,
    @InjectRepository(RepresentativeEntity)
    private readonly representativeRepo: Repository<RepresentativeEntity>,
  ) {
    const info = regionService.getRegionInfo();
    this.logger.log(
      `RegionDomainService initialized with provider: ${regionService.getProviderName()} (${info.name})`,
    );
  }

  /**
   * Get region information
   */
  getRegionInfo(): RegionInfoModel {
    const info = this.regionService.getRegionInfo();
    const supportedTypes = this.regionService.getSupportedDataTypes();

    return {
      id: info.id,
      name: info.name,
      description: info.description,
      timezone: info.timezone,
      dataSourceUrls: info.dataSourceUrls,
      supportedDataTypes: supportedTypes.map(
        (t) => t as unknown as CivicDataTypeGQL,
      ),
    };
  }

  /**
   * Sync all data types from the provider
   */
  async syncAll(): Promise<SyncResult[]> {
    this.logger.log('Starting full data sync');
    const results: SyncResult[] = [];

    const supportedTypes = this.regionService.getSupportedDataTypes();

    for (const dataType of supportedTypes) {
      try {
        const result = await this.syncDataType(dataType);
        results.push(result);
      } catch (error) {
        this.logger.error(`Failed to sync ${dataType}:`, error);
        results.push({
          dataType,
          itemsProcessed: 0,
          itemsCreated: 0,
          itemsUpdated: 0,
          errors: [(error as Error).message],
          syncedAt: new Date(),
        });
      }
    }

    this.logger.log(`Sync complete. Processed ${results.length} data types.`);
    return results;
  }

  /**
   * Sync a specific data type
   */
  async syncDataType(dataType: CivicDataType): Promise<SyncResult> {
    this.logger.log(`Syncing ${dataType}`);
    const startTime = Date.now();

    const syncHandlers: Record<
      CivicDataType,
      () => Promise<{ processed: number; created: number; updated: number }>
    > = {
      [CivicDataType.PROPOSITIONS]: () => this.syncPropositions(),
      [CivicDataType.MEETINGS]: () => this.syncMeetings(),
      [CivicDataType.REPRESENTATIVES]: () => this.syncRepresentatives(),
    };

    const handler = syncHandlers[dataType];
    const { processed, created, updated } = await handler();

    const duration = Date.now() - startTime;
    this.logger.log(
      `Synced ${dataType}: ${processed} items (${created} created, ${updated} updated) in ${duration}ms`,
    );

    return {
      dataType,
      itemsProcessed: processed,
      itemsCreated: created,
      itemsUpdated: updated,
      errors: [],
      syncedAt: new Date(),
    };
  }

  /**
   * Sync propositions using bulk upsert
   *
   * PERFORMANCE: Uses batch upsert instead of N+1 queries
   * This reduces database round trips from O(2n) to O(2) queries
   */
  private async syncPropositions(): Promise<{
    processed: number;
    created: number;
    updated: number;
  }> {
    const propositions = await this.regionService.fetchPropositions();
    if (propositions.length === 0) {
      return { processed: 0, created: 0, updated: 0 };
    }

    // Get existing externalIds in a single query to calculate created vs updated
    const externalIds = propositions.map((p) => p.externalId);
    const existingRecords = await this.propositionRepo
      .createQueryBuilder('p')
      .select('p.externalId')
      .where('p.externalId IN (:...externalIds)', { externalIds })
      .getMany();
    const existingExternalIds = new Set(
      existingRecords.map((r) => r.externalId),
    );

    // Batch upsert all propositions in a single query
    const entities = propositions.map((prop) => ({
      externalId: prop.externalId,
      title: prop.title,
      summary: prop.summary,
      fullText: prop.fullText,
      status: prop.status,
      electionDate: prop.electionDate,
      sourceUrl: prop.sourceUrl,
    }));

    await this.propositionRepo.upsert(entities, {
      conflictPaths: ['externalId'],
      skipUpdateIfNoValuesChanged: true,
    });

    const created = propositions.filter(
      (p) => !existingExternalIds.has(p.externalId),
    ).length;
    const updated = propositions.filter((p) =>
      existingExternalIds.has(p.externalId),
    ).length;

    return { processed: propositions.length, created, updated };
  }

  /**
   * Sync meetings using bulk upsert
   *
   * PERFORMANCE: Uses batch upsert instead of N+1 queries
   * This reduces database round trips from O(2n) to O(2) queries
   * @see https://github.com/CommonwealthLabsCode/qckstrt/issues/197
   */
  private async syncMeetings(): Promise<{
    processed: number;
    created: number;
    updated: number;
  }> {
    const meetings = await this.regionService.fetchMeetings();
    if (meetings.length === 0) {
      return { processed: 0, created: 0, updated: 0 };
    }

    // Get existing externalIds in a single query to calculate created vs updated
    const externalIds = meetings.map((m) => m.externalId);
    const existingRecords = await this.meetingRepo
      .createQueryBuilder('m')
      .select('m.externalId')
      .where('m.externalId IN (:...externalIds)', { externalIds })
      .getMany();
    const existingExternalIds = new Set(
      existingRecords.map((r) => r.externalId),
    );

    // Batch upsert all meetings in a single query
    const entities = meetings.map((meeting) => ({
      externalId: meeting.externalId,
      title: meeting.title,
      body: meeting.body,
      scheduledAt: meeting.scheduledAt,
      location: meeting.location,
      agendaUrl: meeting.agendaUrl,
      videoUrl: meeting.videoUrl,
    }));

    await this.meetingRepo.upsert(entities, {
      conflictPaths: ['externalId'],
      skipUpdateIfNoValuesChanged: true,
    });

    const created = meetings.filter(
      (m) => !existingExternalIds.has(m.externalId),
    ).length;
    const updated = meetings.filter((m) =>
      existingExternalIds.has(m.externalId),
    ).length;

    return { processed: meetings.length, created, updated };
  }

  /**
   * Sync representatives using bulk upsert
   *
   * PERFORMANCE: Uses batch upsert instead of N+1 queries
   * This reduces database round trips from O(2n) to O(2) queries
   * @see https://github.com/CommonwealthLabsCode/qckstrt/issues/197
   */
  private async syncRepresentatives(): Promise<{
    processed: number;
    created: number;
    updated: number;
  }> {
    const reps = await this.regionService.fetchRepresentatives();
    if (reps.length === 0) {
      return { processed: 0, created: 0, updated: 0 };
    }

    // Get existing externalIds in a single query to calculate created vs updated
    const externalIds = reps.map((r) => r.externalId);
    const existingRecords = await this.representativeRepo
      .createQueryBuilder('r')
      .select('r.externalId')
      .where('r.externalId IN (:...externalIds)', { externalIds })
      .getMany();
    const existingExternalIds = new Set(
      existingRecords.map((r) => r.externalId),
    );

    // Batch upsert all representatives in a single query
    const entities = reps.map((rep) => ({
      externalId: rep.externalId,
      name: rep.name,
      chamber: rep.chamber,
      district: rep.district,
      party: rep.party,
      photoUrl: rep.photoUrl,
      contactInfo: rep.contactInfo,
    }));

    await this.representativeRepo.upsert(entities, {
      conflictPaths: ['externalId'],
      skipUpdateIfNoValuesChanged: true,
    });

    const created = reps.filter(
      (r) => !existingExternalIds.has(r.externalId),
    ).length;
    const updated = reps.filter((r) =>
      existingExternalIds.has(r.externalId),
    ).length;

    return { processed: reps.length, created, updated };
  }

  /**
   * Get propositions with pagination
   */
  async getPropositions(
    skip: number = 0,
    take: number = 10,
  ): Promise<PaginatedPropositions> {
    const [items, total] = await this.propositionRepo.findAndCount({
      order: { electionDate: 'DESC', createdAt: 'DESC' },
      skip,
      take: take + 1,
    });

    const hasMore = items.length > take;
    const paginatedItems = items.slice(0, take);

    return {
      items: paginatedItems.map((item) => ({
        ...item,
        status: item.status as unknown as PropositionStatusGQL,
      })),
      total,
      hasMore,
    };
  }

  /**
   * Get a single proposition by ID
   */
  async getProposition(id: string) {
    return this.propositionRepo.findOne({ where: { id } });
  }

  /**
   * Get meetings with pagination
   */
  async getMeetings(
    skip: number = 0,
    take: number = 10,
  ): Promise<PaginatedMeetings> {
    const [items, total] = await this.meetingRepo.findAndCount({
      order: { scheduledAt: 'DESC' },
      skip,
      take: take + 1,
    });

    const hasMore = items.length > take;
    const paginatedItems = items.slice(0, take);

    return {
      items: paginatedItems,
      total,
      hasMore,
    };
  }

  /**
   * Get a single meeting by ID
   */
  async getMeeting(id: string) {
    return this.meetingRepo.findOne({ where: { id } });
  }

  /**
   * Get representatives with pagination
   */
  async getRepresentatives(
    skip: number = 0,
    take: number = 10,
    chamber?: string,
  ): Promise<PaginatedRepresentatives> {
    const query = this.representativeRepo.createQueryBuilder('rep');

    if (chamber) {
      query.where('rep.chamber = :chamber', { chamber });
    }

    query.orderBy('rep.chamber', 'ASC').addOrderBy('rep.name', 'ASC');

    const total = await query.getCount();
    const items = await query
      .skip(skip)
      .take(take + 1)
      .getMany();

    const hasMore = items.length > take;
    const paginatedItems = items.slice(0, take);

    return {
      items: paginatedItems,
      total,
      hasMore,
    };
  }

  /**
   * Get a single representative by ID
   */
  async getRepresentative(id: string) {
    return this.representativeRepo.findOne({ where: { id } });
  }
}
