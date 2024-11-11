import { Test, TestingModule } from '@nestjs/testing'
import { vi } from "vitest"
import { ConfigService } from "@nestjs/config"
import { SessionService } from "./session.service"
import { JwtService } from "@nestjs/jwt"
import { HttpStatus, InternalServerErrorException } from '@nestjs/common'
import { DefaultHttpException } from '@/resources/common/errors/error/custom-error.error'
import { DrizzleAsyncProvider } from '@/resources/database/database.module'

const configServiceMock = {
    get: vi.fn((key: string) => {
        const config = {
            'JWT_SECRET': 'test-secret',
            'JWT_EXPIRES_IN': '1h',
            'JWT_REFRESH_TOKEN_SECRET': 'refresh-secret',
            'JWT_REFRESH_TOKEN_EXPIRES_IN': '7d'
        };
        return config[key];
    })
}

const jwtServiceMock = {
    sign: vi.fn(),
    verify: vi.fn()
}

let dbQueryResult: any[] = [];

const mockDb = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockImplementation(() => dbQueryResult),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockImplementation(() => Promise.resolve()),
    delete: vi.fn().mockReturnThis(),
    fullJoin: vi.fn().mockImplementation(() => dbQueryResult)
};

beforeEach(() => vi.clearAllMocks());

describe("Session Service", () => {
    let service: SessionService;
    let jwtService: JwtService;
    let configService: ConfigService

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                SessionService,
                { provide: DrizzleAsyncProvider, useValue: mockDb },
                { provide: ConfigService, useValue: configServiceMock },
                { provide: JwtService, useValue: jwtServiceMock },
            ]
        }).compile();

        service = module.get<SessionService>(SessionService);
        jwtService = module.get<JwtService>(JwtService);
        configService = module.get<ConfigService>(ConfigService);

    })


    beforeEach(() => {
        vi.clearAllMocks();
        dbQueryResult = [];
    });


    it('Session Service Should be defined', () => {
        expect(service).toBeDefined();
    })

    describe('createSession', () => {
        const userId = 'testing-id';
        const refreshToken = 'refresh-token';
        const ip = '127.0.0.1';
        const deviceInfo = 'Chrome Browser';

        it('Should create session successfully', async () => {
            await service.createSession(userId, refreshToken, ip, deviceInfo);

            expect(mockDb.insert).toHaveBeenCalled();
            expect(mockDb.values).toHaveBeenCalledWith({
                userId,
                refreshToken,
                expiresAt: expect.any(Date),
                ipAddress: ip,
                deviceInfo,
            });
        });

        it('Should throw InternalServerError on database error', async () => {
            mockDb.values.mockRejectedValueOnce(new InternalServerErrorException('Postgres error..'));

            await expect(service.createSession(userId, refreshToken, ip, deviceInfo))
                .rejects.toThrow(InternalServerErrorException);
        });
    });
    describe('findSessionByRefreshToken', () => {
        const refreshToken = 'refresh-token';

        it('Should find session successfully', async () => {
            const mockSession = [{ id: 1, refreshToken }];
            dbQueryResult = mockSession;

            const result = await service.findSessionByRefreshToken(refreshToken);

            expect(result).toEqual(mockSession);
            expect(mockDb.select).toHaveBeenCalled();
            expect(mockDb.from).toHaveBeenCalled();
            expect(mockDb.where).toHaveBeenCalled();
            expect(mockDb.limit).toHaveBeenCalledWith(1);
        });

        it('Should throw InternalServerError on database error', async () => {
            mockDb.where.mockRejectedValueOnce(new InternalServerErrorException('Postgres error..'));

            await expect(service.findSessionByRefreshToken(refreshToken))
                .rejects.toThrow(InternalServerErrorException);
        });
    });

    describe('deleteSessionByRefreshToken', () => {
        const refreshToken = 'refresh-token';

        it('Should delete session successfully', async () => {
            dbQueryResult = [{ id: 1 }];

            await service.deleteSessionByRefreshToken(refreshToken);

            expect(mockDb.select).toHaveBeenCalled();
            expect(mockDb.from).toHaveBeenCalled();
            expect(mockDb.where).toHaveBeenCalled();
            expect(mockDb.limit).toHaveBeenCalledWith(1);
            expect(mockDb.delete).toHaveBeenCalled();
        });

        it('Should throw error when session not found', async () => {
            dbQueryResult = [];

            await expect(service.deleteSessionByRefreshToken(refreshToken))
                .rejects.toThrow(new DefaultHttpException(
                    "Session not found or already logged out",
                    "Ensure you are logged in before attempting to log out.",
                    "Session Service",
                    HttpStatus.UNAUTHORIZED,
                ));
        });
    });
    describe('refreshToken', () => {
        const refreshToken = 'refresh-token';
        const ip = '127.0.0.1';
        const deviceInfo = 'Chrome Browser';
        const mockUser = {
            userId: 'testing-id',
            username: 'testuser',
            role: 'user'
        };

        beforeEach(() => {

            jwtServiceMock.verify.mockReturnValue(mockUser);
            jwtServiceMock.sign.mockReturnValueOnce('new-refresh-token')
                .mockReturnValueOnce('new-access-token');
        });

        it('should refresh tokens successfully', async () => {
            dbQueryResult = [{ id: 1 }];

            const result = await service.refreshToken(refreshToken, ip, deviceInfo);

            expect(result).toEqual({
                accessToken: 'new-access-token',
                newRefreshToken: 'new-refresh-token',
                userId: mockUser.userId
            });
            expect(mockDb.delete).toHaveBeenCalled();
            expect(mockDb.insert).toHaveBeenCalled();
        });

        it('should throw error for invalid refresh token', async () => {
            dbQueryResult = [];

            await expect(service.refreshToken(refreshToken, ip, deviceInfo))
                .rejects.toThrow(DefaultHttpException);
        });

        it('should throw error when token verification fails', async () => {
            dbQueryResult = [{ id: 1 }];
            jwtServiceMock.verify.mockImplementationOnce(() => {
                throw new Error('Token verification failed');
            });

            await expect(service.refreshToken(refreshToken, ip, deviceInfo))
                .rejects.toThrow(DefaultHttpException);
        });
    });

    describe('getSessions', () => {
        const userId = 'testing-id';

        it('should get user sessions successfully', async () => {
            const mockSessions = [{
                refreshToken: 'token1',
                expiresAt: new Date(),
                userId: userId,
                email: 'test@example.com'
            }];
            dbQueryResult = mockSessions;

            const result = await service.getSessions(userId);

            expect(result).toEqual(mockSessions);
            expect(mockDb.select).toHaveBeenCalled();
            expect(mockDb.from).toHaveBeenCalled();
            expect(mockDb.where).toHaveBeenCalled();
            expect(mockDb.fullJoin).toHaveBeenCalled();
        });

        it('Should throw error when fetching sessions fails', async () => {
            mockDb.where.mockRejectedValueOnce(new Error('Postgres Error'));

            await expect(service.getSessions(userId))
                .rejects.toThrow(DefaultHttpException);
        });
    });

    describe('deleteExpiredSessions', () => {
        it('Should delete expired sessions successfully', async () => {
            await service.deleteExpiredSessions();

            expect(mockDb.delete).toHaveBeenCalled();
            expect(mockDb.where).toHaveBeenCalled();
        });

        it('Should throw InternalServerError on database error', async () => {
            mockDb.delete.mockRejectedValueOnce(new Error('Postgres Error'));

            await expect(service.deleteExpiredSessions())
                .rejects.toThrow(InternalServerErrorException);
        });
    });


})