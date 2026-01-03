import authThrottleConfig, { AUTH_THROTTLE } from './auth-throttle.config';

describe('authThrottleConfig', () => {
  const config = authThrottleConfig();

  describe('login rate limits', () => {
    it('should have correct TTL (1 minute)', () => {
      expect(config.login.ttl).toBe(60000);
    });

    it('should allow 5 attempts per minute', () => {
      expect(config.login.limit).toBe(5);
    });
  });

  describe('register rate limits', () => {
    it('should have correct TTL (1 minute)', () => {
      expect(config.register.ttl).toBe(60000);
    });

    it('should allow 3 attempts per minute', () => {
      expect(config.register.limit).toBe(3);
    });
  });

  describe('passwordReset rate limits', () => {
    it('should have correct TTL (1 hour)', () => {
      expect(config.passwordReset.ttl).toBe(3600000);
    });

    it('should allow 3 attempts per hour', () => {
      expect(config.passwordReset.limit).toBe(3);
    });
  });

  describe('magicLink rate limits', () => {
    it('should have correct TTL (1 minute)', () => {
      expect(config.magicLink.ttl).toBe(60000);
    });

    it('should allow 3 attempts per minute', () => {
      expect(config.magicLink.limit).toBe(3);
    });
  });

  describe('passkey rate limits', () => {
    it('should have correct TTL (1 minute)', () => {
      expect(config.passkey.ttl).toBe(60000);
    });

    it('should allow 10 attempts per minute (more lenient)', () => {
      expect(config.passkey.limit).toBe(10);
    });
  });

  describe('lockout configuration', () => {
    it('should lock after 5 failed attempts', () => {
      expect(config.lockout.maxAttempts).toBe(5);
    });

    it('should have 15 minute lockout duration', () => {
      expect(config.lockout.lockoutDuration).toBe(900000);
    });
  });
});

describe('AUTH_THROTTLE constants', () => {
  describe('login throttle', () => {
    it('should have correct name', () => {
      expect(AUTH_THROTTLE.login.name).toBe('auth-login');
    });

    it('should match config values', () => {
      expect(AUTH_THROTTLE.login.ttl).toBe(60000);
      expect(AUTH_THROTTLE.login.limit).toBe(5);
    });
  });

  describe('register throttle', () => {
    it('should have correct name', () => {
      expect(AUTH_THROTTLE.register.name).toBe('auth-register');
    });

    it('should match config values', () => {
      expect(AUTH_THROTTLE.register.ttl).toBe(60000);
      expect(AUTH_THROTTLE.register.limit).toBe(3);
    });
  });

  describe('passwordReset throttle', () => {
    it('should have correct name', () => {
      expect(AUTH_THROTTLE.passwordReset.name).toBe('auth-password-reset');
    });

    it('should match config values', () => {
      expect(AUTH_THROTTLE.passwordReset.ttl).toBe(3600000);
      expect(AUTH_THROTTLE.passwordReset.limit).toBe(3);
    });
  });

  describe('magicLink throttle', () => {
    it('should have correct name', () => {
      expect(AUTH_THROTTLE.magicLink.name).toBe('auth-magic-link');
    });

    it('should match config values', () => {
      expect(AUTH_THROTTLE.magicLink.ttl).toBe(60000);
      expect(AUTH_THROTTLE.magicLink.limit).toBe(3);
    });
  });

  describe('passkey throttle', () => {
    it('should have correct name', () => {
      expect(AUTH_THROTTLE.passkey.name).toBe('auth-passkey');
    });

    it('should match config values', () => {
      expect(AUTH_THROTTLE.passkey.ttl).toBe(60000);
      expect(AUTH_THROTTLE.passkey.limit).toBe(10);
    });
  });

  describe('security requirements', () => {
    it('login should be more restrictive than passkey', () => {
      expect(AUTH_THROTTLE.login.limit).toBeLessThan(
        AUTH_THROTTLE.passkey.limit,
      );
    });

    it('password reset should have longest TTL', () => {
      expect(AUTH_THROTTLE.passwordReset.ttl).toBeGreaterThan(
        AUTH_THROTTLE.login.ttl,
      );
      expect(AUTH_THROTTLE.passwordReset.ttl).toBeGreaterThan(
        AUTH_THROTTLE.register.ttl,
      );
      expect(AUTH_THROTTLE.passwordReset.ttl).toBeGreaterThan(
        AUTH_THROTTLE.magicLink.ttl,
      );
    });

    it('all limits should be positive', () => {
      Object.values(AUTH_THROTTLE).forEach((throttle) => {
        expect(throttle.limit).toBeGreaterThan(0);
        expect(throttle.ttl).toBeGreaterThan(0);
      });
    });
  });
});
