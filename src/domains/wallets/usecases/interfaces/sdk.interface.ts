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

export class SwapTokensParams {
  network: Network;
  fromTokenAddress: string | undefined; 
  toTokenAddress: string | undefined; 
  amount: string;
  fromAddress: string;
  fromPrivateKey: string;
  // slippageBps?: number;
}

export class SwapTokensResult {
  type: TransactionType;
  network: Network;
  status: TransactionStatus;
  hash: string;
  fromAmount: number;
  fromAmount_usd: number;
  toAmount: number;
  toAmount_usd: number;
  from: string;
  fromCurrency: string;
  toCurrency: string;
  fee: number;
  fee_usd: number;
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
  id:string;
  address?: string;
  symbol?: string;  
  timeStart?: string;
  timeEnd?: string;
  count?: number;
  interval?: string;
  convert?: string;
}

export interface GetHistoricalQuotesResult {
  id: string;
  name: string;
  quotes: {
    timestamp: string;
    price: number;
  }[];
}
export type Sdk<N> = N extends Network.ETH
  ? ReturnType<typeof TatumEthSDK>
  : N extends Network.BSC
    ? ReturnType<typeof TatumBscSDK>
    : N extends Network.SOL
      ? ReturnType<typeof TatumSolanaSDK>
      : Api<unknown>;

export type SdkNetwork = "ETH" | "BSC" | "MATIC" | "CELO" | "ONE" | "KLAY" | "SOL" | "KCS" | "ALGO" | "XDC" | "EGLD" | "FLR" | "CRO" | "BASE" | "AVAX" | "FTM" | "OPTIMISM";
