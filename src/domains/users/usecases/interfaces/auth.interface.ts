import { UserModel } from "../../domain/models/user.model";
import { WalletModel } from "src/domains/wallets";

export interface TelegramUserData {
  id: string;
  username: string;
  first_name?: string;
  last_name?: string;
  language_code: string;
}

export interface AuthResult {
  user: UserModel;
  wallets: WalletModel[];
  isNewUser: boolean;
}

export interface ValidateUserResult {
  user: UserModel;
  isNewUser: boolean;
}