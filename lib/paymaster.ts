import { encodeFunctionData, numberToHex } from 'viem';
import { base, baseSepolia } from 'viem/chains';

const NETWORK = process.env.NEXT_PUBLIC_NETWORK || "testnet";
const CHAIN = NETWORK === "mainnet" ? base : baseSepolia;

/**
 * Send a sponsored transaction using paymaster service
 * @param provider - The EIP-1193 provider from wallet
 * @param fromAddress - The sender's address
 * @param contractAddress - The contract address to interact with
 * @param abi - The contract ABI
 * @param functionName - The function to call
 * @param args - The function arguments
 * @returns The transaction hash
 */
export async function sendSponsoredTransaction(
  provider: any,
  fromAddress: string,
  contractAddress: string,
  abi: any,
  functionName: string,
  args: any[]
): Promise<string> {
  // Get paymaster service URL from environment
  const paymasterServiceUrl = process.env.NEXT_PUBLIC_PAYMASTER_SERVICE_URL;
  
  if (!paymasterServiceUrl) {
    throw new Error("Paymaster service URL not configured. Please set NEXT_PUBLIC_PAYMASTER_SERVICE_URL");
  }

  // Encode the function call
  const data = encodeFunctionData({
    abi,
    functionName,
    args,
  });

  // Prepare the transaction call
  const calls = [
    {
      to: contractAddress,
      value: '0x0',
      data,
    }
  ];

  // Send the transaction with paymaster capabilities
  const result = await provider.request({
    method: 'wallet_sendCalls',
    params: [{
      version: '1.0',
      chainId: numberToHex(CHAIN.id),
      from: fromAddress,
      calls,
      capabilities: {
        paymasterService: {
          url: paymasterServiceUrl
        }
      }
    }]
  });

  return result;
}

/**
 * Check if the wallet supports paymaster service
 * @param provider - The EIP-1193 provider from wallet
 * @param address - The user's address
 * @returns Whether paymaster is supported
 */
export async function checkPaymasterSupport(
  provider: any,
  address: string
): Promise<boolean> {
  try {
    const capabilities = await provider.request({
      method: 'wallet_getCapabilities',
      params: [address]
    });

    const chainCapabilities = capabilities[CHAIN.id];
    return chainCapabilities?.paymasterService?.supported || false;
  } catch (error) {
    console.error('Failed to check paymaster capabilities:', error);
    return false;
  }
}

