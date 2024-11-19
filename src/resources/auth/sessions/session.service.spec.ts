import { Test, TestingModule } from '@nestjs/testing';
import { vi } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { SessionService } from './session.service';
import { JwtService } from '@nestjs/jwt';
import { HttpStatus } from '@nestjs/common';
import { DefaultHttpException } from '@/resources/common/errors/error/custom-error.error';
import { DrizzleAsyncProvider } from '@/resources/database/database.module';
import { UserRoles } from '@/resources/common/enums/user-roles.enum';

const configServiceMock = {
  get: vi.fn((key: string) => {
    const config = {
      JWT_SECRET: 'test-secret',
      JWT_EXPIRES_IN: '1h',
      JWT_REFRESH_TOKEN_SECRET: 'refresh-secret',
      JWT_REFRESH_TOKEN_EXPIRES_IN: '7d',
      REFRESH_TOKEN_COOKIE_MAX_AGE: '604800',
    };
    return config[key];
  }),
};

const jwtServiceMock = {
  sign: vi.fn(),
  verify: vi.fn(),
};

let dbQueryResult: any[] = [];
let transactionResult: any;

const mockDb = {
  select: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  limit: vi.fn().mockImplementation(() => dbQueryResult),
  insert: vi.fn().mockReturnThis(),
  values: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
  fullJoin: vi.fn().mockImplementation(() => dbQueryResult),
  transaction: vi.fn().mockImplementation(async (callback) => {
    if (transactionResult instanceof Error) {
      throw transactionResult;
    }
    return callback(mockDb);
  }),
  returning: vi
    .fn()
    .mockImplementation(() => [{ sessionId: 'test-session-id' }]),
};

