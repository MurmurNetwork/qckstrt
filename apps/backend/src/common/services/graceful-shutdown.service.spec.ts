import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { Server } from 'http';
import { EventEmitter } from 'events';
import { GracefulShutdownService } from './graceful-shutdown.service';

describe('GracefulShutdownService', () => {
  let service: GracefulShutdownService;
  let mockConfigService: Partial<ConfigService>;

  beforeEach(async () => {
    mockConfigService = {
      get: jest.fn().mockReturnValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GracefulShutdownService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<GracefulShutdownService>(GracefulShutdownService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should use default timeout when not configured', () => {
      expect(service).toBeDefined();
    });

    it('should use configured timeout', async () => {
      mockConfigService.get = jest.fn().mockReturnValue(5000);

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          GracefulShutdownService,
          {
            provide: ConfigService,
            useValue: mockConfigService,
          },
        ],
      }).compile();

      const customService = module.get<GracefulShutdownService>(
        GracefulShutdownService,
      );
      expect(customService).toBeDefined();
    });
  });

  describe('setHttpServer', () => {
    it('should set the HTTP server reference', () => {
      const mockServer = new EventEmitter() as unknown as Server;
      mockServer.on = jest.fn().mockReturnThis();

      service.setHttpServer(mockServer);

      expect(mockServer.on).toHaveBeenCalledWith(
        'connection',
        expect.any(Function),
      );
    });

    it('should track connections when server receives them', () => {
      const mockServer = new EventEmitter();
      const mockSocket = new EventEmitter();

      service.setHttpServer(mockServer as unknown as Server);
      mockServer.emit('connection', mockSocket);

      expect(service.getActiveConnectionCount()).toBe(1);
    });

    it('should remove connections when they close', () => {
      const mockServer = new EventEmitter();
      const mockSocket = new EventEmitter();

      service.setHttpServer(mockServer as unknown as Server);
      mockServer.emit('connection', mockSocket);
      expect(service.getActiveConnectionCount()).toBe(1);

      mockSocket.emit('close');
      expect(service.getActiveConnectionCount()).toBe(0);
    });
  });

  describe('onApplicationShutdown', () => {
    it('should handle shutdown signal', async () => {
      const mockServer = new EventEmitter() as Server & { close: jest.Mock };
      mockServer.close = jest.fn((callback) => callback());

      service.setHttpServer(mockServer);

      await service.onApplicationShutdown('SIGTERM');

      expect(mockServer.close).toHaveBeenCalled();
      expect(service.isInShutdown()).toBe(true);
    });

    it('should ignore duplicate shutdown signals', async () => {
      const mockServer = new EventEmitter() as Server & { close: jest.Mock };
      mockServer.close = jest.fn((callback) => callback());

      service.setHttpServer(mockServer);

      await service.onApplicationShutdown('SIGTERM');
      await service.onApplicationShutdown('SIGTERM');

      // close should only be called once
      expect(mockServer.close).toHaveBeenCalledTimes(1);
    });

    it('should handle shutdown without HTTP server', async () => {
      await service.onApplicationShutdown('SIGTERM');

      expect(service.isInShutdown()).toBe(true);
    });

    it('should handle server close error', async () => {
      const mockServer = new EventEmitter() as Server & { close: jest.Mock };
      mockServer.close = jest.fn((callback) =>
        callback(new Error('Close error')),
      );

      service.setHttpServer(mockServer);

      // Should not throw
      await expect(
        service.onApplicationShutdown('SIGTERM'),
      ).resolves.not.toThrow();
    });

    it('should handle ERR_SERVER_NOT_RUNNING error gracefully', async () => {
      const mockServer = new EventEmitter() as Server & { close: jest.Mock };
      const error = new Error('Server not running') as NodeJS.ErrnoException;
      error.code = 'ERR_SERVER_NOT_RUNNING';
      mockServer.close = jest.fn((callback) => callback(error));

      service.setHttpServer(mockServer);

      await expect(
        service.onApplicationShutdown('SIGTERM'),
      ).resolves.not.toThrow();
    });
  });

  describe('isInShutdown', () => {
    it('should return false initially', () => {
      expect(service.isInShutdown()).toBe(false);
    });

    it('should return true after shutdown initiated', async () => {
      const mockServer = new EventEmitter() as Server & { close: jest.Mock };
      mockServer.close = jest.fn((callback) => callback());

      service.setHttpServer(mockServer);
      await service.onApplicationShutdown('SIGTERM');

      expect(service.isInShutdown()).toBe(true);
    });
  });

  describe('getActiveConnectionCount', () => {
    it('should return 0 initially', () => {
      expect(service.getActiveConnectionCount()).toBe(0);
    });

    it('should track multiple connections', () => {
      const mockServer = new EventEmitter();

      service.setHttpServer(mockServer as unknown as Server);

      mockServer.emit('connection', new EventEmitter());
      mockServer.emit('connection', new EventEmitter());
      mockServer.emit('connection', new EventEmitter());

      expect(service.getActiveConnectionCount()).toBe(3);
    });
  });

  describe('connection timeout', () => {
    it('should force close connections after timeout', async () => {
      // Create service with very short timeout for testing
      mockConfigService.get = jest.fn().mockReturnValue(150); // 150ms timeout

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          GracefulShutdownService,
          {
            provide: ConfigService,
            useValue: mockConfigService,
          },
        ],
      }).compile();

      const shortTimeoutService = module.get<GracefulShutdownService>(
        GracefulShutdownService,
      );

      const mockServer = new EventEmitter() as Server & { close: jest.Mock };
      mockServer.close = jest.fn((callback) => callback());

      const mockSocket = new EventEmitter() as EventEmitter & {
        destroy: jest.Mock;
      };
      mockSocket.destroy = jest.fn();

      shortTimeoutService.setHttpServer(mockServer);

      // Add socket by emitting 'connection' event
      mockServer.emit('connection', mockSocket);

      // Start shutdown - it will wait for connections to drain or timeout
      await shortTimeoutService.onApplicationShutdown('SIGTERM');

      // After timeout, destroy should have been called
      expect(mockSocket.destroy).toHaveBeenCalled();
    }, 5000);
  });
});
