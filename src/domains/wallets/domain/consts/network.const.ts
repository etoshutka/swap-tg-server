import { SdkNetwork } from "../../usecases/interfaces/sdk.interface";
import { Network } from "../interfaces/wallet.interface";

export const networkSymbol: Record<Exclude<Network, Network.TON>, SdkNetwork> = {
  [Network.ETH]: "ETH",
  [Network.BSC]: "BSC",
  [Network.SOL]: "SOL",
};

export const networkNativeSymbol: Record<Network, string> = {
  [Network.ETH]: "ETH",
  [Network.BSC]: "BNB",
  [Network.SOL]: "SOL",
  [Network.TON]: "TON",
};

export const usdtContractByNetwork: Record<Network, string> = {
  [Network.ETH]: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
  [Network.TON]: "EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs",
  [Network.BSC]: "0x55d398326f99059fF775485246999027B3197955",
  [Network.SOL]: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
};
