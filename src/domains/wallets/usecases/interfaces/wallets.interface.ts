import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID } from "class-validator";
import { Network } from "../../domain/interfaces/wallet.interface";
import { WalletModel } from "../../domain/models/wallet.model";

export class GetWalletParams {
  @IsUUID("4", { message: "Invalid wallet id" })
  @IsNotEmpty({ message: "Wallet id is required" })
  id: string;
}

export class GetWalletsParams {
  @IsUUID("4", { message: "Invalid user id" })
  @IsNotEmpty({ message: "User id is required" })
  user_id: string;
}

export class DeleteWalletParams {
  @IsUUID("4", { message: "Invalid wallet id" })
  @IsNotEmpty({ message: "Wallet id is required" })
  id: string;
}

export class GetTokenInfoParams {
  @IsNotEmpty({ message: "Network is required" })
  network: Network;

  @IsNotEmpty({ message: "Contract address is required" })
  contract: string;
}

export class GetTokenPriceParams {
  @IsNotEmpty({ message: "Network is required" })
  network: Network;

  @IsString({ message: "Symbol must be a string" })
  @IsOptional()
  symbol: string;

  @IsString({ message: "Contract must be a string" })
  @IsOptional()
  contract: string;
}

export class GetTokenInfoResult {
  symbol: string;
  network: Network;
  name: string;
  contract: string;
  price: number;
  price_change_percentage: number;
  icon: string;
}

export class GetTokenPriceResult {
  price: number;
  price_change_percentage: number;
}

export class ImportWalletParams {
  user_id: string;

  @IsString({ message: "Name must be a string" })
  @IsNotEmpty({ message: "Name is required" })
  name: string;

  @IsEnum(Network, { message: "Invalid network" })
  @IsNotEmpty({ message: "Network is required" })
  network: Network;

  @IsNotEmpty({ message: "Private key is required" })
  @IsString({ message: "Private key must be a string" })
  private_key: string;
}

export class GenerateWalletParams {
  name?: string;
  user_id: string;
  network: Network;
  can_deleted?: boolean;
}

export class GenerateWalletsParams {
  user_id: string;
  networks: Network[];
}

export class AddWalletTokenParams {
  wallet_id: string;
  wallet_address: string;
  network: Network;
  contract?: string;
  symbol?: string;
}

export class AddNativeWalletTokenParams {
  wallet_id: string;
  wallet_address: string;
  network: Network;
}

export class UpdateWalletBalancesParams {
  wallet: WalletModel;
}

export interface GetTokenExtendedInfoResult {
  id: number;
  name: string;
  symbol: string;
  total_supply: number | null;
  max_supply: number | null;
  market_cap: number;
  price: number;
  percent_change_24h: number;
  percent_change_7d: number;
  percent_change_30d: number;
}

export interface GetHistoricalQuotesParams {
  id?: string;
  symbol?: string;
  address?: string;
  timeStart?: string;
  timeEnd?: string;
  count?: number;
  interval?: string;
  convert?: string;
}

export interface GetHistoricalQuotesResult {
  id: string;
  symbol: string;
  name: string;
  quotes: {
    timestamp: string;
    price: number;
  }[];
}



export class TransferTransactionParams {
  @IsNumber({ maxDecimalPlaces: 9 }, { message: "Amount must be a number" })
  @IsNotEmpty({ message: "Amount is required" })
  amount: number;

  @IsString({ message: "Currency must be a string" })
  @IsNotEmpty({ message: "Currency is required" })
  currency: string;

  @IsUUID("4", { message: "Invalid wallet id" })
  @IsNotEmpty({ message: "To address is required" })
  token_id: string;

  @IsUUID("4", { message: "Invalid wallet id" })
  @IsNotEmpty({ message: "Wallet id is required" })
  wallet_id: string;

  @IsString({ message: "To address must be a string" })
  @IsNotEmpty({ message: "To address is required" })
  to_address: string;
}

export class GetWalletTransactionsParams {
  @IsUUID("4", { message: "Invalid wallet id" })
  @IsNotEmpty({ message: "Wallet id is required" })
  id: string;
}

export class SwapTokensParams {
  @IsUUID("4", { message: "Invalid wallet id" })
  @IsNotEmpty({ message: "Wallet id is required" })
  wallet_id: string;

  @IsUUID("4", { message: "Invalid from token id" })
  @IsNotEmpty({ message: "From token id is required" })
  from_token_id: string;

  @IsUUID("4", { message: "Invalid to token id" })
  @IsNotEmpty({ message: "To token id is required" })
  to_token_id: string;

  @IsNumber({ maxDecimalPlaces: 9 }, { message: "Amount must be a number" })
  @IsNotEmpty({ message: "Amount is required" })
  amount: number;
}
