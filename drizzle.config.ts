
import { defineConfig } from 'drizzle-kit';
import { ConfigService } from '@nestjs/config';

const configService = new ConfigService();

export default defineConfig({
  schema: './src/database/schema.ts',
  out: './drizzle/database/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    host: configService.get('POSTGRES_HOST'),
    port: configService.get('POSTGRES_PORT'),
    user: configService.get('POSTGRES_USER'),
    password: configService.get('POSTGRES_PASSWORD'),
    database: configService.get('POSTGRES_DB'),
    ssl: false
  },
})