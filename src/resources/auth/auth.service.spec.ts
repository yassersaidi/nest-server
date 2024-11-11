import { AuthService } from "./auth.service"
import { Test, TestingModule } from '@nestjs/testing'
import { UsersServiceMock } from "../users/mocks/user.service.mock"
import { SessionServiceMock } from "./sessions/mocks/session.service.mock"
import { VerificationCodeServiceMock } from "./verification-code/mocks/verification-code.service.mock"
import { DefaultHttpException } from "../common/errors/error/custom-error.error"
import { HttpStatus } from "@nestjs/common"
import { UserRoles } from "../common/enums/user-roles.enum"
import { LoginUserType } from "./interfaces/login-user.interface"
import { vi } from "vitest"
import { ConfigService } from "@nestjs/config"
import { SessionService } from "./sessions/session.service"
import { VerificationCodeService } from "./verification-code/verification-code.service"
import { UsersService } from "../users/users.service"
import { JwtService } from "@nestjs/jwt"
import { Request, Response } from "express"

const bcrypt = require('bcryptjs');

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
    sign: vi.fn(() => {
        return "token";
    })
}

const uapMock = {
    setUA: vi.fn().mockReturnThis(),
    getResult: vi.fn().mockReturnValue({
        browser: { name: 'Arora', version: '0.8' },
        device: {},
        os: { name: 'Windows' }
    }),
};


beforeEach(() => vi.clearAllMocks());

