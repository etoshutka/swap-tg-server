import * as types from "../interfaces/cmc.interface";
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class CmcService {
  public tokenInfoCache: Record<string, types.GetTokenInfoResult> = {};
  private readonly logger = (context: string) => new Logger(`WalletsModule > CmcService > ${context}`);

  constructor(private readonly configService: ConfigService) {}

  /**
   * @name makeRequest
   * @desc Request constructor
   * @param {MakeRequestParams} params
   * @returns {Promise<any>}
   */
  async makeRequest(params: types.MakeRequestParams): Promise<any> {
    const query: URLSearchParams = new URLSearchParams(params.query);
    Object.keys(params.query).forEach((key) => params.query[key] === undefined && query.delete(key));

    const res = await fetch(`https://pro-api.coinmarketcap.com/v2/cryptocurrency/${params.endpoint}?${query.toString()}`, {
      method: "GET",
      headers: { "X-CMC_PRO_API_KEY": this.configService.get("CMC_API_KEY") },
    });

    const json = await res.json();
    return json?.data;
  }

  /**
   * @name getTokenInfo
   * @desc Get token info
   * @param {GetTokenInfoParams} params
   * @returns {Promise<any>}
   */
  async getTokenInfo(params: types.GetTokenInfoParams): Promise<types.GetTokenInfoResult> {
    try {
      let data: any;
      const isSymbol: boolean = params.symbol !== undefined;

      if (isSymbol && this.tokenInfoCache[params?.symbol]) {
        return this.tokenInfoCache[params?.symbol];
      }

      if (!isSymbol && this.tokenInfoCache[params?.address]) {
        return this.tokenInfoCache[params?.address];
      }

      if (isSymbol) {
        data = await this.makeRequest({ endpoint: "info", query: { symbol: params.symbol } }).catch();
      } else {
        data = await this.makeRequest({ endpoint: "info", query: { address: params.address } }).catch();
      }

      if (!data) {
        throw new Error(`"data" is empty`);
      }

      const key: string = isSymbol ? params.symbol : Object.keys(data)?.[0];

      this.tokenInfoCache[isSymbol ? params.symbol : params.address] = {
        id: isSymbol ? data[key][0].id : data[key].id,
        icon: isSymbol ? data[key][0].logo : data[key].logo,
        name: isSymbol ? data[key][0].name : data[key].name,
        symbol: isSymbol ? data[key][0].symbol : data[key].symbol,
      };

      return {
        id: isSymbol ? data[key][0].id : data[key].id,
        icon: isSymbol ? data[key][0].logo : data[key].logo,
        name: isSymbol ? data[key][0].name : data[key].name,
        symbol: isSymbol ? data[key][0].symbol : data[key].symbol,
      };
    } catch (e) {
      this.logger("getTokenInfo()").error(`Failed to get ${params?.symbol ?? params?.address} token info: ` + e.message);
      throw e;
    }
  }

  /**
   * @name getTokenPrice
   * @desc Get token price
   * @param {GetTokenPriceParams} params
   * @returns {Promise<GetTokenPriceResult>}
   */
  async getTokenPrice(params: types.GetTokenPriceParams): Promise<types.GetTokenPriceResult> {
    try {
      const info: types.GetTokenInfoResult = await this.getTokenInfo(params);

      const data = await this.makeRequest({
        endpoint: "quotes/latest",
        query: { id: info.id },
      });

      if (!data) {
        throw new Error(`"data" is empty`);
      }

      const quote: Record<string, number> = data?.[info.id]?.quote.USD;

      return {
        price: quote.price ?? 0,
        price_change_percentage: quote.percent_change_24h ?? 0,
      };
    } catch (e) {
      this.logger("getTokenPrice()").error(`Failed to get ${params.symbol || params.address} token price: ` + e.message);
      throw e;
    }
  }

  async getTokenExtendedInfo(params: types.GetTokenPriceParams): Promise<types.GetTokenExtendedInfoResult> {
    try {
      const info: types.GetTokenInfoResult = await this.getTokenInfo(params);

      const data = await this.makeRequest({
        endpoint: "quotes/latest",
        query: { id: info.id },
      });

      if (!data) {
        throw new Error(`"data" is empty`);
      }

      const quote: Record<string, number> = data?.[info.id]?.quote.USD;

      return {
        id: quote.id,
        name: quote.name ,
        symbol: quote.symbol,
        total_supply: quote.total_supply,
        max_supply: quote.max_supply,
        market_cap: quote.market_cap,
        price: quote.price,
        percent_change_24h: quote.percent_change_24h,
        percent_change_7d: quote.percent_change_7d,
        percent_change_30d: quote.percent_change_30d,
      };
    } catch (e) {
      this.logger("getTokenExtendedInfo()").error(`Failed to get extended info for ${params.symbol || params.address}: ${e.message}`);
      throw e;
    }
  }
  
}
