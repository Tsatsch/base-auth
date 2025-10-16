"use client";
import { ReactNode } from "react";
import { base, baseSepolia } from "wagmi/chains";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider, createConfig, http } from "wagmi";
import { injected } from "wagmi/connectors";
import { OnchainKitProvider } from "@coinbase/onchainkit";
import "@coinbase/onchainkit/styles.css";

// Determine which network to use based on environment variable
// Options: "testnet" (Base Sepolia) or "mainnet" (Base)
const NETWORK = process.env.NEXT_PUBLIC_NETWORK || "testnet";

// Map network to chain and RPC URL
const networkConfig = NETWORK === "mainnet" 
  ? { chain: base, rpcUrl: "https://mainnet.base.org" }
  : { chain: baseSepolia, rpcUrl: "https://sepolia.base.org" };

// Create wagmi config with injected connector for Base Mini-App
const wagmiConfig = NETWORK === "mainnet"
  ? createConfig({
      chains: [base],
      connectors: [
        injected({
          target: "metaMask", // This will use the injected provider from Base app
        }),
      ],
      transports: {
        [base.id]: http("https://mainnet.base.org"),
      },
      ssr: true,
    })
  : createConfig({
      chains: [baseSepolia],
      connectors: [
        injected({
          target: "metaMask", // This will use the injected provider from Base app
        }),
      ],
      transports: {
        [baseSepolia.id]: http("https://sepolia.base.org"),
      },
      ssr: true,
    });

// Create a client for React Query
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 3,
    },
  },
});

export function RootProvider({ children }: { children: ReactNode }) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <OnchainKitProvider
          apiKey={process.env.NEXT_PUBLIC_ONCHAINKIT_API_KEY}
          chain={networkConfig.chain}
          config={{
            appearance: {
              mode: "auto",
            },
            wallet: {
              display: "modal",
              preference: "all",
            },
          }}
          miniKit={{
            enabled: true,
            autoConnect: true,
            notificationProxyUrl: undefined,
          }}
        >
          {children}
        </OnchainKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
