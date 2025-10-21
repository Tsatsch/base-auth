"use client";
import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { useMiniKit } from "@coinbase/onchainkit/minikit";
import { useAccount, useWriteContract, useReadContract, useConnect, useDisconnect, useWaitForTransactionReceipt, useConfig, useSignMessage, useSwitchChain } from "wagmi";
import { injected } from "wagmi/connectors";
import { readContract } from "wagmi/actions";
import { base, baseSepolia } from "wagmi/chains";
import styles from "./page.module.css";
import { encryptSecretGCM, decryptSecretGCM, validateSecret, cleanSecret } from "../lib/crypto";
import { generateTOTP, getTimeRemaining } from "../lib/totp";
import { AUTHENTICATOR_ABI, AUTHENTICATOR_CONTRACT_ADDRESS, type Account } from "../lib/contract";
import { uploadToIPFS, retrieveFromIPFS, uploadImageToIPFS, getIPFSImageURL, type SecretMetadata } from "../lib/ipfs";
import { compressImage, isValidImageFile } from "../lib/imageCompression";
import { VAULT_UNLOCK_MESSAGE, isValidSignature } from "../lib/signature";
import QRScanner from "../components/QRScanner";
import { QRScanResult } from "../lib/qrScanner";
import QRCodeGenerator from "../components/QRCodeGenerator";

interface DecryptedAccount {
  accountName: string;
  secret: string;
  code: string;
  index: number;
  logoCID?: string;
}

// Get current network configuration
const getCurrentNetworkConfig = () => {
  const network = process.env.NEXT_PUBLIC_NETWORK || "testnet";
  return network === "mainnet" 
    ? { chain: base, name: "Base Mainnet", chainId: base.id }
    : { chain: baseSepolia, name: "Base Sepolia", chainId: baseSepolia.id };
};

