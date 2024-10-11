import { networkNativeSymbol, usdtContractByNetwork } from "../../domain/consts/network.const";
import { ServiceMethodResponseDto } from "src/common/dto/service-method-response.dto";
import { TransactionModel } from "../../domain/models/transaction.model";
import { Network, WalletType } from "../../domain/interfaces/wallet.interface";
import { SecretsModel } from "../../domain/models/secrets.model";
import { WalletModel } from "../../domain/models/wallet.model";
import { DB_DATE_FORMAT } from "src/common/consts/date.const";
import { TokenModel } from "../../domain/models/token.model";
import { HttpStatus, Injectable, Logger } from "@nestjs/common";
import * as types from "../interfaces/wallets.interface";
import { InjectRepository } from "@nestjs/typeorm";
import * as sdkTypes from "../interfaces/sdk.interface";
import { SdkService } from "./sdk.service";
import { Repository } from "typeorm";
import * as moment from "moment";
import { TransactionStatus, TransactionType } from "../../domain/interfaces/transaction.interface";
import { ReferralModel } from "src/domains/referral/domain/models/referral.model";

@Injectable()
export class WalletsService {
  private readonly logger = (context: string) => new Logger(`WalletsModule > WalletsService > ${context}`);

  constructor(
    private readonly sdkService: SdkService,
    @InjectRepository(TokenModel)
    private readonly tokenRepo: Repository<TokenModel>,
    @InjectRepository(WalletModel)
    private readonly walletRepo: Repository<WalletModel>,
    @InjectRepository(SecretsModel)
    private readonly secretsRepo: Repository<SecretsModel>,
    @InjectRepository(TransactionModel)
    private readonly transactionRepo: Repository<TransactionModel>,
    @InjectRepository(ReferralModel)
    private readonly referralRepo: Repository<ReferralModel>,
  ) {}

  /**
   * @name getWallet
   * @desc Get wallet
   * @param {types.GetWalletParams} params
   * @returns {Promise<ServiceMethodResponseDto<WalletModel>>}
   */
  async getWallet(params: types.GetWalletParams): Promise<ServiceMethodResponseDto<WalletModel>> {
    let wallet: WalletModel = await this.walletRepo.findOne({ where: { id: params.id } });

    if (!wallet) {
      return new ServiceMethodResponseDto<WalletModel>({ ok: false, status: HttpStatus.NOT_FOUND });
    }

    wallet = (await this.updateWalletBalances({ wallet })).data;
    wallet.tokens = await this.tokenRepo.find({ where: { wallet_id: wallet.id } });

    wallet.tokens = wallet.tokens.sort((a, b) => {
      const aIsNative = a.symbol === networkNativeSymbol[wallet.network];
      const bIsNative = b.symbol === networkNativeSymbol[wallet.network];
      if (aIsNative && !bIsNative) return -1;
      if (!aIsNative && bIsNative) return 1;
      return b.balance_usd - a.balance_usd;
    });

    return new ServiceMethodResponseDto<WalletModel>({ ok: true, data: wallet, status: HttpStatus.OK });
  }

  /**
   * @name getWallets
   * @desc Get wallets
   * @param {types.GetWalletsParams} params
   * @returns {Promise<ServiceMethodResponseDto<WalletModel[]>>}
   */
  async getWallets(params: types.GetWalletsParams): Promise<ServiceMethodResponseDto<WalletModel[]>> {
    const wallets: WalletModel[] = await this.walletRepo.find({ where: { user_id: params.user_id } });

    for (const wallet of wallets) {
      wallet.tokens = await this.tokenRepo.find({ where: { wallet_id: wallet.id } });
      const secrets: SecretsModel = await this.secretsRepo.findOne({ where: { wallet_id: wallet.id } });
      wallet.private_key = secrets.mnemonic;
    }

    return new ServiceMethodResponseDto<WalletModel[]>({ ok: true, data: wallets, status: HttpStatus.OK });
  }

