import { TransactionStatus, TransactionType } from "../../domain/interfaces/transaction.interface";
import { Api, TonApiClient, Transaction, Transactions } from "@ton-api/client";
import { TransactionModel } from "../../domain/models/transaction.model";
import { networkNativeSymbol } from "../../domain/consts/network.const";
import { Network } from "../../domain/interfaces/wallet.interface";
import { Cron, CronExpression } from "@nestjs/schedule";
import * as cmcTypes from "../interfaces/cmc.interface";
import * as types from "../interfaces/sdk.interface";
import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { TatumSolanaSDK } from "@tatumio/solana";
import { ConfigService } from "@nestjs/config";
import { TatumEthSDK } from "@tatumio/eth";
import { TatumBscSDK } from "@tatumio/bsc";
import { CmcService } from "./cmc.service";
import { Repository } from "typeorm";
import { Address, TonClient } from "@ton/ton";

@Injectable()
export class ScheduleService {
  private readonly ethSdk: types.Sdk<Network.ETH>;
  private readonly bscSdk: types.Sdk<Network.BSC>;
  private readonly solSdk: types.Sdk<Network.SOL>;
  private readonly tonSdk: types.Sdk<Network.TON>;
  private readonly tonSecondSdk: TonClient;
  private readonly logger = (context: string) => new Logger(`WalletsModule > ScheduleService > ${context}`);

  constructor(
    private readonly cmcService: CmcService,
    private readonly configService: ConfigService,
    @InjectRepository(TransactionModel)
    private readonly transactionRepo: Repository<TransactionModel>,
  ) {
    this.ethSdk = TatumEthSDK({
      apiKey: this.configService.get("TATUM_MAINNET_API_KEY"),
    });

    this.bscSdk = TatumBscSDK({
      apiKey: this.configService.get("TATUM_MAINNET_API_KEY"),
    });

    this.solSdk = TatumSolanaSDK({
      apiKey: this.configService.get("TATUM_MAINNET_API_KEY"),
    });

    this.tonSdk = new Api(
      new TonApiClient({
        baseUrl: this.configService.get("TON_API_API_URL"),
        baseApiParams: { headers: { Authorization: `Bearer ${this.configService.get("TON_API_API_KEY")}`, "Content-type": "application/json" } },
      }),
    );

    this.tonSecondSdk = new TonClient({
      apiKey: this.configService.get("TON_CENTER_API_KEY"),
      endpoint: "https://toncenter.com/api/v2/jsonRPC",
    });
  }

