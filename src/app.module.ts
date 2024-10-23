import { Module } from '@nestjs/common';
import { UsersModule } from './resources/users/users.module';
import { AuthModule } from './resources/auth/auth.module';
import { DatabaseModule } from './resources/database/database.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';

@Module({
  imports: [ConfigModule.forRoot({
    isGlobal: true
  }),
  ThrottlerModule.forRoot([{
    ttl: 60000,
    limit: 10,
  }]),
  ServeStaticModule.forRoot({
    rootPath: join(__dirname, '..', process.env.PROFILE_PICTURE_DIR),
    serveRoot:'/uploads/profile/'
  }),
    UsersModule,
    AuthModule,
    DatabaseModule,
  JwtModule.registerAsync({
    inject: [ConfigService],
    useFactory: async (configService: ConfigService) => ({}),
  }),

  ],
  providers: [{
    provide: APP_GUARD,
    useClass: ThrottlerGuard
  }]
})
export class AppModule { }