  /**
   * @name deleteWallet
   * @desc Delete wallet
   * @param {types.DeleteWalletParams} params
   * @returns {Promise<ServiceMethodResponseDto<null>>}
   */
  async deleteWallet(params: types.DeleteWalletParams): Promise<ServiceMethodResponseDto<null>> {
    const wallet: WalletModel = await this.walletRepo.findOne({ where: { id: params.id } });
    const tokens: TokenModel[] = await this.tokenRepo.find({ where: { wallet_id: wallet.id } });
    const secrets: SecretsModel = await this.secretsRepo.findOne({ where: { wallet_id: wallet.id } });

    if (!wallet.can_deleted) {
      this.logger("deleteWallet()").error("Wallet cannot be deleted");
      return new ServiceMethodResponseDto<null>({ ok: false, status: HttpStatus.BAD_REQUEST, message: "Wallet cannot be deleted" });
    }

    for (const token of tokens) {
      await this.tokenRepo.delete({ id: token.id });
    }

    await this.secretsRepo.delete({ id: secrets.id });
    await this.walletRepo.delete({ id: wallet.id });

    return new ServiceMethodResponseDto<null>({ ok: true, status: HttpStatus.OK, data: null });
  }

  /**
   * @name getTokenInfo
   * @desc Get token info
   * @param {types.GetTokenInfoParams} params
   * @returns {Promise<ServiceMethodResponseDto<types.GetTokenInfoResult>>}
   */
  async getTokenInfo(params: types.GetTokenInfoParams): Promise<ServiceMethodResponseDto<types.GetTokenInfoResult>> {
    try {
      const tokenInfo: sdkTypes.GetTokenInfoResult = await this.sdkService.getTokenInfo({ address: params.contract, network: params.network });
      const tokenPrice: sdkTypes.GetTokenPriceResult = await this.sdkService.getTokenPrice({ address: params.contract });

      return new ServiceMethodResponseDto<types.GetTokenInfoResult>({
        ok: true,
        data: {
          network: params.network,
          contract: params.contract,
          ...tokenInfo,
          ...tokenPrice,
        },
        status: HttpStatus.OK,
      });
    } catch (e) {
      this.logger("getTokenInfo()").error(`Failed to get token info: ` + e.message);
      return new ServiceMethodResponseDto<types.GetTokenInfoResult>({ ok: false, status: HttpStatus.NOT_FOUND });
    }
  }

  /**
   * @name getTokenPrice
   * @desc Get token price
   * @param {types.GetTokenPriceParams} params
   * @returns {Promise<ServiceMethodResponseDto<types.GetTokenPriceResult>>}
   */
  async getTokenPrice(params: types.GetTokenPriceParams): Promise<ServiceMethodResponseDto<types.GetTokenPriceResult>> {
    try {
      const tokenPrice: sdkTypes.GetTokenPriceResult = await this.sdkService.getTokenPrice({ address: params.contract, symbol: params.symbol });
      return new ServiceMethodResponseDto<types.GetTokenPriceResult>({ ok: true, data: tokenPrice, status: HttpStatus.OK });
    } catch (e) {
      this.logger("getTokenPrice()").error(`Failed to get token price: ` + e.message);
      return new ServiceMethodResponseDto<types.GetTokenInfoResult>({ ok: false, status: HttpStatus.NOT_FOUND });
    }
  }

  async getTokenExtendedInfo(params: types.GetTokenPriceParams): Promise<ServiceMethodResponseDto<types.GetTokenExtendedInfoResult>> {
    try {
      const result = await this.sdkService.getTokenExtendedInfo(params);
      return new ServiceMethodResponseDto<types.GetTokenExtendedInfoResult>({ ok: true, data: result, status: HttpStatus.OK });
    } catch (e) {
      this.logger("getTokenExtendedInfo()").error(`Failed to get extended token info: ${e.message}`);
      return new ServiceMethodResponseDto({ ok: false, status: HttpStatus.INTERNAL_SERVER_ERROR, message: `Failed to get extended token info: ${e.message}` });
    }
  }

  /**
   * @name getHistoricalQuotes
   * @desc Get historical quotes for a token
   * @param {types.GetHistoricalQuotesParams} params
   * @returns {Promise<ServiceMethodResponseDto<types.GetHistoricalQuotesResult>>}
   */
  
  async getHistoricalQuotes(params: types.GetHistoricalQuotesParams): Promise<ServiceMethodResponseDto<types.GetHistoricalQuotesResult>> {
    try {
      console.log('getHistoricalQuotes params:', params);

      const result = await this.sdkService.getHistoricalQuotes(params);
      console.log('Historical quotes data received:', result);

      return new ServiceMethodResponseDto<types.GetHistoricalQuotesResult>({
        ok: true,
        data: result,
        status: HttpStatus.OK
      });
    } catch (e) {
      console.error(`Error in getHistoricalQuotes:`, e);
      this.logger("getHistoricalQuotes()").error(`Failed to get historical quotes for ${params.id || params.symbol || params.address}: ${e.message}`);
      return new ServiceMethodResponseDto({ 
        ok: false, 
        status: HttpStatus.INTERNAL_SERVER_ERROR, 
        message: `Failed to get historical quotes: ${e.message}` 
      });
    }
  }

