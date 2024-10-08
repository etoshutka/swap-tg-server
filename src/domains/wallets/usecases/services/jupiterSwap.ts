import { Connection, Transaction, VersionedTransaction, Keypair, PublicKey } from '@solana/web3.js';
import fetch from 'cross-fetch';
import { Wallet } from '@project-serum/anchor';
import bs58 from 'bs58';

const USDT = "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB";
const SOL = "So11111111111111111111111111111111111111112";


export async function jupiterSwap(
    connection: Connection,
    fromPrivateKey: string,
    inputMint: string,
    outputMint: string,
    amount: number,
    slippageBps: number,
    platformFeeBps: number,
  ): Promise<{ txid: string; status: 'success' | 'error'; message: string }> {
    try {
      console.log("jupiterSwap called with params:", { inputMint, outputMint, amount, slippageBps });

      // let keypair;
      // try {
      //   keypair = createSolanaKeypair(fromPrivateKey);
      
      // } catch (error) {
     
      //   throw new Error(`Failed to create Solana Keypair: ${error.message}`);
      // }

      console.log("Creating Solana wallet");

      //const wallet = new Wallet(keypair);
      const wallet = new Wallet(Keypair.fromSecretKey(bs58.decode(fromPrivateKey)));




      // Define the referral account public key (obtained from the referral dashboard)
      const referralAccountPublicKey = new PublicKey("CXEfB9wmGqyLayo1Byg5WX7MyBqadxK6qStJkopC8YQw");

      
      const inputMintPublicKey = inputMint === SOL ? 
      new PublicKey(SOL) : outputMint === SOL ? 
      new PublicKey(SOL) : new PublicKey(USDT); // vremeno


      const [feeAccount] = await PublicKey.findProgramAddressSync(
        [
          Buffer.from("referral_ata"),
          referralAccountPublicKey.toBuffer(),
          inputMintPublicKey.toBuffer(),
        ],
        new PublicKey("REFER4ZgmyYx9c6He5XfaTMiGfdLwRnkV4RPp9t9iF3")
      );

      const multiplier = inputMint === USDT ? 10**6 : 10**9;
      const adjustedAmount = Math.floor(amount * multiplier);
      console.log("Adjusted amount:", adjustedAmount);

  
      console.log("Fetching quote...");
      const quoteResponse = await (
        await fetch(`https://quote-api.jup.ag/v6/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${adjustedAmount}&slippageBps=${slippageBps}&swapMode=ExactIn&platformFeeBps=${platformFeeBps}`)
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
            //prioritizationFeeLamports: 'auto',
             prioritizationFeeLamports: {
               autoMultiplier: 2,
             },
            dynamicSlippage: { "maxBps": slippageBps },
            feeAccount
          })
        })
      ).json();

      console.log("swapTransaction", swapTransaction)
  
     
  
      const swapTransactionBuf = Buffer.from(swapTransaction, 'base64');
      var transaction = VersionedTransaction.deserialize(swapTransactionBuf);
  
      transaction.sign([wallet.payer]);
     
  
      const latestBlockHash = await connection.getLatestBlockhash();
      console.log('latestBlockHash', latestBlockHash)
  
    
      const rawTransaction = transaction.serialize()
      
      const txid = await connection.sendRawTransaction(rawTransaction, {
        skipPreflight: true,
        maxRetries: 1
      });
  
    
      //  await connection.confirmTransaction({
      //   blockhash: latestBlockHash.blockhash,
      //   lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
      //   signature: txid
      // }, 'confirmed');
      
      console.log(`https://solscan.io/tx/${txid}`);


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

// export function createSolanaKeypair(privateKey: string): Keypair {
//     let secretKey: Uint8Array;

//     if (/^[1-9A-HJ-NP-Za-km-z]{87,88}$/.test(privateKey)) {
//           secretKey = bs58.decode(privateKey);
//     } else {
//       try {
//         secretKey = Buffer.from(privateKey, 'hex');
//       } catch (error) {
//         throw new Error(`Invalid private key format: ${error.message}`);
//       }
//     }
//     if (secretKey.length !== 64) {
//       throw new Error(`Invalid secret key length. Expected 64 bytes, got ${secretKey.length}`);
//     }
  
//     try {
//       return Keypair.fromSecretKey(secretKey);
//     } catch (error) {
//       throw new Error(`Failed to create Keypair: ${error.message}`);
//     }
//   }