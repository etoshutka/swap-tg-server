import { WalletsController } from "./infrastructure/controllers/wallets.controller";
import { ScheduleService } from "./usecases/services/schedule.service";
import { TransactionModel } from "./domain/models/transaction.model";
import { WalletsService } from "./usecases/services/wallets.service";
import { SdkService } from "./usecases/services/sdk.service";
import { SecretsModel } from "./domain/models/secrets.model";
import { CmcService } from "./usecases/services/cmc.service";
import { WalletModel } from "./domain/models/wallet.model";
import { TokenModel } from "./domain/models/token.model";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ConfigModule } from "@nestjs/config";
import { Module, forwardRef } from "@nestjs/common";
import { UsersModule } from "../users/users.module";

@Module({
  imports: [ConfigModule, TypeOrmModule.forFeature([WalletModel, TokenModel, SecretsModel, TransactionModel]), forwardRef(()=>UsersModule)],
  providers: [WalletsService, SdkService, CmcService, ScheduleService],
  controllers: [WalletsController],
  exports: [WalletsService],
})
export class WalletsModule {}