  /**
   * @name transferProcessing
   * @desc Transfer processing
   */
  @Cron(CronExpression.EVERY_10_SECONDS)
async transferProcessing(): Promise<void> {
  try {
    console.log('Starting transferProcessing');
    const transactions: TransactionModel[] = await this.transactionRepo.find({ where: { type: TransactionType.TRANSFER, status: TransactionStatus.PENDING } });
    console.log(`Found ${transactions.length} pending transactions`);

    for (const t of transactions) {
      const NETWORK: Network = t.network;
      console.log(`Processing transaction: ${t.hash} on network: ${NETWORK}`);
      
      try {
        switch (t.network) {
          case Network.ETH:
          case Network.BSC:
            //console.log(`Processing ${t.network} transaction`);
            const isEth: boolean = NETWORK === Network.ETH;
            const sdk: types.Sdk<Network.ETH | Network.BSC> = isEth ? this.ethSdk : this.bscSdk;

            let transaction = await sdk.blockchain.getTransaction(t.hash);
            //console.log('Initial transaction details:', JSON.stringify(transaction, null, 2));
            let isTransactionEnded: boolean = false;
            let attempts = 0;

            while (!isTransactionEnded && attempts < 5) {
              attempts++;
             // console.log(`Attempt ${attempts} to get transaction details`);
              
              if (transaction?.gasUsed) {
                isTransactionEnded = true;
                console.log('Transaction details obtained successfully');
              } else {
                console.log('Transaction details not available, waiting...');
                await new Promise((resolve) => setTimeout(resolve, 10000));
                transaction = await sdk.blockchain.getTransaction(t.hash);
                console.log('Updated transaction details:', JSON.stringify(transaction, null, 2));
              }
            }

            if (isTransactionEnded) {
              const transactionFee: number = (Number(transaction.gasPrice) / 1_000_000_000) * (Number(transaction.gasUsed) / 1_000_000_000);
              console.log(`Transaction fee: ${transactionFee}`);
              
              const nativeTokenPrice: cmcTypes.GetTokenPriceResult = await this.cmcService.getTokenPrice({ symbol: networkNativeSymbol[NETWORK] }).catch(error => {
                console.error('Error getting token price:', error);
                return { price: 0, price_change_percentage: 0  };
              });
              console.log(`Native token price: ${nativeTokenPrice.price}`);
              
              const transactionStatus: TransactionStatus = transaction.status ? TransactionStatus.SUCCESS : TransactionStatus.FAILED;
              console.log(`Transaction status: ${transactionStatus}`);

              await this.transactionRepo.update({ id: t.id }, { fee: transactionFee, status: transactionStatus, fee_usd: transactionFee * nativeTokenPrice.price });
              console.log(`Transaction ${t.id} updated successfully`);
            } else {
              console.log(`Failed to get transaction details for ${t.id} after multiple attempts`);
            }
            break;

          case Network.SOL:
            console.log('Processing Solana transaction');
            const solPrice: cmcTypes.GetTokenPriceResult = await this.cmcService.getTokenPrice({ symbol: "SOL" }).catch(error => {
              console.error('Error getting SOL price:', error);
              return { price: 0, price_change_percentage: 0 };
            });
            console.log('SOL price:', solPrice);
            
            let solTransaction = await this.solSdk.blockchain.getTransaction(t.hash);
            console.log('Initial Solana transaction details:', JSON.stringify(solTransaction, null, 2));
            
            let isSolTransactionEnded: boolean = false;
            let solAttempts = 0;
  
            while (!isSolTransactionEnded && solAttempts < 5) {
              solAttempts++;
              console.log(`Solana: Attempt ${solAttempts} to get transaction details`);
              
              if (solTransaction?.meta?.fee) {
                isSolTransactionEnded = true;
                console.log('Solana: Transaction details obtained successfully');
              } else {
                console.log('Solana: Transaction details not available, waiting...');
                await new Promise((resolve) => setTimeout(resolve, 10000));
                solTransaction = await this.solSdk.blockchain.getTransaction(t.hash);
                console.log('Updated Solana transaction details:', JSON.stringify(solTransaction, null, 2));
              }
            }
  
            if (isSolTransactionEnded) {
              const fee = solTransaction.meta.fee / 1_000_000_000;
              console.log(`Solana: Transaction fee: ${fee}`);
              const status = solTransaction.meta.err ? TransactionStatus.FAILED : TransactionStatus.SUCCESS;
              console.log(`Solana: Transaction status: ${status}`);
              const fee_usd = fee * solPrice.price;
              console.log(`Solana: Transaction fee in USD: ${fee_usd}`);
  
              console.log('Solana: Updating transaction in database:', {
                id: t.id,
                fee,
                status,
                fee_usd
              });
  
              await this.transactionRepo.update(
                { id: t.id },
                {
                  fee,
                  status,
                  fee_usd,
                },
              );
              console.log('Solana: Transaction updated successfully');
            } else {
              console.log('Solana: Failed to get transaction details after multiple attempts');
            }
            break;

          case Network.TON:
            console.log('Processing TON transaction');
            const tonPrice: number = (await this.tonSdk.rates.getRates({ tokens: ["TON"], currencies: ["USD"] })).rates.TON.prices.USD;
            console.log(`TON price: ${tonPrice}`);
            const isJettonTransfer: boolean = t.hash.includes("jetton");
            console.log(`Is Jetton transfer: ${isJettonTransfer}`);
            const transferId: string = isJettonTransfer ? t.hash.split(":")[0] : t.hash;
            console.log(`Transfer ID: ${transferId}`);
        
            let isTonTransactionEnded: boolean = false;
            let tonTransactionResult: Transaction | undefined;
            const tonTransactionResults: Transaction[] = [];
        
            if (!isJettonTransfer) {
              console.log('Processing non-Jetton TON transfer');
              while (!isTonTransactionEnded) {
                await new Promise((resolve) => setTimeout(resolve, 10000));
                const walletTransactions: Transactions = await this.tonSdk.blockchain.getBlockchainAccountTransactions(Address.parse(t.from));
                console.log(`TON: Retrieved ${walletTransactions.transactions.length} transactions for address ${t.from}`);
                const transaction: Transaction | undefined = walletTransactions.transactions.find((tx) => tx.outMsgs?.[0]?.decodedBody?.text === transferId);
        
                if (transaction) {
                  console.log('TON: Found matching transaction:', JSON.stringify(transaction, null, 2));
                  tonTransactionResult = transaction;
                  isTonTransactionEnded = transaction.success || transaction.destroyed || transaction.aborted;
                  console.log(`TON: Transaction ended: ${isTonTransactionEnded}`);
                } else {
                  console.log('TON: No matching transaction found, continuing search...');
                }
              }
            } else {
              console.log('Processing Jetton TON transfer');
              while (!isTonTransactionEnded) {
                await new Promise((resolve) => setTimeout(resolve, 10000));
                const walletTransactions: Transactions = await this.tonSdk.blockchain.getBlockchainAccountTransactions(Address.parse(t.from));
                console.log(`TON Jetton: Retrieved ${walletTransactions.transactions.length} transactions for address ${t.from}`);
                const transaction: Transaction | undefined = walletTransactions.transactions.find((t) => JSON.stringify(t).includes(String(transferId)));
        
                if (transaction && tonTransactionResults.length < 2 && (transaction.success || transaction.destroyed || transaction.aborted)) {
                  console.log('TON Jetton: Found matching transaction:', JSON.stringify(transaction, null, 2));
                  tonTransactionResults.push(transaction);
                  console.log(`TON Jetton: Transaction count: ${tonTransactionResults.length}`);
                }
        
                if (tonTransactionResults.length === 2) {
                  isTonTransactionEnded = true;
                  console.log('TON Jetton: Both transactions found');
                }
              }
            }
        
            let txFee: number;
            if (isJettonTransfer) {
              txFee = tonTransactionResults.reduce((acc, transaction) => acc + Number(transaction.totalFees), 0) / 1e9;
              console.log(`TON Jetton: Total fee: ${txFee}`);
            } else if (tonTransactionResult) {
              txFee = Number(tonTransactionResult.totalFees) / 1e9;
              console.log(`TON: Transaction fee: ${txFee}`);
            } else {
              console.error("TON: Transaction result is undefined");
              throw new Error("Transaction result is undefined");
            }
        
            const txFeeUsd: number = txFee * tonPrice;
            console.log(`TON: Transaction fee in USD: ${txFeeUsd}`);
        
            const txHash: string = isJettonTransfer 
              ? tonTransactionResults[tonTransactionResults.length - 1].hash 
              : tonTransactionResult?.hash || '';
            console.log(`TON: Transaction hash: ${txHash}`);
        
            const txStatus: TransactionStatus = isJettonTransfer
              ? tonTransactionResults[tonTransactionResults.length - 1].success
                ? TransactionStatus.SUCCESS
                : TransactionStatus.FAILED
              : tonTransactionResult?.success
                ? TransactionStatus.SUCCESS
                : TransactionStatus.FAILED;
            console.log(`TON: Transaction status: ${txStatus}`);
        
            console.log('TON: Updating transaction in database:', {
              id: t.id,
              fee: txFee,
              hash: txHash,
              status: txStatus,
              fee_usd: txFeeUsd
            });
        
            await this.transactionRepo.update(
              { id: t.id }, 
              { 
                fee: txFee, 
                hash: txHash, 
                status: txStatus, 
                fee_usd: txFeeUsd 
              }
            );
            console.log('TON: Transaction updated successfully');
            break;
        }
      } catch (error) {
        console.error(`Error processing transaction ${t.id}:`, error);
      }
    }
  } catch (e) {
    console.error('Error in transferProcessing:', e);
    this.logger("transferProcessing()").error(`Failed to update transactions: ${e.message}`, e.stack);
  }
}


/**
   * @name swapProcessing
   * @desc Swap processing
   */
@Cron(CronExpression.EVERY_10_SECONDS)
async swapProcessing(): Promise<void> {
  try {
   // console.log('Starting swapProcessing');
    const transactions: TransactionModel[] = await this.transactionRepo.find({ where: { type: TransactionType.SWAP, status: TransactionStatus.PENDING } });
    //console.log(`Found ${transactions.length} pending swap transactions`);

    for (const t of transactions) {
      const NETWORK: Network = t.network;
      //console.log(`Processing swap transaction: ${t.hash} on network: ${NETWORK}`);
      
      try {
        switch (t.network) {
          case Network.ETH:
          case Network.BSC:
            //console.log(`Processing ${t.network} swap`);
            const isEth: boolean = NETWORK === Network.ETH;
            const sdk: types.Sdk<Network.ETH | Network.BSC> = isEth ? this.ethSdk : this.bscSdk;

            let transaction = await sdk.blockchain.getTransaction(t.hash);
            //console.log('Initial swap details:', JSON.stringify(transaction, null, 2));
            let isSwapEnded: boolean = false;
            let attempts = 0;

            while (!isSwapEnded && attempts < 5) {
              attempts++;
              console.log(`Attempt ${attempts} to get swap details`);
              
              if (transaction?.status !== undefined) {
                isSwapEnded = true;
                console.log('Swap details obtained successfully');
              } else {
                console.log('Swap details not available, waiting...');
                await new Promise((resolve) => setTimeout(resolve, 10000));
                transaction = await sdk.blockchain.getTransaction(t.hash);
                console.log('Updated swap details:', JSON.stringify(transaction, null, 2));
              }
            }

            if (isSwapEnded) {
              const swapFee: number = (Number(transaction.gasPrice) / 1_000_000_000) * (Number(transaction.gasUsed) / 1_000_000_000);
              console.log(`Swap fee: ${swapFee}`);
              
              const nativeTokenPrice: cmcTypes.GetTokenPriceResult = await this.cmcService.getTokenPrice({ symbol: networkNativeSymbol[NETWORK] }).catch(error => {
                console.error('Error getting token price:', error);
                return { price: 0, price_change_percentage: 0 };
              });
              console.log(`Native token price: ${nativeTokenPrice.price}`);
              
              const swapStatus: TransactionStatus = transaction.status ? TransactionStatus.SUCCESS : TransactionStatus.FAILED;
              console.log(`Swap status: ${swapStatus}`);

              await this.transactionRepo.update({ id: t.id }, { fee: swapFee, status: swapStatus, fee_usd: swapFee * nativeTokenPrice.price });
              console.log(`Swap ${t.id} updated successfully`);
            } else {
              console.log(`Failed to get swap details for ${t.id} after multiple attempts`);
            }
            break;

          case Network.SOL:
            console.log('Processing Solana swap');
            const solPrice: cmcTypes.GetTokenPriceResult = await this.cmcService.getTokenPrice({ symbol: "SOL" }).catch(error => {
              console.error('Error getting SOL price:', error);
              return { price: 0, price_change_percentage: 0 };
            });
            console.log('SOL price:', solPrice);
            
            let solSwap = await this.solSdk.blockchain.getTransaction(t.hash);
            console.log('Initial Solana swap details:', JSON.stringify(solSwap, null, 2));
            
            let isSolSwapEnded: boolean = false;
            let solAttempts = 0;
  
            while (!isSolSwapEnded && solAttempts < 5) {
              solAttempts++;
              console.log(`Solana: Attempt ${solAttempts} to get swap details`);
              
              if (solSwap?.meta?.fee) {
                isSolSwapEnded = true;
                console.log('Solana: Swap details obtained successfully');
              } else {
                console.log('Solana: Swap details not available, waiting...');
                await new Promise((resolve) => setTimeout(resolve, 10000));
                solSwap = await this.solSdk.blockchain.getTransaction(t.hash);
                console.log('Updated Solana swap details:', JSON.stringify(solSwap, null, 2));
              }
            }
  
            if (isSolSwapEnded) {
              const fee = solSwap.meta.fee / 1_000_000_000;
              console.log(`Solana: Swap fee: ${fee}`);
              const status = solSwap.meta.err ? TransactionStatus.FAILED : TransactionStatus.SUCCESS;
              console.log(`Solana: Swap status: ${status}`);
              const fee_usd = fee * solPrice.price;
              console.log(`Solana: Swap fee in USD: ${fee_usd}`);
  
              console.log('Solana: Updating swap in database:', {
                id: t.id,
                fee,
                status,
                fee_usd
              });
  
              await this.transactionRepo.update(
                { id: t.id },
                {
                  fee,
                  status,
                  fee_usd,
                },
              );
              console.log('Solana: Swap updated successfully');
            } else {
              console.log('Solana: Failed to get swap details after multiple attempts');
            }
            break;

          case Network.TON:
      //       console.log('Processing TON swap');
      //       const tonPrice: number = (await this.tonSdk.rates.getRates({ tokens: ["TON"], currencies: ["USD"] })).rates.TON.prices.USD;
      //       console.log(`TON price: ${tonPrice}`);

      //       let isTonSwapEnded: boolean = false;
      //       let tonSwapResult: Transaction | undefined;
      //       let tonAttempts = 0;
        
      //       while (!isTonSwapEnded && tonAttempts < 5) {
      //         tonAttempts++;
      //         console.log(`TON: Attempt ${tonAttempts} to get swap details`);
      //         await new Promise((resolve) => setTimeout(resolve, 10000));
      //         const walletTransactions: Transactions = await this.tonSdk.blockchain.getBlockchainAccountTransactions(Address.parse(t.from));
      //         console.log(`TON: Retrieved ${walletTransactions.transactions.length} transactions for address ${t.from}`);
      //         const transaction: Transaction | undefined = walletTransactions.transactions.find((tx) => tx.hash === t.hash);
        
      //         if (transaction) {
      //           console.log('TON: Found matching swap:', JSON.stringify(transaction, null, 2));
      //           tonSwapResult = transaction;
      //           isTonSwapEnded = true;
      //           console.log(`TON: Swap ended: ${isTonSwapEnded}`);
      //         } else {
      //           console.log('TON: No matching swap found, continuing search...');
      //         }
      //       }
        
      //       if (isTonSwapEnded && tonSwapResult) {
      //         const txFee: number = Number(tonSwapResult.totalFees) / 1e9;
      //         console.log(`TON: Swap fee: ${txFee}`);
        
      //         const txFeeUsd: number = txFee * tonPrice;
      //         console.log(`TON: Swap fee in USD: ${txFeeUsd}`);
        
      //         const txStatus: TransactionStatus = tonSwapResult.success
      //           ? TransactionStatus.SUCCESS
      //           : TransactionStatus.FAILED;
      //         console.log(`TON: Swap status: ${txStatus}`);
        
      //         console.log('TON: Updating swap in database:', {
      //           id: t.id,
      //           fee: txFee,
      //           status: txStatus,
      //           fee_usd: txFeeUsd
      //         });
        
      //         await this.transactionRepo.update(
      //           { id: t.id }, 
      //           { 
      //             fee: txFee, 
      //             status: txStatus, 
      //             fee_usd: txFeeUsd 
      //           }
      //         );
      //         console.log('TON: Swap updated successfully');
      //       } else {
      //         console.log('TON: Failed to get swap details after multiple attempts');
      //       }
      //       break;
         }
       } catch (error) {
         console.error(`Error processing swap ${t.id}:`, error);
     }
    }
  } catch (e) {
    console.error('Error in swapProcessing:', e);
    this.logger("swapProcessing()").error(`Failed to update swaps: ${e.message}`, e.stack);
  }
}
}