  /**
   * @name importWallet
   * @desc Import existing wallet
   * @param {types.ImportWalletParams} params
   * @returns {Promise<ServiceMethodResponseDto<WalletModel>>}
   */
  async importWallet(params: types.ImportWalletParams): Promise<ServiceMethodResponseDto<WalletModel>> {
    const wallet: sdkTypes.GetImportedWalletResult = await this.sdkService.getImportedWallet({
      network: params.network,
      private_key: params.private_key,
    });

    const genWallet: WalletModel = await this.walletRepo.save({
      name: params.name ?? `Imported ${params.network} wallet`,
      user_id: params.user_id,
      network: params.network,
      type: WalletType.IMPORTED,
      address: wallet.address,
      is_generated: false,
      is_imported: true,
      created_at: moment().format(DB_DATE_FORMAT),
      updated_at: moment().format(DB_DATE_FORMAT),
    });

    const genSecrets: SecretsModel = await this.secretsRepo.save({
      ...wallet,
      wallet_id: genWallet.id,
      created_at: moment().format(DB_DATE_FORMAT),
    });

    const addTokenRes = await this.addWalletToken({
      network: params.network,
      wallet_id: genWallet.id,
      wallet_address: genWallet.address,
      contract: usdtContractByNetwork[params.network],
    });

    const addNativeTokenRes = await this.addNativeWalletToken({
      network: params.network,
      wallet_id: genWallet.id,
      wallet_address: genWallet.address,
    });

    if (!addNativeTokenRes.ok || !addTokenRes.ok) {
      await this.tokenRepo.delete({ wallet_id: genWallet.id });
      await this.walletRepo.delete({ id: genWallet.id });
      await this.secretsRepo.delete({ id: genSecrets.id });
      this.logger("importWallet()").error("Failed to import wallet");
      return new ServiceMethodResponseDto({ ok: false, status: HttpStatus.INTERNAL_SERVER_ERROR, message: "Failed to import wallet" });
    }

    if (!genSecrets || !genWallet) {
      this.logger("importWallet()").error("Failed to import wallet");
      return new ServiceMethodResponseDto({ ok: false, status: HttpStatus.INTERNAL_SERVER_ERROR, message: "Failed to import wallet" });
    }

    const walletTokens: TokenModel[] = await this.tokenRepo.find({ where: { wallet_id: genWallet.id } });
    let walletBalanceUsd: number = 0;

    for (const token of walletTokens) {
      walletBalanceUsd += token.balance_usd;
    }

    await this.walletRepo.update({ id: genWallet.id }, { balance_usd: walletBalanceUsd });
    const newWallet = await this.getWallet({ id: genWallet.id });

    return new ServiceMethodResponseDto<WalletModel>({ ok: true, data: newWallet.data, status: HttpStatus.OK });
  }

