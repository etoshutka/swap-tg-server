import { Address, beginCell, Cell, internal, OpenedContract, SendMode, toNano, TonClient, WalletContractV5R1 } from "@ton/ton";
import { networkNativeSymbol, networkSymbol } from "../../domain/consts/network.const";
import { TransactionStatus, TransactionType } from "../../domain/interfaces/transaction.interface";
import { Ethereum, Network as TatumNetwork, TatumSDK } from "@tatumio/tatum";
import { KeyPair, mnemonicNew, mnemonicToPrivateKey } from "@ton/crypto";
import { GetTokenPriceResult } from "../interfaces/cmc.interface";
import { Network } from "../../domain/interfaces/wallet.interface";
import { Api, TonApiClient, JettonBalance } from "@ton-api/client";
import * as cmcTypes from "../interfaces/cmc.interface";
import * as types from "../interfaces/sdk.interface";
import { Injectable, Logger } from "@nestjs/common";
import { TatumSolanaSDK } from "@tatumio/solana";
import { ConfigService } from "@nestjs/config";
import { TatumEthSDK } from "@tatumio/eth";
import { CmcService } from "./cmc.service";
import { TatumBscSDK } from "@tatumio/bsc";
import { v4 as uuid } from "uuid";
import { Buffer } from "buffer";

@Injectable()
export class SdkService {
  private readonly ethSdk: types.Sdk<Network.ETH>;
  private readonly bscSdk: types.Sdk<Network.BSC>;
  private readonly solSdk: types.Sdk<Network.SOL>;
  private readonly tonSdk: types.Sdk<Network.TON>;
  private readonly tonSecondSdk: TonClient;
  private readonly logger = (context: string) => new Logger(`WalletsModule > SdkService > ${context}`);

