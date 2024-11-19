import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as db_schema from './schema';

export const DrizzleAsyncProvider = 'DrizzleAsyncProvider';
@Global()
@Module({
  providers: [
    {
      provide: DrizzleAsyncProvider,
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => {
        const connectionString = configService.get<string>('DATABASE_URL');
        const pool = new Pool({
          connectionString,
        });

        return drizzle(pool, { schema: db_schema }) as NodePgDatabase<
          typeof db_schema
        >;
      },
    },
  ],
  exports: [DrizzleAsyncProvider],
})
export class DatabaseModule {}
