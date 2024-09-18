import { Network } from "./wallet.interface";

/**
 * @name TokenInterface
 * @description Wallet token interface
 * @param {string} id - id in database
 * @param {string} wallet_id - Wallet id
 * @param {string} symbol - Symbol
 * @param {Network} network - Network
 * @param {string} name - Name
 * @param {string} contract - Contract address
 * @param {number} balance - Balance in token currency
 * @param {number} balance_usd - Balance in USD
 * @param {number} price - Price
 * @param {number} price_change - Price change
 * @param {number} price_change_percentage - Price change percentage
 * @param {string} icon - Icon
 * @param {string} added_at - Added at wallet
 * @param {string} updated_at - Last updated
 */
export class TokenInterface {
  id: string;
  wallet_id: string;
  symbol: string;
  network: Network;
  name: string;
  contract: string;
  balance: number;
  balance_usd: number;
  price: number;
  price_change_percentage: number;
  icon: string;
  added_at: string;
  updated_at: string;
}