describe("Authentication Service", () => {
    let service: AuthService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AuthService,
                { provide: UsersService, useValue: UsersServiceMock },
                { provide: ConfigService, useValue: configServiceMock },
                { provide: JwtService, useValue: jwtServiceMock },
                { provide: SessionService, useValue: SessionServiceMock },
                { provide: VerificationCodeService, useValue: VerificationCodeServiceMock },
                { provide: "UAParser", useValue: uapMock }
            ]
        }).compile();   

        service = module.get<AuthService>(AuthService);

    })

    it('Auth Service Should be defined', () => {
        expect(service).toBeDefined();
    })

    describe("register", () => {
        const user = {
            email: "testing@mail.com",
            password: "testing",
            username: "testing",
            phoneNumber: "+21355555555"
        }
        beforeEach(() => {
            UsersServiceMock.create.mockResolvedValue({
                id: "cc6d8",
                email: user.email,
                username: user.username,
                phoneNumber: user.phoneNumber
            });
        });

        it("Should create a user", async () => {
            const createdUser = await UsersServiceMock.create(user)
            expect(UsersServiceMock.create).toHaveBeenCalledWith(user);
            expect(createdUser).toEqual({
                id: "cc6d8",
                email: user.email,
                username: user.username,
                phoneNumber: user.phoneNumber
            });
        })

        it("Should throw a conflict error if user with email:testing@mail.com is exists", async () => {
            UsersServiceMock.create.mockRejectedValueOnce(new DefaultHttpException(
                `${user.email} already exists`,
                `Enter new email`,
                'Register Service',
                HttpStatus.CONFLICT)
            )

            await expect(UsersServiceMock.create(user)).rejects.toThrow(new DefaultHttpException(
                `${user.email} already exists`,
                'Enter new email',
                'Register Service',
                HttpStatus.CONFLICT
            ));
        })
    })

    describe("login", async () => {
        const loginDto = { email: "testing@mail.com", password: "testing" };
        const user: LoginUserType = {
            id: "cc6d8",
            username: "testing",
            password: "hashed_password",
            role: UserRoles.USER,
        };

        beforeEach(() => {
            UsersServiceMock.findUser.mockResolvedValue(user);
            SessionServiceMock.createSession.mockResolvedValue(true)
            vi.spyOn(bcrypt, 'compare').mockImplementation(() => Promise.resolve(true));
        });


        it("Should login successfully", async () => {
            const result = await service.login(user, loginDto, "127.0.0.1", "Chrome");

            expect(result).toEqual({
                accessToken: "token",
                refreshToken: "token",
                userId: user.id,
            });
            expect(jwtServiceMock.sign).toHaveBeenCalledTimes(2);

        });

        it('Should throw error for invalid credentials', async () => {
            vi.spyOn(bcrypt, 'compare').mockImplementation(() => Promise.resolve(false));
            const invalidUser = { ...user, password: 'wrong_password' };
            UsersServiceMock.findUser.mockResolvedValue(invalidUser);

            await expect(service.login(invalidUser, loginDto, "127.0.0.1", "Chrome"))
                .rejects
                .toThrow(new DefaultHttpException(
                    "Invalid credentials",
                    "Enter valid email or password",
                    "Login Service",
                    HttpStatus.BAD_REQUEST
                ));
        });

        it('Should generate access and refresh tokens with correct payload', async () => {
            const result = await service.login(user, loginDto, "127.0.0.1", "Chrome");

            expect(jwtServiceMock.sign).toHaveBeenCalledWith(
                { userId: user.id, username: user.username, role: user.role },
                expect.objectContaining({
                    secret: "test-secret",
                    expiresIn: "1h",
                })
            );

            expect(jwtServiceMock.sign).toHaveBeenCalledWith(
                { userId: user.id, username: user.username, role: user.role },
                expect.objectContaining({
                    secret: "refresh-secret",
                    expiresIn: "7d",
                })
            );
        });

    })

    describe("logout", async () => {
        it("Should successfully log out when session is found", async () => {
            const refreshToken = "valid-refresh-token";
            const res = { clearCookie: vi.fn() } as unknown as Response;

            const mockSession = [{ id: "session-id", refreshToken }];

            SessionServiceMock.findSessionByRefreshToken.mockResolvedValue(mockSession);
            SessionServiceMock.deleteSessionByRefreshToken.mockResolvedValue(true);

            const result = await service.logout(refreshToken, res);

            expect(SessionServiceMock.findSessionByRefreshToken).toHaveBeenCalledWith(refreshToken);
            expect(SessionServiceMock.deleteSessionByRefreshToken).toHaveBeenCalledWith(refreshToken);

            expect(res.clearCookie).toHaveBeenCalledWith('accessToken', expect.objectContaining({
                httpOnly: true,
                secure: true,
                sameSite: 'lax',
            }));
            expect(res.clearCookie).toHaveBeenCalledWith('refreshToken', expect.objectContaining({
                httpOnly: true,
                secure: true,
                sameSite: 'lax',
            }));

            expect(result).toEqual({ message: 'Logout successful' });
        });

        it("Should throw error when no session is found for the refresh token", async () => {
            const refreshToken = "invalid-refresh-token";
            const res = { clearCookie: vi.fn() } as unknown as Response;

            SessionServiceMock.findSessionByRefreshToken.mockResolvedValue([]);

            await expect(service.logout(refreshToken, res)).rejects.toThrow(new DefaultHttpException(
                "Session not found or already logged out",
                "Ensure you are logged in before attempting to log out.",
                "Logout",
                HttpStatus.UNAUTHORIZED
            ));

            expect(SessionServiceMock.findSessionByRefreshToken).toHaveBeenCalledWith(refreshToken);
        });

    })

    describe("verification code (email, phone_number, reset_password)", () => {
        it("Call sendEmailVerificationCode with the correct email and userId", async () => {
            const email = "testing@mail.com";
            const userId = "cc6d8";

            const sendEmailVerificationCode = vi.spyOn(VerificationCodeServiceMock, "sendEmailVerificationCode").mockResolvedValue(true);
            await service.verifyEmail(userId, email);

            expect(sendEmailVerificationCode).toHaveBeenCalledWith(userId, email);
        });

        it("Call verifyEmailCode with the correct userId and code", async () => {
            const code = "456123";
            const userId = "cc6d8"
            const verifyEmailCode = vi.spyOn(VerificationCodeServiceMock, "verifyEmailCode").mockResolvedValue(true);
            await service.verifyEmailCode(userId, code);

            expect(verifyEmailCode).toHaveBeenCalledWith(userId, code);
        });

        it("Call sendPhoneVerificationCode with the correct phone number and userId", async () => {
            const phoneNumber = "+21354545454";
            const userId = "cc6d8";

            const sendPhoneVerificationCodeSpy = vi.spyOn(VerificationCodeServiceMock, "sendPhoneVerificationCode");

            await service.verifyPhoneNumber(userId, phoneNumber);

            expect(sendPhoneVerificationCodeSpy).toHaveBeenCalledWith(userId, phoneNumber);
        });

        it("Call verifyPhoneCode with the correct userId and code", async () => {
            const userId = "cc6d8";
            const code = "123456";

            const verifyPhoneCodeSpy = vi.spyOn(VerificationCodeServiceMock, "verifyPhoneCode");

            await service.verifyPhoneNumberCode(userId, code);

            expect(verifyPhoneCodeSpy).toHaveBeenCalledWith(userId, code);
        });

        it("Call verifyPhoneCode with the correct userId and code", async () => {
            const userId = "cc6d8";
            const code = "123456";

            const verifyPhoneCodeSpy = vi.spyOn(VerificationCodeServiceMock, "verifyPhoneCode");
            await service.verifyPhoneNumberCode(userId, code);

            expect(verifyPhoneCodeSpy).toHaveBeenCalledWith(userId, code);
        });

        it("Call sendPasswordResetCode with the correct email and userId", async () => {
            const userId = "cc68d"
            const email = "testing@mail.com";

            const sendPasswordResetCodeSpy = vi.spyOn(VerificationCodeServiceMock, "sendPasswordResetCode");

            await service.forgotPassword(userId, email);

            expect(sendPasswordResetCodeSpy).toHaveBeenCalledWith(userId, email);
        });

        it("Should verify the password reset code and return the hashed new password", async () => {
            const userId = "cc6d8";
            const code = "123456";
            const newPassword = "newPassword123";
            const hashedPassword = "hashed_new_password";

            const verifyPasswordResetCodeSpy = vi.spyOn(VerificationCodeServiceMock, "verifyPasswordResetCode");
            const hashSpy = vi.spyOn(bcrypt, "hash").mockResolvedValue(hashedPassword);

            const result = await service.resetPassword(userId, code, newPassword);

            expect(verifyPasswordResetCodeSpy).toHaveBeenCalledWith(userId, code);
            expect(hashSpy).toHaveBeenCalledWith(newPassword, parseInt(process.env.PASSWORD_SALT || '13'));
            expect(result).toEqual({ hashedPassword });
        });


    });

    describe("refreshToken", () => {
        it("Should call refreshToken on sessionService with the correct arguments", async () => {
            const refreshToken = "some_refresh_token";
            const ip = "127.0.0.1";
            const deviceInfo = "Chrome";

            const refreshTokenSpy = vi.spyOn(SessionServiceMock, "refreshToken");

            await service.refreshToken(refreshToken, ip, deviceInfo);
            expect(refreshTokenSpy).toHaveBeenCalledWith(refreshToken, ip, deviceInfo);
        });
    })

    describe("getUserDeviceInfo", () => {
        it('Should return device info and IP address', async () => {
            const req = {
                headers: { 'user-agent': 'Mozilla/5.0 (Windows; U; Windows NT 5.1; de-CH) AppleWebKit/523.15 (KHTML, like Gecko, Safari/419.3) Arora/0.2' },
                ip: '192.168.1.1',
            } as unknown as Request;

            const result = await service.getUserDeviceInfo(req);

            expect(result).toEqual({
                deviceInfo: 'Arora0.8 - undefined - Windows',
                ipAddress: '192.168.1.1',
            });

            expect(uapMock.setUA).toHaveBeenCalledWith('Mozilla/5.0 (Windows; U; Windows NT 5.1; de-CH) AppleWebKit/523.15 (KHTML, like Gecko, Safari/419.3) Arora/0.2');
            expect(uapMock.getResult).toHaveBeenCalled();
        });

        it('Should return device info and IP address from "x-forwarded-for" header', async () => {
            const req = {
                headers: { 
                    'user-agent': 'Mozilla/5.0 (Windows; U; Windows NT 5.1; de-CH) AppleWebKit/523.15 (KHTML, like Gecko, Safari/419.3) Arora/0.2', 
                    'x-forwarded-for':"192.168.1.40"
                }
            } as unknown as Request;

            const result = await service.getUserDeviceInfo(req);

            expect(result).toEqual({
                deviceInfo: 'Arora0.8 - undefined - Windows',
                ipAddress: '192.168.1.40',
            });

            expect(uapMock.setUA).toHaveBeenCalledWith('Mozilla/5.0 (Windows; U; Windows NT 5.1; de-CH) AppleWebKit/523.15 (KHTML, like Gecko, Safari/419.3) Arora/0.2');
            expect(uapMock.getResult).toHaveBeenCalled();
        });
    })

    describe("getSessions", () => {
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
    })
})