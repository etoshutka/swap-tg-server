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
    platformFeeBps: number,
  ): Promise<{ txid: string; status: 'success' | 'error'; message: string }> {
    try {
      console.log("jupiterSwap called with params:", { inputMint, outputMint, amount, slippageBps });

      const feeRecipientPublicKey = new PublicKey("28yJZ3zGxvPtUcc6ZmhNCgUZZVYad8mWMbGjxoAoe4hA");
      const multiplier = inputMint === USDT ? 10**6 : 10**9;
      const adjustedAmount = Math.floor(amount * multiplier);
      console.log("Adjusted amount:", adjustedAmount);

  
      console.log("Fetching quote...");
      const quoteResponse = await (
        await fetch(`https://quote-api.jup.ag/v6/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${adjustedAmount}&slippageBps=${slippageBps}&platformFeeBps=${platformFeeBps}`)
      ).json();  
      console.log("quoteRespone", quoteResponse)
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
            feeAccount: '28yJZ3zGxvPtUcc6ZmhNCgUZZVYad8mWMbGjxoAoe4hA',
          })
        })
      ).json();

      console.log("swapTransaction", swapTransaction)
  
     
  
      const swapTransactionBuf = Buffer.from(swapTransaction, 'base64');
      var transaction = VersionedTransaction.deserialize(swapTransactionBuf);
  
      transaction.sign([wallet.payer]);
     
  
      const latestBlockHash = await connection.getLatestBlockhash();
  
    
      const rawTransaction = transaction.serialize()
      
      const txid = await connection.sendRawTransaction(rawTransaction, {
        skipPreflight: true,
        maxRetries: 5
      });
  
    
      // const confirmation = await connection.confirmTransaction({
      //   blockhash: latestBlockHash.blockhash,
      //   lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
      //   signature: txid
      // }, 'confirmed');
  
      // if (confirmation.value.err) {
      //   console.error('Transaction failed:', confirmation.value.err);
      //   return { txid, status: 'error', message: `Transaction failed: ${confirmation.value.err}` };
      // }
  
      console.log({ txid, status: 'success', message: 'Swap completed successfully' })
      return { txid, status: 'success', message: 'Swap completed successfully' };
    } catch (error) {
      console.log(error)
      return { txid: '', status: 'error', message: `Swap failed: ${error.message}` };
    }
  }

export function createSolanaKeypair(privateKey: string): Keypair {
    let secretKey: Uint8Array;

    if (/^[1-9A-HJ-NP-Za-km-z]{87,88}$/.test(privateKey)) {
          secretKey = bs58.decode(privateKey);
    } else {
      try {
        secretKey = Buffer.from(privateKey, 'hex');
      } catch (error) {
        throw new Error(`Invalid private key format: ${error.message}`);
      }
    }
    if (secretKey.length !== 64) {
      throw new Error(`Invalid secret key length. Expected 64 bytes, got ${secretKey.length}`);
    }
  
    try {
      return Keypair.fromSecretKey(secretKey);
    } catch (error) {
      throw new Error(`Failed to create Keypair: ${error.message}`);
    }
  }