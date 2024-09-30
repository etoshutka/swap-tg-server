import { Connection, Transaction, VersionedTransaction, Keypair } from '@solana/web3.js';
import fetch from 'cross-fetch';
import { Wallet } from '@project-serum/anchor';
import bs58 from 'bs58';




const SOL_MINT = "So11111111111111111111111111111111111111112";

export async function jupiterSwap(
  connection: Connection,
  wallet: Wallet,
  fromTokenAddress: string,
  toTokenAddress: string,
  amount: number,
  slippageBps: number
): Promise<string> {
  const inputMint = fromTokenAddress || SOL_MINT;
  const outputMint = toTokenAddress || SOL_MINT;

  // Use 1e9 for SOL, 1e6 for all other tokens
  const decimals = inputMint === SOL_MINT ? 1e9 : 1e6;
  const inputAmount = Math.floor(amount * decimals);

  console.log(`Using decimals: ${decimals}, Input amount: ${inputAmount}`);

  // Step 1: Get quote
  const quoteResponse = await (
    await fetch(`https://quote-api.jup.ag/v6/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${inputAmount}&slippageBps=${slippageBps}`)
  ).json();

  console.log('Quote:', quoteResponse);

  // Step 2: Get swap transaction
  const { swapTransaction } = await (
    await fetch('https://quote-api.jup.ag/v6/swap', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        quoteResponse,
        userPublicKey: wallet.publicKey.toString(),
        wrapUnwrapSol: true
      })
    })
  ).json();

  // Step 3: Deserialize and sign the transaction
  const swapTransactionBuf = Buffer.from(swapTransaction, 'base64');
  var transaction = Transaction.from(swapTransactionBuf);
  transaction.sign(wallet.payer);

  // Step 4: Execute the transaction
  const txid = await connection.sendRawTransaction(transaction.serialize(), {
    skipPreflight: true,
    maxRetries: 3
  });

  // Step 5: Confirm the transaction
  const latestBlockHash = await connection.getLatestBlockhash();
  await connection.confirmTransaction({
    blockhash: latestBlockHash.blockhash,
    lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
    signature: txid
  }, 'confirmed');

  console.log(`Swap transaction completed. Transaction ID: ${txid}`);
  return txid;
}


export function createSolanaKeypair(privateKey: string): Keypair {
    let secretKey: Uint8Array;
  
    // Проверяем, является ли privateKey строкой в формате base58
    if (/^[1-9A-HJ-NP-Za-km-z]{87,88}$/.test(privateKey)) {
      // Если да, декодируем его из base58
      secretKey = bs58.decode(privateKey);
    } else {
      // Если нет, пробуем интерпретировать его как hex строку
      try {
        secretKey = Buffer.from(privateKey, 'hex');
      } catch (error) {
        throw new Error(`Invalid private key format: ${error.message}`);
      }
    }
  
    // Проверяем длину секретного ключа
    if (secretKey.length !== 64) {
      throw new Error(`Invalid secret key length. Expected 64 bytes, got ${secretKey.length}`);
    }
  
    try {
      return Keypair.fromSecretKey(secretKey);
    } catch (error) {
      throw new Error(`Failed to create Keypair: ${error.message}`);
    }
  }