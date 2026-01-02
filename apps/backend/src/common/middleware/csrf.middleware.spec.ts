import { ConfigService } from '@nestjs/config';
import { ForbiddenException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

import { CsrfMiddleware } from './csrf.middleware';

describe('CsrfMiddleware', () => {
  let middleware: CsrfMiddleware;
  let configService: Partial<ConfigService>;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;
  let setCookieMock: jest.Mock;

  const defaultConfig = {
    'csrf.enabled': true,
    'csrf.cookieName': 'csrf-token',
    'csrf.headerName': 'x-csrf-token',
    'csrf.tokenMaxAge': 86400000,
    'csrf.cookieDomain': undefined,
    'cookie.secure': false,
    'cookie.sameSite': 'strict',
    NODE_ENV: 'test',
  };

  beforeEach(() => {
    configService = {
      get: jest.fn().mockImplementation((key: string) => {
        return defaultConfig[key as keyof typeof defaultConfig];
      }),
    };

    middleware = new CsrfMiddleware(configService as ConfigService);

    setCookieMock = jest.fn();

    mockRequest = {
      method: 'GET',
      path: '/api/test',
      headers: {},
      cookies: {},
    };

    mockResponse = {
      cookie: setCookieMock,
    };

    mockNext = jest.fn();
  });

  describe('constructor', () => {
    it('should initialize with default values when config is missing', () => {
      const emptyConfigService = {
        get: jest.fn().mockReturnValue(undefined),
      } as unknown as ConfigService;

      const emptyMiddleware = new CsrfMiddleware(emptyConfigService);
      expect(emptyMiddleware).toBeDefined();
    });

    it('should respect csrf.enabled config', () => {
      const disabledConfig = {
        ...defaultConfig,
        'csrf.enabled': false,
      };
      const disabledConfigService = {
        get: jest
          .fn()
          .mockImplementation(
            (key: string) => disabledConfig[key as keyof typeof disabledConfig],
          ),
      } as unknown as ConfigService;

      const disabledMiddleware = new CsrfMiddleware(disabledConfigService);
      expect(disabledMiddleware).toBeDefined();
    });
  });

  describe('use - disabled mode', () => {
    it('should skip validation when CSRF is disabled', () => {
      const disabledConfig = {
        ...defaultConfig,
        'csrf.enabled': false,
      };
      const disabledConfigService = {
        get: jest
          .fn()
          .mockImplementation(
            (key: string) => disabledConfig[key as keyof typeof disabledConfig],
          ),
      } as unknown as ConfigService;

      const disabledMiddleware = new CsrfMiddleware(disabledConfigService);

      mockRequest.method = 'POST';

      disabledMiddleware.use(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(mockNext).toHaveBeenCalled();
      expect(setCookieMock).not.toHaveBeenCalled();
    });
  });

  describe('use - safe methods (GET, HEAD, OPTIONS)', () => {
    it('should allow GET requests without CSRF token', () => {
      mockRequest.method = 'GET';

      middleware.use(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(mockNext).toHaveBeenCalled();
      expect(setCookieMock).toHaveBeenCalled();
    });

    it('should allow HEAD requests without CSRF token', () => {
      mockRequest.method = 'HEAD';

      middleware.use(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(mockNext).toHaveBeenCalled();
    });

    it('should allow OPTIONS requests without CSRF token', () => {
      mockRequest.method = 'OPTIONS';

      middleware.use(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(mockNext).toHaveBeenCalled();
    });

    it('should generate and set new CSRF token when none exists', () => {
      mockRequest.method = 'GET';
      mockRequest.cookies = {};

      middleware.use(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(setCookieMock).toHaveBeenCalledWith(
        'csrf-token',
        expect.any(String),
        expect.objectContaining({
          httpOnly: false,
          secure: false,
          sameSite: 'strict',
          maxAge: 86400000,
          path: '/',
        }),
      );

      // Verify token is UUID format
      const token = setCookieMock.mock.calls[0][1];
      expect(token).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      );
    });

    it('should refresh existing CSRF token from cookie', () => {
      mockRequest.method = 'GET';
      mockRequest.cookies = { 'csrf-token': 'existing-token-123' };

      middleware.use(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(setCookieMock).toHaveBeenCalledWith(
        'csrf-token',
        'existing-token-123',
        expect.any(Object),
      );
    });
  });

  describe('use - unsafe methods (POST, PUT, DELETE, PATCH)', () => {
    beforeEach(() => {
      mockRequest.cookies = { 'csrf-token': 'valid-csrf-token' };
    });

    it('should reject POST request without CSRF header', () => {
      mockRequest.method = 'POST';
      mockRequest.headers = {};

      expect(() =>
        middleware.use(
          mockRequest as Request,
          mockResponse as Response,
          mockNext,
        ),
      ).toThrow(ForbiddenException);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject PUT request without CSRF header', () => {
      mockRequest.method = 'PUT';
      mockRequest.headers = {};

      expect(() =>
        middleware.use(
          mockRequest as Request,
          mockResponse as Response,
          mockNext,
        ),
      ).toThrow(ForbiddenException);
    });

    it('should reject DELETE request without CSRF header', () => {
      mockRequest.method = 'DELETE';
      mockRequest.headers = {};

      expect(() =>
        middleware.use(
          mockRequest as Request,
          mockResponse as Response,
          mockNext,
        ),
      ).toThrow(ForbiddenException);
    });

    it('should reject PATCH request without CSRF header', () => {
      mockRequest.method = 'PATCH';
      mockRequest.headers = {};

      expect(() =>
        middleware.use(
          mockRequest as Request,
          mockResponse as Response,
          mockNext,
        ),
      ).toThrow(ForbiddenException);
    });

    it('should reject request with mismatched CSRF token', () => {
      mockRequest.method = 'POST';
      mockRequest.headers = { 'x-csrf-token': 'wrong-token' };

      expect(() =>
        middleware.use(
          mockRequest as Request,
          mockResponse as Response,
          mockNext,
        ),
      ).toThrow(ForbiddenException);
    });

    it('should allow POST request with valid CSRF token', () => {
      mockRequest.method = 'POST';
      mockRequest.headers = { 'x-csrf-token': 'valid-csrf-token' };

      middleware.use(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(mockNext).toHaveBeenCalled();
    });

    it('should allow PUT request with valid CSRF token', () => {
      mockRequest.method = 'PUT';
      mockRequest.headers = { 'x-csrf-token': 'valid-csrf-token' };

      middleware.use(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(mockNext).toHaveBeenCalled();
    });

    it('should allow DELETE request with valid CSRF token', () => {
      mockRequest.method = 'DELETE';
      mockRequest.headers = { 'x-csrf-token': 'valid-csrf-token' };

      middleware.use(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(mockNext).toHaveBeenCalled();
    });

    it('should allow PATCH request with valid CSRF token', () => {
      mockRequest.method = 'PATCH';
      mockRequest.headers = { 'x-csrf-token': 'valid-csrf-token' };

      middleware.use(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('cookie parsing fallback', () => {
    it('should parse cookie from header when req.cookies is not available', () => {
      mockRequest.method = 'POST';
      mockRequest.cookies = undefined;
      mockRequest.headers = {
        cookie: 'csrf-token=header-parsed-token; other=value',
        'x-csrf-token': 'header-parsed-token',
      };

      middleware.use(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(mockNext).toHaveBeenCalled();
    });

    it('should handle URL-encoded cookie values', () => {
      mockRequest.method = 'POST';
      mockRequest.cookies = undefined;
      mockRequest.headers = {
        cookie: 'csrf-token=token%20with%20spaces',
        'x-csrf-token': 'token with spaces',
      };

      middleware.use(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(mockNext).toHaveBeenCalled();
    });

    it('should generate new token when no cookie header exists', () => {
      mockRequest.method = 'GET';
      mockRequest.cookies = undefined;
      mockRequest.headers = {};

      middleware.use(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(setCookieMock).toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('header handling', () => {
    beforeEach(() => {
      mockRequest.cookies = { 'csrf-token': 'valid-token' };
    });

    it('should handle array header value', () => {
      mockRequest.method = 'POST';
      mockRequest.headers = { 'x-csrf-token': ['valid-token'] };

      middleware.use(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(mockNext).toHaveBeenCalled();
    });

    it('should work with lowercase headers (Express normalizes headers to lowercase)', () => {
      // Express automatically normalizes all headers to lowercase
      // So 'X-CSRF-TOKEN' becomes 'x-csrf-token'
      mockRequest.method = 'POST';
      mockRequest.headers = { 'x-csrf-token': 'valid-token' };

      middleware.use(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('cookie options', () => {
    it('should set secure cookie in production', () => {
      const prodConfig = {
        ...defaultConfig,
        'cookie.secure': true,
        NODE_ENV: 'production',
      };
      const prodConfigService = {
        get: jest
          .fn()
          .mockImplementation(
            (key: string) => prodConfig[key as keyof typeof prodConfig],
          ),
      } as unknown as ConfigService;

      const prodMiddleware = new CsrfMiddleware(prodConfigService);

      prodMiddleware.use(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(setCookieMock).toHaveBeenCalledWith(
        'csrf-token',
        expect.any(String),
        expect.objectContaining({
          secure: true,
        }),
      );
    });

    it('should set cookie domain when configured', () => {
      const domainConfig = {
        ...defaultConfig,
        'csrf.cookieDomain': '.example.com',
      };
      const domainConfigService = {
        get: jest
          .fn()
          .mockImplementation(
            (key: string) => domainConfig[key as keyof typeof domainConfig],
          ),
      } as unknown as ConfigService;

      const domainMiddleware = new CsrfMiddleware(domainConfigService);

      domainMiddleware.use(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(setCookieMock).toHaveBeenCalledWith(
        'csrf-token',
        expect.any(String),
        expect.objectContaining({
          domain: '.example.com',
        }),
      );
    });

    it('should use custom cookie name when configured', () => {
      const customConfig = {
        ...defaultConfig,
        'csrf.cookieName': 'custom-csrf',
      };
      const customConfigService = {
        get: jest
          .fn()
          .mockImplementation(
            (key: string) => customConfig[key as keyof typeof customConfig],
          ),
      } as unknown as ConfigService;

      const customMiddleware = new CsrfMiddleware(customConfigService);

      mockRequest.cookies = { 'custom-csrf': 'token-value' };
      mockRequest.method = 'POST';
      mockRequest.headers = { 'x-csrf-token': 'token-value' };

      customMiddleware.use(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(setCookieMock).toHaveBeenCalledWith(
        'custom-csrf',
        expect.any(String),
        expect.any(Object),
      );
      expect(mockNext).toHaveBeenCalled();
    });

    it('should use custom header name when configured', () => {
      const customConfig = {
        ...defaultConfig,
        'csrf.headerName': 'x-custom-csrf',
      };
      const customConfigService = {
        get: jest
          .fn()
          .mockImplementation(
            (key: string) => customConfig[key as keyof typeof customConfig],
          ),
      } as unknown as ConfigService;

      const customMiddleware = new CsrfMiddleware(customConfigService);

      mockRequest.cookies = { 'csrf-token': 'token-value' };
      mockRequest.method = 'POST';
      mockRequest.headers = { 'x-custom-csrf': 'token-value' };

      customMiddleware.use(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('error messages', () => {
    it('should provide clear error message for missing token', () => {
      mockRequest.method = 'POST';
      mockRequest.cookies = { 'csrf-token': 'valid-token' };
      mockRequest.headers = {};

      try {
        middleware.use(
          mockRequest as Request,
          mockResponse as Response,
          mockNext,
        );
        fail('Should have thrown ForbiddenException');
      } catch (error) {
        expect(error).toBeInstanceOf(ForbiddenException);
        expect((error as ForbiddenException).message).toBe(
          'CSRF token required',
        );
      }
    });

    it('should provide clear error message for invalid token', () => {
      mockRequest.method = 'POST';
      mockRequest.cookies = { 'csrf-token': 'valid-token' };
      mockRequest.headers = { 'x-csrf-token': 'invalid-token' };

      try {
        middleware.use(
          mockRequest as Request,
          mockResponse as Response,
          mockNext,
        );
        fail('Should have thrown ForbiddenException');
      } catch (error) {
        expect(error).toBeInstanceOf(ForbiddenException);
        expect((error as ForbiddenException).message).toBe(
          'Invalid CSRF token',
        );
      }
    });
  });
});
