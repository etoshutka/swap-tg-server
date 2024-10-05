export interface GetTokenPriceParams {
  address?: string;
  symbol?: string;
}

export interface GetTokenPriceResult {
  price: number;
  price_change_percentage: number;
}

export interface GetTokenIdParams {
  symbol: string;
}

export interface GetTokenInfoParams {
  address?: string;
  symbol?: string;
}

export interface GetTokenInfoResult {
  id: string;
  icon: string;
  name: string;
  symbol: string;
}

export interface MakeRequestParams {
  endpoint: string;
  query?: Record<string, string>;
}

export interface GetTokenExtendedInfoResult {
  id: number;
  name: string;
  symbol: string;
  total_supply: number | null;
  max_supply: number | null;
  market_cap: number;
  price: number;
  percent_change_24h: number;
  percent_change_7d: number;
  percent_change_30d: number;
}

export interface GetHistoricalQuotesParams {
  id:string;
  address?: string;
  symbol?: string;  
  timeStart?: string;
  timeEnd?: string;
  count?: number;
  interval?: string;
  convert?: string;
}

export interface GetHistoricalQuotesResult {
  id: string;
  symbol: string;
  name: string;
  quotes: {
    timestamp: string;
    price: number;
  }[];
}