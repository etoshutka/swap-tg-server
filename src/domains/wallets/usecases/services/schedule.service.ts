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
import { ReferralModel } from "src/domains/referral";
import { WalletsService } from "./wallets.service";

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
    @InjectRepository(ReferralModel)
    private readonly referralRepo: Repository<ReferralModel>,
    private readonly walletsService: WalletsService,
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
      
      const transactions: TransactionModel[] = await this.transactionRepo.find({ where: { type: TransactionType.TRANSFER, status: TransactionStatus.PENDING } });

      
      

      for (const t of transactions) {
        const NETWORK: Network = t.network;
        
        try {
          switch (t.network) {
            case Network.ETH:
            case Network.BSC:
      
              const isEth: boolean = NETWORK === Network.ETH;
              const sdk: types.Sdk<Network.ETH | Network.BSC> = isEth ? this.ethSdk : this.bscSdk;

              let transaction = await sdk.blockchain.getTransaction(t.hash);
      
              let isTransactionEnded: boolean = false;
              let attempts = 0;

              while (!isTransactionEnded || attempts < 5) {
                attempts++;
      
                
                if (transaction?.gasUsed) {
                  isTransactionEnded = true;
      
                } else {
      
                  await new Promise((resolve) => setTimeout(resolve, 10000));
                  transaction = await sdk.blockchain.getTransaction(t.hash);
      
                }
              }

              if (isTransactionEnded) {
                const transactionFee: number = (Number(transaction.gasPrice) / 1_000_000_000) * (Number(transaction.gasUsed) / 1_000_000_000);
      
                
                const nativeTokenPrice: cmcTypes.GetTokenPriceResult = await this.cmcService.getTokenPrice({ symbol: networkNativeSymbol[NETWORK] }).catch(error => {
      
                  return { price: 0, price_change_percentage: 0  };
                });
      
                
                const transactionStatus: TransactionStatus = transaction.status ? TransactionStatus.SUCCESS : TransactionStatus.FAILED;
      

                await this.transactionRepo.update({ id: t.id }, { fee: transactionFee, status: transactionStatus, fee_usd: transactionFee * nativeTokenPrice.price });
      
              } else {
      
              }
              break;

            case Network.SOL:
              const solPrice: cmcTypes.GetTokenPriceResult = await this.cmcService.getTokenPrice({ symbol: "SOL" }).catch(error => {
                console.error('Error getting SOL price:', error);
                return { price: 0, price_change_percentage: 0 };
              });
            
              
              let solTransaction = await this.solSdk.blockchain.getTransaction(t.hash);
            
              
              let isSolTransactionEnded: boolean = false;
              let solAttempts = 0;
    
              while (!isSolTransactionEnded || solAttempts < 5) {
                solAttempts++;
            
                
                if (solTransaction?.meta?.fee) {
                  isSolTransactionEnded = true;
            
                } else {
            
                  await new Promise((resolve) => setTimeout(resolve, 10000));
                  solTransaction = await this.solSdk.blockchain.getTransaction(t.hash);
            
                }
              }
    
              if (isSolTransactionEnded) {
                const fee = solTransaction.meta.fee / 1_000_000_000;
            
                const status = solTransaction.meta.err ? TransactionStatus.FAILED : TransactionStatus.SUCCESS;
            
                const fee_usd = fee * solPrice.price;
            
    
              
                await this.transactionRepo.update(
                  { id: t.id },
                  {
                    fee,
                    status,
                    fee_usd,
                  },
                );
          
              } else {
          
              }
              break;

            case Network.TON:
          
              const tonPrice: number = (await this.tonSdk.rates.getRates({ tokens: ["TON"], currencies: ["USD"] })).rates.TON.prices.USD;
          
              const isJettonTransfer: boolean = t.hash.includes("jetton");
          
              const transferId: string = isJettonTransfer ? t.hash.split(":")[0] : t.hash;
          
          
              let isTonTransactionEnded: boolean = false;
              let tonTransactionResult: Transaction | undefined;
              const tonTransactionResults: Transaction[] = [];
          
              if (!isJettonTransfer) {
              
                while (!isTonTransactionEnded) {
                  await new Promise((resolve) => setTimeout(resolve, 10000));
                  const walletTransactions: Transactions = await this.tonSdk.blockchain.getBlockchainAccountTransactions(Address.parse(t.from));
            
                  const transaction: Transaction | undefined = walletTransactions.transactions.find((tx) => tx.outMsgs?.[0]?.decodedBody?.text === transferId);
          
                  if (transaction) {
                
                    tonTransactionResult = transaction;
                    isTonTransactionEnded = transaction.success || transaction.destroyed || transaction.aborted;
                
                  } else {
                
                  }
                }
              } else {
                
                while (!isTonTransactionEnded) {
                  await new Promise((resolve) => setTimeout(resolve, 10000));
                  const walletTransactions: Transactions = await this.tonSdk.blockchain.getBlockchainAccountTransactions(Address.parse(t.from));
              
                  const transaction: Transaction | undefined = walletTransactions.transactions.find((t) => JSON.stringify(t).includes(String(transferId)));
          
                  if (transaction && tonTransactionResults.length < 2 && (transaction.success || transaction.destroyed || transaction.aborted)) {
              
                    tonTransactionResults.push(transaction);
              
                  }
          
                  if (tonTransactionResults.length === 2) {
                    isTonTransactionEnded = true;
              
                  }
                }
              }
          
              let txFee: number;
              if (isJettonTransfer) {
                txFee = tonTransactionResults.reduce((acc, transaction) => acc + Number(transaction.totalFees), 0) / 1e9;
        
              } else if (tonTransactionResult) {
                txFee = Number(tonTransactionResult.totalFees) / 1e9;
        
              } else {
        
                throw new Error("Transaction result is undefined");
              }
          
              const txFeeUsd: number = txFee * tonPrice;
        
          
              const txHash: string = isJettonTransfer 
                ? tonTransactionResults[tonTransactionResults.length - 1].hash 
                : tonTransactionResult?.hash || '';
          
          
              const txStatus: TransactionStatus = isJettonTransfer
                ? tonTransactionResults[tonTransactionResults.length - 1].success
                  ? TransactionStatus.SUCCESS
                  : TransactionStatus.FAILED
                : tonTransactionResult?.success
                  ? TransactionStatus.SUCCESS
                  : TransactionStatus.FAILED;
          
          
              await this.transactionRepo.update(
                { id: t.id }, 
                { 
                  fee: txFee, 
                  hash: txHash, 
                  status: txStatus, 
                  fee_usd: txFeeUsd 
                }
              );
          
              break;
          }
        } catch (error) {
          
        }
      }
    } catch (e) {
    }
  }


    /**
       * @name swapProcessing
       * @desc Swap processing
       */
    @Cron(CronExpression.EVERY_10_SECONDS)
    async swapProcessing(): Promise<void> {
      try {
        const transactions: TransactionModel[] = await this.transactionRepo.find({ where: { type: TransactionType.SWAP, status: TransactionStatus.PENDING } });
    
        for (const t of transactions) {
          const NETWORK: Network = t.network;
    
          try {
            const createdAt = new Date(t.created_at);
            const transactionAge = Date.now() - createdAt.getTime();
            const MAX_PENDING_TIME = 5 * 60 * 1000; // 5 minutes in milliseconds
    
            if (transactionAge > MAX_PENDING_TIME) {
              await this.transactionRepo.update({ id: t.id }, { status: TransactionStatus.FAILED });
              this.logger("swapProcessing()").warn(`Transaction ${t.id} marked as failed due to timeout`);
              continue;
            }
    
            switch (t.network) {
              case Network.ETH:
              case Network.BSC:
                await this.processEthBscSwap(t, NETWORK);
                break;
              case Network.SOL:
                await this.processSolSwap(t);
                break;
              case Network.TON:
                await this.processTonSwap(t);
                break;
            }
          } catch (error) {
            this.logger("swapProcessing()").error(`Error processing swap for transaction ${t.id}: ${error.message}`, error.stack);
          }
        }
      } catch (e) {
        this.logger("swapProcessing()").error(`Failed to update swaps: ${e.message}`, e.stack);
      }
    }
    
    private async processEthBscSwap(t: TransactionModel, NETWORK: Network): Promise<void> {
      const sdk: types.Sdk<Network.ETH | Network.BSC> = NETWORK === Network.ETH ? this.ethSdk : this.bscSdk;
      let transaction = await sdk.blockchain.getTransaction(t.hash);
      let isSwapEnded: boolean = false;
      let attempts = 0;
    
      while (!isSwapEnded && attempts < 5) {
        attempts++;
        
        if (transaction?.status !== undefined) {
          isSwapEnded = true;
        } else {
          await new Promise((resolve) => setTimeout(resolve, 10000));
          transaction = await sdk.blockchain.getTransaction(t.hash);
        }
      }
    
      if (isSwapEnded) {
        const swapFee: number = (Number(transaction.gasPrice) / 1_000_000_000) * (Number(transaction.gasUsed) / 1_000_000_000);
        
        const nativeTokenPrice: cmcTypes.GetTokenPriceResult = await this.cmcService.getTokenPrice({ symbol: networkNativeSymbol[NETWORK] }).catch(error => {
          return { price: 0, price_change_percentage: 0 };
        });
        const swapStatus: TransactionStatus = transaction.status ? TransactionStatus.SUCCESS : TransactionStatus.FAILED;
    
        await this.transactionRepo.update({ id: t.id }, { fee: swapFee, status: swapStatus, fee_usd: swapFee * nativeTokenPrice.price });
      }
    }
    
    private async processSolSwap(t: TransactionModel): Promise<void> {
      let solSwap = await this.solSdk.blockchain.getTransaction(t.hash);               
      let isSolSwapEnded: boolean = false;
      let solAttempts = 0;
    
      while (!isSolSwapEnded && solAttempts < 5) {
        solAttempts++;      
        
        if (solSwap?.meta?.fee) {
          isSolSwapEnded = true;
        } else {      
          await new Promise((resolve) => setTimeout(resolve, 10000));
          solSwap = await this.solSdk.blockchain.getTransaction(t.hash);      
        }
      }     
    
      if (isSolSwapEnded) {
        const solPrice: cmcTypes.GetTokenPriceResult = await this.cmcService.getTokenPrice({ symbol: "SOL" }).catch(error => {
          this.logger("processSolSwap").error('Error getting SOL price:', error);
          return { price: 0, price_change_percentage: 0 };
        });
    
        const fee = solSwap.meta.fee / 1_000_000_000;      
        const status = solSwap.meta.err ? TransactionStatus.FAILED : TransactionStatus.SUCCESS;      
        const fee_usd = fee * solPrice.price;
          
        await this.transactionRepo.update(
          { id: t.id },
          {
            fee,
            status,
            fee_usd,
          },
        );
      }
    }
    
    private async processTonSwap(t: TransactionModel): Promise<void> {
      try {
        const tonPrice: number = (await this.tonSdk.rates.getRates({ tokens: ["TON"], currencies: ["USD"] })).rates.TON.prices.USD;
    
        const isJettonSwap: boolean = t.fromCurrency !== 'TON' || t.toCurrency !== 'TON';
        const swapId: string = t.hash; // Используем hash как идентификатор свапа
    
        let isTonTransactionEnded: boolean = false;
        let tonTransactionResult: Transaction | undefined;
        const tonTransactionResults: Transaction[] = [];
    
        const DEDUST_SWAP_EXTERNAL_OPCODE = '0x61ee542d';
        const EXCESS_OPCODE = '0xd53276db';
    
        if (!isJettonSwap) {
          while (!isTonTransactionEnded) {
            await new Promise((resolve) => setTimeout(resolve, 10000));
            const walletTransactions: Transactions = await this.tonSdk.blockchain.getBlockchainAccountTransactions(Address.parse(t.from));
      
            const transaction: Transaction | undefined = walletTransactions.transactions.find((tx) => {
              const outMsgs = tx.outMsgs || [];
              return outMsgs.some(msg => {
                const bodyCell = msg.decodedBody?.cell;
                if (bodyCell) {
                  const opcode = bodyCell.bits.slice(0, 32).toString('hex');
                  return opcode === DEDUST_SWAP_EXTERNAL_OPCODE || opcode === EXCESS_OPCODE;
                }
                return false;
              });
            });
    
            if (transaction) {
              tonTransactionResult = transaction;
              isTonTransactionEnded = transaction.success || transaction.destroyed || transaction.aborted;
            }
          }
        } else {
          while (!isTonTransactionEnded) {
            await new Promise((resolve) => setTimeout(resolve, 10000));
            const walletTransactions: Transactions = await this.tonSdk.blockchain.getBlockchainAccountTransactions(Address.parse(t.from));
        
            const transaction: Transaction | undefined = walletTransactions.transactions.find((tx) => {
              const outMsgs = tx.outMsgs || [];
              return outMsgs.some(msg => {
                const bodyCell = msg.decodedBody?.cell;
                if (bodyCell) {
                  const opcode = bodyCell.bits.slice(0, 32).toString('hex');
                  return opcode === DEDUST_SWAP_EXTERNAL_OPCODE || opcode === EXCESS_OPCODE;
                }
                return false;
              });
            });
    
            if (transaction && tonTransactionResults.length < 2 && (transaction.success || transaction.destroyed || transaction.aborted)) {
              tonTransactionResults.push(transaction);
            }
    
            if (tonTransactionResults.length === 2) {
              isTonTransactionEnded = true;
            }
          }
        }
    
        let txFee: number;
        if (isJettonSwap) {
          txFee = tonTransactionResults.reduce((acc, transaction) => acc + Number(transaction.totalFees), 0) / 1e9;
        } else if (tonTransactionResult) {
          txFee = Number(tonTransactionResult.totalFees) / 1e9;
        } else {
          throw new Error("Transaction result is undefined");
        }
    
        const txFeeUsd: number = txFee * tonPrice;
    
        const txHash: string = isJettonSwap 
          ? tonTransactionResults[tonTransactionResults.length - 1].hash 
          : tonTransactionResult?.hash || '';
    
        const txStatus: TransactionStatus = isJettonSwap
          ? tonTransactionResults[tonTransactionResults.length - 1].success
            ? TransactionStatus.SUCCESS
            : TransactionStatus.FAILED
          : tonTransactionResult?.success
            ? TransactionStatus.SUCCESS
            : TransactionStatus.FAILED;
    
        this.logger("processTonSwap").debug(`Updating swap transaction ${t.id}: status=${txStatus}, fee=${txFee}, hash=${txHash}`);
    
        await this.transactionRepo.update(
          { id: t.id }, 
          { 
            fee: txFee, 
            hash: txHash, 
            status: txStatus, 
            fee_usd: txFeeUsd 
          }
        );
    
        this.logger(`Successfully processed TON swap for transaction ${t.id}`);
      } catch (error) {
        this.logger("processTonSwap").error(`Error processing TON swap for transaction ${t.id}: ${error.message}`, error.stack);
      }
    }
    @Cron(CronExpression.EVERY_30_SECONDS)
    async processReferralCommissions(): Promise<void> {
      console.log("processReferralCommissions")
      try {
        const pendingTransactions = await this.transactionRepo.find({
          where: {
            type: TransactionType.SWAP,
            status: TransactionStatus.SUCCESS,
            is_referral_processed: false
          }
        });
  
        for (const transaction of pendingTransactions) {
          await this.walletsService.processReferralCommission(transaction.id);
        }
      } catch (error) {
        this.logger("processReferralCommissions").error(`Error processing referral commissions: ${error.message}`);
      }
    }
  }

  