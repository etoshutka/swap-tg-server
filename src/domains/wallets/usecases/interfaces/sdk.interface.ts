import { TransactionStatus, TransactionType } from "../../domain/interfaces/transaction.interface";
import { Network } from "../../domain/interfaces/wallet.interface";
import { TatumSolanaSDK } from "@tatumio/solana";
import { TatumEthSDK } from "@tatumio/eth";
import { TatumBscSDK } from "@tatumio/bsc";
import { Api } from "@ton-api/client";

export class GenerateWalletParams {
  network: Network;
}

export class GenerateWalletResult {
  address: string;
  mnemonic?: string;
  public_key?: string;
  private_key?: string;
}

export class GetImportedWalletParams {
  network: Network;
  private_key: string;
}

export class GetImportedWalletResult {
  address: string;
  mnemonic?: string;
  public_key?: string;
  private_key?: string;
}

export class GetWalletBalanceParams {
  network: Network;
  address: string;
}

export class GetWalletBalanceResult {
  balance: number;
  balance_usd: number;
}

export class GetWalletTokenBalanceParams {
  network: Network;
  address: string;
  contract: string;
}

export class GetWalletTokenBalanceResult {
  balance: number;
  balance_usd: number;
  price: number;
  price_change_percentage: number;
}

export class GetTokenInfoParams {
  network: Network;
  address?: string;
  symbol?: string;
}

export class GetTokenInfoResult {
  icon: string;
  name: string;
  symbol: string;
}

export class GetTokenPriceParams {
  address?: string;
  symbol?: string;
}

export class GetTokenPriceResult {
  price: number;
  price_change_percentage: number;
}

export class TransferNativeWalletTokenTransactionParams {
  network: Network;
  amount: string;
  to_address: string;
  from_address: string;
  from_private_key: string;
}

export class TransferNativeWalletTokenTransactionResult {
  type: TransactionType;
  network: Network;
  hash: string;
  status?: TransactionStatus;
  amount: number;
  amount_usd: number;
  to: string;
  from: string;
  currency: string;
  fee: number;
  fee_usd: number;
}

export class TransferWalletTokenTransactionParams {
  network: Network;
  amount: string;
  currency: string;
  to_address: string;
  from_address: string;
  from_private_key: string;
  token_contract_address: string;
}

export class TransferWalletTokenTransactionResult {
  type: TransactionType;
  network: Network;
  hash: string;
  status?: TransactionStatus;
  amount: number;
  amount_usd: number;
  to: string;
  from: string;
  currency: string;
  fee: number;
  fee_usd: number;
}

export type Sdk<N> = N extends Network.ETH
  ? ReturnType<typeof TatumEthSDK>
  : N extends Network.BSC
    ? ReturnType<typeof TatumBscSDK>
    : N extends Network.SOL
      ? ReturnType<typeof TatumSolanaSDK>
      : Api<unknown>;

export type SdkNetwork = "ETH" | "BSC" | "MATIC" | "CELO" | "ONE" | "KLAY" | "SOL" | "KCS" | "ALGO" | "XDC" | "EGLD" | "FLR" | "CRO" | "BASE" | "AVAX" | "FTM" | "OPTIMISM";
