"use client";
import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { useMiniKit } from "@coinbase/onchainkit/minikit";
import { useAccount, useWriteContract, useReadContract, useConnect, useDisconnect, useWaitForTransactionReceipt, useSignMessage } from "wagmi";
import { injected } from "wagmi/connectors";
import { v4 as uuidv4 } from "uuid";
import styles from "./page.module.css";
import { encryptSecretGCM, decryptSecretGCM, validateSecret, cleanSecret } from "../lib/crypto";
import { generateTOTP, getTimeRemaining } from "../lib/totp";
import { AUTHENTICATOR_ABI, AUTHENTICATOR_CONTRACT_ADDRESS } from "../lib/contract";
import { uploadBundleToIPFS, retrieveBundleFromIPFS, createEmptyBundle, uploadImageToIPFS, getIPFSImageURL, type UserTOTPBundle, type TOTPAccount } from "../lib/ipfs";
import { compressImage, isValidImageFile } from "../lib/imageCompression";
import { VAULT_UNLOCK_MESSAGE, isValidSignature } from "../lib/signature";
import QRScanner from "../components/QRScanner";
import { QRScanResult } from "../lib/qrScanner";
import QRCodeGenerator from "../components/QRCodeGenerator";
import MigrationImport from "../components/MigrationImport";
import ExportModal from "../components/ExportModal";
import { ParsedMigrationAccount } from "../lib/googleAuthMigration";
import { resolveBaseName, formatBaseName } from "../lib/basename";

interface DecryptedAccount {
  id: string;
  accountName: string;
  secret: string;
  code: string;
  index: number;
  logoCID?: string;
}


