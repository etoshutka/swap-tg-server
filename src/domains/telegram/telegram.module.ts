import { TelegramService } from "./usecases/services/telegram.service";
import { ReferralModule } from "../referral/referral.module";
import { UsersModule } from "../users/users.module";
import { Module } from "@nestjs/common";

@Module({
  imports: [UsersModule, ReferralModule],
  providers: [TelegramService],
  controllers: [],
  exports: [],
})
export class TelegramModule {}
