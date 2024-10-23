import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import db_source from '@/config/database';

@Module({
    imports:[
        ConfigModule.forRoot({
            load:[db_source]
        }),
        TypeOrmModule.forRootAsync({
            imports:[ConfigModule],
            useFactory: (configService: ConfigService) => configService.get("db_source"),
            inject: [ConfigService]
        })
    ]
})
export class DatabaseModule {}
