import { TimeoutInterceptor } from "@/resources/common/interceptors/timeout.interceptor";
import { AppModule } from "../src/app.module";
import { HttpStatus, INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from "@nestjs/testing";
import request from 'supertest';
import cookieParser from "cookie-parser";
import { CreateUserDto } from "@/resources/users/dto/create-user.dto";
import { authResponseErrors } from "./api/auth/errors";
import { loginDto } from "@/resources/auth/dto/login.dto";
import { afterAll, expect } from "vitest";
import { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as db_schema from '@/resources/database/schema';
import { and, eq, gt } from "drizzle-orm";
import { DrizzleAsyncProvider } from "@/resources/database/database.module";

describe('AppController (e2e)', () => {
    let app: INestApplication;
    let httpServer: any;
    let drizzleDb: NodePgDatabase<typeof db_schema>;

    const registerUserDto: CreateUserDto = {
        email: "testing2@email.com",
        username: "test2026",
        password: "testing2024@",
        phoneNumber: "+213345777711"
    }

    const loginUserDto: loginDto = {
        email: "testing2@email.com",
        password: "testing2024@",
    }

    let loggedInUserId = ""

    let accessToken = ""
    let refreshToken = ""

    let codes = {
        email: "",
        phoneNumber: "",
        password_reset: ""
    }

    let cookies: string[] = []

    beforeAll(async () => {
        const moduleRef: TestingModule = await Test.createTestingModule({
            imports: [AppModule]
        }).compile();

        app = moduleRef.createNestApplication();
        app.setGlobalPrefix('api/v1');
        app.use(cookieParser());
        app.useGlobalPipes(
            new ValidationPipe({
                whitelist: true,
                transform: true,
                transformOptions: {
                    enableImplicitConversion: true
                }
            }),
        );
        app.useGlobalInterceptors(new TimeoutInterceptor(10000));

        drizzleDb = moduleRef.get<NodePgDatabase<typeof db_schema>>(DrizzleAsyncProvider);

        await app.init();

        httpServer = app.getHttpServer();
    });

    afterAll(async () => {
        await drizzleDb.delete(db_schema.User).where(eq(db_schema.User.email, registerUserDto.email))
        await app.close();
    });

    describe("Auth Route", () => {
        describe("POST /auth/register", () => {
            it("Should return 400 BAD_REQUEST with multiple validation errors", async () => {
                return request(httpServer)
                    .post("/api/v1/auth/register")
                    .expect(HttpStatus.BAD_REQUEST)
                    .then(({ body }) => {
                        const expectedResponse = authResponseErrors.register.multipleErrors;
                        expect(body).toHaveProperty("message", expectedResponse.message);
                        expect(body).toHaveProperty("url", expectedResponse.url);
                    });
            });

            it("Should return 400 BAD_REQUEST with specific validation errors for missing email", async () => {
                const registerDto: CreateUserDto = {
                    email: "",
                    username: "test2024",
                    password: "testing2024@",
                    phoneNumber: "+2135345677710"
                };
                return request(httpServer)
                    .post("/api/v1/auth/register")
                    .send(registerDto)
                    .expect(HttpStatus.BAD_REQUEST)
                    .then(({ body }) => {
                        const expectedResponse = authResponseErrors.register.missingEmail;
                        expect(body).toHaveProperty("message", expectedResponse.message);
                        expect(body).toHaveProperty("url", expectedResponse.url);
                    });
            });

            it("Should return 400 BAD_REQUEST with validation error for short username", async () => {
                const registerDto: CreateUserDto = {
                    email: "test@example.com",
                    username: "test",
                    password: "testing2024@",
                    phoneNumber: "+2135345677710"
                };
                return request(httpServer)
                    .post("/api/v1/auth/register")
                    .send(registerDto)
                    .expect(HttpStatus.BAD_REQUEST)
                    .then(({ body }) => {
                        const expectedResponse = authResponseErrors.register.shortUsername;
                        expect(body).toHaveProperty("message", expectedResponse.message);
                        expect(body).toHaveProperty("url", expectedResponse.url);
                    });
            });

            it("Should return 400 BAD_REQUEST with validation error for short password", async () => {
                const registerDto: CreateUserDto = {
                    email: "test@example.com",
                    username: "testuser",
                    password: "short",
                    phoneNumber: "+2135345677710"
                };
                return request(httpServer)
                    .post("/api/v1/auth/register")
                    .send(registerDto)
                    .expect(HttpStatus.BAD_REQUEST)
                    .then(({ body }) => {
                        const expectedResponse = authResponseErrors.register.shortPassword;
                        expect(body).toHaveProperty("message", expectedResponse.message);
                        expect(body).toHaveProperty("url", expectedResponse.url);
                    });
            });

            it("Should return 400 BAD_REQUEST with validation error for invalid phone number format", async () => {
                const registerDto: CreateUserDto = {
                    email: "test@example.com",
                    username: "testuser",
                    password: "testing2024@",
                    phoneNumber: "1234"
                };
                return request(httpServer)
                    .post("/api/v1/auth/register")
                    .send(registerDto)
                    .expect(HttpStatus.BAD_REQUEST)
                    .then(({ body }) => {
                        const expectedResponse = authResponseErrors.register.invalidPhoneNumber;
                        expect(body).toHaveProperty("message", expectedResponse.message);
                        expect(body).toHaveProperty("url", expectedResponse.url);
                    });
            });

            it("Should create a user successfully and return {id, email, phoneNumber, username} with 200 OK status", async () => {
                return request(httpServer)
                    .post("/api/v1/auth/register")
                    .send(registerUserDto)
                    .expect(HttpStatus.OK)
                    .then(({ body }) => {
                        expect(body).toHaveProperty("email", registerUserDto.email);
                        expect(body).toHaveProperty("username", registerUserDto.username);
                        expect(body).toHaveProperty("phoneNumber", registerUserDto.phoneNumber);
                    });
            })

            it("Should return 409 Conflict with message of testing2@email.com already exist", async () => {
                const registerDto: CreateUserDto = {
                    email: "testing2@email.com",
                    username: "test2026",
                    password: "testing2024@",
                    phoneNumber: "+213345777711"
                }
                return request(httpServer)
                    .post("/api/v1/auth/register")
                    .send(registerDto)
                    .expect(HttpStatus.CONFLICT)
                    .then(({ body }) => {
                        expect(body).toHaveProperty("message", "testing2@email.com already exists");
                        expect(body).toHaveProperty("errorSource", "Register Service");
                        expect(body).toHaveProperty("url", "/api/v1/auth/register");
                    });
            })

            it("Should return 409 Conflict with message of +213345777711 already exist", async () => {
                const registerDto: CreateUserDto = {
                    email: "testing3@email.com",
                    username: "test2026",
                    password: "testing2024@",
                    phoneNumber: "+213345777711"
                }
                return request(httpServer)
                    .post("/api/v1/auth/register")
                    .send(registerDto)
                    .expect(HttpStatus.CONFLICT)
                    .then(({ body }) => {
                        expect(body).toHaveProperty("message", "+213345777711 already exists");
                        expect(body).toHaveProperty("errorSource", "Register Service");
                        expect(body).toHaveProperty("url", "/api/v1/auth/register");
                    });
            })

            it("Should return 409 Conflict with message of test2026 already exist", async () => {
                const registerDto: CreateUserDto = {
                    email: "testing3@email.com",
                    username: "test2026",
                    password: "testing2024@",
                    phoneNumber: "+213345777712"
                }
                return request(httpServer)
                    .post("/api/v1/auth/register")
                    .send(registerDto)
                    .expect(HttpStatus.CONFLICT)
                    .then(({ body }) => {
                        expect(body).toHaveProperty("message", "test2026 already exists");
                        expect(body).toHaveProperty("resolution", "Enter new username");
                        expect(body).toHaveProperty("url", "/api/v1/auth/register");
                    });
            })
        });

        describe("POST /auth/login", () => {
            it("Should return 400 BAD_REQUEST with multiple validation errors", async () => {
                const loginDto = {} as loginDto
                return request(httpServer)
                    .post("/api/v1/auth/login")
                    .send(loginDto)
                    .expect(HttpStatus.BAD_REQUEST)
                    .then(({ body }) => {
                        const expectedResponse = authResponseErrors.login.multipleErrors;
                        expect(body).toHaveProperty("message", expectedResponse.message);
                        expect(body).toHaveProperty("url", expectedResponse.url);
                    });
            });

            it("Should return 400 BAD_REQUEST with email validations errors", async () => {
                const loginDto = { email: "email", password: "hello123" } as loginDto
                return request(httpServer)
                    .post("/api/v1/auth/login")
                    .send(loginDto)
                    .expect(HttpStatus.BAD_REQUEST)
                    .then(({ body }) => {
                        const expectedResponse = authResponseErrors.login.emailNotAnEmail;
                        expect(body).toHaveProperty("message", expectedResponse.message);
                        expect(body).toHaveProperty("url", expectedResponse.url);
                    });
            });

            it("Should return 400 BAD_REQUEST with password validations errors", async () => {
                const loginDto = { email: "testing3@email.com" } as loginDto
                return request(httpServer)
                    .post("/api/v1/auth/login")
                    .send(loginDto)
                    .expect(HttpStatus.BAD_REQUEST)
                    .then(({ body }) => {
                        const expectedResponse = authResponseErrors.login.passwordNotFound;
                        expect(body).toHaveProperty("message", expectedResponse.message);
                        expect(body).toHaveProperty("url", expectedResponse.url);
                    });
            });

            it("Should return 400 BAD_REQUEST with message of User with email: testing3@email.com not found.", async () => {
                const loginDto: loginDto = {
                    email: "testing3@email.com",
                    password: "testing2024@",
                }
                return request(httpServer)
                    .post("/api/v1/auth/login")
                    .send(loginDto)
                    .expect(HttpStatus.BAD_REQUEST)
                    .then(({ body }) => {
                        expect(body).toHaveProperty("message", "User with email: testing3@email.com not found.");
                        expect(body).toHaveProperty("resolution", "Check your information or create an account");
                        expect(body).toHaveProperty("url", "/api/v1/auth/login");
                    });
            })

            it("Should return 400 BAD_REQUEST with message of Invalid credentials", async () => {
                const loginDto: loginDto = {
                    email: "testing2@email.com",
                    password: "testing2025@", // correct password is: "testing2024@"
                }
                return request(httpServer)
                    .post("/api/v1/auth/login")
                    .send(loginDto)
                    .expect(HttpStatus.BAD_REQUEST)
                    .then(({ body }) => {
                        expect(body).toHaveProperty("message", "Invalid credentials");
                        expect(body).toHaveProperty("resolution", "Enter valid email or password");
                        expect(body).toHaveProperty("url", "/api/v1/auth/login");
                    });
            })

            it("Should successful login the user and returns message Login successful with 201 CREATED status", async () => {
                const response = await request(httpServer)
                    .post("/api/v1/auth/login")
                    .send(loginUserDto)
                    .expect(HttpStatus.CREATED);

                cookies = response.headers['set-cookie'] as unknown as string[];

                const accessTokenCookie = cookies.find(cookie => cookie.startsWith('accessToken='));
                const refreshTokenCookie = cookies.find(cookie => cookie.startsWith('refreshToken='));

                expect(accessTokenCookie).toBeDefined();
                expect(refreshTokenCookie).toBeDefined();

                expect(accessTokenCookie).toContain('HttpOnly');
                expect(accessTokenCookie).toContain('Secure');
                expect(accessTokenCookie).toContain('SameSite=Lax');
                expect(accessTokenCookie).toContain(`Max-Age=${process.env.ACCESS_TOKEN_COOKIE_MAX_AGE}`);

                expect(refreshTokenCookie).toContain('HttpOnly');
                expect(refreshTokenCookie).toContain('Secure');
                expect(refreshTokenCookie).toContain('SameSite=Lax');
                expect(refreshTokenCookie).toContain(`Max-Age=${process.env.REFRESH_TOKEN_COOKIE_MAX_AGE}`);

                expect(response.body).toHaveProperty("message", "Login successful");
                expect(response.body).toHaveProperty("userId");

                accessToken = response.body.accessToken
            })
        })

        describe("Get /auth/me", () => {
            it("Should return 401 Unauthorized with message Your access token is missing", async () => {
                return request(httpServer)
                    .get("/api/v1/auth/me")
                    .expect(HttpStatus.UNAUTHORIZED)
                    .then(({ body }) => {
                        expect(body).toHaveProperty("message", "Your access token is missing");
                        expect(body).toHaveProperty("url", "/api/v1/auth/me");
                        expect(body).toHaveProperty("from", "Auth Guard");
                    });
            });

            it("Should return 401 Unauthorized with message Your access token is missing(without Bearer key missing)", async () => {
                return request(httpServer)
                    .get("/api/v1/auth/me")
                    .set('Authorization', accessToken)
                    .expect(HttpStatus.UNAUTHORIZED)
                    .then(({ body }) => {
                        expect(body).toHaveProperty("message", "Your access token is missing");
                        expect(body).toHaveProperty("url", "/api/v1/auth/me");
                        expect(body).toHaveProperty("from", "Auth Guard");
                    });
            });

            it("Should return 401 Unauthorized with message Your access token is expired", async () => {
                return request(httpServer)
                    .get("/api/v1/auth/me")
                    .set('Authorization', "Bearer invalid_access_token")
                    .expect(HttpStatus.UNAUTHORIZED)
                    .then(({ body }) => {
                        expect(body).toHaveProperty("message", "Your access token is expired");
                        expect(body).toHaveProperty("url", "/api/v1/auth/me");
                        expect(body).toHaveProperty("from", "Auth Guard");
                    });
            });

            it(`Should return the authed user with the email ${loginUserDto.email}`, async () => {
                return request(httpServer)
                    .get("/api/v1/auth/me")
                    .set('Authorization', `Bearer ${accessToken}`)
                    .expect(HttpStatus.OK)
                    .then(({ body }) => {
                        expect(body).toHaveProperty("email", loginUserDto.email);
                        loggedInUserId = body.id
                    });
            });
        })

        describe("Post /auth/verify-email", () => {
            it("Should return 400 BAD_REQUEST with message of Invalid email", async () => {
                return request(httpServer)
                    .post("/api/v1/auth/verify-email")
                    .set('Authorization', `Bearer ${accessToken}`)
                    .expect(HttpStatus.BAD_REQUEST)
                    .then(({ body }) => {
                        const verifyEmail = authResponseErrors.verifyEmail.invalidEmail
                        expect(body).toHaveProperty("message", verifyEmail.message);
                        expect(body).toHaveProperty("url", verifyEmail.url);
                    });
            })

            it("Should return 400 BAD_REQUEST with message User with email: testing@email.com not found.", async () => {
                return request(httpServer)
                    .post("/api/v1/auth/verify-email")
                    .set('Authorization', `Bearer ${accessToken}`)
                    .send({ email: "testing@gmail.com" })
                    .expect(HttpStatus.BAD_REQUEST)
                    .then(({ body }) => {
                        expect(body).toHaveProperty("message", "User with email: testing@gmail.com not found.");
                        expect(body).toHaveProperty("errorSource", "Users Service");
                        expect(body).toHaveProperty("url", "/api/v1/auth/verify-email");
                    });
            })

            it("Should successful send code and returns message Verification code sent! with 200 OK", async () => {
                await request(httpServer)
                    .post("/api/v1/auth/verify-email")
                    .set('Authorization', `Bearer ${accessToken}`)
                    .send({ email: loginUserDto.email })
                    .expect(HttpStatus.OK)
                    .then(({ body }) => {
                        expect(body).toHaveProperty("message", "Verification code sent!");
                        expect(body).toHaveProperty("userId", loggedInUserId);
                    });
                const codeRecord = await drizzleDb
                    .select()
                    .from(db_schema.VerificationCode)
                    .where(and(
                        eq(db_schema.VerificationCode.userId, loggedInUserId),
                        eq(db_schema.VerificationCode.type, "email"),
                        gt(db_schema.VerificationCode.expiresAt, new Date())
                    )).limit(1)

                expect(codeRecord.length).to.equal(1)
                codes = { ...codes, email: codeRecord[0].code }
            })

            it("Should return 400 BAD_REQUEST with message verification code has already been sent.", async () => {
                return request(httpServer)
                    .post("/api/v1/auth/verify-email")
                    .set('Authorization', `Bearer ${accessToken}`)
                    .send({ email: loginUserDto.email })
                    .expect(HttpStatus.BAD_REQUEST)
                    .then(({ body }) => {
                        expect(body).toHaveProperty("message", "A verification code has already been sent.");
                        expect(body).toHaveProperty("errorSource", "Email Verification Service");
                    });
            })
        })

        describe("Post /auth/verify-email-code", () => {
            it("Should return 400 BAD_REQUEST with message multiple errors", async () => {
                return request(httpServer)
                    .post("/api/v1/auth/verify-email-code")
                    .set('Authorization', `Bearer ${accessToken}`)
                    .expect(HttpStatus.BAD_REQUEST)
                    .then(({ body }) => {
                        const verifyEmail = authResponseErrors.verifyEmailCode.multipleErrors
                        expect(body).toHaveProperty("message", verifyEmail.message);
                        expect(body).toHaveProperty("url", verifyEmail.url);
                    });
            })


            it("Should return 400 BAD_REQUEST with code validation error", async () => {
                return request(httpServer)
                    .post("/api/v1/auth/verify-email-code")
                    .send({ email: loginUserDto.email, code: "454545d" })
                    .set('Authorization', `Bearer ${accessToken}`)
                    .expect(HttpStatus.BAD_REQUEST)
                    .then(({ body }) => {
                        expect(body).toHaveProperty("message", ["code must be shorter than or equal to 6 characters"]);
                        expect(body).toHaveProperty("url", "/api/v1/auth/verify-email-code");
                    });
            })

            it("Should return 400 BAD_REQUEST with message User with email: testing@email.com not found.", async () => {
                return request(httpServer)
                    .post("/api/v1/auth/verify-email-code")
                    .send({ email: "testing@gmail.com", code: "454545" })
                    .set('Authorization', `Bearer ${accessToken}`)
                    .expect(HttpStatus.BAD_REQUEST)
                    .then(({ body }) => {
                        expect(body).toHaveProperty("message", "User with email: testing@gmail.com not found.");
                        expect(body).toHaveProperty("errorSource", "Users Service");
                        expect(body).toHaveProperty("url", "/api/v1/auth/verify-email-code");
                    });
            })

            it("Should return 400 BAD_REQUEST with message Invalid or expired code.", async () => {
                return request(httpServer)
                    .post("/api/v1/auth/verify-email-code")
                    .send({ email: loginUserDto.email, code: "454545" })
                    .set('Authorization', `Bearer ${accessToken}`)
                    .expect(HttpStatus.BAD_REQUEST)
                    .then(({ body }) => {
                        expect(body).toHaveProperty("message", "Invalid or expired code.");
                        expect(body).toHaveProperty("resolution", "Please request a new email code.");
                        expect(body).toHaveProperty("errorSource", "email Verification Service");
                    });
            })

            it("Should successful verify user email and returns message User email successfully verified! with 200 OK", async () => {
                await request(httpServer)
                    .post("/api/v1/auth/verify-email-code")
                    .send({ email: loginUserDto.email, code: codes.email })
                    .set('Authorization', `Bearer ${accessToken}`)
                    .expect(HttpStatus.OK)
                    .then(({ body }) => {
                        expect(body).toHaveProperty("message", "User email successfully verified!");
                        expect(body).toHaveProperty("userId", loggedInUserId);
                    });
                const codeRecord = await drizzleDb
                    .select()
                    .from(db_schema.VerificationCode)
                    .where(and(
                        eq(db_schema.VerificationCode.userId, loggedInUserId),
                        eq(db_schema.VerificationCode.type, "email"),
                        gt(db_schema.VerificationCode.expiresAt, new Date())
                    )).limit(1)

                expect(codeRecord.length).to.equal(0)
            })

            it("Should return 200 OK with message User email already verified!", async () => {
                return request(httpServer)
                    .post("/api/v1/auth/verify-email-code")
                    .send({ email: loginUserDto.email, code: "454545" })
                    .set('Authorization', `Bearer ${accessToken}`)
                    .expect(HttpStatus.OK)
                    .then(({ body }) => {
                        expect(body).toHaveProperty("message", "User email already verified!");
                        expect(body).toHaveProperty("userId", loggedInUserId);
                    });
            })
        })

    });
});
