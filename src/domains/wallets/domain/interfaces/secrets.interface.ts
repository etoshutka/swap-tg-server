/**
 * @name SecretsInterface
 * @description Wallet secrets data interface, like public key and etc.
 * @param {string} id - id in database
 * @param {string} wallet_id - Wallet id
 * @param {string} mnemonic - Mnemonic
 * @param {string} private_key - Private key
 * @param {string} public_key - Public key
 */
export class SecretsInterface {
  id: string;
  wallet_id: string;
  mnemonic: string;
  private_key: string;
  public_key: string;
  created_at: string;
}
