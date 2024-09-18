import { PostgresModule } from "./postgres/postgres.module";
import { Module } from "@nestjs/common";

/**
 * @description Compose database module
 */
@Module({
  imports: [PostgresModule],
})
export class DatabaseModule {}