describe('Session Service', () => {
  let service: SessionService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionService,
        { provide: DrizzleAsyncProvider, useValue: mockDb },
        { provide: ConfigService, useValue: configServiceMock },
        { provide: JwtService, useValue: jwtServiceMock },
      ],
    }).compile();

    service = module.get<SessionService>(SessionService);
  });

  beforeEach(() => {
    vi.clearAllMocks();
    dbQueryResult = [];
    transactionResult = null;
  });

  it('Session Service Should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createSession', () => {
    const userId = 'testing-id';
    const ip = '127.0.0.1';
    const deviceInfo = 'Chrome Browser';

    it('Should create session successfully', async () => {
      const result = await service.createSession(userId, ip, deviceInfo);

      expect(result).toBe('test-session-id');
      expect(mockDb.insert).toHaveBeenCalled();
      expect(mockDb.values).toHaveBeenCalledWith({
        userId,
        expiresAt: expect.any(Date),
        ipAddress: ip,
        deviceInfo,
      });
    });

    it('Should throw DefaultHttpException on database error', async () => {
      transactionResult = new Error('Database error');

      await expect(
        service.createSession(userId, ip, deviceInfo),
      ).rejects.toThrow(DefaultHttpException);
    });
  });

  describe('findSessionById', () => {
    const sessionId = 'test-session-id';

    it('Should find session successfully', async () => {
      const mockSession = [{ id: sessionId }];
      dbQueryResult = mockSession;

      const result = await service.findSessionById(sessionId);

      expect(result).toEqual(mockSession[0]);
      expect(mockDb.select).toHaveBeenCalled();
      expect(mockDb.where).toHaveBeenCalled();
      expect(mockDb.limit).toHaveBeenCalledWith(1);
    });

    it('Should throw DefaultHttpException on database error', async () => {
      mockDb.where.mockRejectedValueOnce(new Error('Database error'));

      await expect(service.findSessionById(sessionId)).rejects.toThrow(
        new DefaultHttpException(
          'Error finding session',
          '',
          'Sessions Service',
          HttpStatus.INTERNAL_SERVER_ERROR,
        ),
      );
    });
  });

  describe('deleteSessionById', () => {
    const sessionId = 'test-session-id';

    it('Should delete session successfully', async () => {
      dbQueryResult = [{ id: sessionId }];

      await service.deleteSessionById(sessionId);

      expect(mockDb.delete).toHaveBeenCalled();
      expect(mockDb.where).toHaveBeenCalled();
    });

    it('Should throw DefaultHttpException when session not found', async () => {
      dbQueryResult = [];

      await expect(service.deleteSessionById(sessionId)).rejects.toThrow(
        new DefaultHttpException(
          'Session not found or already logged out',
          'Ensure you are logged in before attempting to log out.',
          'Session Service',
          HttpStatus.UNAUTHORIZED,
        ),
      );
    });

    it('Should throw DefaultHttpException on database error', async () => {
      dbQueryResult = [{ id: sessionId }];
      transactionResult = new Error('Database error');

      await expect(service.deleteSessionById(sessionId)).rejects.toThrow(
        new DefaultHttpException(
          'Failed to delete session',
          'Please try again later',
          'Session Service',
          HttpStatus.INTERNAL_SERVER_ERROR,
        ),
      );
    });
  });

  describe('refreshToken', () => {
    const sessionId = 'test-session-id';
    const mockUser = {
      userId: 'testing-id',
      username: 'testuser',
      role: UserRoles.USER,
      ipAddress: '127.0.0.1',
      deviceInfo: 'Chrome Browser',
    };

    beforeEach(() => {
      dbQueryResult = [mockUser];
      jwtServiceMock.sign
        .mockReturnValueOnce('new-access-token')
        .mockReturnValueOnce('new-refresh-token');
    });

    it('Should refresh tokens successfully', async () => {
      mockDb.limit.mockImplementation(() => dbQueryResult);

      const result = await service.refreshToken(sessionId);

      expect(result).toEqual({
        accessToken: 'new-access-token',
        newRefreshToken: 'new-refresh-token',
        userId: mockUser.userId,
      });
      expect(mockDb.delete).toHaveBeenCalled();
      expect(mockDb.insert).toHaveBeenCalled();
    });

    it('Should throw DefaultHttpException when session not found', async () => {
      dbQueryResult = [];

      await expect(service.refreshToken(sessionId)).rejects.toThrow(
        new DefaultHttpException(
          'Session not found or already logged out',
          'Please login again',
          'Session Service',
          HttpStatus.UNAUTHORIZED,
        ),
      );
    });

    it('Should throw DefaultHttpException on database error', async () => {
      transactionResult = new Error('Database error');

      await expect(service.refreshToken(sessionId)).rejects.toThrow(
        new DefaultHttpException(
          'Failed to refresh token',
          'Please try logging in again',
          'Session Service',
          HttpStatus.UNAUTHORIZED,
        ),
      );
    });
  });

  describe('getSessions', () => {
    const userId = 'testing-id';

    it('Should get user sessions successfully', async () => {
      const mockSessions = [
        {
          expiresAt: new Date(),
          userId: userId,
          email: 'test@example.com',
        },
      ];
      dbQueryResult = mockSessions;

      const result = await service.getSessions(userId);

      expect(result).toEqual(mockSessions);
      expect(mockDb.select).toHaveBeenCalled();
      expect(mockDb.where).toHaveBeenCalled();
      expect(mockDb.fullJoin).toHaveBeenCalled();
    });

    it('Should throw DefaultHttpException when fetching sessions fails', async () => {
      mockDb.where.mockRejectedValueOnce(new Error('Database error'));

      await expect(service.getSessions(userId)).rejects.toThrow(
        new DefaultHttpException(
          'Failed to fetch sessions',
          'Please try again later',
          'Session Service',
          HttpStatus.INTERNAL_SERVER_ERROR,
        ),
      );
    });
  });

  describe('deleteExpiredSessions', () => {
    it('Should delete expired sessions successfully', async () => {
      await service.deleteExpiredSessions();

      expect(mockDb.delete).toHaveBeenCalled();
      expect(mockDb.where).toHaveBeenCalled();
    });

    it('Should throw InternalServerErrorException on database error', async () => {
      mockDb.delete.mockRejectedValueOnce(new Error('Database error'));

      await expect(service.deleteExpiredSessions()).rejects.toThrow(
        DefaultHttpException,
      );
    });
  });

  describe('Token generation', () => {
    const sessionId = 'test-session-id';
    const payload = {
      userId: 'test-user',
      role: UserRoles.USER,
      username: 'testuser',
      sessionId: 'test-session-id',
    };
    beforeEach(() => {
      jwtServiceMock.sign.mockReset();
    });

    it('Should generate refresh token', () => {
      jwtServiceMock.sign.mockReturnValueOnce('refresh-token');

      const result = service.generateRefreshToken(sessionId);

      expect(result).toBe('refresh-token');
      expect(jwtServiceMock.sign).toHaveBeenCalledWith(
        { sessionId },
        {
          secret: 'refresh-secret',
          expiresIn: '7d',
        },
      );
    });

    it('Should generate access token', () => {
      jwtServiceMock.sign.mockReturnValueOnce('access-token');

      const result = service.generateAccessToken(payload);

      expect(result).toBe('access-token');
      expect(jwtServiceMock.sign).toHaveBeenCalledWith(payload, {
        secret: 'test-secret',
        expiresIn: '1h',
      });
    });
  });
});
