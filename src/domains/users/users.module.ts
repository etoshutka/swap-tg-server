import { UsersController } from "./infrastructure/controllers/users.controller";
import { AuthController } from "./infrastructure/controllers/auth.controller";
import { UsersService } from "./usecases/services/users.service";
import { AuthService } from "./usecases/services/auth.service";
import { ReferralModule } from "../referral/referral.module";
import { WalletsModule } from "../wallets/wallets.module";
import { UserModel } from "./domain/models/user.model";
import { TypeOrmModule } from "@nestjs/typeorm";
import { forwardRef, Module } from "@nestjs/common";

@Module({
  imports: [TypeOrmModule.forFeature([UserModel]), WalletsModule, forwardRef(() => ReferralModule)],
  providers: [UsersService, AuthService],
  controllers: [UsersController, AuthController],
  exports: [UsersService, AuthService],
})
export class UsersModule {}
