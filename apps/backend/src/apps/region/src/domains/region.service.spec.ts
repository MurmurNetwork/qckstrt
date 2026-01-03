import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { createMock } from '@golevelup/ts-jest';

import { RegionDomainService } from './region.service';
import { PropositionEntity } from 'src/db/entities/proposition.entity';
import { MeetingEntity } from 'src/db/entities/meeting.entity';
import { RepresentativeEntity } from 'src/db/entities/representative.entity';
import {
  RegionService as RegionProviderService,
  CivicDataType,
  PropositionStatus,
  Proposition,
} from '@qckstrt/region-provider';

/**
 * Tests for Region Domain Service
 *
 * PERFORMANCE: Tests updated for bulk upsert implementation
 */

describe('RegionDomainService', () => {
  let service: RegionDomainService;
  let regionProviderService: jest.Mocked<RegionProviderService>;
  let propositionRepo: jest.Mocked<Repository<PropositionEntity>>;
  let meetingRepo: jest.Mocked<Repository<MeetingEntity>>;
  let representativeRepo: jest.Mocked<Repository<RepresentativeEntity>>;

  const mockRegionInfo = {
    id: 'test-region',
    name: 'Test Region',
    description: 'A test region for testing',
    timezone: 'America/Los_Angeles',
    dataSourceUrls: ['https://example.com'],
  };

  const mockPropositions = [
    {
      externalId: 'prop-1',
      title: 'Test Proposition 1',
      summary: 'Summary 1',
      fullText: 'Full text 1',
      status: 'pending',
      electionDate: new Date('2024-11-05'),
      sourceUrl: 'https://example.com/prop-1',
    },
  ];

  const mockMeetings = [
    {
      externalId: 'meeting-1',
      title: 'City Council Meeting',
      body: 'City Council',
      scheduledAt: new Date('2024-01-15T10:00:00Z'),
      location: 'City Hall',
      agendaUrl: 'https://example.com/agenda',
      videoUrl: 'https://example.com/video',
    },
  ];

  const mockRepresentatives = [
    {
      externalId: 'rep-1',
      name: 'John Doe',
      chamber: 'Senate',
      district: 'District 1',
      party: 'Independent',
      photoUrl: 'https://example.com/photo.jpg',
      contactInfo: { email: 'john@example.com' },
    },
  ];

  beforeEach(async () => {
    const mockRegionProvider = {
      getProviderName: jest.fn().mockReturnValue('test-provider'),
      getRegionInfo: jest.fn().mockReturnValue(mockRegionInfo),
      getSupportedDataTypes: jest
        .fn()
        .mockReturnValue([
          CivicDataType.PROPOSITIONS,
          CivicDataType.MEETINGS,
          CivicDataType.REPRESENTATIVES,
        ]),
      fetchPropositions: jest.fn().mockResolvedValue(mockPropositions),
      fetchMeetings: jest.fn().mockResolvedValue(mockMeetings),
      fetchRepresentatives: jest.fn().mockResolvedValue(mockRepresentatives),
    };

    // Create mock query builders for bulk upsert operations
    const createMockQueryBuilder = <T extends { externalId: string }>(
      getResult: T[] = [],
    ) => {
      const qb = createMock<SelectQueryBuilder<T>>();
      qb.select.mockReturnThis();
      qb.where.mockReturnThis();
      qb.orderBy.mockReturnThis();
      qb.addOrderBy.mockReturnThis();
      qb.skip.mockReturnThis();
      qb.take.mockReturnThis();
      qb.getMany.mockResolvedValue(getResult);
      qb.getCount.mockResolvedValue(getResult.length);
      return qb;
    };

    const mockPropositionRepo = {
      findOne: jest.fn(),
      findAndCount: jest.fn(),
      upsert: jest
        .fn()
        .mockResolvedValue({ identifiers: [], generatedMaps: [] }),
      createQueryBuilder: jest.fn(() =>
        createMockQueryBuilder<PropositionEntity>(),
      ),
    };

    const mockMeetingRepo = {
      findOne: jest.fn(),
      findAndCount: jest.fn(),
      upsert: jest
        .fn()
        .mockResolvedValue({ identifiers: [], generatedMaps: [] }),
      createQueryBuilder: jest.fn(() =>
        createMockQueryBuilder<MeetingEntity>(),
      ),
    };

    const mockRepresentativeRepo = {
      findOne: jest.fn(),
      findAndCount: jest.fn(),
      upsert: jest
        .fn()
        .mockResolvedValue({ identifiers: [], generatedMaps: [] }),
      createQueryBuilder: jest.fn(() =>
        createMockQueryBuilder<RepresentativeEntity>(),
      ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RegionDomainService,
        {
          provide: RegionProviderService,
          useValue: mockRegionProvider,
        },
        {
          provide: getRepositoryToken(PropositionEntity),
          useValue: mockPropositionRepo,
        },
        {
          provide: getRepositoryToken(MeetingEntity),
          useValue: mockMeetingRepo,
        },
        {
          provide: getRepositoryToken(RepresentativeEntity),
          useValue: mockRepresentativeRepo,
        },
      ],
    }).compile();

    service = module.get<RegionDomainService>(RegionDomainService);
    regionProviderService = module.get(RegionProviderService);
    propositionRepo = module.get(getRepositoryToken(PropositionEntity));
    meetingRepo = module.get(getRepositoryToken(MeetingEntity));
    representativeRepo = module.get(getRepositoryToken(RepresentativeEntity));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getRegionInfo', () => {
    it('should return region info with supported data types', () => {
      const info = service.getRegionInfo();

      expect(info.id).toBe('test-region');
      expect(info.name).toBe('Test Region');
      expect(info.description).toBeDefined();
      expect(info.timezone).toBe('America/Los_Angeles');
      expect(info.supportedDataTypes).toHaveLength(3);
    });
  });

  describe('syncAll', () => {
    it('should sync all data types and return results', async () => {
      // All repos use bulk upsert, no existing records
      const results = await service.syncAll();

      expect(results).toHaveLength(3);
      expect(results[0].dataType).toBe(CivicDataType.PROPOSITIONS);
      expect(results[1].dataType).toBe(CivicDataType.MEETINGS);
      expect(results[2].dataType).toBe(CivicDataType.REPRESENTATIVES);
      expect(propositionRepo.upsert).toHaveBeenCalled();
      expect(meetingRepo.upsert).toHaveBeenCalled();
      expect(representativeRepo.upsert).toHaveBeenCalled();
    });

    it('should handle sync errors gracefully', async () => {
      regionProviderService.fetchPropositions.mockRejectedValue(
        new Error('Network error'),
      );

      const results = await service.syncAll();

      expect(results[0].errors).toContain('Network error');
      expect(results[0].itemsProcessed).toBe(0);
    });
  });

  describe('syncDataType - PROPOSITIONS', () => {
    it('should create new propositions using bulk upsert', async () => {
      // No existing records - createQueryBuilder returns empty array
      const result = await service.syncDataType(CivicDataType.PROPOSITIONS);

      expect(result.itemsCreated).toBe(1);
      expect(result.itemsUpdated).toBe(0);
      expect(result.itemsProcessed).toBe(1);
      expect(propositionRepo.upsert).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            externalId: 'prop-1',
            title: 'Test Proposition 1',
          }),
        ]),
        expect.objectContaining({
          conflictPaths: ['externalId'],
        }),
      );
    });

    it('should update existing propositions using bulk upsert', async () => {
      // Mock existing record found
      const existingQb = createMock<SelectQueryBuilder<PropositionEntity>>();
      existingQb.select.mockReturnThis();
      existingQb.where.mockReturnThis();
      existingQb.getMany.mockResolvedValue([
        { externalId: 'prop-1' } as PropositionEntity,
      ]);
      propositionRepo.createQueryBuilder.mockReturnValue(existingQb);

      const result = await service.syncDataType(CivicDataType.PROPOSITIONS);

      expect(result.itemsCreated).toBe(0);
      expect(result.itemsUpdated).toBe(1);
      expect(propositionRepo.upsert).toHaveBeenCalled();
    });

    it('should handle empty propositions list', async () => {
      regionProviderService.fetchPropositions.mockResolvedValue([]);

      const result = await service.syncDataType(CivicDataType.PROPOSITIONS);

      expect(result.itemsProcessed).toBe(0);
      expect(result.itemsCreated).toBe(0);
      expect(result.itemsUpdated).toBe(0);
      expect(propositionRepo.upsert).not.toHaveBeenCalled();
    });
  });

  describe('syncDataType - MEETINGS', () => {
    it('should create new meetings using bulk upsert', async () => {
      const result = await service.syncDataType(CivicDataType.MEETINGS);

      expect(result.itemsCreated).toBe(1);
      expect(result.itemsUpdated).toBe(0);
      expect(meetingRepo.upsert).toHaveBeenCalled();
    });

    it('should update existing meetings using bulk upsert', async () => {
      const existingQb = createMock<SelectQueryBuilder<MeetingEntity>>();
      existingQb.select.mockReturnThis();
      existingQb.where.mockReturnThis();
      existingQb.getMany.mockResolvedValue([
        { externalId: 'meeting-1' } as MeetingEntity,
      ]);
      meetingRepo.createQueryBuilder.mockReturnValue(existingQb);

      const result = await service.syncDataType(CivicDataType.MEETINGS);

      expect(result.itemsUpdated).toBe(1);
      expect(meetingRepo.upsert).toHaveBeenCalled();
    });
  });

  describe('syncDataType - REPRESENTATIVES', () => {
    it('should create new representatives using bulk upsert', async () => {
      const result = await service.syncDataType(CivicDataType.REPRESENTATIVES);

      expect(result.itemsCreated).toBe(1);
      expect(representativeRepo.upsert).toHaveBeenCalled();
    });

    it('should update existing representatives using bulk upsert', async () => {
      const existingQb = createMock<SelectQueryBuilder<RepresentativeEntity>>();
      existingQb.select.mockReturnThis();
      existingQb.where.mockReturnThis();
      existingQb.getMany.mockResolvedValue([
        { externalId: 'rep-1' } as RepresentativeEntity,
      ]);
      representativeRepo.createQueryBuilder.mockReturnValue(existingQb);

      const result = await service.syncDataType(CivicDataType.REPRESENTATIVES);

      expect(result.itemsUpdated).toBe(1);
      expect(representativeRepo.upsert).toHaveBeenCalled();
    });
  });

  describe('bulk upsert performance', () => {
    it('should use only 2 queries per sync (SELECT existing + UPSERT)', async () => {
      // This test verifies the N+1 fix - we should call createQueryBuilder once
      // and upsert once, instead of N findOne + N save/update calls
      await service.syncDataType(CivicDataType.PROPOSITIONS);

      // Should call createQueryBuilder exactly once (for SELECT existing)
      expect(propositionRepo.createQueryBuilder).toHaveBeenCalledTimes(1);
      // Should call upsert exactly once (for bulk insert/update)
      expect(propositionRepo.upsert).toHaveBeenCalledTimes(1);
    });

    it('should handle large datasets (1000+ records) efficiently', async () => {
      // Generate 1000 propositions to test bulk performance
      const largeDataset: Proposition[] = Array.from(
        { length: 1000 },
        (_, i) => ({
          externalId: `prop-${i}`,
          title: `Proposition ${i}`,
          summary: `Summary for proposition ${i}`,
          fullText: `Full text for proposition ${i}`,
          status: PropositionStatus.PENDING,
          electionDate: new Date('2024-11-05'),
          sourceUrl: `https://example.com/prop-${i}`,
        }),
      );

      regionProviderService.fetchPropositions.mockResolvedValue(largeDataset);

      const result = await service.syncDataType(CivicDataType.PROPOSITIONS);

      // Verify all 1000 items processed
      expect(result.itemsProcessed).toBe(1000);
      expect(result.itemsCreated).toBe(1000);

      // Verify only 2 database calls (not 2000)
      expect(propositionRepo.createQueryBuilder).toHaveBeenCalledTimes(1);
      expect(propositionRepo.upsert).toHaveBeenCalledTimes(1);

      // Verify upsert was called with all 1000 entities
      expect(propositionRepo.upsert).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ externalId: 'prop-0' }),
          expect.objectContaining({ externalId: 'prop-999' }),
        ]),
        expect.any(Object),
      );
    });

    it('should correctly identify creates vs updates in mixed batch', async () => {
      // 500 new + 500 existing = 1000 total
      const mixedDataset: Proposition[] = Array.from(
        { length: 1000 },
        (_, i) => ({
          externalId: `prop-${i}`,
          title: `Proposition ${i}`,
          summary: `Summary ${i}`,
          fullText: undefined,
          status: PropositionStatus.PENDING,
          electionDate: new Date('2024-11-05'),
          sourceUrl: undefined,
        }),
      );

      regionProviderService.fetchPropositions.mockResolvedValue(mixedDataset);

      // Mock 500 existing records (prop-0 through prop-499)
      const existingQb = createMock<SelectQueryBuilder<PropositionEntity>>();
      existingQb.select.mockReturnThis();
      existingQb.where.mockReturnThis();
      existingQb.getMany.mockResolvedValue(
        Array.from({ length: 500 }, (_, i) => ({
          externalId: `prop-${i}`,
        })) as PropositionEntity[],
      );
      propositionRepo.createQueryBuilder.mockReturnValue(existingQb);

      const result = await service.syncDataType(CivicDataType.PROPOSITIONS);

      expect(result.itemsProcessed).toBe(1000);
      expect(result.itemsCreated).toBe(500); // prop-500 through prop-999
      expect(result.itemsUpdated).toBe(500); // prop-0 through prop-499
    });
  });

  describe('getPropositions', () => {
    it('should return paginated propositions', async () => {
      const mockItems = [
        {
          id: '1',
          externalId: 'prop-1',
          title: 'Prop 1',
          summary: 'Summary',
          status: 'pending',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];
      propositionRepo.findAndCount.mockResolvedValue([
        mockItems as PropositionEntity[],
        1,
      ]);

      const result = await service.getPropositions(0, 10);

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.hasMore).toBe(false);
    });

    it('should indicate hasMore when more items exist', async () => {
      const mockItems = Array.from({ length: 11 }, (_, i) => ({
        id: String(i),
        externalId: `prop-${i}`,
        title: `Prop ${i}`,
        summary: 'Summary',
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
      }));
      propositionRepo.findAndCount.mockResolvedValue([
        mockItems as PropositionEntity[],
        15,
      ]);

      const result = await service.getPropositions(0, 10);

      expect(result.items).toHaveLength(10);
      expect(result.hasMore).toBe(true);
    });
  });

  describe('getProposition', () => {
    it('should return a single proposition by ID', async () => {
      const mockProp = { id: '1', title: 'Test Prop' };
      propositionRepo.findOne.mockResolvedValue(mockProp as PropositionEntity);

      const result = await service.getProposition('1');

      expect(result).toEqual(mockProp);
      expect(propositionRepo.findOne).toHaveBeenCalledWith({
        where: { id: '1' },
      });
    });

    it('should return null if proposition not found', async () => {
      propositionRepo.findOne.mockResolvedValue(null);

      const result = await service.getProposition('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('getMeetings', () => {
    it('should return paginated meetings', async () => {
      const mockItems = [
        {
          id: '1',
          externalId: 'meeting-1',
          title: 'Meeting 1',
          body: 'Council',
          scheduledAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];
      meetingRepo.findAndCount.mockResolvedValue([
        mockItems as MeetingEntity[],
        1,
      ]);

      const result = await service.getMeetings(0, 10);

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.hasMore).toBe(false);
    });
  });

  describe('getMeeting', () => {
    it('should return a single meeting by ID', async () => {
      const mockMeeting = { id: '1', title: 'Test Meeting' };
      meetingRepo.findOne.mockResolvedValue(mockMeeting as MeetingEntity);

      const result = await service.getMeeting('1');

      expect(result).toEqual(mockMeeting);
    });
  });

  describe('getRepresentatives', () => {
    it('should return paginated representatives', async () => {
      const mockItems = [
        {
          id: '1',
          externalId: 'rep-1',
          name: 'John Doe',
          chamber: 'Senate',
          district: 'D1',
          party: 'Independent',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const mockQueryBuilder =
        createMock<SelectQueryBuilder<RepresentativeEntity>>();
      mockQueryBuilder.where.mockReturnThis();
      mockQueryBuilder.orderBy.mockReturnThis();
      mockQueryBuilder.addOrderBy.mockReturnThis();
      mockQueryBuilder.skip.mockReturnThis();
      mockQueryBuilder.take.mockReturnThis();
      mockQueryBuilder.getCount.mockResolvedValue(1);
      mockQueryBuilder.getMany.mockResolvedValue(mockItems);

      representativeRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const result = await service.getRepresentatives(0, 10);

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.hasMore).toBe(false);
    });

    it('should filter by chamber when provided', async () => {
      const mockQueryBuilder =
        createMock<SelectQueryBuilder<RepresentativeEntity>>();
      mockQueryBuilder.where.mockReturnThis();
      mockQueryBuilder.orderBy.mockReturnThis();
      mockQueryBuilder.addOrderBy.mockReturnThis();
      mockQueryBuilder.skip.mockReturnThis();
      mockQueryBuilder.take.mockReturnThis();
      mockQueryBuilder.getCount.mockResolvedValue(0);
      mockQueryBuilder.getMany.mockResolvedValue([]);

      representativeRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      await service.getRepresentatives(0, 10, 'Senate');

      expect(mockQueryBuilder.where).toHaveBeenCalledWith(
        'rep.chamber = :chamber',
        { chamber: 'Senate' },
      );
    });
  });

  describe('getRepresentative', () => {
    it('should return a single representative by ID', async () => {
      const mockRep = { id: '1', name: 'John Doe' };
      representativeRepo.findOne.mockResolvedValue(
        mockRep as RepresentativeEntity,
      );

      const result = await service.getRepresentative('1');

      expect(result).toEqual(mockRep);
    });
  });
});
