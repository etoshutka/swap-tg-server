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