  /**
   * @name generateWallet
   * @desc Generate new wallet
   * @param {types.GenerateWalletParams} params
   * @returns {Promise<ServiceMethodResponseDto<WalletModel>>}
   */
  async generateWallet(params: types.GenerateWalletParams): Promise<ServiceMethodResponseDto<WalletModel>> {
    console.log('Generating wallet:', params);
    const wallet: sdkTypes.GenerateWalletResult = await this.sdkService.generateWallet({ network: params.network });
    console.log('Generated wallet:', wallet);
    const genWallet: WalletModel = await this.walletRepo.save({
      name: params.name ?? `${params.network} wallet`,
      user_id: params.user_id,
      network: params.network,
      type: WalletType.GENERATED,
      address: wallet.address,
      is_generated: true,
      is_imported: false,
      created_at: moment().format(DB_DATE_FORMAT),
      updated_at: moment().format(DB_DATE_FORMAT),
      can_deleted: params.can_deleted,
    });

    const genSecrets: SecretsModel = await this.secretsRepo.save({
      ...wallet,
      wallet_id: genWallet.id,
      created_at: moment().format(DB_DATE_FORMAT),
    });

    const addTokenRes = await this.addWalletToken({
      network: params.network,
      wallet_id: genWallet.id,
      wallet_address: genWallet.address,
      contract: usdtContractByNetwork[params.network],
    });
    console.log('Add token result:', addTokenRes);

    const addNativeTokenRes = await this.addNativeWalletToken({
      network: params.network,
      wallet_id: genWallet.id,
      wallet_address: genWallet.address,
    });
    console.log('Add native token result:', addNativeTokenRes);

    if (!addNativeTokenRes.ok || !addTokenRes.ok) {
      await this.tokenRepo.delete({ wallet_id: genWallet.id });
      await this.walletRepo.delete({ id: genWallet.id });
      await this.secretsRepo.delete({ id: genSecrets.id });
      this.logger("generateWallet()").error("Failed to generate wallet");
      return new ServiceMethodResponseDto({ ok: false, status: HttpStatus.INTERNAL_SERVER_ERROR, message: "Failed to generate wallet" });
    }

    if (!genSecrets || !genWallet) {
      this.logger("generateWallet()").error("Failed to generate wallet");
      return new ServiceMethodResponseDto({ ok: false, status: HttpStatus.INTERNAL_SERVER_ERROR, message: "Failed to generate wallet" });
    }

    const newWallet = await this.getWallet({ id: genWallet.id });
    return new ServiceMethodResponseDto<WalletModel>({ ok: true, data: newWallet.data, status: HttpStatus.OK });
  }

  /**
   * @name addWalletToken
   * @desc Add fungible/erc20/jetton token into wallet
   */
  async addWalletToken(params: types.AddWalletTokenParams): Promise<ServiceMethodResponseDto<null>> {
    try {
      console.log('Adding wallet token:', params);
      const isTokenAlreadyAdded: boolean = await this.tokenRepo.existsBy({
        wallet_id: params.wallet_id,
        network: params.network,
        contract: params.contract,
      });
  
      if (isTokenAlreadyAdded) {
        this.logger("addWalletToken()").error("Token already added");
        return new ServiceMethodResponseDto({ ok: false, status: HttpStatus.CONFLICT, message: "Token already added" });
      }
  
      const tokenInfo: sdkTypes.GetTokenInfoResult = await this.sdkService.getTokenInfo({
        network: params.network,
        address: params?.contract,
      });
      console.log('Token info:', tokenInfo);
  
      const tokenBalance: sdkTypes.GetWalletTokenBalanceResult = await this.sdkService.getWalletTokenBalance({
        network: params.network,
        address: params.wallet_address,
        contract: params.contract,
      });
      console.log('Token balance:', tokenBalance);
  
      const genToken: TokenModel = await this.tokenRepo.save({
        wallet_id: params.wallet_id,
        network: params.network,
        symbol: tokenInfo.symbol,
        name: tokenInfo.name,
        contract: params.contract,
        balance: tokenBalance.balance,
        balance_usd: tokenBalance.balance_usd,
        price: tokenBalance.price,
        price_change_percentage: tokenBalance.price_change_percentage,
        icon: tokenInfo.icon,
        created_at: moment().format(DB_DATE_FORMAT),
        updated_at: moment().format(DB_DATE_FORMAT),
      });
  
      if (!genToken) {
        this.logger("addWalletToken()").error("Failed to add token into wallet");
        return new ServiceMethodResponseDto({ ok: false, status: HttpStatus.INTERNAL_SERVER_ERROR, message: "Failed to add token into wallet" });
      }
  
      return new ServiceMethodResponseDto({ ok: true, status: HttpStatus.OK });
    } catch (e) {
      console.error('Error in addWalletToken:', e);
      this.logger("addWalletToken()").error("Failed to add token into wallet " + e.message);
      return new ServiceMethodResponseDto({ ok: false, status: HttpStatus.INTERNAL_SERVER_ERROR, message: "Failed to add token into wallet " + e.message });
    }
  }
  
