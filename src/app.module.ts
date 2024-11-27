import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { AuthModule } from './auth/auth.module';
import { DatabaseModule } from './database/database.module';
import { UsersModule } from './users/users.module';
// import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
// import { APP_GUARD } from '@nestjs/core';
import KeyvRedis from '@keyv/redis';
import { CacheModule, CacheStore } from '@nestjs/cache-manager';
import { ServeStaticModule } from '@nestjs/serve-static';
import Keyv from 'keyv';
import { resolve } from 'path';
import { CommonModule } from './common/common.module';
import { ConversationModule } from './conversation/conversation.module';
import { FriendsModule } from './friends/friends.module';
import { MessagesModule } from './messages/messages.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    // ThrottlerModule.forRoot([{
    //   ttl: 60000,
    //   limit: 100,
    // }]),
    ServeStaticModule.forRoot(
      (() => {
        const publicDir = resolve('./static/');
        const servePath = '/static';

        return {
          rootPath: publicDir,
          serveRoot: servePath,
          exclude: ['/api*'],
        };
      })(),
    ),
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
    FriendsModule,
    ConversationModule,
    MessagesModule,
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
