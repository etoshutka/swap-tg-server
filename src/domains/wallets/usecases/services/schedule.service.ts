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
      const transactions: TransactionModel[] = await this.transactionRepo.find({ where: { type: TransactionType.TRANSFER, status: TransactionStatus.PENDING } });

      for (const t of transactions) {
        const NETWORK: Network = t.network;

        switch (t.network) {
          case Network.ETH:
          case Network.BSC:
            const isEth: boolean = NETWORK === Network.ETH;
            const sdk: types.Sdk<Network.ETH | Network.BSC> = isEth ? this.ethSdk : this.bscSdk;

            let transaction = await sdk.blockchain.getTransaction(t.hash);
            let isTransactionEnded: boolean = false;

            while (!isTransactionEnded) {
              if (!!transaction?.gasUsed) {
                isTransactionEnded = true;
              } else {
                await new Promise((resolve) => setTimeout(resolve, 10000));
                transaction = await sdk.blockchain.getTransaction(t.hash);
              }
            }

            const transactionFee: number = (Number(transaction.gasPrice) / 1_000_000_000) * (Number(transaction.gasUsed) / 1_000_000_000);
            const nativeTokenPrice: cmcTypes.GetTokenPriceResult = await this.cmcService.getTokenPrice({ symbol: networkNativeSymbol[NETWORK] }).catch();
            const transactionStatus: TransactionStatus = transaction.status ? TransactionStatus.SUCCESS : TransactionStatus.FAILED;

            await this.transactionRepo.update({ id: t.id }, { fee: transactionFee, status: transactionStatus, fee_usd: transactionFee * nativeTokenPrice.price });
            break;
          case Network.SOL:
            const solPrice: cmcTypes.GetTokenPriceResult = await this.cmcService.getTokenPrice({ symbol: "SOL" }).catch();
            let solTransaction = await this.solSdk.blockchain.getTransaction(t.hash);
            let isSolTransactionEnded: boolean = false;

            while (!isSolTransactionEnded) {
              if (!!solTransaction?.meta.fee) {
                isSolTransactionEnded = true;
              } else {
                await new Promise((resolve) => setTimeout(resolve, 10000));
                solTransaction = await this.solSdk.blockchain.getTransaction(t.hash);
              }
            }

            await this.transactionRepo.update(
              { id: t.id },
              {
                fee: solTransaction.meta.fee / 1_000_000_000,
                status: solTransaction.meta.err ? TransactionStatus.FAILED : TransactionStatus.SUCCESS,
                fee_usd: (solTransaction.meta.fee / 1_000_000_000) * solPrice.price,
              },
            );
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
      }
    } catch (e) {
      this.logger("transferProcessing()").error(`Failed to update transactions: ` + e.message);
    }
  }
}