  async addNativeWalletToken(params: types.AddNativeWalletTokenParams): Promise<ServiceMethodResponseDto<null>> {
    try {
      const tokenInfo: sdkTypes.GetTokenInfoResult = await this.sdkService.getTokenInfo({
        network: params.network,
        symbol: networkNativeSymbol[params.network],
      });
  
      const tokenBalance: sdkTypes.GetWalletBalanceResult = await this.sdkService.getWalletBalance({
        network: params.network,
        address: params.wallet_address,
      });
  
      const tokenPrice: sdkTypes.GetTokenPriceResult = await this.sdkService.getTokenPrice({
        symbol: networkNativeSymbol[params.network],
      });
  
      const genToken: TokenModel = await this.tokenRepo.save({
        wallet_id: params.wallet_id,
        network: params.network,
        symbol: tokenInfo.symbol,
        name: tokenInfo.name,
        balance: tokenBalance.balance,
        balance_usd: tokenBalance.balance_usd,
        price: tokenPrice.price,
        price_change_percentage: tokenPrice.price_change_percentage,
        icon: tokenInfo.icon,
        created_at: moment().format(DB_DATE_FORMAT),
        updated_at: moment().format(DB_DATE_FORMAT),
      });
  
      if (!genToken) {
        this.logger("addNativeWalletToken()").error("Failed to add token into wallet");
        return new ServiceMethodResponseDto({ ok: false, status: HttpStatus.INTERNAL_SERVER_ERROR, message: "Failed to add token into wallet" });
      }
  
      return new ServiceMethodResponseDto({ ok: true, status: HttpStatus.OK });
    } catch (e) {
      this.logger("addNativeWalletToken()").error("Failed to add token into wallet " + e.message);
      return new ServiceMethodResponseDto({ ok: false, status: HttpStatus.INTERNAL_SERVER_ERROR, message: "Failed to add token into wallet " + e.message });
    }
  }

  /**
   * @name generateWallets
   * @desc Generate new wallets (inside system function, not allowed for controllers)
   * @param {types.GenerateWalletsParams} params
   * @returns {Promise<ServiceMethodResponseDto<WalletModel[]>>}
   */
  async generateWallets(params: types.GenerateWalletsParams): Promise<ServiceMethodResponseDto<WalletModel[]>> {
    const wallets: WalletModel[] = [];

    for (const network of params.networks) {
      await new Promise((resolve) => setTimeout(resolve, 3000));
      const res = await this.generateWallet({ user_id: params.user_id, network, can_deleted: false });
      res.ok && wallets.push(res.data);
    }

    if (wallets.length !== params.networks.length) {
      for (const wallet of wallets) {
        await this.tokenRepo.delete({ wallet_id: wallet.id });
        await this.walletRepo.delete({ id: wallet.id });
        await this.secretsRepo.delete({ wallet_id: wallet.id });
      }

      return new ServiceMethodResponseDto({ ok: false, status: HttpStatus.INTERNAL_SERVER_ERROR });
    }

    return new ServiceMethodResponseDto<WalletModel[]>({ ok: true, data: wallets, status: HttpStatus.OK });
  }

  /**
   * @name updateWalletBalances
   * @desc Cron work that will update wallet and wallet tokens balances
   * @param {types.UpdateWalletBalancesParams} params
   * @returns {Promise<ServiceMethodResponseDto<null>>}
   */
  async updateWalletBalances(params: types.UpdateWalletBalancesParams): Promise<ServiceMethodResponseDto<WalletModel>> {
    let totalBalanceUsd: number = 0;
    const tokens: TokenModel[] = await this.tokenRepo.find({ where: { wallet_id: params.wallet.id } });

    // Update token balances
    for (const token of tokens) {
      const isNativeToken: boolean = networkNativeSymbol[token.network] === token.symbol;

      switch (isNativeToken) {
        case true:
          const nativeTokenPrice: sdkTypes.GetTokenPriceResult = await this.sdkService.getTokenPrice({ symbol: token.symbol });
          const nativeTokenBalance: sdkTypes.GetWalletBalanceResult = await this.sdkService.getWalletBalance({ network: token.network, address: params.wallet.address });
          totalBalanceUsd += nativeTokenBalance.balance_usd;
          await this.tokenRepo.update({ id: token.id }, { ...nativeTokenBalance, ...nativeTokenPrice, updated_at: moment().format(DB_DATE_FORMAT) });
          break;
        case false:
          const tokenBalance: sdkTypes.GetWalletTokenBalanceResult = await this.sdkService.getWalletTokenBalance({ network: token.network, address: params.wallet.address, contract: token.contract });
          totalBalanceUsd += tokenBalance.balance_usd;
          await this.tokenRepo.update({ id: token.id }, { ...tokenBalance, updated_at: moment().format(DB_DATE_FORMAT) });
          break;
      }
    }

    // Update wallet balance
    await this.walletRepo.update({ id: params.wallet.id }, { balance_usd: totalBalanceUsd, updated_at: moment().format(DB_DATE_FORMAT) });
    const updatedWallet: WalletModel = await this.walletRepo.findOne({ where: { id: params.wallet.id } });

    return new ServiceMethodResponseDto<WalletModel>({ ok: true, status: HttpStatus.OK, data: updatedWallet });
  }

