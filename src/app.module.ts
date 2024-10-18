import { Module } from '@nestjs/common';
import { UsersModule } from './resources/users/users.module';
import { AuthModule } from './resources/auth/auth.module';
import { DatabaseModule } from './resources/database/database.module';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [ConfigModule.forRoot({
    isGlobal: true
  }),
    UsersModule,
    AuthModule,
    DatabaseModule
  ],
})
export class AppModule { }
