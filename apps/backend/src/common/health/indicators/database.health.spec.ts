import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { DatabaseHealthIndicator } from './database.health';

describe('DatabaseHealthIndicator', () => {
  let indicator: DatabaseHealthIndicator;
  let dataSource: DataSource;

  beforeEach(async () => {
    const mockDataSource = {
      query: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DatabaseHealthIndicator,
        {
          provide: getDataSourceToken(),
          useValue: mockDataSource,
        },
      ],
    }).compile();

    indicator = module.get<DatabaseHealthIndicator>(DatabaseHealthIndicator);
    dataSource = module.get<DataSource>(getDataSourceToken());
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('check', () => {
    it('should return up status when database is reachable', async () => {
      const result = await indicator.check();

      expect(result.database).toBeDefined();
      expect(result.database.status).toBe('up');
      expect(result.database.responseTime).toBeDefined();
    });

    it('should execute SELECT 1 query', async () => {
      await indicator.check();

      expect(dataSource.query).toHaveBeenCalledWith('SELECT 1');
    });

    it('should include response time in result', async () => {
      const result = await indicator.check();

      expect(result.database.responseTime).toMatch(/^\d+ms$/);
    });

    it('should return down status when database query fails', async () => {
      (dataSource.query as jest.Mock).mockRejectedValue(
        new Error('Connection refused'),
      );

      const result = await indicator.check();

      expect(result.database.status).toBe('down');
      expect(result.database.error).toBe('Connection refused');
      expect(result.database.responseTime).toBeDefined();
    });

    it('should handle unknown errors', async () => {
      (dataSource.query as jest.Mock).mockRejectedValue('Unknown error');

      const result = await indicator.check();

      expect(result.database.status).toBe('down');
      expect(result.database.error).toBe('Unknown error');
    });

    it('should measure response time even on failure', async () => {
      (dataSource.query as jest.Mock).mockRejectedValue(new Error('Timeout'));

      const result = await indicator.check();

      expect(result.database.responseTime).toMatch(/^\d+ms$/);
    });
  });
});
