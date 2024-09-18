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

  /**
   * Sign up user
   * @desc Create new user, wallets and check ref link
   * @param {Partial<UserModel>} params
   * @returns {Promise<UserModel | boolean>}
   */
  async signUp(params: types.SignUpParams): Promise<ServiceMethodResponseDto<types.SignUpResult>> {
    const isUserExist: boolean = await this.userService.isUserExist({ telegram_id: params.telegram_id });

    // Check if user exist
    if (isUserExist) {
      return new ServiceMethodResponseDto({ ok: false, status: HttpStatus.CONFLICT, data: null, message: "User already exist" });
    }

    // Create user
    const createdUser: UserModel = await this.userService.create({ ...params });

    // Generate wallets
    const createdWallets = await this.walletsService.generateWallets({
      user_id: createdUser.id,
      networks: [Network.ETH, Network.SOL, Network.TON, Network.BSC],
    });

    // Check if process failed
    if (!createdUser || !createdWallets.ok) {
      await this.userService.deleteOne(createdUser.id);
      return new ServiceMethodResponseDto({ ok: false, status: HttpStatus.NOT_FOUND, data: null, message: "Error creating user: " + createdWallets.message });
    }

    // Init user referral program
    await this.referralService.initReferralUserProgram({ telegram_id: createdUser.telegram_id });

    return new ServiceMethodResponseDto({
      ok: true,
      status: HttpStatus.OK,
      data: {
        user: createdUser,
        wallets: createdWallets.data,
      },
    });
  }
}
