import { ReferralController } from "./infrastructure/controllers/referral.controller";
import { ReferralService } from "./usecases/services/referral.service";
import { RefConfigModel } from "./domain/models/ref-config.model";
import { ReferralModel } from "./domain/models/referral.model";
import { UsersModule } from "../users/users.module";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Module } from "@nestjs/common";

@Module({
  imports: [TypeOrmModule.forFeature([ReferralModel, RefConfigModel]), UsersModule],
  providers: [ReferralService],
  controllers: [ReferralController],
  exports: [ReferralService],
})
export class ReferralModule {}