  /**
   * @name transferTransaction
   * @desc Transfer transaction
   * @param {types.TransferTransactionParams} params
   * @returns {Promise<ServiceMethodResponseDto<TransactionModel>>}
   */
  async transferTransaction(params: types.TransferTransactionParams): Promise<ServiceMethodResponseDto<TransactionModel>> {
    try {
      const TO_ADDRESS: string = params?.to_address;
      const WALLET_ID: string = params?.wallet_id;
      const TOKEN_ID: string = params?.token_id;
      const AMOUNT: number = params?.amount;

      const walletData = await this.getWallet({ id: WALLET_ID });
      const wallet: WalletModel | undefined = walletData.data;
      const walletSecrets: SecretsModel = await this.secretsRepo.findOne({ where: { wallet_id: wallet.id } });
      const tokenToTransfer: TokenModel | undefined = wallet?.tokens.find((token) => token.id === TOKEN_ID);
      const isTokenNative: boolean = networkNativeSymbol[wallet?.network] === tokenToTransfer?.symbol;
      const balanceIsValid: boolean = tokenToTransfer?.balance > AMOUNT;

      if (!walletData.data || !walletSecrets) {
        this.logger("transferTransaction()").error("Wallet not found");
        return new ServiceMethodResponseDto({ ok: false, data: null, status: HttpStatus.NOT_FOUND, message: "Wallet not found" });
      }

      if (!tokenToTransfer) {
        this.logger("transferTransaction()").error("Token not found");
        return new ServiceMethodResponseDto({ ok: false, data: null, status: HttpStatus.NOT_FOUND, message: "Token not found" });
      }

      if (!balanceIsValid) {
        this.logger("transferTransaction()").error("Insufficient balance");
        return new ServiceMethodResponseDto({ ok: false, data: null, status: HttpStatus.BAD_REQUEST, message: "Insufficient balance" });
      }

      let transactionResult: sdkTypes.TransferWalletTokenTransactionResult | sdkTypes.TransferNativeWalletTokenTransactionResult;

      switch (isTokenNative) {
        case true:
          transactionResult = await this.sdkService.transferNativeWalletTokenTransaction({
            network: tokenToTransfer.network,
            amount: AMOUNT.toString(),
            to_address: TO_ADDRESS,
            from_address: wallet.address,
            from_private_key: tokenToTransfer.network === Network.TON ? walletSecrets.mnemonic : walletSecrets.private_key,
          });
          break;
        case false:
          transactionResult = await this.sdkService.transferWalletTokenTransaction({
            network: tokenToTransfer.network,
            amount: AMOUNT.toString(),
            currency: tokenToTransfer.symbol,
            to_address: TO_ADDRESS,
            from_address: wallet.address,
            from_private_key: tokenToTransfer.network === Network.TON ? walletSecrets.mnemonic : walletSecrets.private_key,
            token_contract_address: tokenToTransfer.contract,
          });
          break;
      }

      const walletTransaction: TransactionModel = await this.transactionRepo.save({
        wallet_id: WALLET_ID,
        ...transactionResult,
      });

      return new ServiceMethodResponseDto<TransactionModel>({ ok: true, data: walletTransaction, status: HttpStatus.OK });
    } catch (e) {
      this.logger("transferTransaction()").error("Failed to transfer token: " + e.message);
      return new ServiceMethodResponseDto({ ok: false, data: null, status: HttpStatus.INTERNAL_SERVER_ERROR, message: `Failed to transfer token: ${e.message}` });
    }
  }

