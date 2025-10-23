"use client";
import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { useMiniKit } from "@coinbase/onchainkit/minikit";
import { useAccount, useWriteContract, useReadContract, useConnect, useDisconnect, useWaitForTransactionReceipt, useSignMessage, useSwitchChain, useChainId, useConnectorClient } from "wagmi";
import { injected } from "wagmi/connectors";
import { v4 as uuidv4 } from "uuid";
import { base, baseSepolia } from "wagmi/chains";
import styles from "./page.module.css";
import { encryptSecretGCM, decryptSecretGCM, validateSecret, cleanSecret } from "../lib/crypto";
import { generateTOTP, getTimeRemaining } from "../lib/totp";
import { AUTHENTICATOR_ABI, AUTHENTICATOR_CONTRACT_ADDRESS } from "../lib/contract";
import { uploadBundleToIPFS, retrieveBundleFromIPFS, createEmptyBundle, uploadImageToIPFS, getIPFSImageURL, type UserTOTPBundle, type TOTPAccount } from "../lib/ipfs";
import { compressImage, isValidImageFile } from "../lib/imageCompression";
import { VAULT_UNLOCK_MESSAGE, isValidSignature } from "../lib/signature";
import QRScanner from "../components/QRScanner";
import { QRScanResult } from "../lib/qrScanner";
import MigrationImport from "../components/MigrationImport";
import ExportModal from "../components/ExportModal";
import { ParsedMigrationAccount } from "../lib/googleAuthMigration";
import { resolveBaseName, formatBaseName } from "../lib/basename";
import { sendSponsoredTransaction } from "../lib/paymaster";

interface DecryptedAccount {
  id: string;
  accountName: string;
  secret: string;
  code: string;
  index: number;
  logoCID?: string;
}

const REQUIRED_CHAIN = (process.env.NEXT_PUBLIC_NETWORK || "testnet") === "mainnet" ? base : baseSepolia;
const REQUIRED_CHAIN_ID = REQUIRED_CHAIN.id;

