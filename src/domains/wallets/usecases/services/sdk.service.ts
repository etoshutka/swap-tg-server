import { Address, beginCell, Cell, internal, OpenedContract, Sender, SenderArguments, SendMode, toNano, TonClient, WalletContractV5R1 } from "@ton/ton";
import { networkNativeSymbol, networkSymbol } from "../../domain/consts/network.const";
import { TransactionStatus, TransactionType } from "../../domain/interfaces/transaction.interface";
import { Ethereum, Network as TatumNetwork, TatumSDK, Solana } from "@tatumio/tatum";
import { KeyPair, mnemonicNew, mnemonicToPrivateKey } from "@ton/crypto";
import { GetTokenPriceResult } from "../interfaces/cmc.interface";
import { Network } from "../../domain/interfaces/wallet.interface";
import { Api, TonApiClient, JettonBalance } from "@ton-api/client";
import { Asset, Factory, JettonRoot, MAINNET_FACTORY_ADDR, PoolType, ReadinessStatus, VaultJetton} from '@dedust/sdk';
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
import { createSolanaKeypair, jupiterSwap } from "./jupiterSwap";
import { Connection, Keypair } from "@solana/web3.js";
import bs58 from 'bs58';
import { Wallet } from "@project-serum/anchor";

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
    this.ethSdk = TatumEthSDK({
      apiKey: this.configService.get("TATUM_MAINNET_API_KEY"),
    });

    this.bscSdk = TatumBscSDK({
      apiKey: this.configService.get("TATUM_MAINNET_API_KEY"),
    });

    this.solSdk = TatumSolanaSDK({
      apiKey: this.configService.get("TATUM_MAINNET_API_KEY"),
    });

    // this.tonSdk = new Api(
    //   new TonApiClient({
    //     baseUrl: this.configService.get("TON_API_API_URL"),
    //     baseApiParams: { headers: { Authorization: `Bearer ${this.configService.get("TON_API_API_KEY")}`, "Content-type": "application/json" } },
    //   }),
    // );

    const http = new TonApiClient({
      baseUrl: 'https://tonapi.io',
      apiKey: this.configService.get("TON_API_API_KEY")
    });

    this.tonSdk = new Api(http)
    

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
   * @name getTokenExtendedInfo
   * @desc Get extended token information
   * @param {types.GetTokenInfoParams} params
   * @returns {Promise<types.GetTokenExtendedInfoResult>}
   */
  async getTokenExtendedInfo(params: types.GetTokenPriceParams): Promise<types.GetTokenExtendedInfoResult> {
    try {
      return await this.cmcService.getTokenExtendedInfo({ symbol: params?.symbol, address: params?.address });
    } catch (e) {
      this.logger("getTokenExtendedInfo()").error(`Failed to get extended info for ${params.symbol || params.address}: ${e.message}`);
      throw e;
    }
  }

  /**
   * @name getHistoricalQuotes
   * @desc Get historical quotes for a token
   * @param {types.GetHistoricalQuotesParams} params
   * @returns {Promise<types.GetHistoricalQuotesResult>}
   */
  async getHistoricalQuotes(params: types.GetHistoricalQuotesParams): Promise<types.GetHistoricalQuotesResult> {
    try {
      return await this.cmcService.getHistoricalQuotes({
        id: params.id,
        symbol: params.symbol,
        address: params.address,
        timeStart: params.timeStart,
        timeEnd: params.timeEnd,
        count: params.count,
        interval: params.interval,
        convert: params.convert,
      });
    } catch (e) {
      this.logger("getHistoricalQuotes()").error(`Failed to get historical quotes for ${params.id || params.symbol || params.address}: ${e.message}`);
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
            try {
              const address = Address.parse(params.address);
              const balance = await this.tonSecondSdk.getBalance(address);
              const balanceInTON = Number(balance) / 1e9; 
              let price = 0;
              try {
                price = (await this.tonSdk.rates.getRates({ tokens: [networkNativeSymbol[params.network]], currencies: ["USD"] })).rates.TON.prices.USD;
              } catch (error) {

              }
              
              const balance_usd = balanceInTON * price;
              

              
              return { balance: balanceInTON, balance_usd };
            } catch (error) {
              return { balance: 0, balance_usd: 0 };
            }
        }
    } catch (e) {
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
       

        const tonJettonBalance: JettonBalance = await this.tonSdk.accounts.getAccountJettonBalance(
          Address.parse(params.address), 
          Address.parse(params.contract), 
          { currencies: ["USD"] }
        );
       

        const balance = Number(tonJettonBalance.balance) / Math.pow(10, Number(tonJettonBalance.jetton.decimals));
        const balance_usd = balance * tonJettonPrice.price;

        return {
          balance,
          balance_usd,
          price: tonJettonPrice.price,
          price_change_percentage: tonJettonPrice.price_change_percentage,
        };
      } catch (error) {
        console.error('Error fetching TON token balance:', error);
        
        // В случае ошибки при получении баланса, всё равно пытаемся получить цену токена
        const tonJettonPrice: GetTokenPriceResult = await this.cmcService.getTokenPrice({ address: params.contract })
          .catch(() => ({ price: 0, price_change_percentage: 0 }));

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

  /**
   * @name swapTokens
   * @desc Swap tokens across different networks
   * @param {types.SwapTokensParams} params
   * @returns {Promise<types.SwapTokensResult>}
   */
  async swapTokens(params: types.SwapTokensParams): Promise<types.SwapTokensResult> {
    try {
      const { network, fromTokenAddress, toTokenAddress, amount, fromAddress, fromPrivateKey, slippageBps } = params;

      // console.log("Received slippageBps:", slippageBps); 
  
       
      if (!fromPrivateKey) {
        throw new Error('fromPrivateKey is null or undefined');
      }
  
      switch (network) {
        case Network.BSC:
        case Network.ETH:
          const isEth = network === Network.ETH;
          const sdk: types.Sdk<Network.ETH | Network.BSC> = isEth ? this.ethSdk : this.bscSdk;
          const zeroXApiUrl = 'https://api.0x.org';
          const nativeSymbol = isEth ? 'ETH' : 'BNB';
          const chainId = isEth ? '1' : '56';
      
          const WETH_ADDRESS = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
          const WBNB_ADDRESS = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
      
          const nativeTokenAddress = isEth ? WETH_ADDRESS : WBNB_ADDRESS;
      
          const sellTokenAddress = fromTokenAddress || nativeTokenAddress;
          const buyTokenAddress = toTokenAddress || nativeTokenAddress;
      
          const decimals: number = fromTokenAddress ? await sdk.erc20.decimals(fromTokenAddress) : 18;
         
      
          // Log balance before swap
          const balanceBefore = Number((await sdk.blockchain.getBlockchainAccountBalance(fromAddress)).balance);
         
         
         
      
          // Convert amount to wei (as a BigInt)
          const sellAmountWei = BigInt(Math.floor(Number(amount) * Number(10**decimals)));
         
      
          const priceParams = new URLSearchParams({
            chainId,
            buyToken: buyTokenAddress,
            sellToken: sellTokenAddress,
            sellAmount: sellAmountWei.toString(),
            taker: fromAddress,
            slippageBps: slippageBps.toString(),
            swapFeeRecipient: '0x3A454De19854bD2F771e4025E568C6E3A21117df',
            swapFeeBps: '1000',
            swapFeeToken: sellTokenAddress
          });
      
         
      
          const priceResponse = await fetch(`${zeroXApiUrl}/swap/allowance-holder/price?${priceParams}`, {
            method: 'GET',
            headers: { 
              '0x-api-key': this.configService.get("ZEROX_API_KEY"),
              '0x-version': 'v2',
              'Accept': 'application/json'
            }
          });
      
          if (!priceResponse.ok) {
            const errorText = await priceResponse.text();
            console.error('0x API Price Error:', errorText);
            throw new Error(`HTTP error! status: ${priceResponse.status}`);
          }
      
          const priceData = await priceResponse.json();
         

          const quoteParams = new URLSearchParams({
            chainId,
            buyToken: buyTokenAddress,
            sellToken: sellTokenAddress,
            sellAmount: sellAmountWei.toString(),
            taker: fromAddress,
            slippageBps: slippageBps.toString(),
            swapFeeRecipient: '0x3A454De19854bD2F771e4025E568C6E3A21117df',
            swapFeeBps: '1000',
            swapFeeToken: sellTokenAddress
          });
      
        
      
          const response = await fetch(`${zeroXApiUrl}/swap/allowance-holder/quote?${quoteParams}`, {
            method: 'GET',
            headers: { 
              '0x-api-key': this.configService.get("ZEROX_API_KEY"),
              '0x-version': 'v2',
              'Accept': 'application/json'
            }
          });
      
          if (!response.ok) {        
            throw new Error(`HTTP error! status: ${response.status}`);
          }
      
          const quoteData = await response.json();
        
      
          const gasLimit = priceData.gas;
          const gasPrice = Math.ceil(Number(priceData.gasPrice / 1_000_000_000)).toString();
         // const totalGasCost = BigInt(gasLimit) * BigInt(gasPrice);
      
          
      
          let txResult;
      
          if (sellTokenAddress !== nativeTokenAddress) {
            
            if (quoteData.issues && quoteData.issues.allowance !== null) {
            const approveTx: any = await sdk.erc20.send.approveSignedTransaction({
              amount: amount,
              spender: quoteData.issues.allowance.spender,
              contractAddress: sellTokenAddress,
              fromPrivateKey,
              fee: {
                gasLimit: gasLimit,
                gasPrice: gasPrice,
              },
            });
           
          
            const approvalTransaction = await sdk.blockchain.getTransaction(approveTx.txId);
          
          }
      
              txResult = await sdk.transaction.send.transferSignedTransaction({
              to: quoteData.transaction.to,
              amount: quoteData.transaction.value,
              data: quoteData.transaction.data,
              fromPrivateKey,
              fee: {
                gasLimit: gasLimit,
                gasPrice: gasPrice,
              }
            });
            // txResult = await sdk.erc20.send.transferSignedTransaction({
            //   to: quoteData.transaction.to,
            //   amount: amount,
            //   fromPrivateKey,
            //   contractAddress: sellTokenAddress,
            //   digits: decimals,
            //   data: quoteData.transaction.data,
            //   fee: isEth? {
            //     gasLimit: gasLimit,
            //     gasPrice: gasPrice,
            //   } : undefined,
            
          } else {
          
            txResult = await sdk.transaction.send.transferSignedTransaction({
              to: quoteData.transaction.to,
              amount: amount,
              data: quoteData.transaction.data,
              fromPrivateKey,
              fee: {
                gasLimit: gasLimit,
                gasPrice: gasPrice,
              }
            });
          }
      
         
      
          // Log balance after swap
          const balanceAfter = Number((await sdk.blockchain.getBlockchainAccountBalance(fromAddress)).balance);
          
      
          // Получение цен токенов для конвертации в USD
          const [fromTokenPriceInfo, toTokenPriceInfo] = await Promise.all([
            this.cmcService.getTokenPrice({ address: fromTokenAddress, symbol: fromTokenAddress ? undefined : nativeSymbol }),
            this.cmcService.getTokenPrice({ address: toTokenAddress, symbol: toTokenAddress ? undefined : nativeSymbol })
          ]);
      
          const ethresult = {
            type: TransactionType.SWAP,
            network,
            status: TransactionStatus.PENDING,
            hash: txResult.txId,
            fromAmount: Number(quoteData.sellAmount) / 10**decimals,
            fromAmount_usd: (Number(quoteData.sellAmount) / 10**decimals) * fromTokenPriceInfo.price,
            toAmount: Number(quoteData.buyAmount) / 1e18,
            toAmount_usd: (Number(quoteData.buyAmount) / 1e18) * toTokenPriceInfo.price,
            from: fromAddress,
            to: fromAddress,
            currency: nativeSymbol,
            fromCurrency: fromTokenAddress || nativeSymbol,
            toCurrency: toTokenAddress || nativeSymbol,
            fee: Number(quoteData.totalNetworkFee) / 1e18,
            fee_usd: (Number(quoteData.totalNetworkFee) / 1e18) * fromTokenPriceInfo.price,
          };
      
          return ethresult;

        case Network.SOL:

          const apikey = this.configService.get("TATUM_MAINNET_API_KEY")
          // const tatumRpcUrl = `https://api.tatum.io/v3/blockchain/node/solana-mainnet/${apikey}`;
          // const headers = {
          //   'accept': 'application/json',
          //   'content-type': 'application/json',
          //   'x-api-key': this.configService.get("TATUM_MAINNET_API_KEY")
          // };

          const tatumRpcUrl = 'https://api.mainnet-beta.solana.com'

          

          // Функция для выполнения RPC-запросов
          const tatumRpcRequest = async (method: string, params: any[] = []) => {
          //   const response = await fetch(tatumRpcUrl, {
          //     method: 'POST',
          //     headers: headers,
          //     body: JSON.stringify({
          //       jsonrpc: '2.0',
          //       id: 1,
          //       method: method,
          //       params: params
          //     })
          //   });

            if (!response.ok) {
              throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            if (data.error) {
              throw new Error(`RPC error: ${data.error.message}`);
            }

            return data.result;
          };

        console.log("Creating connection");
        // Создаем соединение с использованием нашей функции RPC-запросов
        const connection = new Connection(tatumRpcUrl)

        
        // try {
        //   const blockHeight = await connection.getBlockHeight();
        //   console.log('Current block height:', blockHeight);
        // } catch (error) {
        //   console.error('Error connecting to Solana network:', error);
        //   throw new Error(`Failed to connect to Solana network: ${error.message}`);
        // }


      
        console.log("Creating Solana Keypair");

          let keypair;
          try {
            keypair = createSolanaKeypair(fromPrivateKey);
          
          } catch (error) {
         
            throw new Error(`Failed to create Solana Keypair: ${error.message}`);
          }

          console.log("Creating Solana wallet");

          const walletsol = new Wallet(keypair);
        

          // Perform the swap
            
          
          const txid = await jupiterSwap(
            connection,
            walletsol,
            fromTokenAddress || "So11111111111111111111111111111111111111112",
            toTokenAddress || "So11111111111111111111111111111111111111112",
            Number(amount),
            slippageBps,
            1000 // platformFeeBps (10%)
          );
        
          //console.log("Slippage (bps):", slippageBps);

          console.log("jupiterSwap result:", txid);

         // const txDetails = await txid.txid;
         // const txDetails = await this.solSdk.blockchain.getTransaction(txid.txid)
         


          // Get token prices for USD conversion
          
          const [fromTokenPriceSol, toTokenPriceSol] = await Promise.all([
            this.cmcService.getTokenPrice({ address: fromTokenAddress, symbol: fromTokenAddress ? undefined : "SOL" }),
            this.cmcService.getTokenPrice({ address: toTokenAddress, symbol: toTokenAddress ? undefined : "SOL" })
          ]);
        


          // Prepare and return the result
          const solresult = {
            type: TransactionType.SWAP,
            network: Network.SOL,
            status: TransactionStatus.PENDING,
            hash: txid.txid,
            fromAmount: Number(amount),
            fromAmount_usd: Number(amount) * fromTokenPriceSol.price,
            toAmount: 0, // Нужно вычислить из результата транзакции, если возможно
            toAmount_usd: 0,
            from: fromAddress,
            to: fromAddress,
            currency: "SOL",
            fromCurrency: fromTokenAddress || "SOL",
            toCurrency: toTokenAddress || "SOL",
            fee: 0,
            fee_usd: 0
          };
          
          console.log("Final result:", solresult);

          return solresult;

        case Network.TON:
          const factory = this.tonSecondSdk.open(Factory.createFromAddress(MAINNET_FACTORY_ADDR));
        
  
          const tonVault = this.tonSecondSdk.open(await factory.getNativeVault());
        
  
          const fromToken = fromTokenAddress ? Asset.jetton(Address.parse(fromTokenAddress)) : Asset.native();
          const toToken = toTokenAddress ? Asset.jetton(Address.parse(toTokenAddress)) : Asset.native();
          
  
          const pool = this.tonSecondSdk.open(await factory.getPool(PoolType.VOLATILE, [fromToken, toToken]));
         
  
          if ((await pool.getReadinessStatus()) !== ReadinessStatus.READY) {
            throw new Error(`Pool (${fromToken}, ${toToken}) does not exist.`);
          }
  
          if ((await tonVault.getReadinessStatus()) !== ReadinessStatus.READY) {
            throw new Error('Vault (TON) does not exist.');
          }
  
          const amountIn = toNano(amount);
         
  
          // Create and sign the transaction
          const pair: KeyPair = await mnemonicToPrivateKey(fromPrivateKey.split(" "));
         
  
          const wallet: WalletContractV5R1 = WalletContractV5R1.create({ workchain: 0, publicKey: pair.publicKey });
         
  
          const contract: OpenedContract<WalletContractV5R1> = this.tonSecondSdk.open(wallet);
          const seqno: number = await contract.getSeqno();
         
  
          const transferId: string = uuid();
          
  
          // Create a Sender object
          const sender: Sender = {
            address: wallet.address,
            send: async (args: SenderArguments) => {
                         await contract.sendTransfer({
                seqno,
                sendMode: SendMode.PAY_GAS_SEPARATELY,
                secretKey: pair.secretKey,
                messages: [
                  internal({
                    to: args.to,
                    value: args.value,
                    body: args.body,
                    bounce: false
                  })
                ],
              });
           
            }
          };
  
          // Use sendSwap method
          if (fromToken.toString() === Asset.native().toString()) {
           
            await tonVault.sendSwap(sender, {
              poolAddress: pool.address,
              amount: amountIn,
              gasAmount: toNano("0.25"),
            });
          } else {
           
            if (!fromTokenAddress) {
              throw new Error('fromTokenAddress is required for Jetton swap');
            }
            const jettonVault = this.tonSecondSdk.open(await factory.getJettonVault(Address.parse(fromTokenAddress)));
           
            const jettonRoot = this.tonSecondSdk.open(JettonRoot.createFromAddress(Address.parse(fromTokenAddress)));
            const jettonWallet = this.tonSecondSdk.open(await jettonRoot.getWallet(sender.address));
           
            await jettonWallet.sendTransfer(sender, toNano("0.3"), {
              amount: amountIn,
              destination: jettonVault.address,
              responseAddress: sender.address,
              forwardAmount: toNano("0.25"),
              forwardPayload: VaultJetton.createSwapPayload({ poolAddress: pool.address }),
            });
          }
  
          const safeGetTokenPrice = async (address: string | null, symbol: string): Promise<number> => {
            try {
              if (!address && symbol.toUpperCase() === 'TON') {
                const price = await this.cmcService.getTokenPrice({ symbol: 'TON' });
                return price.price;
              }
              if (address) {
                const price = await this.cmcService.getTokenPrice({ address });
                return price.price;
              }
              return 0;
            } catch (error) {
              console.warn(`Failed to get price for ${symbol || address}: ${error.message}`);
              return 0;
            }
          };
  
          const fromTokenPrice = await safeGetTokenPrice(fromTokenAddress, fromToken.toString());
          const toTokenPrice = await safeGetTokenPrice(toTokenAddress, toToken.toString());
      
         
  
          const result = {
            type: TransactionType.SWAP,
            network: Network.TON,
            status: TransactionStatus.PENDING,
            hash: transferId,
            fromAmount: Number(amount),
            fromAmount_usd: Number(amount) * fromTokenPrice,
            toAmount: 0,
            toAmount_usd: 0,
            from: fromAddress,
            to: fromAddress,
            currency: 'TON',
            fromCurrency: fromTokenAddress ? fromToken.toString().replace('jetton:', '') : 'TON',
            toCurrency: toTokenAddress ? toToken.toString().replace('jetton:', '') : 'TON',
            fee: 0,
            fee_usd: 0,
          };
  
          
          return result;
  
        default:
          throw new Error(`Unsupported network: ${network}`);
      }
    } catch (e) {
      console.error('Error in swapTokens:', e);
      this.logger("swapTokens()").error(`Failed to swap tokens: ${e.message}`);
      throw e;
    }
  }

  async estimateSwapFee(params: types.SwapTokensParams): Promise<number> {
    this.logger(`Estimating swap fee for params: ${JSON.stringify(params)}`);
    switch (params.network) {
      case Network.ETH:
        return 0
      case Network.BSC:
        return 0.001
      case Network.SOL:
        this.logger(`Returning fixed fee for SOL: 0.0001`);
        return 0.0001;
      case Network.TON:
        this.logger(`Returning fixed fee for TON: 0.25`);
        return 0.25; 
    }
  }
}
