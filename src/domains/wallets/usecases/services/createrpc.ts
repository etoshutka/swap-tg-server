import { Connection, ConnectionConfig } from "@solana/web3.js";

export function createTatumSolanaConnection(apiKey: string): Connection {
    const tatumRpcUrl = `https://api.tatum.io/v3/blockchain/node/solana-mainnet/${apiKey}`;
  
    const customFetch = async (input: RequestInfo, init?: RequestInit) => {
      const url = input.toString();
      const isRpcRequest = url.includes('/rpcPath');
  
      if (isRpcRequest) {
        const response = await fetch(url, {
          ...init,
          method: 'POST',
          headers: {
            ...init?.headers,
            'accept': 'application/json',
            'content-type': 'application/json',
            'x-api-key': apiKey
          },
        });
  
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
  
        const data = await response.json();
        if (data.error) {
          throw new Error(`RPC error: ${data.error.message}`);
        }
  
        return new Response(JSON.stringify(data.result), response);
      }
  
      return fetch(input, init);
    };
  
    const config: ConnectionConfig = {
      commitment: 'confirmed',
      fetch: customFetch,
    };
  
    return new Connection(`${tatumRpcUrl}/rpcPath`, config);
  }