  /**
   * @name getWalletTransactions
   * @desc Get wallet transactions
   * @param {types.GetWalletTransactionsParams} params
   * @returns {Promise<ServiceMethodResponseDto<TransactionModel[]>>}
   */
  async getWalletTransactions(params: types.GetWalletTransactionsParams): Promise<ServiceMethodResponseDto<TransactionModel[]>> {
    const walletData = await this.getWallet({ id: params.id });

    if (!walletData.data) {
      this.logger("getWalletTransactions()").error("Wallet not found");
      return new ServiceMethodResponseDto({ ok: false, data: null, status: HttpStatus.NOT_FOUND, message: "Wallet not found" });
    }

    let transactions: TransactionModel[] = await this.transactionRepo.find({ where: { wallet_id: walletData.data.id } });

    transactions = transactions.sort((a, b) => {
      const createdAt: moment.Moment = moment(a.created_at);
      const createdAtB: moment.Moment = moment(b.created_at);
      if (createdAt.isBefore(createdAtB)) return 1;
      if (createdAt.isAfter(createdAtB)) return -1;
      return 0;
    });

    return new ServiceMethodResponseDto({ ok: true, data: transactions ?? [], status: HttpStatus.OK });
  }


  /**
 * @name swapTokens
 * @desc Swap tokens within a wallet
 * @param {types.SwapTokensParams} params
 * @returns {Promise<ServiceMethodResponseDto<TransactionModel>>}
 */
  async swapTokens(params: types.SwapTokensParams): Promise<ServiceMethodResponseDto<TransactionModel>> {
    try {
      const { wallet_id, from_token_id, to_token_id, amount, slippageBps } = params;
  
      console.log("Received params in swapTokens:", { wallet_id, from_token_id, to_token_id, amount });
  
      // Get wallet and tokens information
      const walletData = await this.getWallet({ id: wallet_id });
      if (!walletData.ok || !walletData.data) {
        return new ServiceMethodResponseDto({ ok: false, status: HttpStatus.NOT_FOUND, message: "Wallet not found" });
      }
      const wallet: WalletModel = walletData.data;
  
      const fromToken = wallet.tokens.find(token => token.id === from_token_id);
      const toToken = wallet.tokens.find(token => token.id === to_token_id);
  
      if (!fromToken || !toToken) {
        return new ServiceMethodResponseDto({ ok: false, status: HttpStatus.NOT_FOUND, message: "Token not found" });
      }
  
      if (fromToken.balance < amount) {
        return new ServiceMethodResponseDto({ ok: false, status: HttpStatus.BAD_REQUEST, message: "Insufficient balance" });
      }
  
      // Get wallet secrets
      const secrets = await this.secretsRepo.findOne({ where: { wallet_id: wallet.id } });
      if (!secrets) {
        return new ServiceMethodResponseDto({ ok: false, status: HttpStatus.NOT_FOUND, message: "Wallet secrets not found" });
      }
  
      // Perform the swap
      const swapResult = await this.sdkService.swapTokens({
        network: wallet.network,
        fromTokenAddress: fromToken.contract,
        toTokenAddress: toToken.contract,
        amount: amount.toString(),
        fromAddress: wallet.address,
        fromPrivateKey: wallet.network === Network.TON ? secrets.mnemonic : secrets.private_key,
        slippageBps: slippageBps, 
      });
  
      console.log("Swap result:", swapResult);
  
      // Save the transaction
      const transaction = await this.transactionRepo.save({
        wallet_id: wallet.id,
        type: TransactionType.SWAP,
        network: wallet.network,
        status: TransactionStatus.PENDING,
        hash: swapResult.hash,
        amount: amount,
        amount_usd: amount * fromToken.price,
        from: wallet.address,
        to: wallet.address,
        fromCurrency: fromToken.symbol,
        toCurrency: toToken.symbol,
        fee: swapResult.fee,
        fee_usd: swapResult.fee_usd,
        created_at: moment().format(DB_DATE_FORMAT),
        updated_at: moment().format(DB_DATE_FORMAT),
        service_fee: (amount * 100) / 10000,
        service_fee_usd: (amount * fromToken.price * 100) / 10000
      });
  
      // Update token balances
      await this.updateWalletBalances({ wallet });
  
      return new ServiceMethodResponseDto<TransactionModel>({ ok: true, data: transaction, status: HttpStatus.OK });
    } catch (e) {
      console.error("Error in swapTokens:", e);
      this.logger("swapTokens()").error(`Failed to swap tokens: ${e.message}`);
      return new ServiceMethodResponseDto({ ok: false, status: HttpStatus.INTERNAL_SERVER_ERROR, message: `Failed to swap tokens: ${e.message}` });
    }
  }

