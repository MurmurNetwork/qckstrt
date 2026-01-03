import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AccountLockoutService } from './account-lockout.service';

describe('AccountLockoutService', () => {
  let service: AccountLockoutService;

  beforeEach(async () => {
    const mockConfigService = {
      get: jest.fn((key: string) => {
        const config: Record<string, number> = {
          'authThrottle.lockout.maxAttempts': 5,
          'authThrottle.lockout.lockoutDuration': 900000, // 15 minutes
        };
        return config[key];
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccountLockoutService,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<AccountLockoutService>(AccountLockoutService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('isLocked', () => {
    it('should return false for unknown identifier', () => {
      expect(service.isLocked('unknown@example.com')).toBe(false);
    });

    it('should return false when no lockout is active', () => {
      service.recordFailedAttempt('test@example.com');
      expect(service.isLocked('test@example.com')).toBe(false);
    });

    it('should return true when account is locked', () => {
      const email = 'locked@example.com';

      // Record 5 failed attempts to trigger lockout
      for (let i = 0; i < 5; i++) {
        service.recordFailedAttempt(email);
      }

      expect(service.isLocked(email)).toBe(true);
    });

    it('should be case-insensitive', () => {
      const email = 'Test@Example.com';

      for (let i = 0; i < 5; i++) {
        service.recordFailedAttempt(email);
      }

      expect(service.isLocked('test@example.com')).toBe(true);
      expect(service.isLocked('TEST@EXAMPLE.COM')).toBe(true);
    });
  });

  describe('recordFailedAttempt', () => {
    it('should increment failed attempts', () => {
      const email = 'test@example.com';

      service.recordFailedAttempt(email);
      expect(service.getFailedAttempts(email)).toBe(1);

      service.recordFailedAttempt(email);
      expect(service.getFailedAttempts(email)).toBe(2);
    });

    it('should return false when not yet locked', () => {
      const email = 'test@example.com';

      for (let i = 0; i < 4; i++) {
        const isLocked = service.recordFailedAttempt(email);
        expect(isLocked).toBe(false);
      }
    });

    it('should return true when lockout is triggered', () => {
      const email = 'test@example.com';

      for (let i = 0; i < 4; i++) {
        service.recordFailedAttempt(email);
      }

      // 5th attempt should trigger lockout
      const isLocked = service.recordFailedAttempt(email);
      expect(isLocked).toBe(true);
    });

    it('should log failed attempts with IP address', () => {
      const loggerSpy = jest.spyOn(service['logger'], 'warn');
      const email = 'test@example.com';
      const ip = '192.168.1.1';

      service.recordFailedAttempt(email, ip);

      expect(loggerSpy).toHaveBeenCalledWith(expect.stringContaining(email));
      expect(loggerSpy).toHaveBeenCalledWith(expect.stringContaining(ip));
    });
  });

  describe('clearLockout', () => {
    it('should clear lockout record', () => {
      const email = 'test@example.com';

      // Create lockout
      for (let i = 0; i < 5; i++) {
        service.recordFailedAttempt(email);
      }

      expect(service.isLocked(email)).toBe(true);

      service.clearLockout(email);

      expect(service.isLocked(email)).toBe(false);
      expect(service.getFailedAttempts(email)).toBe(0);
    });

    it('should be case-insensitive', () => {
      const email = 'Test@Example.com';

      for (let i = 0; i < 5; i++) {
        service.recordFailedAttempt(email);
      }

      service.clearLockout('test@example.com');

      expect(service.isLocked('TEST@EXAMPLE.COM')).toBe(false);
    });
  });

  describe('getRemainingLockoutTime', () => {
    it('should return 0 for unknown identifier', () => {
      expect(service.getRemainingLockoutTime('unknown@example.com')).toBe(0);
    });

    it('should return 0 when not locked', () => {
      const email = 'test@example.com';
      service.recordFailedAttempt(email);

      expect(service.getRemainingLockoutTime(email)).toBe(0);
    });

    it('should return positive value when locked', () => {
      const email = 'locked@example.com';

      for (let i = 0; i < 5; i++) {
        service.recordFailedAttempt(email);
      }

      const remaining = service.getRemainingLockoutTime(email);
      expect(remaining).toBeGreaterThan(0);
      expect(remaining).toBeLessThanOrEqual(900000); // 15 minutes
    });
  });

  describe('getFailedAttempts', () => {
    it('should return 0 for unknown identifier', () => {
      expect(service.getFailedAttempts('unknown@example.com')).toBe(0);
    });

    it('should return correct count', () => {
      const email = 'test@example.com';

      service.recordFailedAttempt(email);
      service.recordFailedAttempt(email);
      service.recordFailedAttempt(email);

      expect(service.getFailedAttempts(email)).toBe(3);
    });
  });

  describe('cleanupExpiredRecords', () => {
    it('should remove expired lockout records', () => {
      const email = 'old@example.com';

      // Record attempt and manually set old timestamp
      service.recordFailedAttempt(email);

      // Access private map to manipulate for testing
      const records = service['lockoutRecords'];
      const record = records.get(email.toLowerCase());
      if (record) {
        // Set last attempt to very old time
        record.lastAttempt = Date.now() - 2000000; // Over 2x lockout duration
      }

      service.cleanupExpiredRecords();

      expect(service.getFailedAttempts(email)).toBe(0);
    });
  });

  describe('default configuration', () => {
    it('should use default values when config is not available', async () => {
      const mockConfigService = {
        get: jest.fn().mockReturnValue(undefined),
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          AccountLockoutService,
          { provide: ConfigService, useValue: mockConfigService },
        ],
      }).compile();

      const defaultService = module.get<AccountLockoutService>(
        AccountLockoutService,
      );

      // Should use default of 5 max attempts
      const email = 'default@example.com';
      for (let i = 0; i < 4; i++) {
        expect(defaultService.recordFailedAttempt(email)).toBe(false);
      }
      expect(defaultService.recordFailedAttempt(email)).toBe(true);
    });
  });
});
