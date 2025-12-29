import { Test, TestingModule } from '@nestjs/testing';
import { createMock } from '@golevelup/ts-jest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';

import { ActivityService } from './activity.service';
import { AuditLogEntity } from 'src/db/entities/audit-log.entity';
import { UserSessionEntity } from 'src/db/entities/user-session.entity';
import { AuditAction } from 'src/common/enums/audit-action.enum';

describe('ActivityService', () => {
  let service: ActivityService;
  let auditLogRepo: Repository<AuditLogEntity>;
  let sessionRepo: Repository<UserSessionEntity>;

  const mockUserId = 'test-user-id';
  const mockSessionToken = 'mock-session-token-123';

  const mockAuditLog = {
    id: 'log-1',
    userId: mockUserId,
    action: AuditAction.LOGIN,
    entityType: null,
    entityId: null,
    operationName: 'login',
    operationType: 'mutation',
    success: true,
    errorMessage: null,
    ipAddress: '192.168.1.1',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X) Chrome/120.0.0.0',
    timestamp: new Date('2024-01-20T10:00:00Z'),
  } as unknown as AuditLogEntity;

  const mockMobileAuditLog = {
    ...mockAuditLog,
    id: 'log-2',
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile Safari/605.1.15',
  } as unknown as AuditLogEntity;

  const mockTabletAuditLog = {
    ...mockAuditLog,
    id: 'log-3',
    userAgent: 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) Safari',
  } as unknown as AuditLogEntity;

  const mockSession = {
    id: 'session-1',
    userId: mockUserId,
    sessionToken: mockSessionToken,
    deviceType: 'desktop',
    deviceName: 'MacBook Pro',
    browser: 'Chrome',
    operatingSystem: 'macOS',
    city: 'San Francisco',
    region: 'California',
    country: 'USA',
    isActive: true,
    lastActivityAt: new Date('2024-01-20T10:30:00Z'),
    createdAt: new Date('2024-01-15T08:00:00Z'),
    expiresAt: new Date('2024-02-15T08:00:00Z'),
    revokedAt: null,
    revokedReason: null,
  } as unknown as UserSessionEntity;

  const mockOtherSession = {
    ...mockSession,
    id: 'session-2',
    sessionToken: 'other-token',
    deviceName: 'iPhone',
    deviceType: 'mobile',
  } as unknown as UserSessionEntity;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ActivityService,
        {
          provide: getRepositoryToken(AuditLogEntity),
          useValue: createMock<Repository<AuditLogEntity>>(),
        },
        {
          provide: getRepositoryToken(UserSessionEntity),
          useValue: createMock<Repository<UserSessionEntity>>(),
        },
      ],
    }).compile();

    service = module.get<ActivityService>(ActivityService);
    auditLogRepo = module.get<Repository<AuditLogEntity>>(
      getRepositoryToken(AuditLogEntity),
    );
    sessionRepo = module.get<Repository<UserSessionEntity>>(
      getRepositoryToken(UserSessionEntity),
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ============================================
  // getActivityLog Tests
  // ============================================

  describe('getActivityLog', () => {
    it('should return paginated activity log', async () => {
      auditLogRepo.findAndCount = jest
        .fn()
        .mockResolvedValue([[mockAuditLog], 1]);

      const result = await service.getActivityLog(mockUserId, 20, 0);

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.hasMore).toBe(false);
      expect(auditLogRepo.findAndCount).toHaveBeenCalledWith({
        where: { userId: mockUserId },
        order: { timestamp: 'DESC' },
        take: 20,
        skip: 0,
      });
    });

    it('should set hasMore true when more items exist', async () => {
      auditLogRepo.findAndCount = jest
        .fn()
        .mockResolvedValue([[mockAuditLog], 25]);

      const result = await service.getActivityLog(mockUserId, 10, 0);

      expect(result.hasMore).toBe(true);
    });

    it('should apply action filters', async () => {
      auditLogRepo.findAndCount = jest
        .fn()
        .mockResolvedValue([[mockAuditLog], 1]);

      const filters = { actions: [AuditAction.LOGIN, AuditAction.LOGOUT] };
      await service.getActivityLog(mockUserId, 20, 0, filters);

      expect(auditLogRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: mockUserId,
            action: In([AuditAction.LOGIN, AuditAction.LOGOUT]),
          }),
        }),
      );
    });

    it('should apply entityType filter', async () => {
      auditLogRepo.findAndCount = jest.fn().mockResolvedValue([[], 0]);

      const filters = { entityType: 'User' };
      await service.getActivityLog(mockUserId, 20, 0, filters);

      expect(auditLogRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            entityType: 'User',
          }),
        }),
      );
    });

    it('should apply successOnly filter', async () => {
      auditLogRepo.findAndCount = jest.fn().mockResolvedValue([[], 0]);

      const filters = { successOnly: true };
      await service.getActivityLog(mockUserId, 20, 0, filters);

      expect(auditLogRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            success: true,
          }),
        }),
      );
    });

    it('should parse desktop user agent correctly', async () => {
      auditLogRepo.findAndCount = jest
        .fn()
        .mockResolvedValue([[mockAuditLog], 1]);

      const result = await service.getActivityLog(mockUserId, 20, 0);

      expect(result.items[0].deviceType).toBe('desktop');
      expect(result.items[0].browser).toBe('Chrome');
    });

    it('should parse mobile user agent correctly', async () => {
      auditLogRepo.findAndCount = jest
        .fn()
        .mockResolvedValue([[mockMobileAuditLog], 1]);

      const result = await service.getActivityLog(mockUserId, 20, 0);

      expect(result.items[0].deviceType).toBe('mobile');
      expect(result.items[0].browser).toBe('Safari');
    });

    it('should parse tablet user agent correctly', async () => {
      auditLogRepo.findAndCount = jest
        .fn()
        .mockResolvedValue([[mockTabletAuditLog], 1]);

      const result = await service.getActivityLog(mockUserId, 20, 0);

      expect(result.items[0].deviceType).toBe('tablet');
    });

    it('should handle missing user agent', async () => {
      const logWithoutUA = { ...mockAuditLog, userAgent: undefined };
      auditLogRepo.findAndCount = jest
        .fn()
        .mockResolvedValue([[logWithoutUA], 1]);

      const result = await service.getActivityLog(mockUserId, 20, 0);

      expect(result.items[0].deviceType).toBeUndefined();
      expect(result.items[0].browser).toBeUndefined();
    });

    it('should detect Firefox browser', async () => {
      const firefoxLog = {
        ...mockAuditLog,
        userAgent: 'Mozilla/5.0 (Windows NT 10.0) Firefox/121.0',
      };
      auditLogRepo.findAndCount = jest
        .fn()
        .mockResolvedValue([[firefoxLog], 1]);

      const result = await service.getActivityLog(mockUserId, 20, 0);

      expect(result.items[0].browser).toBe('Firefox');
    });

    it('should detect Edge browser', async () => {
      const edgeLog = {
        ...mockAuditLog,
        userAgent: 'Mozilla/5.0 (Windows NT 10.0) Edge/121.0',
      };
      auditLogRepo.findAndCount = jest.fn().mockResolvedValue([[edgeLog], 1]);

      const result = await service.getActivityLog(mockUserId, 20, 0);

      expect(result.items[0].browser).toBe('Edge');
    });
  });

  // ============================================
  // getSessions Tests
  // ============================================

  describe('getSessions', () => {
    it('should return active sessions', async () => {
      sessionRepo.findAndCount = jest
        .fn()
        .mockResolvedValue([[mockSession], 1]);

      const result = await service.getSessions(mockUserId, mockSessionToken);

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(sessionRepo.findAndCount).toHaveBeenCalledWith({
        where: { userId: mockUserId, isActive: true },
        order: { lastActivityAt: 'DESC', createdAt: 'DESC' },
      });
    });

    it('should include revoked sessions when flag is set', async () => {
      sessionRepo.findAndCount = jest
        .fn()
        .mockResolvedValue([[mockSession], 1]);

      await service.getSessions(mockUserId, mockSessionToken, true);

      expect(sessionRepo.findAndCount).toHaveBeenCalledWith({
        where: { userId: mockUserId },
        order: { lastActivityAt: 'DESC', createdAt: 'DESC' },
      });
    });

    it('should mark current session correctly', async () => {
      sessionRepo.findAndCount = jest
        .fn()
        .mockResolvedValue([[mockSession, mockOtherSession], 2]);

      const result = await service.getSessions(mockUserId, mockSessionToken);

      expect(result.items[0].isCurrent).toBe(true);
      expect(result.items[1].isCurrent).toBe(false);
    });
  });

  // ============================================
  // getSession Tests
  // ============================================

  describe('getSession', () => {
    it('should return session by id', async () => {
      sessionRepo.findOne = jest.fn().mockResolvedValue(mockSession);

      const result = await service.getSession(
        mockUserId,
        'session-1',
        mockSessionToken,
      );

      expect(result).toBeDefined();
      expect(result!.id).toBe('session-1');
      expect(result!.isCurrent).toBe(true);
    });

    it('should return null for non-existent session', async () => {
      sessionRepo.findOne = jest.fn().mockResolvedValue(null);

      const result = await service.getSession(
        mockUserId,
        'non-existent',
        mockSessionToken,
      );

      expect(result).toBeNull();
    });

    it('should mark isCurrent false for different token', async () => {
      sessionRepo.findOne = jest.fn().mockResolvedValue(mockSession);

      const result = await service.getSession(
        mockUserId,
        'session-1',
        'different-token',
      );

      expect(result!.isCurrent).toBe(false);
    });
  });

  // ============================================
  // revokeSession Tests
  // ============================================

  describe('revokeSession', () => {
    it('should revoke session successfully', async () => {
      sessionRepo.update = jest.fn().mockResolvedValue({ affected: 1 });

      const result = await service.revokeSession(
        mockUserId,
        'session-1',
        'user_logout',
      );

      expect(result).toBe(true);
      expect(sessionRepo.update).toHaveBeenCalledWith(
        { id: 'session-1', userId: mockUserId },
        expect.objectContaining({
          isActive: false,
          revokedReason: 'user_logout',
        }),
      );
    });

    it('should return false if session not found', async () => {
      sessionRepo.update = jest.fn().mockResolvedValue({ affected: 0 });

      const result = await service.revokeSession(
        mockUserId,
        'non-existent',
        'user_logout',
      );

      expect(result).toBe(false);
    });
  });

  // ============================================
  // revokeAllSessions Tests
  // ============================================

  describe('revokeAllSessions', () => {
    it('should revoke all sessions except current', async () => {
      sessionRepo.find = jest
        .fn()
        .mockResolvedValue([mockSession, mockOtherSession]);
      sessionRepo.update = jest.fn().mockResolvedValue({ affected: 1 });

      const result = await service.revokeAllSessions(
        mockUserId,
        mockSessionToken,
        'user_logout_all',
      );

      expect(result).toBe(1);
      expect(sessionRepo.update).toHaveBeenCalledTimes(1);
      expect(sessionRepo.update).toHaveBeenCalledWith(
        'session-2',
        expect.objectContaining({
          isActive: false,
          revokedReason: 'user_logout_all',
        }),
      );
    });

    it('should return 0 if no other sessions exist', async () => {
      sessionRepo.find = jest.fn().mockResolvedValue([mockSession]);

      const result = await service.revokeAllSessions(
        mockUserId,
        mockSessionToken,
        'user_logout_all',
      );

      expect(result).toBe(0);
    });

    it('should revoke all sessions if no current token provided', async () => {
      sessionRepo.find = jest
        .fn()
        .mockResolvedValue([mockSession, mockOtherSession]);
      sessionRepo.update = jest.fn().mockResolvedValue({ affected: 1 });

      const result = await service.revokeAllSessions(
        mockUserId,
        undefined,
        'admin_logout',
      );

      expect(result).toBe(2);
      expect(sessionRepo.update).toHaveBeenCalledTimes(2);
    });
  });

  // ============================================
  // getActivitySummary Tests
  // ============================================

  describe('getActivitySummary', () => {
    it('should return complete activity summary', async () => {
      auditLogRepo.count = jest
        .fn()
        .mockResolvedValueOnce(100) // totalActions
        .mockResolvedValueOnce(95) // successfulActions
        .mockResolvedValueOnce(5); // failedActions

      sessionRepo.count = jest.fn().mockResolvedValue(2);

      auditLogRepo.findOne = jest
        .fn()
        .mockResolvedValueOnce(mockAuditLog) // lastLogin
        .mockResolvedValueOnce(mockAuditLog); // lastActivity

      const result = await service.getActivitySummary(mockUserId);

      expect(result.totalActions).toBe(100);
      expect(result.successfulActions).toBe(95);
      expect(result.failedActions).toBe(5);
      expect(result.activeSessions).toBe(2);
      expect(result.lastLoginAt).toBeDefined();
      expect(result.lastActivityAt).toBeDefined();
    });

    it('should handle no login history', async () => {
      auditLogRepo.count = jest.fn().mockResolvedValue(0);
      sessionRepo.count = jest.fn().mockResolvedValue(0);
      auditLogRepo.findOne = jest.fn().mockResolvedValue(null);

      const result = await service.getActivitySummary(mockUserId);

      expect(result.totalActions).toBe(0);
      expect(result.lastLoginAt).toBeUndefined();
      expect(result.lastActivityAt).toBeUndefined();
    });
  });
});
