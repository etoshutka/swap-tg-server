import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { config } from 'dotenv';

config();

const configService = new ConfigService();

export default new DataSource({
  type: 'postgres',
  url: configService.get('DB_PG_URL'),
  host: configService.get('DB_PG_HOST'),
  port: configService.get('DB_PG_PORT'),
  username: configService.get('DB_PG_USERNAME'),
  password: configService.get('DB_PG_PASSWORD'),
  database: configService.get('DB_PG_DATABASE'),
  entities: ['src/**/*.model.ts'],
  migrations: ['src/migrations/*.ts'],
});