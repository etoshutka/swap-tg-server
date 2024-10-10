import { Connection, Transaction, VersionedTransaction, Keypair, PublicKey, BlockhashWithExpiryBlockHeight } from '@solana/web3.js';
import fetch from 'cross-fetch';
import { Wallet } from '@project-serum/anchor';
import bs58 from 'bs58';
import  promiseRetry  from 'promise-retry';

const USDT = "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB";
const SOL = "So11111111111111111111111111111111111111112";

async function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function transactionSenderAndConfirmationWaiter({
  connection,
  serializedTransaction,
  blockhashWithExpiryBlockHeight,
}: {
  connection: Connection;
  serializedTransaction: Uint8Array;
  blockhashWithExpiryBlockHeight: BlockhashWithExpiryBlockHeight;
}): Promise<string | null> {
  const txid = await connection.sendRawTransaction(
    serializedTransaction,
    { skipPreflight: true }
  );
  
  const controller = new AbortController();
  const abortSignal = controller.signal;

  const abortableResender = async () => {
    while (true) {
      await wait(2000);
      if (abortSignal.aborted) return;
      try {
        await connection.sendRawTransaction(
          serializedTransaction,
          { skipPreflight: true }
        );
      } catch (e) {
        console.warn(`Failed to resend transaction: ${e}`);
      }
    }
  };

  try {
    abortableResender();
    const lastValidBlockHeight = blockhashWithExpiryBlockHeight.lastValidBlockHeight - 150;

    await Promise.race([
      connection.confirmTransaction(
        {
          ...blockhashWithExpiryBlockHeight,
          signature: txid,
        },
        "confirmed"
      ),
      new Promise(async (resolve) => {
        while (!abortSignal.aborted) {
          await wait(2000);
          const tx = await connection.getSignatureStatus(txid, {
            searchTransactionHistory: false,
          });
          if (tx?.value?.confirmationStatus === "confirmed") {
            resolve(tx);
          }
        }
      }),
    ]);
  } catch (e) {
    if (e instanceof Error && e.name === "TransactionExpiredBlockheightExceededError") {
      return null;
    } else {
      throw e;
    }
  } finally {
    controller.abort();
  }

  const response = await promiseRetry(
    async (retry) => {
      const response = await connection.getTransaction(txid, {
        commitment: "confirmed",
        maxSupportedTransactionVersion: 0,
      });
      if (!response) {
        retry(new Error("Transaction not found"));
      }
      return response;
    },
    {
      retries: 5,
      minTimeout: 1000,
    }
  );

  return response ? txid : null;
}

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

    console.log("Creating Solana wallet");
    const wallet = new Wallet(Keypair.fromSecretKey(bs58.decode(fromPrivateKey)));

    const referralAccountPublicKey = new PublicKey("CXEfB9wmGqyLayo1Byg5WX7MyBqadxK6qStJkopC8YQw");
    
    const inputMintPublicKey = inputMint === SOL ? 
      new PublicKey(SOL) : outputMint === SOL ? 
      new PublicKey(SOL) : new PublicKey(USDT);

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
          prioritizationFeeLamports: {
            autoMultiplier: 2,
          },
          dynamicSlippage: { "maxBps": slippageBps },
          feeAccount
        })
      })
    ).json();

    console.log("swapTransaction", swapTransaction);

    const swapTransactionBuf = Buffer.from(swapTransaction, 'base64');
    var transaction = VersionedTransaction.deserialize(swapTransactionBuf);

    transaction.sign([wallet.payer]);

    const latestBlockHash = await connection.getLatestBlockhash();
    console.log('latestBlockHash', latestBlockHash);

    const rawTransaction = transaction.serialize();

    const txid = await transactionSenderAndConfirmationWaiter({
      connection,
      serializedTransaction: rawTransaction,
      blockhashWithExpiryBlockHeight: latestBlockHash,
    });

    if (txid === null) {
      return { txid: '', status: 'error', message: 'Transaction failed or expired' };
    }

    console.log(`https://solscan.io/tx/${txid}`);
    console.log({ txid, status: 'success', message: 'Swap completed successfully' });
    return { txid, status: 'success', message: 'Swap completed successfully' };
  } catch (error) {
    console.log(error);
    return { txid: '', status: 'error', message: `Swap failed: ${error instanceof Error ? error.message : String(error)}` };
  }
}