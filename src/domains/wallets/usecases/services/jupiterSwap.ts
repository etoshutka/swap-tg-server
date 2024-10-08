import { Connection, Transaction, VersionedTransaction, Keypair, PublicKey } from '@solana/web3.js';
import fetch from 'cross-fetch';
import { Wallet } from '@project-serum/anchor';
import bs58 from 'bs58';

const USDT = "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB";

export async function jupiterSwap(
  connection: Connection,
  wallet: Wallet,
  inputMint: string,
  outputMint: string,
  amount: number,
  slippageBps: number,
  tatumApiKey: string
): Promise<{ txid: string; status: 'success' | 'error'; message: string }> {
  try {
    console.log("jupiterSwap called with params:", { inputMint, outputMint, amount, slippageBps });

    const multiplier = inputMint === USDT ? 10**6 : 10**9;
    const adjustedAmount = Math.floor(amount * multiplier);
    console.log("Adjusted amount:", adjustedAmount);

    console.log("Fetching quote...");
    const quoteResponse = await (
      await fetch(`https://quote-api.jup.ag/v6/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${adjustedAmount}&slippageBps=${slippageBps}`)
    ).json();  
    console.log("quoteResponse", quoteResponse);

    const { swapTransaction } = await (
      await fetch('https://quote-api.jup.ag/v6/swap', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          quoteResponse,
          userPublicKey: wallet.publicKey.toString(),
          wrapAndUnwrapSol: true,
          dynamicComputeUnitLimit: true,
          prioritizationFeeLamports: 'auto',
          dynamicSlippage: { "maxBps": slippageBps },
        })
      })
    ).json();

    console.log("swapTransaction", swapTransaction);

    const swapTransactionBuf = Buffer.from(swapTransaction, 'base64');
    var transaction = VersionedTransaction.deserialize(swapTransactionBuf);

    transaction.sign([wallet.payer]);

    const latestBlockHash = await connection.getLatestBlockhash();

    const rawTransaction = transaction.serialize()
    
    const txid = await connection.sendRawTransaction(rawTransaction, {
      skipPreflight: true,
      maxRetries: 2
    });

    // Подтверждение транзакции с использованием API Tatum
    const confirmationResponse = await confirmTransactionTatum(txid, tatumApiKey);

    if (confirmationResponse.failed) {
      console.error('Transaction failed:', confirmationResponse.reason);
      return { txid, status: 'error', message: `Transaction failed: ${confirmationResponse.reason}` };
    }

    console.log({ txid, status: 'success', message: 'Swap completed and confirmed successfully' });
    return { txid, status: 'success', message: 'Swap completed and confirmed successfully' };
  } catch (error) {
    console.log(error);
    return { txid: '', status: 'error', message: `Swap failed: ${error.message}` };
  }
}

async function confirmTransactionTatum(txid: string, apiKey: string): Promise<any> {
const options = {
  method: 'POST',
  headers: {
    accept: 'application/json',
    'content-type': 'application/json',
    'x-api-key': apiKey
  },
  body: JSON.stringify({ txHash: txid })
};

try {
  const response = await fetch('https://api.tatum.io/v3/solana/broadcast/confirm', options);
  const result = await response.json();
  console.log('Tatum confirmation response:', result);
  return result;
} catch (error) {
  console.error('Error confirming transaction with Tatum:', error);
  throw error;
}
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