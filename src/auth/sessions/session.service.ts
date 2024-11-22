import { UserRoles } from '@/common/enums/user-roles.enum';
import { DefaultHttpException } from '@/common/errors/error/custom-error.error';
import { DrizzleAsyncProvider } from '@/database/database.module';
import * as db_schema from '@/database/schema';
import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { and, eq, gt, lt } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { AuthedUserReqType } from '../interfaces/authed-user.interface';

@Injectable()
export class SessionService {
  private readonly logger = new Logger(SessionService.name);

  constructor(
    @Inject(DrizzleAsyncProvider) private db: NodePgDatabase<typeof db_schema>,
    private readonly tokenService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async createSession(userId: string, ip: string, deviceInfo: string) {
    this.logger.log(
      `Creating session for user: ${userId}, IP: ${ip}, Device: ${deviceInfo}`,
    );
    let sessionId: string;
    try {
      await this.db.transaction(async (tx) => {
        const [session] = await tx
          .insert(db_schema.Session)
          .values({
            userId,
            expiresAt: new Date(
              Date.now() +
                parseInt(
                  this.configService.get('REFRESH_TOKEN_COOKIE_MAX_AGE'),
                ) *
                  1000,
            ),
            ipAddress: ip,
            deviceInfo,
          })
          .returning({ sessionId: db_schema.Session.id });
        sessionId = session.sessionId;
        await tx
          .delete(db_schema.Session)
          .where(lt(db_schema.Session.expiresAt, new Date()));
      });

      this.logger.log(
        `Session created for user: ${userId} with id: ${sessionId}`,
      );
      return sessionId;
    } catch (error) {
      this.logger.error(
        `Error creating session for user: ${userId}, Error: ${error.message}`,
      );
      throw new DefaultHttpException(
        error,
        '',
        'Sessions Service',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async findSessionById(sessionId: string) {
    this.logger.log(`Searching for session with id: ${sessionId}`);
    try {
      const [session] = await this.db
        .select()
        .from(db_schema.Session)
        .where(
          and(
            eq(db_schema.Session.id, sessionId),
            gt(db_schema.Session.expiresAt, new Date()),
          ),
        )
        .limit(1);
      return session;
    } catch (error) {
      this.logger.error(
        `Error finding session for id: ${sessionId}, Error: ${error.message}`,
      );
      throw new DefaultHttpException(
        'Error finding session',
        '',
        'Sessions Service',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async deleteSessionById(sessionId: string) {
    this.logger.log(`Deleting session : ${sessionId}`);

    try {
      await this.db.transaction(async (tx) => {
        const [session] = await tx
          .select()
          .from(db_schema.Session)
          .where(eq(db_schema.Session.id, sessionId))
          .limit(1);
        if (!session) {
          this.logger.warn(`Session with ${sessionId} not found`);
          throw new DefaultHttpException('', '', '');
        }

        await tx
          .delete(db_schema.Session)
          .where(eq(db_schema.Session.id, sessionId));
      });

      this.logger.log(`Session with id:${sessionId} deleted successfully`);
    } catch (error) {
      this.logger.error(
        `Error deleting session with id:${sessionId}: ${error.message}`,
      );
      if (error instanceof DefaultHttpException) {
        throw new DefaultHttpException(
          'Session not found or already logged out',
          'Ensure you are logged in before attempting to log out.',
          'Session Service',
          HttpStatus.UNAUTHORIZED,
        );
      }
      throw new DefaultHttpException(
        'Failed to delete session',
        'Please try again later',
        'Session Service',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async deleteExpiredSessions() {
    this.logger.log('Deleting expired sessions');
    try {
      await this.db
        .delete(db_schema.Session)
        .where(lt(db_schema.Session.expiresAt, new Date()));
      this.logger.log('Expired sessions deleted');
    } catch (error) {
      this.logger.error(`Error deleting expired sessions: ${error.message}`);
      throw new DefaultHttpException(
        'Error deleting expired sessions',
        'Ensure you are logged in before attempting to log out.',
        'Session Service',
        HttpStatus.UNAUTHORIZED,
      );
    }
  }

  async refreshToken(sessionId: string) {
    this.logger.log(`Started session refresh process`);

    try {
      return await this.db.transaction(async (tx) => {
        const [session] = await tx
          .select({
            userId: db_schema.Session.userId,
            role: db_schema.User.role,
            username: db_schema.User.username,
            ipAddress: db_schema.Session.ipAddress,
            deviceInfo: db_schema.Session.deviceInfo,
          })
          .from(db_schema.Session)
          .where(eq(db_schema.Session.id, sessionId))
          .fullJoin(
            db_schema.User,
            eq(db_schema.Session.userId, db_schema.User.id),
          );
        if (!session) {
          this.logger.warn(`Session not found`);
          throw new DefaultHttpException('', '', '');
        }

        await tx
          .delete(db_schema.Session)
          .where(eq(db_schema.Session.id, sessionId));

        const newSessionId = await this.createSession(
          session.userId,
          session.ipAddress,
          session.deviceInfo,
        );

        const newAccessToken = this.generateAccessToken({
          userId: session.userId,
          role: session.role as UserRoles,
          username: session.username,
          sessionId: newSessionId,
        });

        const newRefreshToken = this.generateRefreshToken(newSessionId);
        this.logger.log(
          `Successfully refreshed tokens for user: ${session.userId}`,
        );

        return {
          accessToken: newAccessToken,
          newRefreshToken,
          userId: session.userId,
        };
      });
    } catch (error) {
      this.logger.error(` Error: ${error.message}`);
      if (error instanceof DefaultHttpException) {
        throw new DefaultHttpException(
          'Session not found or already logged out',
          '',
          'Session Service',
          HttpStatus.UNAUTHORIZED,
        );
      }
      throw new DefaultHttpException(
        'Failed to refresh token',
        'Please try logging in again',
        'Session Service',
        HttpStatus.UNAUTHORIZED,
      );
    }
  }

  async getSessions(userId: string) {
    this.logger.log(`Fetching sessions for user: ${userId}`);
    try {
      const sessions = await this.db
        .select({
          expiresAt: db_schema.Session.expiresAt,
          userId: db_schema.Session.userId,
          email: db_schema.User.email,
        })
        .from(db_schema.Session)
        .where(eq(db_schema.Session.userId, userId))
        .fullJoin(
          db_schema.User,
          eq(db_schema.Session.userId, db_schema.User.id),
        );

      this.logger.log(`Sessions fetched for user: ${userId}`);
      return sessions;
    } catch (error) {
      this.logger.error(
        `Error fetching sessions for user: ${userId}, Error: ${error.message}`,
      );
      throw new DefaultHttpException(
        'Failed to fetch sessions',
        'Please try again later',
        'Session Service',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  generateRefreshToken(sessionId: string) {
    return this.tokenService.sign(
      { sessionId },
      {
        secret: this.configService.get('JWT_REFRESH_TOKEN_SECRET'),
        expiresIn: this.configService.get('JWT_REFRESH_TOKEN_EXPIRES_IN'),
      },
    );
  }

  generateAccessToken(payload: AuthedUserReqType) {
    return this.tokenService.sign(payload, {
      secret: this.configService.get('JWT_SECRET'),
      expiresIn: this.configService.get('JWT_EXPIRES_IN'),
    });
  }
}
