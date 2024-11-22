import { UserRoles } from '@/common/enums/user-roles.enum';
import { DefaultHttpException } from '@/common/errors/error/custom-error.error';
import { UsersServiceMock } from '@/users/mocks/user.service.mock';
import { UsersService } from '@/users/users.service';
import { HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { Request } from 'express';
import { vi } from 'vitest';
import { AuthService } from './auth.service';
import { LoginUserType } from './interfaces/login-user.interface';
import { SessionServiceMock } from './sessions/mocks/session.service.mock';
import { SessionService } from './sessions/session.service';
import { VerificationCodeServiceMock } from './verification-code/mocks/verification-code.service.mock';
import { VerificationCodeService } from './verification-code/verification-code.service';

import bcrypt from 'bcryptjs';

const configServiceMock = {
  get: vi.fn((key: string) => {
    const config = {
      JWT_SECRET: 'test-secret',
      JWT_EXPIRES_IN: '1h',
      JWT_REFRESH_TOKEN_SECRET: 'refresh-secret',
      JWT_REFRESH_TOKEN_EXPIRES_IN: '7d',
    };
    return config[key];
  }),
};

const jwtServiceMock = {
  sign: vi.fn(() => {
    return 'token';
  }),
};

const uapMock = {
  setUA: vi.fn().mockReturnThis(),
  getResult: vi.fn().mockReturnValue({
    browser: { name: 'Arora', version: '0.8' },
    device: {},
    os: { name: 'Windows' },
  }),
};

beforeEach(() => vi.clearAllMocks());

describe('Authentication Service', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: UsersServiceMock },
        { provide: ConfigService, useValue: configServiceMock },
        { provide: JwtService, useValue: jwtServiceMock },
        { provide: SessionService, useValue: SessionServiceMock },
        {
          provide: VerificationCodeService,
          useValue: VerificationCodeServiceMock,
        },
        { provide: 'UAParser', useValue: uapMock },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('Auth Service Should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('register', () => {
    const user = {
      email: 'testing@mail.com',
      password: 'testing',
      username: 'testing',
      phoneNumber: '+21355555555',
    };
    beforeEach(() => {
      UsersServiceMock.create.mockResolvedValue({
        id: 'cc6d8',
        email: user.email,
        username: user.username,
        phoneNumber: user.phoneNumber,
      });
    });

    it('Should create a user', async () => {
      const createdUser = await UsersServiceMock.create(user);
      expect(UsersServiceMock.create).toHaveBeenCalledWith(user);
      expect(createdUser).toEqual({
        id: 'cc6d8',
        email: user.email,
        username: user.username,
        phoneNumber: user.phoneNumber,
      });
    });

    it('Should throw a conflict error if user with email:testing@mail.com is exists', async () => {
      UsersServiceMock.create.mockRejectedValueOnce(
        new DefaultHttpException(
          `${user.email} already exists`,
          `Enter new email`,
          'Register Service',
          HttpStatus.CONFLICT,
        ),
      );

      await expect(UsersServiceMock.create(user)).rejects.toThrow(
        new DefaultHttpException(
          `${user.email} already exists`,
          'Enter new email',
          'Register Service',
          HttpStatus.CONFLICT,
        ),
      );
    });
  });

  describe('login', async () => {
    const loginDto = { email: 'testing@mail.com', password: 'testing' };
    const user: LoginUserType = {
      id: 'cc6d8',
      username: 'testing',
      password: 'hashed_password',
      role: UserRoles.USER,
    };

    beforeEach(() => {
      UsersServiceMock.findUser.mockResolvedValue(user);
      SessionServiceMock.createSession.mockResolvedValue(true);
      SessionServiceMock.generateAccessToken.mockReturnValue('token');
      SessionServiceMock.generateRefreshToken.mockReturnValue('token');
      vi.spyOn(bcrypt, 'compare').mockImplementation(() =>
        Promise.resolve(true),
      );
    });

    it('Should login successfully', async () => {
      const result = await service.login(user, loginDto, '127.0.0.1', 'Chrome');

      expect(result).toEqual({
        accessToken: 'token',
        refreshToken: 'token',
        userId: user.id,
      });
      expect(SessionServiceMock.generateAccessToken).toHaveBeenCalledTimes(1);
      expect(SessionServiceMock.generateRefreshToken).toHaveBeenCalledTimes(1);
    });

    it('Should throw error for invalid credentials', async () => {
      vi.spyOn(bcrypt, 'compare').mockImplementation(() =>
        Promise.resolve(false),
      );
      const invalidUser = { ...user, password: 'wrong_password' };
      UsersServiceMock.findUser.mockResolvedValue(invalidUser);

      await expect(
        service.login(invalidUser, loginDto, '127.0.0.1', 'Chrome'),
      ).rejects.toThrow(
        new DefaultHttpException(
          'Invalid credentials',
          'Enter valid email or password',
          'Login Service',
          HttpStatus.BAD_REQUEST,
        ),
      );
    });

    it('Should generate access and refresh tokens with correct payload', async () => {
      await service.login(user, loginDto, '127.0.0.1', 'Chrome');

      expect(SessionServiceMock.generateAccessToken).toHaveBeenCalled();
      expect(SessionServiceMock.generateRefreshToken).toHaveBeenCalled();
    });
  });

  describe('logout', async () => {
    it('Should successfully log out when session is found', async () => {
      const sessionId = 'valid-session-id';

      const mockSession = [
        {
          id: sessionId,
          createdAt: '2024-11-12 19:47:18.861399',
          userId: 'user-id',
          deviceInfo: 'Chrome',
          ipAddress: '192.168.5.5',
          expiresAt: '2024-11-12 19:50:18.861399',
        },
      ];

      SessionServiceMock.findSessionById.mockResolvedValue(mockSession);
      SessionServiceMock.deleteSessionById.mockResolvedValue(true);

      const result = await service.logout(sessionId);

      expect(SessionServiceMock.findSessionById).toHaveBeenCalledWith(
        sessionId,
      );
      expect(SessionServiceMock.deleteSessionById).toHaveBeenCalledWith(
        sessionId,
      );

      expect(result).toEqual({ message: 'Logout successful' });
    });

    it('Should throw error when no session is found', async () => {
      const sessionId = 'invalid-session-id';

      SessionServiceMock.findSessionById.mockResolvedValue(undefined);

      await expect(service.logout(sessionId)).rejects.toThrow(
        new DefaultHttpException(
          'Session not found or already logged out',
          'Ensure you are logged in before attempting to log out.',
          'Logout',
          HttpStatus.UNAUTHORIZED,
        ),
      );

      expect(SessionServiceMock.findSessionById).toHaveBeenCalledWith(
        sessionId,
      );
    });
  });

  describe('verification code (email, phone_number, reset_password)', () => {
    it('Call sendEmailVerificationCode with the correct email and userId', async () => {
      const email = 'testing@mail.com';
      const userId = 'cc6d8';

      const sendEmailVerificationCode = vi
        .spyOn(VerificationCodeServiceMock, 'sendEmailVerificationCode')
        .mockResolvedValue(true);
      await service.verifyEmail(userId, email);

      expect(sendEmailVerificationCode).toHaveBeenCalledWith(userId, email);
    });

    it('Call verifyEmailCode with the correct userId and code', async () => {
      const code = '456123';
      const userId = 'cc6d8';
      const verifyEmailCode = vi
        .spyOn(VerificationCodeServiceMock, 'verifyEmailCode')
        .mockResolvedValue(true);
      await service.verifyEmailCode(userId, code);

      expect(verifyEmailCode).toHaveBeenCalledWith(userId, code);
    });

    it('Call sendPhoneVerificationCode with the correct phone number and userId', async () => {
      const phoneNumber = '+21354545454';
      const userId = 'cc6d8';

      const sendPhoneVerificationCodeSpy = vi.spyOn(
        VerificationCodeServiceMock,
        'sendPhoneVerificationCode',
      );

      await service.verifyPhoneNumber(userId, phoneNumber);

      expect(sendPhoneVerificationCodeSpy).toHaveBeenCalledWith(
        userId,
        phoneNumber,
      );
    });

    it('Call verifyPhoneCode with the correct userId and code', async () => {
      const userId = 'cc6d8';
      const code = '123456';

      const verifyPhoneCodeSpy = vi.spyOn(
        VerificationCodeServiceMock,
        'verifyPhoneCode',
      );

      await service.verifyPhoneNumberCode(userId, code);

      expect(verifyPhoneCodeSpy).toHaveBeenCalledWith(userId, code);
    });

    it('Call verifyPhoneCode with the correct userId and code', async () => {
      const userId = 'cc6d8';
      const code = '123456';

      const verifyPhoneCodeSpy = vi.spyOn(
        VerificationCodeServiceMock,
        'verifyPhoneCode',
      );
      await service.verifyPhoneNumberCode(userId, code);

      expect(verifyPhoneCodeSpy).toHaveBeenCalledWith(userId, code);
    });

    it('Call sendPasswordResetCode with the correct email and userId', async () => {
      const userId = 'cc68d';
      const email = 'testing@mail.com';

      const sendPasswordResetCodeSpy = vi.spyOn(
        VerificationCodeServiceMock,
        'sendPasswordResetCode',
      );

      await service.forgotPassword(userId, email);

      expect(sendPasswordResetCodeSpy).toHaveBeenCalledWith(userId, email);
    });

    it('Should verify the password reset code and return the hashed new password', async () => {
      const userId = 'cc6d8';
      const code = '123456';
      const newPassword = 'newPassword123';
      const hashedPassword = 'hashed_new_password';

      const verifyPasswordResetCodeSpy = vi.spyOn(
        VerificationCodeServiceMock,
        'verifyPasswordResetCode',
      );
      const hashSpy = vi
        .spyOn(bcrypt, 'hash')
        .mockResolvedValue(hashedPassword);

      const result = await service.resetPassword(userId, code, newPassword);

      expect(verifyPasswordResetCodeSpy).toHaveBeenCalledWith(userId, code);
      expect(hashSpy).toHaveBeenCalledWith(
        newPassword,
        parseInt(process.env.PASSWORD_SALT || '13'),
      );
      expect(result).toEqual({ hashedPassword });
    });
  });

  describe('refreshToken', () => {
    it('Should call refreshToken on sessionService with the correct arguments', async () => {
      const sessionId = 'session-id';

      const sessionIdSpy = vi.spyOn(SessionServiceMock, 'refreshToken');

      await service.refreshToken(sessionId);
      expect(sessionIdSpy).toHaveBeenCalledWith(sessionId);
    });
  });

  describe('getUserDeviceInfo', () => {
    it('Should return device info and IP address', async () => {
      const req = {
        headers: {
          'user-agent':
            'Mozilla/5.0 (Windows; U; Windows NT 5.1; de-CH) AppleWebKit/523.15 (KHTML, like Gecko, Safari/419.3) Arora/0.2',
        },
        ip: '192.168.1.1',
      } as unknown as Request;

      const result = await service.getUserDeviceInfo(req);

      expect(result).toEqual({
        deviceInfo: 'Arora0.8 - undefined - Windows',
        ipAddress: '192.168.1.1',
      });

      expect(uapMock.setUA).toHaveBeenCalledWith(
        'Mozilla/5.0 (Windows; U; Windows NT 5.1; de-CH) AppleWebKit/523.15 (KHTML, like Gecko, Safari/419.3) Arora/0.2',
      );
      expect(uapMock.getResult).toHaveBeenCalled();
    });

    it('Should return device info and IP address from "x-forwarded-for" header', async () => {
      const req = {
        headers: {
          'user-agent':
            'Mozilla/5.0 (Windows; U; Windows NT 5.1; de-CH) AppleWebKit/523.15 (KHTML, like Gecko, Safari/419.3) Arora/0.2',
          'x-forwarded-for': '192.168.1.40',
        },
      } as unknown as Request;

      const result = await service.getUserDeviceInfo(req);

      expect(result).toEqual({
        deviceInfo: 'Arora0.8 - undefined - Windows',
        ipAddress: '192.168.1.40',
      });

      expect(uapMock.setUA).toHaveBeenCalledWith(
        'Mozilla/5.0 (Windows; U; Windows NT 5.1; de-CH) AppleWebKit/523.15 (KHTML, like Gecko, Safari/419.3) Arora/0.2',
      );
      expect(uapMock.getResult).toHaveBeenCalled();
    });
  });

  describe('getSessions', () => {
    it('Fetch sessions for a user', async () => {
      const userId = 'cc6d8';
      const mockSessions = [
        { id: 'session1', userId, device: 'Chrome' },
        { id: 'session2', userId, device: 'Firefox' },
      ];

      SessionServiceMock.getSessions.mockResolvedValue(mockSessions);

      const result = await service.getSessions(userId);

      expect(result).toEqual(mockSessions);
      expect(SessionServiceMock.getSessions).toHaveBeenCalledWith(userId);
    });

    it('Return an empty array if no sessions are found', async () => {
      const userId = 'cc6d8';
      SessionServiceMock.getSessions.mockResolvedValue([]);

      const result = await service.getSessions(userId);

      expect(result).toEqual([]);
      expect(SessionServiceMock.getSessions).toHaveBeenCalledWith(userId);
    });
  });
});