export default function Home() {
  const { isFrameReady, setFrameReady } = useMiniKit();
  const { address, isConnected } = useAccount();
  const { connect } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();
  const config = useConfig();
  
  // Get current network configuration
  const networkConfig = getCurrentNetworkConfig();
  const [accounts, setAccounts] = useState<DecryptedAccount[]>([]);
  const [timeRemaining, setTimeRemaining] = useState(30);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [showQRGenerator, setShowQRGenerator] = useState(false);
  const [newAccountName, setNewAccountName] = useState("");
  const [newSecret, setNewSecret] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [uploadingToIPFS, setUploadingToIPFS] = useState(false);
  const [pendingTxHash, setPendingTxHash] = useState<`0x${string}` | undefined>();
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [hasAttemptedNetworkSwitch, setHasAttemptedNetworkSwitch] = useState(false);
  
  // Vault unlock state
  const [vaultSignature, setVaultSignature] = useState<string | null>(null);
  const [isVaultUnlocked, setIsVaultUnlocked] = useState(false);
  const [isUnlocking, setIsUnlocking] = useState(false);

  // Initialize the miniapp
  useEffect(() => {
    if (!isFrameReady) {
      setFrameReady();
    }
  }, [setFrameReady, isFrameReady]);

  // Ensure wallet is on the correct network (Base Sepolia or Base Mainnet)
  const ensureCorrectNetwork = useCallback(async () => {
    if (!isConnected || !switchChain) {
      throw new Error("Wallet not connected or switch chain not available");
    }

    try {
      console.log(`🔄 Attempting to switch to ${networkConfig.name} network (Chain ID: ${networkConfig.chainId})`);
      await switchChain({ chainId: networkConfig.chainId });
      console.log(`✅ Successfully switched to ${networkConfig.name} network`);
      return true;
    } catch (error) {
      console.warn(`⚠️ Failed to switch to ${networkConfig.name}:`, error);
      throw new Error(`Failed to switch to ${networkConfig.name} network. Please switch manually in your wallet.`);
    }
  }, [isConnected, switchChain, networkConfig]);

  // Auto-connect to injected provider on mount
  useEffect(() => {
    if (!isConnected && isFrameReady) {
      // Attempt to connect automatically
      connect({ connector: injected() });
    }
  }, [isConnected, isFrameReady, connect]);

  // Ensure correct network after connection (separate effect to prevent loops)
  useEffect(() => {
    if (isConnected && isFrameReady && !hasAttemptedNetworkSwitch) {
      // Small delay to ensure wallet is fully connected
      const timer = setTimeout(async () => {
        try {
          await ensureCorrectNetwork();
          setHasAttemptedNetworkSwitch(true);
        } catch (error) {
          console.warn("Auto network switch failed:", error);
        }
      }, 1000);
      
      return () => clearTimeout(timer);
    }
  }, [isConnected, isFrameReady, hasAttemptedNetworkSwitch, ensureCorrectNetwork]);

  // Contract interactions
  const { writeContract, data: writeData, error: writeError, isPending: _isWritePending, reset: resetWrite } = useWriteContract();
  
  // Signature for vault unlocking
  const { signMessage, data: signature, error: signError, isPending: isSignPending } = useSignMessage();

  // Lock vault when wallet disconnects
  useEffect(() => {
    if (!isConnected) {
      setVaultSignature(null);
      setIsVaultUnlocked(false);
      setAccounts([]);
      setHasAttemptedNetworkSwitch(false); // Reset network switch attempt
    }
  }, [isConnected]);

  // Handle signature response
  useEffect(() => {
    if (signature) {
      console.log("✅ Signature received:", signature);
      
      // Validate signature
      if (!isValidSignature(signature)) {
        setError("Invalid signature received");
        setIsUnlocking(false);
        return;
      }

      // Store signature and unlock vault
      setVaultSignature(signature);
      setIsVaultUnlocked(true);
      setIsUnlocking(false);
      
      console.log("✅ Vault unlocked successfully");
    }
  }, [signature]);

  // Handle signature errors
  useEffect(() => {
    if (signError) {
      console.error("❌ Signature error:", signError);
      setError(`Failed to unlock vault: ${signError.message}`);
      setIsUnlocking(false);
    }
  }, [signError]);
  
  // Log write errors
  useEffect(() => {
    if (writeError) {
      console.error("Write contract error:", writeError);
    }
  }, [writeError]);
  
  // When writeData changes (tx hash is available), set it as pending
  useEffect(() => {
    if (writeData && !pendingTxHash) {
      console.log("💎 Transaction hash received:", writeData);
      console.log("View on BaseScan:", `https://base-sepolia.blockscout.com/tx/${writeData}`);
      setPendingTxHash(writeData);
    }
  }, [writeData, pendingTxHash]);
  
  // Wait for transaction confirmation
  const { isSuccess: isTxConfirmed, isLoading: isTxPending, data: _txReceipt } = useWaitForTransactionReceipt({
    hash: pendingTxHash,
    query: {
      enabled: !!pendingTxHash,
    },
  });
  
  // Log transaction receipt status
  useEffect(() => {
    if (pendingTxHash) {
      console.log("⏳ Waiting for transaction confirmation...", {
        hash: pendingTxHash,
        isPending: isTxPending,
        isConfirmed: isTxConfirmed,
      });
    }
  }, [pendingTxHash, isTxPending, isTxConfirmed]);
  
  const { data: secretsData, refetch: refetchSecrets, error: readError, isLoading: isReadLoading } = useReadContract({
    address: AUTHENTICATOR_CONTRACT_ADDRESS as `0x${string}`,
    abi: AUTHENTICATOR_ABI,
    functionName: "getSecrets",
    account: address, // CRITICAL: Pass the account to set msg.sender
    args: [],
    query: {
      enabled: isConnected && !!address,
      refetchInterval: false,
      staleTime: 0, // Always consider data stale
      gcTime: 0, // Don't cache at all
    },
  });
  
  // Also read secret count for debugging
  const { data: secretCount, refetch: refetchCount } = useReadContract({
    address: AUTHENTICATOR_CONTRACT_ADDRESS as `0x${string}`,
    abi: AUTHENTICATOR_ABI,
    functionName: "getSecretCount",
    account: address, // CRITICAL: Pass the account to set msg.sender
    args: [],
    query: {
      enabled: isConnected && !!address,
      staleTime: 0,
      gcTime: 0,
    },
  });
  
  // Log read contract state
  useEffect(() => {
    console.log("=".repeat(60));
    console.log("📖 READ CONTRACT STATE");
    console.log("=".repeat(60));
    console.log("Connected Wallet Address:", address);
    console.log("Contract Address:", AUTHENTICATOR_CONTRACT_ADDRESS);
    console.log("Secret Count:", secretCount?.toString());
    console.log("Secrets Data Length:", secretsData ? (secretsData as Account[]).length : 0);
    console.log("Is Connected:", isConnected);
    console.log("Read Error:", readError);
    console.log("Is Loading:", isReadLoading);
    if (secretsData && (secretsData as Account[]).length > 0) {
      console.log("Accounts found:", (secretsData as Account[]).map((acc: Account) => acc.accountName));
    }
    console.log("=".repeat(60));
  }, [secretsData, secretCount, readError, isReadLoading, address, isConnected]);

  // Load and decrypt accounts from IPFS
  const loadAccounts = useCallback(async () => {
    if (!secretsData || !address || !vaultSignature) {
      console.log("No secrets data, address, or vault signature available");
      setAccounts([]);
      return;
    }

    try {
      console.log("Loading accounts, count:", (secretsData as Account[]).length);
      const decrypted: DecryptedAccount[] = [];
      
      for (let i = 0; i < (secretsData as Account[]).length; i++) {
        const account = (secretsData as Account[])[i];
        try {
          console.log(`📦 Retrieving account ${i} from IPFS: ${account.ipfsCID}`);
          
          // Retrieve encrypted metadata from IPFS
          const metadata: SecretMetadata = await retrieveFromIPFS(account.ipfsCID);
          
          // Decrypt the secret using AES-256-GCM with signature
          const decryptedSecret = await decryptSecretGCM(
            metadata.encryptedSecret,
            metadata.iv,
            metadata.salt,
            vaultSignature
          );
          
          const code = generateTOTP(decryptedSecret, account.accountName);
          
          decrypted.push({
            accountName: account.accountName,
            secret: decryptedSecret,
            code,
            index: i,
            logoCID: metadata.logoCID,
          });
          
          console.log(`✅ Successfully decrypted account: ${account.accountName}`);
        } catch (err) {
          console.error(`Failed to decrypt account ${account.accountName}:`, err);
        }
      }
      
      console.log("Loaded and decrypted accounts:", decrypted.length);
      setAccounts(decrypted);
    } catch (err) {
      console.error("Error loading accounts:", err);
    }
  }, [secretsData, address, vaultSignature]);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  // Manual refetch function with explicit account parameter
  const manualRefetch = async () => {
    if (!address) return;
    
    try {
      console.log("🔄 Manual refetch with explicit account parameter...");
      const [secretsResult, countResult] = await Promise.all([
        readContract(config, {
          address: AUTHENTICATOR_CONTRACT_ADDRESS as `0x${string}`,
          abi: AUTHENTICATOR_ABI,
          functionName: "getSecrets",
          account: address,
        }),
        readContract(config, {
          address: AUTHENTICATOR_CONTRACT_ADDRESS as `0x${string}`,
          abi: AUTHENTICATOR_ABI,
          functionName: "getSecretCount",
          account: address,
        }),
      ]);
      
      console.log("📊 Manual Refetch Results:");
      console.log("  - Count:", countResult?.toString());
      console.log("  - Secrets:", secretsResult ? (secretsResult as Account[]).length : 0);
      
      return { secretsResult, countResult };
    } catch (error) {
      console.error("Error in manual refetch:", error);
      throw error;
    }
  };

  // Refetch when transaction is confirmed
  useEffect(() => {
    if (isTxConfirmed && pendingTxHash) {
      console.log("=".repeat(60));
      console.log("✅ TRANSACTION CONFIRMED!");
      console.log("=".repeat(60));
      console.log("Transaction Hash:", pendingTxHash);
      console.log("Contract Address:", AUTHENTICATOR_CONTRACT_ADDRESS);
      console.log("Connected Address:", address);
      console.log("Waiting 2 seconds before refetching...");
      console.log("=".repeat(60));
      
      // Add a small delay to ensure blockchain state is updated
      setTimeout(async () => {
        console.log("🔄 Refetching data from contract...");
        
        // Try manual refetch first
        try {
          await manualRefetch();
        } catch (error) {
          console.error("Manual refetch failed:", error);
        }
        
        // Also trigger the hook refetch
        const countResult = await refetchCount();
        const secretsResult = await refetchSecrets();
        console.log("📊 Hook Refetch Results:");
        console.log("  - Count:", countResult.data?.toString());
        console.log("  - Secrets:", secretsResult.data ? (secretsResult.data as Account[]).length : 0);
        console.log("=".repeat(60));
        
        setPendingTxHash(undefined);
        resetWrite(); // Clear the write state for next transaction
        setShowAddModal(false);
        setNewAccountName("");
        setNewSecret("");
        setLogoFile(null);
        setLogoPreview(null);
        setIsLoading(false);
        setUploadingToIPFS(false);
      }, 2000); // Increased delay to 2 seconds
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTxConfirmed, pendingTxHash, address]);

  // Update TOTP codes every second
  useEffect(() => {
    const interval = setInterval(() => {
      const remaining = getTimeRemaining();
      setTimeRemaining(remaining);

      // Regenerate codes when timer resets
      if (remaining === 30 && accounts.length > 0) {
        setAccounts((prev) =>
          prev.map((account) => ({
            ...account,
            code: generateTOTP(account.secret, account.accountName),
          }))
        );
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [accounts.length]);

  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      setLogoFile(null);
      setLogoPreview(null);
      return;
    }

    if (!isValidImageFile(file)) {
      setError("Invalid image file. Please upload a JPEG, PNG, GIF, or WebP image under 10MB.");
      return;
    }

    setLogoFile(file);
    
    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setLogoPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleAddAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!address) {
      setError("Please connect your wallet first");
      return;
    }

    // Ensure we're on the correct network before proceeding with transaction
    console.log(`🔐 Preparing to add account - ensuring wallet is on ${networkConfig.name}...`);
    try {
      await ensureCorrectNetwork();
      console.log(`✅ Wallet is on correct network (${networkConfig.name}) - proceeding with transaction`);
    } catch (error) {
      const errorMessage = `❌ Network switch failed: ${error instanceof Error ? error.message : 'Unknown error'}. Please switch to ${networkConfig.name} network in your wallet manually.`;
      setError(errorMessage);
      console.error(errorMessage);
      return;
    }

    if (!newAccountName.trim()) {
      setError("Please enter an account name");
      return;
    }

    if (!newSecret.trim()) {
      setError("Please enter a 2FA secret");
      return;
    }

    const cleanedSecret = cleanSecret(newSecret);
    
    if (!validateSecret(cleanedSecret)) {
      setError("Invalid 2FA secret format. Please enter a valid base32 encoded secret.");
      return;
    }

    try {
      setIsLoading(true);
      setUploadingToIPFS(true);
      setError("");
      
      console.log("=".repeat(60));
      console.log("✍️  ADDING NEW ACCOUNT WITH IPFS");
      console.log("=".repeat(60));
      console.log("Wallet Address:", address);
      console.log("Account Name:", newAccountName.trim());
      console.log("Contract Address:", AUTHENTICATOR_CONTRACT_ADDRESS);
      console.log("=".repeat(60));
      
      // Step 1: Upload and compress logo if provided
      let logoCID: string | undefined;
      if (logoFile) {
        console.log("🖼️  Processing logo...");
        const compressedLogo = await compressImage(logoFile, {
          maxSizeMB: 0.5,
          maxWidthOrHeight: 512,
        });
        console.log("📤 Uploading logo to IPFS...");
        logoCID = await uploadImageToIPFS(compressedLogo, newAccountName.trim());
        console.log("✅ Logo uploaded to IPFS:", logoCID);
      }

      // Step 2: Encrypt the secret with AES-256-GCM using signature
      console.log("🔐 Encrypting secret with AES-256-GCM using signature...");
      const { encrypted, iv, salt } = await encryptSecretGCM(cleanedSecret, vaultSignature!);
      console.log("✅ Secret encrypted");

      // Step 3: Create metadata object
      const metadata: SecretMetadata = {
        accountName: newAccountName.trim(),
        encryptedSecret: encrypted,
        algorithm: "SHA1",
        period: 30,
        digits: 6,
        timestamp: Date.now(),
        iv,
        salt,
        logoCID,
      };

      // Step 4: Upload metadata to IPFS
      console.log("📤 Uploading metadata to IPFS...");
      const ipfsCID = await uploadToIPFS(metadata);
      console.log("✅ Uploaded to IPFS:", ipfsCID);
      setUploadingToIPFS(false);

      // Step 5: Store IPFS CID on blockchain
      console.log("⛓️  Storing IPFS CID on blockchain...");
      await writeContract({
        address: AUTHENTICATOR_CONTRACT_ADDRESS as `0x${string}`,
        abi: AUTHENTICATOR_ABI,
        functionName: "addSecret",
        args: [newAccountName.trim(), ipfsCID],
      });

      console.log("✅ Transaction submitted! Waiting for confirmation...");
      console.log("=".repeat(60));
      
    } catch (err: unknown) {
      console.error("❌ Error adding account:", err);
      if (err instanceof Error) {
        setError(`Failed to add account: ${err.message}`);
      } else {
        setError("Failed to add account. Please try again.");
      }
      setIsLoading(false);
      setUploadingToIPFS(false);
    }
  };

  const handleDeleteAccount = async (index: number) => {
    if (!address) return;

    // Ensure we're on the correct network before proceeding with transaction
    console.log(`🗑️ Preparing to delete account - ensuring wallet is on ${networkConfig.name}...`);
    try {
      await ensureCorrectNetwork();
      console.log(`✅ Wallet is on correct network (${networkConfig.name}) - proceeding with deletion`);
    } catch (error) {
      const errorMessage = `❌ Network switch failed: ${error instanceof Error ? error.message : 'Unknown error'}. Please switch to ${networkConfig.name} network in your wallet manually.`;
      setError(errorMessage);
      console.error(errorMessage);
      return;
    }

    try {
      setIsLoading(true);
      
      await writeContract({
        address: AUTHENTICATOR_CONTRACT_ADDRESS as `0x${string}`,
        abi: AUTHENTICATOR_ABI,
        functionName: "removeSecret",
        args: [BigInt(index)],
      });

      // The transaction hash will be set by the useEffect watching writeData
    } catch (err) {
      console.error("Error deleting account:", err);
      setIsLoading(false);
    }
  };

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const copyToClipboard = (code: string, index?: number) => {
    navigator.clipboard.writeText(code);
    if (typeof index === 'number') {
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 1200);
    }
  };

  const handleConnect = () => {
    connect({ connector: injected() });
  };

  const handleSwitchToCorrectNetwork = async () => {
    console.log(`🔄 Manual network switch requested - switching to ${networkConfig.name}...`);
    try {
      await ensureCorrectNetwork();
      setError(""); // Clear any previous errors
      console.log(`✅ Manual network switch successful`);
    } catch (error) {
      const errorMessage = `❌ Manual network switch failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      setError(errorMessage);
      console.error(errorMessage);
    }
  };

  const handleDisconnect = () => {
    disconnect();
  };

  const handleUnlockVault = async () => {
    if (!isConnected || !address) {
      setError("Please connect your wallet first");
      return;
    }

    try {
      setIsUnlocking(true);
      setError("");

      console.log("🔐 Requesting vault signature...");
      console.log("   Message:", VAULT_UNLOCK_MESSAGE);
      
      // Request signature using wagmi hook
      signMessage({ message: VAULT_UNLOCK_MESSAGE });
      
    } catch (err) {
      console.error("❌ Failed to unlock vault:", err);
      if (err instanceof Error) {
        setError(`Failed to unlock vault: ${err.message}`);
      } else {
        setError("Failed to unlock vault. Please try again.");
      }
      setIsUnlocking(false);
    }
  };

  const handleLockVault = () => {
    setVaultSignature(null);
    setIsVaultUnlocked(false);
    setAccounts([]);
    console.log("🔒 Vault locked");
  };

  const handleQRScanSuccess = (result: QRScanResult) => {
    if (result.success && result.data) {
      setNewSecret(result.data.secret);
      if (result.data.account && result.data.account !== 'Scanned Account') {
        setNewAccountName(result.data.account);
      } else if (result.data.issuer && result.data.issuer !== 'Unknown') {
        setNewAccountName(result.data.issuer);
      }
      setShowQRScanner(false);
      console.log("✅ QR code scanned successfully:", result.data);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.brand}>
          <Image src="/logo.png" alt="Base Auth" width={32} height={32} className={styles.headerLogo} />
          <h1 className={styles.title}>
            <span className={styles.titleBase}>BASE</span>
            <span className={styles.titleAuth}>AUTH</span>
          </h1>
        </div>
        <div className={styles.headerActions}>
          {isConnected && address ? (
            <>
              <button 
                className={styles.networkButton}
                onClick={handleSwitchToCorrectNetwork}
                title={`Switch to ${networkConfig.name}`}
              >
                🔄 {networkConfig.name}
              </button>
              <div 
                className={styles.walletInfo}
                onClick={handleDisconnect}
                style={{ cursor: 'pointer' }}
                title="Click to disconnect"
              >
                <span>🔗</span>
                <span className={styles.walletAddress}>{formatAddress(address)}</span>
              </div>
            </>
          ) : (
            <button className={styles.connectButton} onClick={handleConnect}>
              Connect Wallet
            </button>
          )}
          
          {/* Development test button - remove in production */}
          <button 
            className={styles.testButton}
            onClick={() => setShowQRGenerator(true)}
            title="Generate test QR codes"
          >
            🧪
          </button>
        </div>
      </div>

      {isTxPending && (
        <div className={styles.toast} role="status" aria-live="polite">
          Pending transaction  a{/* non-breaking visual spacing */}
        </div>
      )}

      {!isConnected ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>🔐</div>
          <h2 className={styles.emptyTitle}>Connect Your Wallet</h2>
          <p className={styles.emptyDescription}>
            Connect your wallet to start managing your 2FA accounts securely with IPFS.
          </p>
        </div>
      ) : !isVaultUnlocked ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>🔒</div>
          <h2 className={styles.emptyTitle}>Vault Locked</h2>
          <p className={styles.emptyDescription}>
            Click &apos;Unlock Vault&apos; to view your 2FA accounts. Your signature is required for security.
          </p>
          <button
            className={styles.connectButton}
            onClick={handleUnlockVault}
            disabled={isUnlocking || isSignPending}
            type="button"
          >
            {isUnlocking || isSignPending ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                <span className={styles.spinner} aria-hidden />
                Unlocking...
              </span>
            ) : (
              'Unlock Vault'
            )}
          </button>
        </div>
      ) : accounts.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>🔑</div>
          <h2 className={styles.emptyTitle}>No 2FA Accounts Yet</h2>
          <p className={styles.emptyDescription}>
            Add your first 2FA account. Data is encrypted and stored on IPFS.
          </p>
          <button
            className={styles.connectButton}
            onClick={() => setShowAddModal(true)}
            type="button"
          >
            Add Account
          </button>
        </div>
      ) : (
        <div className={styles.accountsList}>
          {accounts.map((account) => (
            <div key={account.index} className={styles.accountCard}>
              <div className={styles.accountInfo}>
                <div className={styles.accountHeader}>
                  {account.logoCID && (
                    <Image
                      src={getIPFSImageURL(account.logoCID)}
                      alt={`${account.accountName} logo`}
                      width={32}
                      height={32}
                      className={styles.accountLogo}
                      onError={(e) => {
                        // Hide logo if it fails to load
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  )}
                  <div className={styles.accountName}>{account.accountName}</div>
                </div>
                <div className={styles.codeDisplay}>
                  <button
                    className={styles.code}
                    onClick={() => copyToClipboard(account.code, account.index)}
                    title="Click to copy"
                    type="button"
                  >
                    {account.code}
                  </button>
                  {copiedIndex === account.index && (
                    <span className={styles.copiedBadge} aria-live="polite">Copied</span>
                  )}
                  <div className={styles.timer}>
                    <div className={styles.pixelProgress} aria-label="TOTP timer" role="progressbar"
                      aria-valuemin={0} aria-valuemax={30} aria-valuenow={timeRemaining}
                    >
                      <div className={styles.pixelFill} style={{ width: `${((30 - timeRemaining) / 30) * 100}%` }} />
                      <div className={styles.pixelGrid} />
                      <div className={styles.pixelCap} style={{ left: `calc(${((30 - timeRemaining) / 30) * 100}% - var(--pixel-size) / 2)` }} />
                    </div>
                    <div className={styles.timerTextInline}>{timeRemaining}s</div>
                  </div>
                </div>
              </div>
              <button
                className={styles.deleteButton}
                onClick={() => handleDeleteAccount(account.index)}
                disabled={isLoading}
                type="button"
                title="Delete account"
              >
                🗑️
              </button>
            </div>
          ))}
        </div>
      )}

      {isConnected && isVaultUnlocked && (
        <button
          className={styles.addButton}
          onClick={() => setShowAddModal(true)}
          disabled={isLoading}
          type="button"
          title="Add new 2FA account"
        >
          +
        </button>
      )}

      {isConnected && isVaultUnlocked && (
        <button
          className={styles.lockButton}
          onClick={handleLockVault}
          type="button"
          title="Lock vault"
        >
          🔒
        </button>
      )}

      {showAddModal && (
        <div className={styles.modal} onClick={() => setShowAddModal(false)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.sheetHandle} aria-hidden />
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>Add 2FA Account</h2>
              <button
                className={styles.closeButton}
                onClick={() => setShowAddModal(false)}
                type="button"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddAccount} className={styles.form}>
              <div className={styles.formGroup}>
                <label htmlFor="accountName" className={styles.label}>
                  Account Name
                </label>
                <input
                  id="accountName"
                  type="text"
                  placeholder="e.g., Google, GitHub, Twitter"
                  value={newAccountName}
                  onChange={(e) => setNewAccountName(e.target.value)}
                  className={styles.input}
                  disabled={isLoading}
                />
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="secret" className={styles.label}>
                  2FA Secret Key
                </label>
                <div className={styles.secretInputContainer}>
                  <textarea
                    id="secret"
                    placeholder="Paste your 2FA secret key here (base32 encoded)"
                    value={newSecret}
                    onChange={(e) => setNewSecret(e.target.value)}
                    className={styles.textarea}
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    className={styles.qrButton}
                    onClick={() => setShowQRScanner(true)}
                    disabled={isLoading}
                    title="Scan QR code"
                  >
                    📷
                  </button>
                </div>
                <p className={styles.hint}>
                  The secret is encrypted with AES-256-GCM and stored on IPFS.
                  Only the IPFS CID is stored on-chain.
                </p>
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="logo" className={styles.label}>
                  Logo (Optional)
                </label>
                <input
                  id="logo"
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                  onChange={handleLogoChange}
                  className={styles.fileInput}
                  disabled={isLoading}
                />
                {logoPreview && (
                  <div className={styles.logoPreview}>
                    <Image src={logoPreview} alt="Logo preview" width={64} height={64} className={styles.logoPreviewImage} />
                    <button
                      type="button"
                      className={styles.removeLogoButton}
                      onClick={() => {
                        setLogoFile(null);
                        setLogoPreview(null);
                        const input = document.getElementById('logo') as HTMLInputElement;
                        if (input) input.value = '';
                      }}
                      disabled={isLoading}
                    >
                      Remove
                    </button>
                  </div>
                )}
                <p className={styles.hint}>
                  Logo will be compressed and stored on IPFS. Max 10MB, recommended 512x512px.
                </p>
              </div>

              {error && <div className={styles.error}>{error}</div>}

              {uploadingToIPFS && (
                <div className={styles.info}>
                  Uploading encrypted data to IPFS...
                </div>
              )}

              <button type="submit" className={styles.submitButton} disabled={isLoading}>
                {isLoading ? (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span className={styles.spinner} aria-hidden />
                    {uploadingToIPFS ? 'Uploading to IPFS...' : 'Adding...'}
                  </span>
                ) : (
                  'Add Account'
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      <QRScanner
        isOpen={showQRScanner}
        onClose={() => setShowQRScanner(false)}
        onScanSuccess={handleQRScanSuccess}
      />

      <QRCodeGenerator
        isOpen={showQRGenerator}
        onClose={() => setShowQRGenerator(false)}
      />
    </div>
  );
}
