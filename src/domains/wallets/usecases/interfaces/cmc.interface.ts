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
  name: string | number;
  symbol: string | number;
  total_supply: number | null;
  max_supply: number | null;
  market_cap: number;
  price: number;
  percent_change_24h: number;
  percent_change_7d: number;
  percent_change_30d: number;
}
