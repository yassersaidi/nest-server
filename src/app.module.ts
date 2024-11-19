import { Module } from '@nestjs/common';
import { UsersModule } from './resources/users/users.module';
import { AuthModule } from './resources/auth/auth.module';
import { DatabaseModule } from './resources/database/database.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { CommonModule } from './resources/common/common.module';
import { CacheModule, CacheStore } from '@nestjs/cache-manager';
import Keyv from 'keyv';
import KeyvRedis from '@keyv/redis';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    // ThrottlerModule.forRoot([{
    //   ttl: 60000,
    //   limit: 100,
    // }]),
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', process.env.UPLOADS_DIR + '/profile'),
      serveRoot: '/uploads/profile/',
    }),
    CommonModule,
    UsersModule,
    AuthModule,
    DatabaseModule,
    CacheModule.registerAsync({
      isGlobal: true,
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => {
        const redisUri = configService.get<string>('REDIS_URI');
        const store = new Keyv({
          store: new KeyvRedis(redisUri),
          ttl: 20000,
        });
        return {
          store: store as unknown as CacheStore,
        };
      },
    }),
    JwtModule,
  ],
  // TODO: Enable it after testing
  // providers: [
  //   {
  //     provide: APP_GUARD,
  //     useClass: ThrottlerGuard
  //   }
  // ]
})
export class AppModule {}
