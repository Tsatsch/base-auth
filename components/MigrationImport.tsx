"use client";

import { useState, useEffect } from 'react';
import { ParsedMigrationAccount } from '../lib/googleAuthMigration';
import styles from '../app/page.module.css';

interface MigrationImportProps {
  accounts: ParsedMigrationAccount[];
  onImport: (selectedAccounts: ParsedMigrationAccount[]) => void;
  onClose: () => void;
  isOpen: boolean;
  isLoading?: boolean;
}

export default function MigrationImport({ 
  accounts, 
  onImport, 
  onClose, 
  isOpen,
  isLoading = false 
}: MigrationImportProps) {
  const [selectedAccounts, setSelectedAccounts] = useState<Set<number>>(
    new Set(accounts.map((_, index) => index))
  );

  // Handle escape key for modal closing
  useEffect(() => {
    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen && !isLoading) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscapeKey);
    }
    
    return () => document.removeEventListener('keydown', handleEscapeKey);
  }, [isOpen, onClose, isLoading]);

  if (!isOpen) {
    return null;
  }

  const toggleAccount = (index: number) => {
    const newSelected = new Set(selectedAccounts);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedAccounts(newSelected);
  };

  const toggleAll = () => {
    if (selectedAccounts.size === accounts.length) {
      setSelectedAccounts(new Set());
    } else {
      setSelectedAccounts(new Set(accounts.map((_, index) => index)));
    }
  };

  const handleImport = () => {
    const accountsToImport = accounts.filter((_, index) => selectedAccounts.has(index));
    onImport(accountsToImport);
  };

  return (
    <div className={styles.modal} onClick={() => {
      if (!isLoading) {
        onClose();
      }
    }}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <div className={styles.sheetHandle} aria-hidden />
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>
            Import from Google Authenticator
          </h2>
          <button
            className={styles.closeButton}
            onClick={onClose}
            type="button"
            disabled={isLoading}
          >
            ✕
          </button>
        </div>

        <div style={{ padding: '1rem' }}>
          <div style={{ 
            marginBottom: '1rem', 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center' 
          }}>
            <p style={{ 
              fontSize: '0.875rem', 
              color: 'var(--text-secondary)',
              margin: 0 
            }}>
              Found {accounts.length} account{accounts.length !== 1 ? 's' : ''}. 
              Select which ones to import:
            </p>
            <button
              onClick={toggleAll}
              className={styles.retryButton}
              style={{ fontSize: '0.75rem', padding: '0.25rem 0.75rem' }}
              type="button"
              disabled={isLoading}
            >
              {selectedAccounts.size === accounts.length ? 'Deselect All' : 'Select All'}
            </button>
          </div>

          <div style={{ 
            maxHeight: '400px', 
            overflowY: 'auto',
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            backgroundColor: 'var(--bg-secondary)'
          }}>
            {accounts.map((account, index) => (
              <label
                key={index}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '1rem',
                  borderBottom: index < accounts.length - 1 ? '1px solid var(--border-color)' : 'none',
                  cursor: isLoading ? 'not-allowed' : 'pointer',
                  opacity: isLoading ? 0.6 : 1,
                  backgroundColor: selectedAccounts.has(index) 
                    ? 'rgba(0, 82, 255, 0.05)' 
                    : 'transparent',
                  transition: 'background-color 0.2s ease'
                }}
              >
                <input
                  type="checkbox"
                  checked={selectedAccounts.has(index)}
                  onChange={() => toggleAccount(index)}
                  disabled={isLoading}
                  style={{
                    marginRight: '1rem',
                    width: '18px',
                    height: '18px',
                    cursor: isLoading ? 'not-allowed' : 'pointer'
                  }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ 
                    fontWeight: 600, 
                    marginBottom: '0.25rem',
                    color: 'var(--text-primary)'
                  }}>
                    {account.accountName}
                  </div>
                  {account.issuer && account.issuer !== 'Unknown' && (
                    <div style={{ 
                      fontSize: '0.875rem', 
                      color: 'var(--text-secondary)',
                      marginBottom: '0.25rem'
                    }}>
                      {account.issuer}
                    </div>
                  )}
                  <div style={{ 
                    fontSize: '0.75rem', 
                    color: 'var(--text-tertiary)',
                    display: 'flex',
                    gap: '0.75rem'
                  }}>
                    <span>🔐 {account.type}</span>
                    <span>🔢 {account.digits} digits</span>
                    <span>🔏 {account.algorithm}</span>
                  </div>
                </div>
              </label>
            ))}
          </div>

          <div style={{ marginTop: '1rem', display: 'flex', gap: '0.75rem' }}>
            <button
              onClick={handleImport}
              className={styles.submitButton}
              disabled={selectedAccounts.size === 0 || isLoading}
              type="button"
              style={{ flex: 1 }}
            >
              {isLoading ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span className={styles.spinner} aria-hidden />
                  Importing...
                </span>
              ) : (
                `Import ${selectedAccounts.size} Account${selectedAccounts.size !== 1 ? 's' : ''}`
              )}
            </button>
            <button
              onClick={onClose}
              className={styles.retryButton}
              disabled={isLoading}
              type="button"
            >
              Cancel
            </button>
          </div>

          <p className={styles.hint} style={{ marginTop: '1rem', marginBottom: 0 }}>
            💡 Each account will be encrypted with AES-256-GCM and stored on IPFS. 
            Only the IPFS CID is stored on-chain.
          </p>
        </div>
      </div>
    </div>
  );
}

