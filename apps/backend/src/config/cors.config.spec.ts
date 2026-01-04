import { ConfigService } from '@nestjs/config';
import {
  getCorsConfig,
  getGraphQLCorsConfig,
  CORS_ALLOWED_HEADERS,
  CORS_ALLOWED_METHODS,
  CORS_MAX_AGE,
} from './cors.config';

describe('CORS Configuration', () => {
  let mockConfigService: jest.Mocked<ConfigService>;

  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    mockConfigService = {
      get: jest.fn(),
    } as unknown as jest.Mocked<ConfigService>;
  });

  afterEach(() => {
    jest.clearAllMocks();
    // Restore original environment
    process.env.NODE_ENV = originalNodeEnv;
  });

  describe('Constants', () => {
    it('should have correct allowed headers', () => {
      expect(CORS_ALLOWED_HEADERS).toContain('Content-Type');
      expect(CORS_ALLOWED_HEADERS).toContain('Authorization');
      expect(CORS_ALLOWED_HEADERS).toContain('X-Requested-With');
      expect(CORS_ALLOWED_HEADERS).toContain('X-CSRF-Token');
    });

    it('should have correct allowed methods', () => {
      expect(CORS_ALLOWED_METHODS).toContain('GET');
      expect(CORS_ALLOWED_METHODS).toContain('POST');
      expect(CORS_ALLOWED_METHODS).toContain('OPTIONS');
    });

    it('should have correct max age (24 hours)', () => {
      expect(CORS_MAX_AGE).toBe(86400);
    });
  });

  describe('getCorsConfig', () => {
    describe('in development mode', () => {
      beforeEach(() => {
        process.env.NODE_ENV = 'development';
        mockConfigService.get.mockImplementation((key: string) => {
          if (key === 'ALLOWED_ORIGINS') return undefined;
          return undefined;
        });
      });

      it('should allow all origins', () => {
        const config = getCorsConfig(mockConfigService);
        expect(config.origin).toBe(true);
      });

      it('should include credentials', () => {
        const config = getCorsConfig(mockConfigService);
        expect(config.credentials).toBe(true);
      });

      it('should use standard allowed methods', () => {
        const config = getCorsConfig(mockConfigService);
        expect(config.methods).toEqual(CORS_ALLOWED_METHODS);
      });

      it('should use standard allowed headers', () => {
        const config = getCorsConfig(mockConfigService);
        expect(config.allowedHeaders).toEqual(CORS_ALLOWED_HEADERS);
      });
    });

    describe('in production mode', () => {
      const allowedOrigins =
        'https://app.example.com,https://admin.example.com';

      beforeEach(() => {
        process.env.NODE_ENV = 'production';
        mockConfigService.get.mockImplementation((key: string) => {
          if (key === 'ALLOWED_ORIGINS') return allowedOrigins;
          return undefined;
        });
      });

      it('should restrict to allowed origins', () => {
        const config = getCorsConfig(mockConfigService);
        expect(config.origin).toEqual([
          'https://app.example.com',
          'https://admin.example.com',
        ]);
      });

      it('should include credentials', () => {
        const config = getCorsConfig(mockConfigService);
        expect(config.credentials).toBe(true);
      });

      it('should use standard allowed methods', () => {
        const config = getCorsConfig(mockConfigService);
        expect(config.methods).toEqual(CORS_ALLOWED_METHODS);
      });

      it('should use standard allowed headers', () => {
        const config = getCorsConfig(mockConfigService);
        expect(config.allowedHeaders).toEqual(CORS_ALLOWED_HEADERS);
      });

      it('should set maxAge for preflight caching', () => {
        const config = getCorsConfig(mockConfigService);
        expect(config.maxAge).toBe(CORS_MAX_AGE);
      });
    });

    describe('in production without ALLOWED_ORIGINS', () => {
      beforeEach(() => {
        process.env.NODE_ENV = 'production';
        mockConfigService.get.mockImplementation((key: string) => {
          if (key === 'ALLOWED_ORIGINS') return undefined;
          return undefined;
        });
      });

      it('should fall back to allowing all origins', () => {
        const config = getCorsConfig(mockConfigService);
        expect(config.origin).toBe(true);
      });
    });

    describe('origin trimming', () => {
      beforeEach(() => {
        process.env.NODE_ENV = 'production';
        mockConfigService.get.mockImplementation((key: string) => {
          if (key === 'ALLOWED_ORIGINS')
            return '  https://app.example.com  ,  https://admin.example.com  ';
          return undefined;
        });
      });

      it('should trim whitespace from origins', () => {
        const config = getCorsConfig(mockConfigService);
        expect(config.origin).toEqual([
          'https://app.example.com',
          'https://admin.example.com',
        ]);
      });
    });
  });

  describe('getGraphQLCorsConfig', () => {
    describe('in development mode', () => {
      beforeEach(() => {
        process.env.NODE_ENV = 'development';
        mockConfigService.get.mockImplementation((key: string) => {
          if (key === 'ALLOWED_ORIGINS') return undefined;
          return undefined;
        });
      });

      it('should allow all origins', () => {
        const config = getGraphQLCorsConfig(mockConfigService);
        expect(config.origin).toBe(true);
      });

      it('should include credentials', () => {
        const config = getGraphQLCorsConfig(mockConfigService);
        expect(config.credentials).toBe(true);
      });

      it('should use standard allowed methods', () => {
        const config = getGraphQLCorsConfig(mockConfigService);
        expect(config.methods).toEqual(CORS_ALLOWED_METHODS);
      });

      it('should use standard allowed headers', () => {
        const config = getGraphQLCorsConfig(mockConfigService);
        expect(config.allowedHeaders).toEqual(CORS_ALLOWED_HEADERS);
      });
    });

    describe('in production mode', () => {
      const allowedOrigins =
        'https://app.example.com,https://admin.example.com';

      beforeEach(() => {
        process.env.NODE_ENV = 'production';
        mockConfigService.get.mockImplementation((key: string) => {
          if (key === 'ALLOWED_ORIGINS') return allowedOrigins;
          return undefined;
        });
      });

      it('should restrict to allowed origins', () => {
        const config = getGraphQLCorsConfig(mockConfigService);
        expect(config.origin).toEqual([
          'https://app.example.com',
          'https://admin.example.com',
        ]);
      });

      it('should include credentials', () => {
        const config = getGraphQLCorsConfig(mockConfigService);
        expect(config.credentials).toBe(true);
      });

      it('should use standard allowed methods', () => {
        const config = getGraphQLCorsConfig(mockConfigService);
        expect(config.methods).toEqual(CORS_ALLOWED_METHODS);
      });

      it('should use standard allowed headers', () => {
        const config = getGraphQLCorsConfig(mockConfigService);
        expect(config.allowedHeaders).toEqual(CORS_ALLOWED_HEADERS);
      });
    });

    describe('in production without ALLOWED_ORIGINS', () => {
      beforeEach(() => {
        process.env.NODE_ENV = 'production';
        mockConfigService.get.mockImplementation((key: string) => {
          if (key === 'ALLOWED_ORIGINS') return undefined;
          return undefined;
        });
      });

      it('should fall back to allowing all origins', () => {
        const config = getGraphQLCorsConfig(mockConfigService);
        expect(config.origin).toBe(true);
      });
    });
  });
});
