import { TokenInterface } from "./token.interafce";

export enum Network {
  SOL = "Solana",
  TON = "The Open Network",
  ETH = "Ethereum",
  BSC = "Binance Smart Chain",
}

export enum WalletType {
  IMPORTED = "IMPORTED",
  GENERATED = "GENERATED",
}

/**
 * @name WalletInterface
 * @description Wallet interface
 * @param {string} id - id in database
 * @param {string} user_id - User id who owns this wallet
 * @param {WalletType} type - Type
 * @param {Network} network - Network
 * @param {string} address - Address
 * @param {boolean} is_generated - Is generated
 * @param {boolean} is_imported - Is imported
 * @param {number} balance - Balance in native currency
 * @param {number} balance_usd - Balance in USD
 * @param {string} updated_at - Last updated
 * @param {string} created_at - Created at
 */
export class WalletInterface {
  id: string;
  user_id: string;
  type: WalletType;
  network: Network;
  name: string;
  address: string;
  is_generated: boolean;
  is_imported: boolean;
  balance: number;
  balance_usd: number;
  updated_at: string;
  created_at: string;
  can_deleted: boolean;
  private_key?: string;
  tokens?: TokenInterface[];
}
