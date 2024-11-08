import { Injectable, Inject, HttpStatus, Logger, InternalServerErrorException } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as db_schema from '@/resources/database/schema';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { DrizzleAsyncProvider } from '@/resources/database/database.module';
import { DefaultHttpException } from '@/resources/common/errors/error/custom-error.error';
import { and, eq, gt, lt } from 'drizzle-orm';

@Injectable()
export class SessionService {
    private readonly logger = new Logger(SessionService.name);

    constructor(
        @Inject(DrizzleAsyncProvider) private db: NodePgDatabase<typeof db_schema>,
        private readonly tokenService: JwtService,
        private readonly configService: ConfigService,
    ) { }

    async createSession(userId: string, refreshToken: string, ip: string, deviceInfo: string) {
        this.logger.log(`Creating session for user: ${userId}, IP: ${ip}, Device: ${deviceInfo}`);

        try {
            await this.db.insert(db_schema.Session).values({
                userId,
                refreshToken,
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                ipAddress: ip,
                deviceInfo,
            });

            await this.db.delete(db_schema.Session).where(lt(db_schema.Session.expiresAt, new Date()));
            this.logger.log(`Session created for user: ${userId} with refresh token: ${refreshToken}`);
        } catch (error) {
            this.logger.error(`Error creating session for user: ${userId}, Error: ${error.message}`);
            throw new InternalServerErrorException()
        }
    }

    async findSessionByRefreshToken(refreshToken: string) {
        this.logger.log(`Searching for session with refresh token: ${refreshToken}`);
        try {
            const session = await this.db
                .select()
                .from(db_schema.Session)
                .where(and(
                    eq(db_schema.Session.refreshToken, refreshToken),
                    gt(db_schema.Session.expiresAt, new Date())
                ))
                .limit(1);
            return session;
        } catch (error) {
            this.logger.error(`Error finding session for refresh token: ${refreshToken}, Error: ${error.message}`);
            throw new InternalServerErrorException()
        }
    }

    async deleteSessionByRefreshToken(refreshToken: string) {
        this.logger.log(`Deleting session for refresh token: ${refreshToken}`);

        try {
            const session = await this.db.select().from(db_schema.Session)
                .where(eq(db_schema.Session.refreshToken, refreshToken)).limit(1);

            if (session.length === 0) {
                this.logger.warn(`Session not found for refresh token: ${refreshToken}`);
                throw new DefaultHttpException(
                    "Session not found or already logged out",
                    "Ensure you are logged in before attempting to log out.",
                    "Session Service",
                    HttpStatus.UNAUTHORIZED,
                );
            }

            await this.db.delete(db_schema.Session).where(eq(db_schema.Session.refreshToken, refreshToken));
            this.logger.log(`Session deleted for refresh token: ${refreshToken}`);
        } catch (error) {
            this.logger.error(`Error deleting session for refresh token: ${refreshToken}, Error: ${error.message}`);
            throw new InternalServerErrorException()
        }
    }

    async deleteExpiredSessions() {
        this.logger.log('Deleting expired sessions');
        try {
            await this.db.delete(db_schema.Session).where(lt(db_schema.Session.expiresAt, new Date()));
            this.logger.log('Expired sessions deleted');
        } catch (error) {
            this.logger.error(`Error deleting expired sessions: ${error.message}`);
            throw new InternalServerErrorException()
        }
    }

    async refreshToken(refreshToken: string, ip: string, deviceInfo: string) {
        this.logger.log(`Refreshing token for refresh token: ${refreshToken}, IP: ${ip}, Device: ${deviceInfo}`);

        try {
            const session = await this.db.select().from(db_schema.Session).where(eq(db_schema.Session.refreshToken, refreshToken)).limit(1);

            if (session.length === 0) {
                this.logger.warn(`Invalid refresh token: ${refreshToken}`);
                throw new DefaultHttpException(
                    "Invalid refresh token",
                    "Please login again",
                    "Session Service",
                    HttpStatus.UNAUTHORIZED,
                );
            }

            const { userId, username, role } = await this.tokenService.verifyAsync(
                refreshToken,
                { secret: this.configService.get('JWT_REFRESH_TOKEN_SECRET') },
            );

            await this.db.delete(db_schema.Session).where(eq(db_schema.Session.refreshToken, refreshToken));

            const newRefreshToken = this.tokenService.sign(
                { userId, username, role },
                {
                    secret: this.configService.get('JWT_REFRESH_TOKEN_SECRET'),
                    expiresIn: this.configService.get('JWT_REFRESH_TOKEN_EXPIRES_IN'),
                }
            );

            const newAccessToken = this.tokenService.sign(
                { userId, username, role },
                {
                    secret: this.configService.get('JWT_SECRET'),
                    expiresIn: this.configService.get('JWT_EXPIRES_IN')
                },
            );

            await this.createSession(userId, newRefreshToken, ip, deviceInfo);

            this.logger.log(`New refresh token and access token generated for user: ${userId}`);
            return { accessToken: newAccessToken, newRefreshToken, userId };
        } catch (error) {
            this.logger.error(`Error refreshing token for refresh token: ${refreshToken}, Error: ${error.message}`);
            throw new DefaultHttpException(
                "Your refresh token is expired",
                "Sign in again or refresh your token",
                "Session Service",
                HttpStatus.UNAUTHORIZED
            );
        }
    }

    async getSessions(userId: string) {
        this.logger.log(`Fetching sessions for user: ${userId}`);
        try {
            const sessions = await this.db.select({
                refreshToken: db_schema.Session.refreshToken,
                expiresAt: db_schema.Session.expiresAt,
                userId: db_schema.Session.userId,
                email: db_schema.User.email,
            })
                .from(db_schema.Session)
                .where(eq(db_schema.Session.userId, userId))
                .fullJoin(db_schema.User, eq(db_schema.Session.userId, db_schema.User.id));

            this.logger.log(`Sessions fetched for user: ${userId}`);
            return sessions;
        } catch (error) {
            this.logger.error(`Error fetching sessions for user: ${userId}, Error: ${error.message}`);
            throw new InternalServerErrorException()
        }
    }
}
