import { Connection, Transaction, VersionedTransaction, Keypair, PublicKey } from '@solana/web3.js';
import fetch from 'cross-fetch';
import { Wallet } from '@project-serum/anchor';
import bs58 from 'bs58';

const SOL_MINT = "So11111111111111111111111111111111111111112";

export async function jupiterSwap(
    connection: Connection,
    wallet: Wallet,
    inputMint: string,
    outputMint: string,
    amount: number,
    slippageBps: number
  ): Promise<{ txid: string; status: 'success' | 'error'; message: string }> {
    try {
      const multiplier = inputMint === SOL_MINT ? 10**9 : 10**9;
      const adjustedAmount = Math.floor(amount * multiplier);
  
     
      const quoteResponse = await (
        await fetch(`https://quote-api.jup.ag/v6/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${adjustedAmount}&slippageBps=${slippageBps}`)
      ).json();  
      
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
            // dynamicSlippage: { "maxBps": 300 },
          })
        })
      ).json();
  
     
  
      const swapTransactionBuf = Buffer.from(swapTransaction, 'base64');
      var transaction = VersionedTransaction.deserialize(swapTransactionBuf);
  
      transaction.sign([wallet.payer]);
     
  
      const latestBlockHash = await connection.getLatestBlockhash();
  
    
      const rawTransaction = transaction.serialize()
      
      const txid = await connection.sendRawTransaction(rawTransaction, {
        skipPreflight: true,
        maxRetries: 5
      });
  
    
    //   const confirmation = await connection.confirmTransaction({
    //     blockhash: latestBlockHash.blockhash,
    //     lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
    //     signature: txid
    //   }, 'confirmed');
  
    //   if (confirmation.value.err) {
    //     console.error('Transaction failed:', confirmation.value.err);
    //     return { txid, status: 'error', message: `Transaction failed: ${confirmation.value.err}` };
    //   }
  
      
      return { txid, status: 'success', message: 'Swap completed successfully' };
    } catch (error) {
      
      return { txid: '', status: 'error', message: `Swap failed: ${error.message}` };
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