  async processReferralCommission(transactionId: string): Promise<boolean> {
    try {
      const transaction = await this.transactionRepo.findOne({ where: { id: transactionId } });
      this.logger("processReferralCommission()").log(`Processing transaction ${transactionId}`);
  
      if (!transaction) {
        this.logger("processReferralCommission()").warn(`Transaction ${transactionId} not found`);
        return false;
      }
  
      if (transaction.is_referral_processed) {
        this.logger("processReferralCommission()").warn(`Transaction ${transactionId} already processed`);
        return false;
      }
  
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      if (new Date(transaction.created_at) < twentyFourHoursAgo) {
        this.logger("processReferralCommission()").warn(`Transaction ${transactionId} is too old`);
        await this.transactionRepo.update({ id: transactionId }, { is_referral_processed: true });
        return false;
      }
  
      const wallet = await this.walletRepo.findOne({ where: { id: transaction.wallet_id } });
      if (!wallet) {
        this.logger("processReferralCommission()").warn(`Wallet not found for transaction ${transactionId}`);
        await this.transactionRepo.update({ id: transactionId }, { is_referral_processed: true });
        return false;
      }
  
      const referral = await this.referralRepo.findOne({ where: { user_id: wallet.user_id } });
      if (!referral || !referral.invited_by) {
        this.logger("processReferralCommission()").warn(`No valid referral found for user ${wallet.user_id}`);
        await this.transactionRepo.update({ id: transactionId }, { is_referral_processed: true });
        return false;
      }
  
      const referralCommission = transaction.service_fee_usd * 0.3;
      this.logger("processReferralCommission()").log(`Calculated commission: ${referralCommission} USD for transaction ${transactionId}`);
  
      await this.referralRepo.update(
        { user_id: referral.invited_by },
        { 
          balance: () => `balance + ${referralCommission}`,
        }
      );
  
      await this.transactionRepo.update({ id: transactionId }, { is_referral_processed: true });
      this.logger("processReferralCommission()").log(`Referral commission of ${referralCommission} USD credited to user ${referral.invited_by}`);
      return true;
    } catch (error) {
      this.logger("processReferralCommission()").error(`Failed to process referral commission: ${error.message}`);
      return false;
    }
  }


async estimateSwapFee(params: types.SwapTokensParams): Promise<ServiceMethodResponseDto<number>> {
  this.logger(`Estimating swap fee for params: ${JSON.stringify(params)}`);
  try {
    const { wallet_id, from_token_id, to_token_id, amount } = params;

    this.logger(`Getting wallet data for ID: ${wallet_id}`);
    const walletData = await this.getWallet({ id: wallet_id });
    if (!walletData.ok || !walletData.data) {
      this.logger(`Wallet not found for ID: ${wallet_id}`);
      return new ServiceMethodResponseDto({ ok: false, status: HttpStatus.NOT_FOUND, message: "Wallet not found" });
    }
    const wallet: WalletModel = walletData.data;
    this.logger(`Wallet found: ${JSON.stringify(wallet)}`);

    const fromToken = wallet.tokens.find(token => token.id === from_token_id);
    const toToken = wallet.tokens.find(token => token.id === to_token_id);

    if (!fromToken || !toToken) {
      this.logger(`Token not found. FromToken: ${from_token_id}, ToToken: ${to_token_id}`);
      return new ServiceMethodResponseDto({ ok: false, status: HttpStatus.NOT_FOUND, message: "Token not found" });
    }
    this.logger(`Tokens found. FromToken: ${JSON.stringify(fromToken)}, ToToken: ${JSON.stringify(toToken)}`);

    this.logger(`Calling sdkService.estimateSwapFee`);
    const estimatedFee = await this.sdkService.estimateSwapFee({
      network: wallet.network,
      fromTokenAddress: fromToken.contract,
      toTokenAddress: toToken.contract,
      amount: amount.toString(),
      fromAddress: wallet.address,
      fromPrivateKey: ''
    });
    this.logger(`Estimated fee: ${estimatedFee}`);

    return new ServiceMethodResponseDto<number>({ ok: true, data: estimatedFee, status: HttpStatus.OK });
  } catch (e) {
    this.logger(`Failed to estimate swap fee: ${e.message}`);
    return new ServiceMethodResponseDto({ ok: false, status: HttpStatus.INTERNAL_SERVER_ERROR, message: `Failed to estimate swap fee: ${e.message}` });
  }
}

}
