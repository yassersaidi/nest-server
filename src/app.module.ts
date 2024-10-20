import { Module } from '@nestjs/common';
import { UsersModule } from './resources/users/users.module';
import { AuthModule } from './resources/auth/auth.module';
import { DatabaseModule } from './resources/database/database.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';

@Module({
  imports: [ConfigModule.forRoot({
    isGlobal: true
  }),
    UsersModule,
    AuthModule,
    DatabaseModule,
  JwtModule.registerAsync({
    inject: [ConfigService],
    useFactory: async (configService: ConfigService) => ({}),
  }),
  
  ],
})
export class AppModule { }
