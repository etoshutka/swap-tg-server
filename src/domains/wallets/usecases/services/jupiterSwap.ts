import { Connection, Transaction, VersionedTransaction } from '@solana/web3.js';
import fetch from 'cross-fetch';
import { Wallet } from '@project-serum/anchor';

export async function jupiterSwap(
  connection: Connection,
  wallet: Wallet,
  inputMint: string,
  outputMint: string,
  amount: number,
  slippageBps: number
): Promise<string> {
  // Step 1: Get quote
  const quoteResponse = await (
    await fetch(`https://quote-api.jup.ag/v6/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&slippageBps=${slippageBps}`)
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
        wrapAndUnwrapSol: true
      })
    })
  ).json();

  // Step 3: Deserialize the transaction
  const swapTransactionBuf = Buffer.from(swapTransaction, 'base64');
  var transaction = VersionedTransaction.deserialize(swapTransactionBuf);

  // Step 4: Sign the transaction
  transaction.sign([wallet.payer]);

  // Step 5: Execute the transaction
  const rawTransaction = transaction.serialize()
  const txid = await connection.sendRawTransaction(rawTransaction, {
    skipPreflight: true,
    maxRetries: 2
  });

  // Step 6: Confirm the transaction
  const latestBlockHash = await connection.getLatestBlockhash();
  await connection.confirmTransaction({
    blockhash: latestBlockHash.blockhash,
    lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
    signature: txid
  });

  console.log(`Swap transaction completed. Transaction ID: ${txid}`);
  return txid;
}