  constructor(
    private readonly cmcService: CmcService,
    private readonly configService: ConfigService,
  ) {
    console.log('TATUM_MAINNET_API_KEY:', this.configService.get("TATUM_MAINNET_API_KEY"));
    console.log('TON_API_API_KEY:', this.configService.get("TON_API_API_KEY"));
    console.log('TON_API_API_URL:', this.configService.get("TON_API_API_URL"));
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
      apiKey: "37ae71c9060112979bb9ae2409ec0fceab17adae1f248298691068dcc35e2b1c",
      endpoint: "https://toncenter.com/api/v2/jsonRPC",
    });
  }

  /**
   * @name getTokenInfo
   * @desc Get token info
   * @param {types.GetTokenInfoParams} params
   * @returns {Promise<any>}
   */
  async getTokenInfo(params: types.GetTokenInfoParams): Promise<types.GetTokenInfoResult> {
    try {
      return await this.cmcService.getTokenInfo({ symbol: params?.symbol, address: params?.address });
    } catch (e) {
      this.logger("getTokenInfo()").error(`Failed to get ${params?.symbol ?? params?.address} token info: ` + e.message);
      throw e;
    }
  }

  /**
   * @name getTokenPrice
   * @desc Get token price
   * @param {types.GetTokenPriceParams} params
   * @returns {Promise<types.GetTokenPriceResult>}
   */
  async getTokenPrice(params: types.GetTokenPriceParams): Promise<types.GetTokenPriceResult> {
    try {
      return await this.cmcService.getTokenPrice({ symbol: params?.symbol, address: params?.address });
    } catch (e) {
      this.logger("getTokenPrice()").error("Failed to get token price: " + e.message);
      throw e;
    }
  }

  /**
   * @name generateWallet
   * @desc Generate new wallet
   * @param {types.GenerateWalletParams} params
   * @returns {types.GenerateWalletResult}
   */
  async generateWallet(params: types.GenerateWalletParams): Promise<types.GenerateWalletResult> {
    switch (params.network) {
      case Network.ETH:
      case Network.BSC: {
        const sdk: types.Sdk<Network.ETH | Network.BSC> = params.network === Network.ETH ? this.ethSdk : this.bscSdk;
        const { xpub: public_key, mnemonic } = await sdk.wallet.generateWallet();
        const address: string = sdk.wallet.generateAddressFromXPub(public_key, 0);
        const private_key: string = await sdk.wallet.generatePrivateKeyFromMnemonic(mnemonic, 0);
        return { address, mnemonic, public_key, private_key };
      }
      case Network.SOL: {
        const { mnemonic, address, privateKey: private_key } = this.solSdk.wallet.wallet();
        return { address, mnemonic, private_key };
      }
      case Network.TON: {
        const mnemonics: string[] = await mnemonicNew();
        const { publicKey, secretKey } = await mnemonicToPrivateKey(mnemonics);
        const wallet: WalletContractV5R1 = WalletContractV5R1.create({ workchain: 0, publicKey });
        const public_key: string = Buffer.from(publicKey).toString("base64");
        const private_key: string = Buffer.from(secretKey).toString("base64");
        return { address: wallet.address.toString(), mnemonic: mnemonics.join(" "), public_key, private_key };
      }
    }
  }

  /**
   * @name getImportedWallet
   * @desc Get imported wallet via private key
   * @param {types.GetImportedWalletParams} params
   * @returns {types.GetImportedWalletResult}
   */
  async getImportedWallet(params: types.GetImportedWalletParams): Promise<any /*types.GetImportedWalletResult*/> {
    switch (params.network) {
      case Network.ETH:
      case Network.BSC:
        const sdk: types.Sdk<Network.ETH | Network.BSC> = params.network === Network.ETH ? this.ethSdk : this.bscSdk;
        const address: string = sdk.wallet.generateAddressFromPrivateKey(params.private_key);
        return { address, private_key: params.private_key };
      case Network.SOL:
        const { privateKey: private_key, ...wallet } = this.solSdk.wallet.wallet(params.private_key);
        return { private_key, ...wallet };
      case Network.TON:
        const pair: KeyPair = await mnemonicToPrivateKey(params.private_key.split(" "));
        const ton_wallet: WalletContractV5R1 = WalletContractV5R1.create({ workchain: 0, publicKey: pair.publicKey });
        const ton_public_key: string = Buffer.from(pair.publicKey).toString("base64");
        const ton_private_key: string = Buffer.from(pair.secretKey).toString("base64");
        return { address: ton_wallet.address.toString(), public_key: ton_public_key, private_key: ton_private_key, mnemonic: params.private_key };
    }
  }

  /**
   * @name getWalletBalance
   * @desc Get wallet native balance
   * @param {types.GetWalletBalanceParams} params
   * @returns {types.GetWalletBalanceResult}
   */
  async getWalletBalance(params: types.GetWalletBalanceParams): Promise<types.GetWalletBalanceResult> {
    try {
      console.log('Getting balance for:', params);
      const tatumSdk = params.network === Network.TON ? undefined : await TatumSDK.init<Ethereum>({ apiKey: this.configService.get("TATUM_MAINNET_API_KEY"), network: TatumNetwork.ETHEREUM });
  
      let price: number = 0;
      let balance: number = 0;
      let balance_usd: number = 0;
  
      switch (params.network) {
        case Network.ETH:
          case Network.BSC:
            const sdk: types.Sdk<Network.ETH | Network.BSC> = params.network === Network.ETH ? this.ethSdk : this.bscSdk;
            balance = Number((await sdk.blockchain.getBlockchainAccountBalance(params.address)).balance);
            price = Number((await tatumSdk.rates.getCurrentRate(networkNativeSymbol[params.network], "USD")).data.value);
            balance_usd = balance * price;
            return { balance, balance_usd };
          case Network.SOL:
            balance = Number((await this.solSdk.blockchain.getAccountBalance(params.address)).balance);
            price = Number((await tatumSdk.rates.getCurrentRate(networkNativeSymbol[params.network], "USD")).data.value);
            balance_usd = balance * price;
            return { balance, balance_usd };
        case Network.TON:
          console.log('TON API URL:', this.configService.get("TON_API_API_URL"));
          console.log('TON API Key:', this.configService.get("TON_API_API_KEY"));
          try {
            const account = await this.tonSdk.accounts.getAccount(Address.parse(params.address));
            if (account.status === 'uninit' || account.status === 'nonexist') {
              return { balance: 0, balance_usd: 0 };
            }
            balance = Number(BigInt(account.balance) / BigInt(10 ** 9));
          } catch (error) {
            console.error('Error fetching TON account:', error);
            // Если произошла ошибка, предполагаем, что кошелек не инициализирован
            return { balance: 0, balance_usd: 0 };
          }
          console.log('TON balance info:', balance);
          try {
            price = (await this.tonSdk.rates.getRates({ tokens: [networkNativeSymbol[params.network]], currencies: ["USD"] })).rates.TON.prices.USD;
          } catch (error) {
            console.error('Error fetching TON price:', error);
            price = 0;
          }
          console.log('USD price info:', price);
          balance_usd = balance * price;
          return { balance, balance_usd };
      }
    } catch (e) {
      console.error('Error in getWalletBalance:', e);
      this.logger("getWalletBalance()").error(`Failed to get native ${networkNativeSymbol[params.network]} wallet balance: ` + e.message);
   
      return { balance: 0, balance_usd: 0 };
    }
  }

  /**
   * @name getWalletTokenBalance
   * @desc Get wallet token balance
   * @param {types.GetWalletTokenBalanceParams} params
   * @returns {types.GetWalletTokenBalanceResult}
   */
  async getWalletTokenBalance(params: types.GetWalletTokenBalanceParams): Promise<types.GetWalletTokenBalanceResult> {
    switch (params.network) {
      case Network.ETH:
      case Network.BSC:
        const sdk: types.Sdk<Network.ETH | Network.BSC> = params.network === Network.ETH ? this.ethSdk : this.bscSdk;
        const decimals: string = await sdk.erc20.decimals(params.contract);
        const erc20Price: GetTokenPriceResult = await this.cmcService.getTokenPrice({ address: params.contract });
        const erc20Balance: number = Number((await sdk.erc20.getErc20AccountBalance(networkSymbol[params.network], params.address, params.contract))?.balance ?? 0);

        if (!erc20Balance) {
          return {
            balance: 0,
            balance_usd: 0,
            price: erc20Price.price,
            price_change_percentage: erc20Price.price_change_percentage,
          };
        }

        return {
          balance: erc20Balance / Math.pow(10, Number(decimals)),
          balance_usd: (erc20Balance / Math.pow(10, Number(decimals))) * erc20Price.price,
          price: erc20Price.price,
          price_change_percentage: erc20Price.price_change_percentage,
        };
      case Network.SOL:
        const sol20Price: GetTokenPriceResult = await this.cmcService.getTokenPrice({ address: params.contract });
        const sol20Balance = (await this.solSdk.spl.getSplAccountBalances(networkSymbol[Network.SOL] as "ETH" | "MATIC" | "CELO" | "SOL" | "ALGO", params.address)).find(
          (b) => b.contractAddress === params.contract,
        );

        return {
          balance: Number(sol20Balance?.amount ?? 0),
          balance_usd: Number(sol20Balance?.amount ?? 0) * sol20Price.price,
          price: sol20Price.price,
          price_change_percentage: sol20Price.price_change_percentage,
        };
        case Network.TON:
      try {
        const tonJettonPrice: GetTokenPriceResult = await this.cmcService.getTokenPrice({ address: params.contract });
        const tonJettonBalance: JettonBalance = await this.tonSdk.accounts.getAccountJettonBalance(Address.parse(params.address), Address.parse(params.contract), { currencies: ["USD"] });

        return {
          balance: Number(tonJettonBalance.balance) / Math.pow(10, Number(tonJettonBalance.jetton.decimals)),
          balance_usd: (Number(tonJettonBalance.balance) * tonJettonBalance.price.prices.USD) / Math.pow(10, Number(tonJettonBalance.jetton.decimals)),
          price: tonJettonBalance.price.prices.USD,
          price_change_percentage: Number(tonJettonBalance.price.diff24h.USD.replace("%", "")),
        };
      } catch (error) {
        console.error('Error fetching TON token balance:', error);
        // В случае любой ошибки возвращаем нулевой баланс
        const tonJettonPrice: GetTokenPriceResult = await this.cmcService.getTokenPrice({ address: params.contract }).catch(() => ({ price: 0, price_change_percentage: 0 }));
        return {
          balance: 0,
          balance_usd: 0,
          price: tonJettonPrice.price,
          price_change_percentage: tonJettonPrice.price_change_percentage,
        };
      }
    }
  }

  /**
   * @name transferWalletTokenTransaction
   * @desc Transfer wallet token transaction
   * @param {types.TransferWalletTokenTransactionParams} params
   * @returns {types.TransferWalletTokenTransactionResult}
   */
  async transferWalletTokenTransaction(params: types.TransferWalletTokenTransactionParams): Promise<types.TransferWalletTokenTransactionResult> {
    try {
      const TOKEN_CONTRACT_ADDRESS: string = params?.token_contract_address;
      const FROM_PRIVATE_KEY: string = params?.from_private_key;
      const FROM_ADDRESS: string = params?.from_address;
      const TO_ADDRESS: string = params?.to_address;
      const NETWORK: Network = params?.network;
      const CURRENCY: string = params?.currency;
      const AMOUNT: string = params?.amount;

      switch (NETWORK) {
        case Network.ETH:
        case Network.BSC:
          const isEth: boolean = NETWORK === Network.ETH;
          const sdk: types.Sdk<Network.ETH | Network.BSC> = isEth ? this.ethSdk : this.bscSdk;

          const gasInfo: any = await sdk.blockchain.estimateGas({ to: TO_ADDRESS, from: FROM_ADDRESS, amount: AMOUNT });
          const gasLimit: string = String(gasInfo.gasLimit);
          const gasPrice: string = Math.ceil(Number(isEth ? gasInfo.estimations.fast : gasInfo.gasPrice) / 1_000_000_000).toString();
          const decimals: number = await sdk.erc20.decimals(TOKEN_CONTRACT_ADDRESS);

          const transactionResult: any = await sdk.erc20.send.transferSignedTransaction({
            to: TO_ADDRESS,
            digits: decimals,
            amount: AMOUNT,
            fromPrivateKey: FROM_PRIVATE_KEY,
            contractAddress: TOKEN_CONTRACT_ADDRESS,
            fee: isEth ? { gasLimit, gasPrice } : undefined,
          });

          const transaction = await sdk.blockchain.getTransaction(transactionResult.txId);
          const tokenPrice: cmcTypes.GetTokenPriceResult = await this.cmcService.getTokenPrice({ address: TOKEN_CONTRACT_ADDRESS }).catch();

          return {
            type: TransactionType.TRANSFER,
            network: NETWORK,
            status: TransactionStatus.PENDING,
            hash: transaction.transactionHash,
            amount: Number(AMOUNT),
            amount_usd: Number(AMOUNT) * tokenPrice.price,
            to: TO_ADDRESS,
            from: FROM_ADDRESS,
            currency: CURRENCY,
            fee: 0,
            fee_usd: 0,
          };
        case Network.SOL:
          const solTransactionResult: any = await this.solSdk.spl.send.transferSignedTransaction({
            to: TO_ADDRESS,
            from: FROM_ADDRESS,
            amount: AMOUNT,
            digits: 6,
            fromPrivateKey: FROM_PRIVATE_KEY,
            contractAddress: TOKEN_CONTRACT_ADDRESS,
          });

          const solTransaction = await this.solSdk.blockchain.getTransaction(solTransactionResult.txId);
          const solTokenPrice: cmcTypes.GetTokenPriceResult = await this.cmcService.getTokenPrice({ address: TOKEN_CONTRACT_ADDRESS }).catch();

          return {
            type: TransactionType.TRANSFER,
            network: NETWORK,
            status: TransactionStatus.PENDING,
            hash: solTransaction.transaction.signatures[0],
            amount: Number(AMOUNT),
            amount_usd: Number(AMOUNT) * solTokenPrice.price,
            to: TO_ADDRESS,
            from: FROM_ADDRESS,
            currency: CURRENCY,
            fee: 0,
            fee_usd: 0,
          };
        case Network.TON:
          const pair: KeyPair = await mnemonicToPrivateKey(FROM_PRIVATE_KEY.split(" "));
          const wallet: WalletContractV5R1 = WalletContractV5R1.create({ workchain: 0, publicKey: pair.publicKey });
          const contract: OpenedContract<WalletContractV5R1> = this.tonSecondSdk.open(wallet);
          const seqno: number = await contract.getSeqno();
          const transferId: number = Math.floor(Math.random() * (999_999_999 - 100_000_000 + 1) + 100_000_000);

          const jettonPrice: cmcTypes.GetTokenPriceResult = await this.cmcService.getTokenPrice({ address: TOKEN_CONTRACT_ADDRESS }).catch();

          const jettonWalletAddressResult = await this.tonSdk.blockchain.execGetMethodForBlockchainAccount(Address.parse(TOKEN_CONTRACT_ADDRESS), "get_wallet_address", { args: [wallet.address.toRawString()] });
          const jettonWallet: Address = Address.parse(jettonWalletAddressResult.decoded?.jetton_wallet_address);

          const jettonTransferMessageBody: Cell = beginCell()
            .storeUint(0xf8a7ea5, 32)
            .storeUint(transferId, 64)
            .storeCoins(toNano(Number(AMOUNT) / 1_000))
            .storeAddress(Address.parse(TO_ADDRESS))
            .storeAddress(Address.parse(FROM_ADDRESS))
            .storeBit(false)
            .storeCoins(1n)
            .storeMaybeRef(undefined)
            .endCell();

          await contract.sendTransfer({
            seqno,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            secretKey: pair.secretKey,
            messages: [
              internal({
                to: jettonWallet,
                body: jettonTransferMessageBody,
                value: BigInt(toNano(AMOUNT)),
                bounce: false,
              }),
            ],
          });

          return {
            type: TransactionType.TRANSFER,
            network: NETWORK,
            status: TransactionStatus.PENDING,
            hash: `${transferId}:jetton`,
            amount: Number(AMOUNT),
            amount_usd: Number(AMOUNT) * jettonPrice.price,
            to: TO_ADDRESS,
            from: FROM_ADDRESS,
            currency: CURRENCY,
            fee: 0,
            fee_usd: 0,
          };
      }
    } catch (e) {
      this.logger("transferWalletTokenTransaction()").error("Failed to transfer token: " + e.message);
      throw e;
    }
  }

  /**
   * @name transferNativeWalletTokenTransaction
   * @desc Transfer native wallet token transaction
   * @param {types.TransferNativeWalletTokenTransactionParams} params
   * @returns {types.TransferNativeWalletTokenTransactionResult}
   */
  async transferNativeWalletTokenTransaction(params: types.TransferNativeWalletTokenTransactionParams): Promise<types.TransferNativeWalletTokenTransactionResult> {
    try {
      const FROM_PRIVATE_KEY: string = params?.from_private_key;
      const FROM_ADDRESS: string = params?.from_address;
      const TO_ADDRESS: string = params?.to_address;
      const NETWORK: Network = params?.network;
      const AMOUNT: string = params?.amount;

      switch (NETWORK) {
        case Network.ETH:
        case Network.BSC:
          const isEth: boolean = NETWORK === Network.ETH;
          const sdk: types.Sdk<Network.ETH | Network.BSC> = isEth ? this.ethSdk : this.bscSdk;

          const gasInfo: any = await sdk.blockchain.estimateGas({ to: TO_ADDRESS, from: FROM_ADDRESS, amount: AMOUNT });
          const gasLimit: string = String(gasInfo.gasLimit);
          const gasPrice: string = Math.ceil(Number(isEth ? gasInfo.estimations.fast : gasInfo.gasPrice) / 1_000_000_000).toString();

          const transactionResult: any = await sdk.transaction.send.transferSignedTransaction({ to: TO_ADDRESS, amount: AMOUNT, fromPrivateKey: FROM_PRIVATE_KEY, fee: { gasLimit, gasPrice } });
          const transaction = await sdk.blockchain.getTransaction(transactionResult.txId);
          const nativeTokenPrice: cmcTypes.GetTokenPriceResult = await this.cmcService.getTokenPrice({ symbol: networkNativeSymbol[NETWORK] }).catch();

          return {
            type: TransactionType.TRANSFER,
            network: NETWORK,
            status: TransactionStatus.PENDING,
            hash: transaction.transactionHash,
            amount: Number(AMOUNT),
            amount_usd: Number(AMOUNT) * nativeTokenPrice.price,
            to: TO_ADDRESS,
            from: FROM_ADDRESS,
            currency: networkNativeSymbol[NETWORK],
            fee: 0,
            fee_usd: 0,
          };
        case Network.SOL:
          const solTransactionResult: any = await this.solSdk.transaction.send.transferSignedTransaction({ to: TO_ADDRESS, from: FROM_ADDRESS, amount: AMOUNT, fromPrivateKey: FROM_PRIVATE_KEY });
          const solTransaction = await this.solSdk.blockchain.getTransaction(solTransactionResult.txId);
          const solPrice: cmcTypes.GetTokenPriceResult = await this.cmcService.getTokenPrice({ symbol: "SOL" }).catch();

          return {
            type: TransactionType.TRANSFER,
            network: NETWORK,
            status: TransactionStatus.PENDING,
            hash: solTransaction.transaction.signatures[0],
            amount: Number(AMOUNT),
            amount_usd: Number(AMOUNT) * solPrice.price,
            to: TO_ADDRESS,
            from: FROM_ADDRESS,
            currency: networkNativeSymbol[NETWORK],
            fee: 0,
            fee_usd: 0,
          };
        case Network.TON:
          const pair: KeyPair = await mnemonicToPrivateKey(FROM_PRIVATE_KEY.split(" "));
          const wallet: WalletContractV5R1 = WalletContractV5R1.create({ workchain: 0, publicKey: pair.publicKey });
          const contract: OpenedContract<WalletContractV5R1> = this.tonSecondSdk.open(wallet);
          const seqno: number = await contract.getSeqno();
          const tonPrice: number = (await this.tonSdk.rates.getRates({ tokens: ["TON"], currencies: ["USD"] })).rates.TON.prices.USD;
          const transferId: string = uuid();

          await contract.sendTransfer({
            seqno,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            secretKey: pair.secretKey,
            messages: [internal({ to: TO_ADDRESS, value: AMOUNT, bounce: false, body: transferId })],
          });

          return {
            type: TransactionType.TRANSFER,
            network: NETWORK,
            status: TransactionStatus.PENDING,
            hash: transferId,
            amount: Number(AMOUNT),
            amount_usd: Number(AMOUNT) * tonPrice,
            to: TO_ADDRESS,
            from: FROM_ADDRESS,
            currency: networkNativeSymbol[NETWORK],
            fee: 0,
            fee_usd: 0,
          };
      }
    } catch (e) {
      this.logger("transferNativeWalletTokenTransaction()").error("Failed to transfer native token: " + e.message);
      throw e;
    }
  }
}
