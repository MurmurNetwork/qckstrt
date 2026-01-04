import {
  getEnvironment,
  isProduction,
  isDevelopment,
  isTest,
  isNonProduction,
} from './environment.config';

describe('environment.config', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  describe('getEnvironment', () => {
    it('should return "production" for NODE_ENV=production', () => {
      process.env.NODE_ENV = 'production';
      expect(getEnvironment()).toBe('production');
    });

    it('should return "production" for NODE_ENV=prod (legacy)', () => {
      process.env.NODE_ENV = 'prod';
      expect(getEnvironment()).toBe('production');
    });

    it('should return "production" for NODE_ENV=PRODUCTION (case insensitive)', () => {
      process.env.NODE_ENV = 'PRODUCTION';
      expect(getEnvironment()).toBe('production');
    });

    it('should return "development" for NODE_ENV=development', () => {
      process.env.NODE_ENV = 'development';
      expect(getEnvironment()).toBe('development');
    });

    it('should return "development" for NODE_ENV=dev (legacy)', () => {
      process.env.NODE_ENV = 'dev';
      expect(getEnvironment()).toBe('development');
    });

    it('should return "test" for NODE_ENV=test', () => {
      process.env.NODE_ENV = 'test';
      expect(getEnvironment()).toBe('test');
    });

    it('should return "development" for undefined NODE_ENV', () => {
      delete process.env.NODE_ENV;
      expect(getEnvironment()).toBe('development');
    });

    it('should return "development" for empty NODE_ENV', () => {
      process.env.NODE_ENV = '';
      expect(getEnvironment()).toBe('development');
    });

    it('should return "development" for unknown NODE_ENV values', () => {
      process.env.NODE_ENV = 'staging';
      expect(getEnvironment()).toBe('development');
    });
  });

  describe('isProduction', () => {
    it('should return true for production environment', () => {
      process.env.NODE_ENV = 'production';
      expect(isProduction()).toBe(true);
    });

    it('should return true for prod (legacy)', () => {
      process.env.NODE_ENV = 'prod';
      expect(isProduction()).toBe(true);
    });

    it('should return false for development environment', () => {
      process.env.NODE_ENV = 'development';
      expect(isProduction()).toBe(false);
    });

    it('should return false for test environment', () => {
      process.env.NODE_ENV = 'test';
      expect(isProduction()).toBe(false);
    });
  });

  describe('isDevelopment', () => {
    it('should return true for development environment', () => {
      process.env.NODE_ENV = 'development';
      expect(isDevelopment()).toBe(true);
    });

    it('should return true for dev (legacy)', () => {
      process.env.NODE_ENV = 'dev';
      expect(isDevelopment()).toBe(true);
    });

    it('should return true for undefined NODE_ENV (default)', () => {
      delete process.env.NODE_ENV;
      expect(isDevelopment()).toBe(true);
    });

    it('should return false for production environment', () => {
      process.env.NODE_ENV = 'production';
      expect(isDevelopment()).toBe(false);
    });

    it('should return false for test environment', () => {
      process.env.NODE_ENV = 'test';
      expect(isDevelopment()).toBe(false);
    });
  });

  describe('isTest', () => {
    it('should return true for test environment', () => {
      process.env.NODE_ENV = 'test';
      expect(isTest()).toBe(true);
    });

    it('should return false for production environment', () => {
      process.env.NODE_ENV = 'production';
      expect(isTest()).toBe(false);
    });

    it('should return false for development environment', () => {
      process.env.NODE_ENV = 'development';
      expect(isTest()).toBe(false);
    });
  });

  describe('isNonProduction', () => {
    it('should return false for production environment', () => {
      process.env.NODE_ENV = 'production';
      expect(isNonProduction()).toBe(false);
    });

    it('should return true for development environment', () => {
      process.env.NODE_ENV = 'development';
      expect(isNonProduction()).toBe(true);
    });

    it('should return true for test environment', () => {
      process.env.NODE_ENV = 'test';
      expect(isNonProduction()).toBe(true);
    });
  });
});