export default function Home() {
  const { isFrameReady, setFrameReady } = useMiniKit();
  const { address, isConnected } = useAccount();
  const { connect } = useConnect();
  const { disconnect } = useDisconnect();
  const chainId = useChainId();
  const { switchChain, isPending: isSwitchingChain } = useSwitchChain();
  const { data: connectorClient } = useConnectorClient();
  
  const [accounts, setAccounts] = useState<DecryptedAccount[]>([]);
  const [timeRemaining, setTimeRemaining] = useState(30);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [showMigrationImport, setShowMigrationImport] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [migrationAccounts, setMigrationAccounts] = useState<ParsedMigrationAccount[]>([]);
  const [newAccountName, setNewAccountName] = useState("");
  const [newSecret, setNewSecret] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [uploadingToIPFS, setUploadingToIPFS] = useState(false);
  const [pendingTxHash, setPendingTxHash] = useState<`0x${string}` | undefined>();
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [vaultSignature, setVaultSignature] = useState<string | null>(null);
  const [isVaultUnlocked, setIsVaultUnlocked] = useState(false);
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [baseName, setBaseName] = useState<string | null>(null);
  const [isResolvingBaseName, setIsResolvingBaseName] = useState(false);


  useEffect(() => {
    if (!isFrameReady) {
      setFrameReady();
    }
  }, [setFrameReady, isFrameReady]);

  useEffect(() => {
    const resolveWalletBaseName = async () => {
      if (!address || !isConnected) {
        setBaseName(null);
        return;
      }

      setIsResolvingBaseName(true);
      try {
        const resolvedBaseName = await resolveBaseName(address);
        setBaseName(resolvedBaseName);
      } catch {
        setBaseName(null);
      } finally {
        setIsResolvingBaseName(false);
      }
    };

    resolveWalletBaseName();
  }, [address, isConnected]);

  useEffect(() => {
    if (!isConnected && isFrameReady) {
      connect({ connector: injected() });
    }
  }, [isConnected, isFrameReady, connect]);

  const { writeContract, data: writeData, error: writeError, isPending: isWritePending, reset: resetWrite } = useWriteContract();
  const { signMessage, data: signature, error: signError, isPending: isSignPending } = useSignMessage();

  // Function to reset application state after transaction cancellation or error
  const resetApplicationState = useCallback(() => {
    setIsLoading(false);
    setUploadingToIPFS(false);
    setPendingTxHash(undefined);
    setError("");
    resetWrite();
  }, [resetWrite]);

  // Function to safely close modals with state cleanup
  const closeModalSafely = useCallback((modalType: 'add' | 'qr' | 'migration' | 'export') => {
    if (isLoading || isWritePending) {
      return; // Don't close during loading
    }

    switch (modalType) {
      case 'add':
        setShowAddModal(false);
        setNewAccountName("");
        setNewSecret("");
        setLogoFile(null);
        setLogoPreview(null);
        setError("");
        break;
      case 'qr':
        setShowQRScanner(false);
        break;
      case 'migration':
        setShowMigrationImport(false);
        setMigrationAccounts([]);
        break;
      case 'export':
        setShowExportModal(false);
        break;
    }
  }, [isLoading, isWritePending]);

  // Handle escape key for modal closing
  useEffect(() => {
    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (showAddModal) {
          closeModalSafely('add');
        } else if (showQRScanner) {
          closeModalSafely('qr');
        } else if (showMigrationImport) {
          closeModalSafely('migration');
        } else if (showExportModal) {
          closeModalSafely('export');
        }
      }
    };

    document.addEventListener('keydown', handleEscapeKey);
    return () => document.removeEventListener('keydown', handleEscapeKey);
  }, [showAddModal, showQRScanner, showMigrationImport, showExportModal, isLoading, isWritePending, closeModalSafely]);

  useEffect(() => {
    if (!isConnected) {
      setVaultSignature(null);
      setIsVaultUnlocked(false);
      setAccounts([]);
    }
  }, [isConnected]);

  useEffect(() => {
    if (signature) {
      if (!isValidSignature(signature)) {
        setError("Invalid signature received");
        setIsUnlocking(false);
        return;
      }

      setVaultSignature(signature);
      setIsVaultUnlocked(true);
      setIsUnlocking(false);
    }
  }, [signature]);

  useEffect(() => {
    if (signError) {
      setError(`Failed to unlock vault: ${signError.message}`);
      setIsUnlocking(false);
    }
  }, [signError]);

  // Handle write contract errors
  useEffect(() => {
    if (writeError) {
      setError(`Transaction failed: ${writeError.message}`);
      resetApplicationState();
    }
  }, [writeError, resetApplicationState]);
  
  useEffect(() => {
    if (writeData && !pendingTxHash) {
      setPendingTxHash(writeData);
    }
  }, [writeData, pendingTxHash]);
  
  const { isSuccess: isTxConfirmed, isLoading: isTxPending, error: txError, data: _txReceipt } = useWaitForTransactionReceipt({
    hash: pendingTxHash,
    query: {
      enabled: !!pendingTxHash,
    },
  });
  
  const { data: userData, refetch: refetchUserData, error: _readError, isLoading: _isReadLoading } = useReadContract({
    address: AUTHENTICATOR_CONTRACT_ADDRESS as `0x${string}`,
    abi: AUTHENTICATOR_ABI,
    functionName: "getUserData",
    account: address,
    args: [],
    query: {
      enabled: isConnected && !!address,
      refetchInterval: false,
      staleTime: 0,
      gcTime: 0,
    },
  });
  
  const userBundleCID = userData?.exists ? userData.ipfsCID : null;
  
  const loadAccounts = useCallback(async () => {
    if (!userBundleCID || !address || !vaultSignature) {
      setAccounts([]);
      return;
    }

    try {
      const bundle: UserTOTPBundle = await retrieveBundleFromIPFS(userBundleCID, vaultSignature);
      const decrypted: DecryptedAccount[] = [];
      
      for (let i = 0; i < bundle.accounts.length; i++) {
        const account = bundle.accounts[i];
        try {
          const decryptedSecret = await decryptSecretGCM(
            account.encryptedSecret,
            account.iv,
            account.salt,
            vaultSignature
          );
          
          const code = generateTOTP(decryptedSecret, account.accountName);
          
          decrypted.push({
            id: account.id,
            accountName: account.accountName,
            secret: decryptedSecret,
            code,
            index: i,
            logoCID: account.logoCID,
          });
        } catch {
        }
      }
      
      setAccounts(decrypted);
    } catch {
      setAccounts([]);
    }
  }, [userBundleCID, address, vaultSignature]);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  // Handle transaction errors
  useEffect(() => {
    if (txError) {
      setError(`Transaction failed: ${txError.message}`);
      resetApplicationState();
    }
  }, [txError, resetApplicationState]);

  useEffect(() => {
    if (isTxConfirmed && pendingTxHash) {
      setTimeout(async () => {
        await refetchUserData();
        
        setPendingTxHash(undefined);
        resetWrite();
        setShowAddModal(false);
        setNewAccountName("");
        setNewSecret("");
        setLogoFile(null);
        setLogoPreview(null);
        setIsLoading(false);
        setUploadingToIPFS(false);
      }, 2000);
    }
  }, [isTxConfirmed, pendingTxHash, address, refetchUserData, resetWrite]);

  useEffect(() => {
    const interval = setInterval(() => {
      const remaining = getTimeRemaining();
      setTimeRemaining(remaining);

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

  const ensureCorrectNetwork = async (): Promise<boolean> => {
    if (!isConnected || !address) {
      setError("Please connect your wallet first");
      return false;
    }

    if (chainId !== REQUIRED_CHAIN_ID) {
      try {
        setError(`Please switch to ${REQUIRED_CHAIN.name} to continue`);
        await switchChain({ chainId: REQUIRED_CHAIN_ID });
        setError("");
        return true;
      } catch (err) {
        if (err instanceof Error) {
          setError(`Failed to switch network: ${err.message}`);
        } else {
          setError(`Please switch to ${REQUIRED_CHAIN.name} network to continue`);
        }
        return false;
      }
    }

    return true;
  };

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

    const isOnCorrectNetwork = await ensureCorrectNetwork();
    if (!isOnCorrectNetwork) {
      return;
    }

    try {
      setIsLoading(true);
      setUploadingToIPFS(true);
      setError("");
      
      let bundle: UserTOTPBundle;
      if (userBundleCID && userBundleCID !== "") {
        bundle = await retrieveBundleFromIPFS(userBundleCID, vaultSignature!);
      } else {
        bundle = createEmptyBundle(address);
      }
      
      let logoCID: string | undefined;
      if (logoFile) {
        const compressedLogo = await compressImage(logoFile, {
          maxSizeMB: 0.5,
          maxWidthOrHeight: 512,
        });
        logoCID = await uploadImageToIPFS(compressedLogo, newAccountName.trim());
      }

      const { encrypted, iv, salt } = await encryptSecretGCM(cleanedSecret, vaultSignature!);

      const newAccount: TOTPAccount = {
        id: uuidv4(),
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

      bundle.accounts.push(newAccount);
      bundle.lastUpdated = Date.now();

      const newBundleCID = await uploadBundleToIPFS(bundle, vaultSignature!, userBundleCID);
      setUploadingToIPFS(false);

      // Try to use paymaster-sponsored transaction if available
      let txHash: `0x${string}` | undefined;
      console.log("🔍 Add Account Transaction Debug Info:");
      console.log("- Connector Client:", connectorClient ? "✅ Available" : "❌ Not available");
      console.log("- Paymaster URL:", process.env.NEXT_PUBLIC_PAYMASTER_ENDPOINT_TESTNET ? "✅ Configured" : "❌ Not configured");
      console.log("- Bundle CID:", newBundleCID);
      
      try {
        if (connectorClient && process.env.NEXT_PUBLIC_PAYMASTER_ENDPOINT_TESTNET) {
          console.log("🚀 Attempting paymaster-sponsored transaction...");
          const result = await sendSponsoredTransaction(
            connectorClient,
            address,
            AUTHENTICATOR_CONTRACT_ADDRESS,
            AUTHENTICATOR_ABI,
            "setUserData",
            [newBundleCID]
          );
          txHash = result as `0x${string}`;
          setPendingTxHash(txHash);
          console.log("✅ Paymaster transaction successful:", txHash);
        } else {
          console.log("⚠️ Paymaster not available, using regular transaction...");
          // Fall back to regular transaction
          await writeContract({
            address: AUTHENTICATOR_CONTRACT_ADDRESS as `0x${string}`,
            abi: AUTHENTICATOR_ABI,
            functionName: "setUserData",
            args: [newBundleCID],
          });
        }
      } catch (paymasterError) {
        // Check if user cancelled the sponsored transaction
        if ((paymasterError as any)?.message === 'USER_CANCELLED') {
          console.log("👤 User cancelled sponsored transaction - operation cancelled");
          setIsLoading(false);
          setUploadingToIPFS(false);
          return; // Don't fall back to regular transaction
        }
        
        console.warn("❌ Paymaster transaction failed, falling back to regular transaction:", paymasterError);
        try {
          // Fall back to regular transaction only for actual errors
          await writeContract({
            address: AUTHENTICATOR_CONTRACT_ADDRESS as `0x${string}`,
            abi: AUTHENTICATOR_ABI,
            functionName: "setUserData",
            args: [newBundleCID],
          });
        } catch (fallbackError) {
          throw new Error(`Both paymaster and regular transactions failed: ${fallbackError instanceof Error ? fallbackError.message : 'Unknown error'}`);
        }
      }
      
    } catch (err: unknown) {
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

    const isOnCorrectNetwork = await ensureCorrectNetwork();
    if (!isOnCorrectNetwork) {
      return;
    }

    try {
      setIsLoading(true);
      
      const accountToDelete = accounts.find(acc => acc.index === index);
      if (!accountToDelete) {
        setIsLoading(false);
        return;
      }
      
      if (!userBundleCID || userBundleCID === "") {
        setIsLoading(false);
        return;
      }
      
      const bundle = await retrieveBundleFromIPFS(userBundleCID, vaultSignature!);
      
      bundle.accounts = bundle.accounts.filter(acc => acc.id !== accountToDelete.id);
      bundle.lastUpdated = Date.now();
      
      const newBundleCID = await uploadBundleToIPFS(bundle, vaultSignature!, userBundleCID);
      
      // Try to use paymaster-sponsored transaction if available
      let txHash: `0x${string}` | undefined;
      console.log("🔍 Delete Account Transaction Debug Info:");
      console.log("- Connector Client:", connectorClient ? "✅ Available" : "❌ Not available");
      console.log("- Paymaster URL:", process.env.NEXT_PUBLIC_PAYMASTER_ENDPOINT_TESTNET ? "✅ Configured" : "❌ Not configured");
      console.log("- Bundle CID:", newBundleCID);
      
      try {
        if (connectorClient && process.env.NEXT_PUBLIC_PAYMASTER_ENDPOINT_TESTNET) {
          console.log("🚀 Attempting paymaster-sponsored transaction...");
          const result = await sendSponsoredTransaction(
            connectorClient,
            address,
            AUTHENTICATOR_CONTRACT_ADDRESS,
            AUTHENTICATOR_ABI,
            "setUserData",
            [newBundleCID]
          );
          txHash = result as `0x${string}`;
          setPendingTxHash(txHash);
          console.log("✅ Paymaster transaction successful:", txHash);
        } else {
          console.log("⚠️ Paymaster not available, using regular transaction...");
          // Fall back to regular transaction
          await writeContract({
            address: AUTHENTICATOR_CONTRACT_ADDRESS as `0x${string}`,
            abi: AUTHENTICATOR_ABI,
            functionName: "setUserData",
            args: [newBundleCID],
          });
        }
      } catch (paymasterError) {
        // Check if user cancelled the sponsored transaction
        if ((paymasterError as any)?.message === 'USER_CANCELLED') {
          console.log("👤 User cancelled sponsored transaction - operation cancelled");
          setIsLoading(false);
          return; // Don't fall back to regular transaction
        }
        
        console.warn("❌ Paymaster transaction failed, falling back to regular transaction:", paymasterError);
        try {
          // Fall back to regular transaction
          await writeContract({
            address: AUTHENTICATOR_CONTRACT_ADDRESS as `0x${string}`,
            abi: AUTHENTICATOR_ABI,
            functionName: "setUserData",
            args: [newBundleCID],
          });
        } catch (fallbackError) {
          throw new Error(`Both paymaster and regular transactions failed: ${fallbackError instanceof Error ? fallbackError.message : 'Unknown error'}`);
        }
      }

    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(`Failed to delete account: ${err.message}`);
      } else {
        setError("Failed to delete account. Please try again.");
      }
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

      signMessage({ message: VAULT_UNLOCK_MESSAGE });
      
    } catch (err) {
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
  };

  const handleQRScanSuccess = useCallback((result: QRScanResult) => {
    if (result.success) {
      if (result.migrationData && result.migrationData.accounts) {
        setMigrationAccounts(result.migrationData.accounts);
        setShowQRScanner(false);
        setShowMigrationImport(true);
      } else if (result.data) {
        setNewSecret(result.data.secret);
        if (result.data.account && result.data.account !== 'Scanned Account') {
          setNewAccountName(result.data.account);
        } else if (result.data.issuer && result.data.issuer !== 'Unknown') {
          setNewAccountName(result.data.issuer);
        }
        setShowQRScanner(false);
      }
    }
  }, []);

  const handleMigrationImport = async (selectedAccounts: ParsedMigrationAccount[]) => {
    if (!address || !vaultSignature) {
      setError("Please connect your wallet and unlock vault first");
      return;
    }

    const isOnCorrectNetwork = await ensureCorrectNetwork();
    if (!isOnCorrectNetwork) {
      return;
    }

    try {
      setIsLoading(true);
      setUploadingToIPFS(true);
      setError("");

      let bundle: UserTOTPBundle;
      if (userBundleCID && userBundleCID !== "") {
        bundle = await retrieveBundleFromIPFS(userBundleCID, vaultSignature);
      } else {
        bundle = createEmptyBundle(address);
      }

      for (const account of selectedAccounts) {
        const { encrypted, iv, salt } = await encryptSecretGCM(account.secret, vaultSignature);

        const newAccount: TOTPAccount = {
          id: uuidv4(),
          accountName: account.accountName,
          encryptedSecret: encrypted,
          algorithm: account.algorithm,
          period: 30,
          digits: account.digits,
          timestamp: Date.now(),
          iv,
          salt,
        };

        bundle.accounts.push(newAccount);
      }

      bundle.lastUpdated = Date.now();

      const newBundleCID = await uploadBundleToIPFS(bundle, vaultSignature, userBundleCID);
      setUploadingToIPFS(false);

      // Try to use paymaster-sponsored transaction if available
      let txHash: `0x${string}` | undefined;
      try {
        if (connectorClient && process.env.NEXT_PUBLIC_PAYMASTER_ENDPOINT_TESTNET) {
          const result = await sendSponsoredTransaction(
            connectorClient,
            address,
            AUTHENTICATOR_CONTRACT_ADDRESS,
            AUTHENTICATOR_ABI,
            "setUserData",
            [newBundleCID]
          );
          txHash = result as `0x${string}`;
          setPendingTxHash(txHash);
        } else {
          // Fall back to regular transaction
          await writeContract({
            address: AUTHENTICATOR_CONTRACT_ADDRESS as `0x${string}`,
            abi: AUTHENTICATOR_ABI,
            functionName: "setUserData",
            args: [newBundleCID],
          });
        }
      } catch (paymasterError) {
        // Check if user cancelled the sponsored transaction
        if ((paymasterError as any)?.message === 'USER_CANCELLED') {
          console.log("👤 User cancelled sponsored transaction - operation cancelled");
          setIsLoading(false);
          return; // Don't fall back to regular transaction
        }
        
        console.warn("❌ Paymaster transaction failed, falling back to regular transaction:", paymasterError);
        try {
          // Fall back to regular transaction
          await writeContract({
            address: AUTHENTICATOR_CONTRACT_ADDRESS as `0x${string}`,
            abi: AUTHENTICATOR_ABI,
            functionName: "setUserData",
            args: [newBundleCID],
          });
        } catch (fallbackError) {
          throw new Error(`Both paymaster and regular transactions failed: ${fallbackError instanceof Error ? fallbackError.message : 'Unknown error'}`);
        }
      }

      setShowMigrationImport(false);
      setMigrationAccounts([]);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(`Failed to import accounts: ${err.message}`);
      } else {
        setError("Failed to import accounts. Please try again.");
      }
      setIsLoading(false);
      setUploadingToIPFS(false);
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
            <div 
              className={styles.walletInfo}
              onClick={handleDisconnect}
              style={{ cursor: 'pointer' }}
              title="Click to disconnect"
            >
              <span>🔗</span>
              <span className={styles.walletAddress}>
                {isResolvingBaseName ? (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                    <span className={styles.spinner} aria-hidden />
                    Resolving...
                  </span>
                ) : baseName ? (
                  <span title={`${formatBaseName(baseName)} (${formatAddress(address)})`} style={{ color: '#0000ff' }}>
                    {formatBaseName(baseName)}
                  </span>
                ) : (
                  formatAddress(address)
                )}
              </span>
            </div>
          ) : (
            <button className={styles.connectButton} onClick={handleConnect}>
              Connect Wallet
            </button>
          )}
        </div>
      </div>

      {isTxPending && (
        <div className={styles.toast} role="status" aria-live="polite">
          Pending transaction
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
              <button
                className={styles.deleteButton}
                onClick={() => handleDeleteAccount(account.index)}
                disabled={isLoading}
                type="button"
                title="Delete account"
              >
                ✕
              </button>
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

      {isConnected && isVaultUnlocked && accounts.length > 0 && (
        <button
          className={styles.exportButton}
          onClick={() => setShowExportModal(true)}
          type="button"
          title="Export accounts"
        >
          📤
        </button>
      )}

      {showAddModal && (
        <div className={styles.modal} onClick={() => closeModalSafely('add')}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.sheetHandle} aria-hidden />
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>Add 2FA Account</h2>
              <button
                className={styles.closeButton}
                onClick={() => closeModalSafely('add')}
                disabled={isLoading || isWritePending}
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
                <textarea
                  id="secret"
                  placeholder="Paste your 2FA secret key here (base32 encoded)"
                  value={newSecret}
                  onChange={(e) => setNewSecret(e.target.value)}
                  className={styles.textarea}
                  disabled={isLoading}
                />
                <p className={styles.hint}>
                  The secret is encrypted with AES-256-GCM and stored on IPFS.
                  Only the IPFS CID is stored on-chain.
                </p>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>
                  Import or Scan:
                </label>
                <button
                  type="button"
                  className={styles.scanButton}
                  onClick={() => setShowQRScanner(true)}
                  disabled={isLoading}
                  title="Scan QR code"
                >
                  📷 Scan QR Code
                </button>
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

              <button type="submit" className={styles.submitButton} disabled={isLoading || isSwitchingChain}>
                {isSwitchingChain ? (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span className={styles.spinner} aria-hidden />
                    Switching Network...
                  </span>
                ) : isLoading ? (
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

      <MigrationImport
        isOpen={showMigrationImport}
        accounts={migrationAccounts}
        onClose={() => {
          setShowMigrationImport(false);
          setMigrationAccounts([]);
        }}
        onImport={handleMigrationImport}
        isLoading={isLoading}
      />

      <ExportModal
        isOpen={showExportModal}
        accounts={accounts.map(acc => ({
          accountName: acc.accountName,
          secret: acc.secret,
        }))}
        onClose={() => setShowExportModal(false)}
      />
    </div>
  );
}