export default function Home() {
  const { isFrameReady, setFrameReady } = useMiniKit();
  const { address, isConnected } = useAccount();
  const { connect } = useConnect();
  const { disconnect } = useDisconnect();
  
  const [accounts, setAccounts] = useState<DecryptedAccount[]>([]);
  const [timeRemaining, setTimeRemaining] = useState(30);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [showQRGenerator, setShowQRGenerator] = useState(false);
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
  
  // Vault unlock state
  const [vaultSignature, setVaultSignature] = useState<string | null>(null);
  const [isVaultUnlocked, setIsVaultUnlocked] = useState(false);
  const [isUnlocking, setIsUnlocking] = useState(false);
  
  // Base name resolution state
  const [baseName, setBaseName] = useState<string | null>(null);
  const [isResolvingBaseName, setIsResolvingBaseName] = useState(false);

  // Initialize the miniapp
  useEffect(() => {
    if (!isFrameReady) {
      setFrameReady();
    }
  }, [setFrameReady, isFrameReady]);

  // Resolve base name when wallet connects
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
      } catch (error) {
        console.warn('Failed to resolve base name:', error);
        setBaseName(null);
      } finally {
        setIsResolvingBaseName(false);
      }
    };

    resolveWalletBaseName();
  }, [address, isConnected]);


  // Auto-connect to injected provider on mount
  useEffect(() => {
    if (!isConnected && isFrameReady) {
      // Attempt to connect automatically
      connect({ connector: injected() });
    }
  }, [isConnected, isFrameReady, connect]);


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
  
  const { data: userData, refetch: refetchUserData, error: readError, isLoading: isReadLoading } = useReadContract({
    address: AUTHENTICATOR_CONTRACT_ADDRESS as `0x${string}`,
    abi: AUTHENTICATOR_ABI,
    functionName: "getUserData",
    account: address, // CRITICAL: Pass the account to set msg.sender
    args: [],
    query: {
      enabled: isConnected && !!address,
      refetchInterval: false,
      staleTime: 0, // Always consider data stale
      gcTime: 0, // Don't cache at all
    },
  });
  
  // Extract bundle CID from userData
  const userBundleCID = userData?.exists ? userData.ipfsCID : null;
  
  // Log read contract state
  useEffect(() => {
    console.log("=".repeat(60));
    console.log("📖 READ CONTRACT STATE");
    console.log("=".repeat(60));
    console.log("Connected Wallet Address:", address);
    console.log("Contract Address:", AUTHENTICATOR_CONTRACT_ADDRESS);
    console.log("User Data:", userData);
    console.log("User Bundle CID:", userBundleCID);
    console.log("Is Connected:", isConnected);
    console.log("Read Error:", readError);
    console.log("Is Loading:", isReadLoading);
    console.log("=".repeat(60));
  }, [userData, userBundleCID, readError, isReadLoading, address, isConnected]);

  // Load and decrypt accounts from IPFS bundle
  const loadAccounts = useCallback(async () => {
    if (!userBundleCID || !address || !vaultSignature) {
      console.log("No bundle CID, address, or vault signature available");
      setAccounts([]);
      return;
    }

    try {
      console.log("📦 Loading user bundle from IPFS:", userBundleCID);
      
      // Retrieve and decrypt user bundle from IPFS (bundle is now fully encrypted)
      const bundle: UserTOTPBundle = await retrieveBundleFromIPFS(userBundleCID, vaultSignature);
      
      console.log("Loading accounts, count:", bundle.accounts.length);
      const decrypted: DecryptedAccount[] = [];
      
      for (let i = 0; i < bundle.accounts.length; i++) {
        const account = bundle.accounts[i];
        try {
          // Decrypt the secret using AES-256-GCM with signature
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
          
          console.log(`✅ Successfully decrypted account: ${account.accountName}`);
        } catch (err) {
          console.error(`Failed to decrypt account ${account.accountName}:`, err);
        }
      }
      
      console.log("Loaded and decrypted accounts:", decrypted.length);
      setAccounts(decrypted);
    } catch (err) {
      console.error("Error loading accounts:", err);
      setAccounts([]);
    }
  }, [userBundleCID, address, vaultSignature]);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

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
        
        // Trigger the hook refetch
        await refetchUserData();
        console.log("📊 User data refetched");
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
      console.log("✍️  ADDING NEW ACCOUNT TO BUNDLE");
      console.log("=".repeat(60));
      console.log("Wallet Address:", address);
      console.log("Account Name:", newAccountName.trim());
      console.log("Contract Address:", AUTHENTICATOR_CONTRACT_ADDRESS);
      console.log("=".repeat(60));
      
      // Step 1: Fetch existing bundle or create new one
      let bundle: UserTOTPBundle;
      if (userBundleCID && userBundleCID !== "") {
        console.log("📦 Fetching existing bundle:", userBundleCID);
        bundle = await retrieveBundleFromIPFS(userBundleCID, vaultSignature!);
      } else {
        console.log("🆕 Creating new bundle");
        bundle = createEmptyBundle(address);
      }
      
      // Step 2: Upload and compress logo if provided
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

      // Step 3: Encrypt the secret with AES-256-GCM using signature
      console.log("🔐 Encrypting secret with AES-256-GCM using signature...");
      const { encrypted, iv, salt } = await encryptSecretGCM(cleanedSecret, vaultSignature!);
      console.log("✅ Secret encrypted");

      // Step 4: Create new account object
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

      // Step 5: Add to bundle
      bundle.accounts.push(newAccount);
      bundle.lastUpdated = Date.now();

      // Step 6: Upload updated bundle to IPFS (encrypted, with cleanup of old bundle)
      console.log("📤 Uploading encrypted bundle to IPFS...");
      const newBundleCID = await uploadBundleToIPFS(bundle, vaultSignature!, userBundleCID);
      console.log("✅ Encrypted bundle uploaded:", newBundleCID);
      setUploadingToIPFS(false);

      // Step 7: Update contract with new CID
      console.log("⛓️  Storing bundle CID on blockchain...");
      await writeContract({
        address: AUTHENTICATOR_CONTRACT_ADDRESS as `0x${string}`,
        abi: AUTHENTICATOR_ABI,
        functionName: "setUserData",
        args: [newBundleCID],
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


    try {
      setIsLoading(true);
      
      // Get account ID from index
      const accountToDelete = accounts.find(acc => acc.index === index);
      if (!accountToDelete) {
        console.error("Account not found at index:", index);
        setIsLoading(false);
        return;
      }
      
      // Fetch existing bundle
      if (!userBundleCID || userBundleCID === "") {
        console.error("No bundle found");
        setIsLoading(false);
        return;
      }
      
      console.log("📦 Fetching bundle to remove account...");
      const bundle = await retrieveBundleFromIPFS(userBundleCID, vaultSignature!);
      
      // Remove account from bundle
      bundle.accounts = bundle.accounts.filter(acc => acc.id !== accountToDelete.id);
      bundle.lastUpdated = Date.now();
      
      // Upload updated encrypted bundle (with cleanup of old bundle)
      console.log("📤 Uploading updated encrypted bundle...");
      const newBundleCID = await uploadBundleToIPFS(bundle, vaultSignature!, userBundleCID);
      console.log("✅ Encrypted bundle uploaded:", newBundleCID);
      
      // Update contract
      await writeContract({
        address: AUTHENTICATOR_CONTRACT_ADDRESS as `0x${string}`,
        abi: AUTHENTICATOR_ABI,
        functionName: "setUserData",
        args: [newBundleCID],
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

  const handleQRScanSuccess = useCallback((result: QRScanResult) => {
    if (result.success) {
      // Check if it's a migration (batch import)
      if (result.migrationData && result.migrationData.accounts) {
        console.log(`✅ Migration QR scanned with ${result.migrationData.accounts.length} accounts`);
        setMigrationAccounts(result.migrationData.accounts);
        setShowQRScanner(false);
        setShowMigrationImport(true);
      } else if (result.data) {
        // Single account
        setNewSecret(result.data.secret);
        if (result.data.account && result.data.account !== 'Scanned Account') {
          setNewAccountName(result.data.account);
        } else if (result.data.issuer && result.data.issuer !== 'Unknown') {
          setNewAccountName(result.data.issuer);
        }
        setShowQRScanner(false);
        console.log("✅ QR code scanned successfully:", result.data);
      }
    }
  }, []);

  const handleMigrationImport = async (selectedAccounts: ParsedMigrationAccount[]) => {
    if (!address || !vaultSignature) {
      setError("Please connect your wallet and unlock vault first");
      return;
    }


    try {
      setIsLoading(true);
      setUploadingToIPFS(true);
      setError("");

      console.log("=".repeat(60));
      console.log("📦 IMPORTING MULTIPLE ACCOUNTS FROM GOOGLE AUTHENTICATOR");
      console.log("=".repeat(60));
      console.log("Wallet Address:", address);
      console.log("Number of Accounts:", selectedAccounts.length);
      console.log("Contract Address:", AUTHENTICATOR_CONTRACT_ADDRESS);
      console.log("=".repeat(60));

      // Step 1: Fetch existing bundle or create new one
      let bundle: UserTOTPBundle;
      if (userBundleCID && userBundleCID !== "") {
        console.log("📦 Fetching existing bundle:", userBundleCID);
        bundle = await retrieveBundleFromIPFS(userBundleCID, vaultSignature);
      } else {
        console.log("🆕 Creating new bundle");
        bundle = createEmptyBundle(address);
      }

      // Step 2: Process each selected account
      for (const account of selectedAccounts) {
        console.log(`🔐 Processing account: ${account.accountName} (${account.issuer})`);

        // Encrypt the secret with AES-256-GCM using signature
        const { encrypted, iv, salt } = await encryptSecretGCM(account.secret, vaultSignature);

        // Create new account object
        const newAccount: TOTPAccount = {
          id: uuidv4(),
          accountName: account.accountName,
          encryptedSecret: encrypted,
          algorithm: account.algorithm,
          period: 30, // Standard TOTP period
          digits: account.digits,
          timestamp: Date.now(),
          iv,
          salt,
          // Note: We don't transfer logos from Google Authenticator
        };

        bundle.accounts.push(newAccount);
        console.log(`✅ Added account: ${account.accountName}`);
      }

      bundle.lastUpdated = Date.now();

      // Step 3: Upload updated bundle to IPFS (encrypted, with cleanup of old bundle)
      console.log("📤 Uploading encrypted bundle to IPFS...");
      const newBundleCID = await uploadBundleToIPFS(bundle, vaultSignature, userBundleCID);
      console.log("✅ Encrypted bundle uploaded:", newBundleCID);
      setUploadingToIPFS(false);

      // Step 4: Update contract with new CID
      console.log("⛓️  Storing bundle CID on blockchain...");
      await writeContract({
        address: AUTHENTICATOR_CONTRACT_ADDRESS as `0x${string}`,
        abi: AUTHENTICATOR_ABI,
        functionName: "setUserData",
        args: [newBundleCID],
      });

      console.log("✅ Transaction submitted! Waiting for confirmation...");
      console.log("=".repeat(60));

      // Close the migration import modal
      setShowMigrationImport(false);
      setMigrationAccounts([]);
    } catch (err: unknown) {
      console.error("❌ Error importing accounts:", err);
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
