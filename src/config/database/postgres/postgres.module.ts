import { ConfigModule, ConfigService } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Module } from "@nestjs/common";

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: "postgres",
        url: configService.get("DB_PG_URL"),
        port: configService.get("DB_PG_PORT"),
        host: configService.get("DB_PG_HOST"),
        database: configService.get("DB_PG_DATABASE"),
        username: configService.get("DB_PG_USERNAME"),
        password: configService.get("DB_PG_PASSWORD"),
        autoLoadEntities: true,
        synchronize: Boolean(configService.get("DB_PG_SYNCHRONIZE")),
      }),
      inject: [ConfigService],
    }),
  ],
})
export class PostgresModule {}
