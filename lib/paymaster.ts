import { encodeFunctionData, numberToHex, type Abi } from 'viem';
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  provider: any,
  fromAddress: string,
  contractAddress: string,
  abi: Abi,
  functionName: string,
  args: unknown[]
): Promise<string> {
  // Get paymaster service URL from environment
  const paymasterServiceUrl = process.env.NEXT_PUBLIC_PAYMASTER_ENDPOINT_TESTNET;
  
  console.log("🔧 Paymaster Debug Info:");
  console.log("- Paymaster URL:", paymasterServiceUrl ? "✅ Configured" : "❌ Not configured");
  console.log("- From Address:", fromAddress);
  console.log("- Contract Address:", contractAddress);
  console.log("- Function:", functionName);
  console.log("- Args:", args);
  console.log("- Is Sponsored:", "✅ true");
  
  if (!paymasterServiceUrl) {
    throw new Error("Paymaster service URL not configured. Please set NEXT_PUBLIC_PAYMASTER_ENDPOINT_TESTNET");
  }

  // Encode the function call
  const data = encodeFunctionData({
    abi,
    functionName,
    args,
  });

  console.log("- Encoded Data:", data);

  // Prepare the transaction call
  const calls = [
    {
      to: contractAddress,
      value: '0x0',
      data,
    }
  ];

  const walletSendCallsParams = {
    version: '1.0',
    chainId: numberToHex(CHAIN.id),
    from: fromAddress,
    calls,
    isSponsored: true,
    capabilities: {
      paymasterService: {
        url: paymasterServiceUrl
      }
    }
  };

  console.log("- Wallet SendCalls Params:", JSON.stringify(walletSendCallsParams, null, 2));

  try {
    // Send the transaction with paymaster capabilities
    console.log("🚀 Sending sponsored transaction...");
    const result = await provider.request({
      method: 'wallet_sendCalls',
      params: [walletSendCallsParams]
    });

    console.log("✅ Sponsored transaction successful:", result);
    
    // wallet_sendCalls returns an object with batchId and txHashes
    // We need to extract the first transaction hash
    if (result && result.txHashes && result.txHashes.length > 0) {
      return result.txHashes[0];
    } else if (typeof result === 'string') {
      // Some implementations might return the hash directly
      return result;
    } else {
      throw new Error("Unexpected response format from wallet_sendCalls");
    }
  } catch (error) {
    console.error("Paymaster transaction failed:", error);
    
    // Check if this is a user cancellation
    const errorMessage = (error as Error)?.message?.toLowerCase() || '';
    const errorCode = (error as { code?: number | string })?.code;
    const isUserCancellation = errorMessage.includes('user rejected') || 
                               errorMessage.includes('user denied') || 
                               errorMessage.includes('cancelled') ||
                               errorMessage.includes('rejected') ||
                               errorCode === 4001 ||
                               errorCode === 'ACTION_REJECTED';
    
    if (isUserCancellation) {
      console.log("👤 User cancelled sponsored transaction");
      throw new Error('USER_CANCELLED');
    }
    
    throw error;
  }
}

/**
 * Check if the wallet supports paymaster service
 * @param provider - The EIP-1193 provider from wallet
 * @param address - The user's address
 * @returns Whether paymaster is supported
 */
export async function checkPaymasterSupport(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

