"use client";
import { useState, useEffect, useCallback } from "react";
import { useMiniKit } from "@coinbase/onchainkit/minikit";
import { useAccount, useWriteContract, useReadContract } from "wagmi";
import styles from "./page.module.css";
import { encryptSecret, decryptSecret, validateSecret, cleanSecret } from "../lib/crypto";
import { generateTOTP, getTimeRemaining } from "../lib/totp";
import { AUTHENTICATOR_ABI, AUTHENTICATOR_CONTRACT_ADDRESS, type Account } from "../lib/contract";

interface DecryptedAccount {
  accountName: string;
  secret: string;
  code: string;
  index: number;
}

export default function Home() {
  const { isFrameReady, setFrameReady } = useMiniKit();
  const { address, isConnected } = useAccount();
  const [accounts, setAccounts] = useState<DecryptedAccount[]>([]);
  const [timeRemaining, setTimeRemaining] = useState(30);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newAccountName, setNewAccountName] = useState("");
  const [newSecret, setNewSecret] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Initialize the miniapp
  useEffect(() => {
    if (!isFrameReady) {
      setFrameReady();
    }
  }, [setFrameReady, isFrameReady]);

  // Contract interactions
  const { writeContract } = useWriteContract();
  
  const { data: secretsData, refetch: refetchSecrets } = useReadContract({
    address: AUTHENTICATOR_CONTRACT_ADDRESS as `0x${string}`,
    abi: AUTHENTICATOR_ABI,
    functionName: "getSecrets",
    account: address,
    query: {
      enabled: isConnected && !!address,
    },
  });

  // Load and decrypt accounts from blockchain
  const loadAccounts = useCallback(async () => {
    if (!secretsData || !address) {
      setAccounts([]);
      return;
    }

    try {
      const decrypted: DecryptedAccount[] = [];
      
      for (let i = 0; i < (secretsData as Account[]).length; i++) {
        const account = (secretsData as Account[])[i];
        try {
          const decryptedSecret = decryptSecret(account.encryptedSecret, address);
          const code = generateTOTP(decryptedSecret, account.accountName);
          
          decrypted.push({
            accountName: account.accountName,
            secret: decryptedSecret,
            code,
            index: i,
          });
        } catch (err) {
          console.error(`Failed to decrypt account ${account.accountName}:`, err);
        }
      }
      
      setAccounts(decrypted);
    } catch (err) {
      console.error("Error loading accounts:", err);
    }
  }, [secretsData, address]);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

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
      
      // Encrypt the secret with the user's wallet address
      const encrypted = encryptSecret(cleanedSecret, address);

      // Write to the smart contract
      await writeContract({
        address: AUTHENTICATOR_CONTRACT_ADDRESS as `0x${string}`,
        abi: AUTHENTICATOR_ABI,
        functionName: "addSecret",
        args: [newAccountName.trim(), encrypted],
      });

      // Wait a bit and refetch
      setTimeout(() => {
        refetchSecrets();
        setShowAddModal(false);
        setNewAccountName("");
        setNewSecret("");
        setIsLoading(false);
      }, 2000);
    } catch (err: unknown) {
      console.error("Error adding account:", err);
      if (err instanceof Error) {
        setError(`Failed to add account: ${err.message}`);
      } else {
        setError("Failed to add account. Please try again.");
      }
      setIsLoading(false);
    }
  };

  const handleDeleteAccount = async (index: number) => {
    if (!address) return;

    try {
      setIsLoading(true);
      
      await writeContract({
        address: AUTHENTICATOR_CONTRACT_ADDRESS as `0x${string}`,
        abi: AUTHENTICATOR_ABI,
        functionName: "removeSecret",
        args: [BigInt(index)],
      });

      setTimeout(() => {
        refetchSecrets();
        setIsLoading(false);
      }, 2000);
    } catch (err) {
      console.error("Error deleting account:", err);
      setIsLoading(false);
    }
  };

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const copyToClipboard = (code: string) => {
    navigator.clipboard.writeText(code);
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Base Auth</h1>
        {isConnected && address ? (
          <div className={styles.walletInfo}>
            <span>🔗</span>
            <span className={styles.walletAddress}>{formatAddress(address)}</span>
          </div>
        ) : (
          <button className={styles.connectButton}>
            Connect Wallet
          </button>
        )}
      </div>

      {!isConnected ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>🔐</div>
          <h2 className={styles.emptyTitle}>Connect Your Wallet</h2>
          <p className={styles.emptyDescription}>
            Connect your wallet to start managing your 2FA accounts on-chain securely.
          </p>
        </div>
      ) : accounts.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>🔑</div>
          <h2 className={styles.emptyTitle}>No 2FA Accounts Yet</h2>
          <p className={styles.emptyDescription}>
            Add your first 2FA account to start generating secure one-time codes.
          </p>
        </div>
      ) : (
        <div className={styles.accountsList}>
          {accounts.map((account) => (
            <div key={account.index} className={styles.accountCard}>
              <div className={styles.accountInfo}>
                <div className={styles.accountName}>{account.accountName}</div>
                <div className={styles.codeDisplay}>
                  <button
                    className={styles.code}
                    onClick={() => copyToClipboard(account.code)}
                    title="Click to copy"
                    type="button"
                  >
                    {account.code}
                  </button>
                  <div className={styles.timer}>
                    <svg className={styles.timerCircle} viewBox="0 0 36 36">
                      <circle
                        cx="18"
                        cy="18"
                        r="16"
                        fill="none"
                        stroke="var(--gray-15)"
                        strokeWidth="2"
                      />
                      <circle
                        cx="18"
                        cy="18"
                        r="16"
                        fill="none"
                        stroke="var(--base-blue)"
                        strokeWidth="2"
                        strokeDasharray={`${(timeRemaining / 30) * 100.5} 100.5`}
                        strokeLinecap="round"
                        transform="rotate(-90 18 18)"
                      />
                      <text className={styles.timerText} x="50%" y="50%" textAnchor="middle" dy=".3em">
                        {timeRemaining}
                      </text>
                    </svg>
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

      {isConnected && (
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

      {showAddModal && (
        <div className={styles.modal} onClick={() => setShowAddModal(false)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
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
                <textarea
                  id="secret"
                  placeholder="Paste your 2FA secret key here (base32 encoded)"
                  value={newSecret}
                  onChange={(e) => setNewSecret(e.target.value)}
                  className={styles.textarea}
                  disabled={isLoading}
                />
                <p className={styles.hint}>
                  The secret key is usually provided as a base32 encoded string when you set up
                  2FA. It will be encrypted and stored on-chain.
                </p>
              </div>

              {error && <div className={styles.error}>{error}</div>}

              <button type="submit" className={styles.submitButton} disabled={isLoading}>
                {isLoading ? "Adding..." : "Add Account"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
