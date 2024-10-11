import { ServiceMethodResponseDto } from "src/common/dto/service-method-response.dto";
import { Network, WalletsService } from "src/domains/wallets";
import { UserModel } from "../../domain/models/user.model";
import { HttpStatus, Injectable } from "@nestjs/common";
import { ReferralService } from "src/domains/referral";
import * as types from "../interfaces/auth.interface";
import { UsersService } from "./users.service";

@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UsersService,
    private readonly walletsService: WalletsService,
    private readonly referralService: ReferralService,
  ) {}

  async validateUser(telegramData: types.TelegramUserData): Promise<ServiceMethodResponseDto<types.ValidateUserResult>> {
    let user = await this.userService.findOne({ telegram_id: telegramData.id });
    let isNewUser = false;

    if (!user) {
      isNewUser = true;
      user = await this.createUser(telegramData);
    } else {
      // Update user info if needed
      await this.userService.updateOne({ 
        id: user.id, 
        username: telegramData.username,
        first_name: telegramData.first_name,
        last_name: telegramData.last_name,
        language_code: telegramData.language_code
      });
      user = await this.userService.findOne({ id: user.id });
    }

    if (!user) {
      return new ServiceMethodResponseDto({
        ok: false,
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: "Failed to create or update user",
      });
    }

    return new ServiceMethodResponseDto({
      ok: true,
      status: HttpStatus.OK,
      data: { user, isNewUser },
    });
  }

  private async createUser(telegramData: types.TelegramUserData): Promise<UserModel | null> {
    const createdUser = await this.userService.create({
      telegram_id: telegramData.id,
      username: telegramData.username,
      first_name: telegramData.first_name,
      last_name: telegramData.last_name,
      language_code: telegramData.language_code,
    });

    if (!createdUser) {
      return null;
    }

    const createdWallets = await this.walletsService.generateWallets({
      user_id: createdUser.id,
      networks: [Network.ETH, Network.SOL, Network.TON, Network.BSC],
    });

    if (!createdWallets.ok) {
      await this.userService.deleteOne(createdUser.id);
      return null;
    }

    //await this.referralService.initReferralUserProgram({ telegram_id: createdUser.telegram_id });

    return createdUser;
  }

  async getAuthResult(telegramData: types.TelegramUserData): Promise<ServiceMethodResponseDto<types.AuthResult>> {
    const validateResult = await this.validateUser(telegramData);

    if (!validateResult.ok) {
      return new ServiceMethodResponseDto({
        ok: false,
        status: validateResult.status,
        message: validateResult.message,
      });
    }

    const { user, isNewUser } = validateResult.data;
    

    const walletsResult = await this.walletsService.getWallets({ user_id: user.id });

    if (!walletsResult.ok) {
      return new ServiceMethodResponseDto({
        ok: false,
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: "Failed to retrieve user wallets",
      });
    }

    await this.referralService.initReferralUserProgram({ telegram_id: user.telegram_id });


    return new ServiceMethodResponseDto({
      ok: true,
      status: HttpStatus.OK,
      data: {
        user,
        wallets: walletsResult.data,
        isNewUser,
      },
    });
  }
}