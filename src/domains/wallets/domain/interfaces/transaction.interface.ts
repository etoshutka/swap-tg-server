import { Network } from "./wallet.interface";

export enum TransactionType {
  SWAP = "SWAP",
  DEPOSIT = "DEPOSIT",
  TRANSFER = "TRANSFER",
}

export enum TransactionStatus {
  FAILED = "FAILED",
  PENDING = "PENDING",
  SUCCESS = "SUCCESS",
}

/**
 * @name TransactionInterface
 * @description Wallet transaction interface
 */
export class TransactionInterface {
  id: string;
  wallet_id: string;
  type: TransactionType;
  network: Network;
  hash: string;
  status: TransactionStatus;
  amount: number;
  amount_usd: number;
  to: string;
  from: string;
  currency: string;
  fee: number;
  fee_usd: number;
  updated_at: string;
  created_at: string;
}
