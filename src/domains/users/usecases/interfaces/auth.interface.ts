import { UserModel } from "../../domain/models/user.model";
import { IsNotEmpty, IsString } from "class-validator";
import { WalletModel } from "src/domains/wallets";

export class SignUpParams {
  @IsString({ message: "Telegram id must be a string" })
  @IsNotEmpty({ message: "Telegram id is required" })
  telegram_id: string;

  @IsString({ message: "Username must be a string" })
  @IsNotEmpty({ message: "Username is required" })
  username: string;

  @IsString({ message: "First name must be a string" })
  first_name?: string;

  @IsString({ message: "Last name must be a string" })
  last_name?: string;

  @IsString({ message: "Language code must be a string" })
  @IsNotEmpty({ message: "Language code is required" })
  language_code: string;
}

export class SignUpResult {
  user: UserModel;
  wallets: WalletModel[];
}
