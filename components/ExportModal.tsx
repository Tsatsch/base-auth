"use client";

import { useState, useEffect } from 'react';
import Image from 'next/image';
import styles from '../app/page.module.css';
import { createMigrationURI, ParsedMigrationAccount } from '../lib/googleAuthMigration';
import QRCode from 'qrcode';

interface ExportModalProps {
  accounts: Array<{
    accountName: string;
    secret: string;
  }>;
  onClose: () => void;
  isOpen: boolean;
}

export default function ExportModal({ accounts, onClose, isOpen }: ExportModalProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [qrCodes, setQrCodes] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDisclaimer, setShowDisclaimer] = useState(true);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setCurrentIndex(0);
      setQrCodes([]);
      setShowDisclaimer(true);
      setError(null);
    }
  }, [isOpen]);

  // Generate QR codes when modal opens
  useEffect(() => {
    if (isOpen && accounts.length > 0 && qrCodes.length === 0) {
      generateQRCodes();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, accounts.length]);

  const generateQRCodes = async () => {
    try {
      setIsGenerating(true);
      setError(null);
      
      const qrCodeDataURLs: string[] = [];

      // Generate one QR code per account
      for (const account of accounts) {
        // Convert account to migration format
        const migrationAccount: ParsedMigrationAccount = {
          secret: account.secret,
          name: account.accountName,
          issuer: account.accountName.split(':')[0] || 'BaseAuth',
          accountName: account.accountName.split(':')[1] || account.accountName,
          algorithm: 'SHA1',
          digits: 6,
          type: 'TOTP',
        };

        // Create migration URI for single account
        const uri = createMigrationURI([migrationAccount]);
        
        // Generate QR code from URI
        const qrCodeDataURL = await QRCode.toDataURL(uri, {
          width: 512,
          margin: 2,
          color: {
            dark: '#000000',
            light: '#FFFFFF'
          }
        });

        qrCodeDataURLs.push(qrCodeDataURL);
      }

      setQrCodes(qrCodeDataURLs);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate QR codes');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleNext = () => {
    if (currentIndex < qrCodes.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const handleAcceptDisclaimer = () => {
    setShowDisclaimer(false);
  };

  // Handle escape key for modal closing
  useEffect(() => {
    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscapeKey);
    }
    
    return () => document.removeEventListener('keydown', handleEscapeKey);
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className={styles.modal} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <div className={styles.sheetHandle} aria-hidden />
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>
            Export 2FA Accounts
          </h2>
          <button
            className={styles.closeButton}
            onClick={onClose}
            type="button"
          >
            ✕
          </button>
        </div>

        <div style={{ padding: '1rem' }}>
          {showDisclaimer ? (
            // Disclaimer screen
            <div style={{ textAlign: 'center', padding: '1rem' }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>⚠️</div>
              <h3 style={{ 
                fontSize: '1rem', 
                fontWeight: 600, 
                marginBottom: '0.75rem',
                color: 'var(--text-primary)'
              }}>
                Security Warning
              </h3>
              <p style={{ 
                fontSize: '0.8rem', 
                lineHeight: '1.4',
                color: 'var(--text-secondary)',
                marginBottom: '1rem',
                textAlign: 'left'
              }}>
                QR codes contain <strong>sensitive 2FA data</strong>. Ensure:
              </p>
              <ul style={{ 
                textAlign: 'left', 
                fontSize: '0.75rem',
                lineHeight: '1.5',
                color: 'var(--text-secondary)',
                marginBottom: '1.25rem',
                paddingLeft: '1rem'
              }}>
                <li>Private location</li>
                <li>No one watching</li>
                <li>No cameras recording</li>
                <li>Trusted scanning device</li>
              </ul>
              <p style={{ 
                fontSize: '0.7rem', 
                color: 'var(--text-tertiary)',
                marginBottom: '1.25rem',
                fontStyle: 'italic',
                lineHeight: '1.3'
              }}>
                Anyone with these QR codes can access your accounts.
              </p>
              <button
                onClick={handleAcceptDisclaimer}
                className={styles.submitButton}
                type="button"
                style={{ fontSize: '0.875rem', padding: '0.75rem 1rem' }}
              >
                I Understand
              </button>
            </div>
          ) : (
            // QR code display screen
            <>
              {isGenerating ? (
                <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
                  <span className={styles.spinner} style={{ fontSize: '1.5rem' }} aria-hidden />
                  <p style={{ marginTop: '0.75rem', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                    Generating QR codes...
                  </p>
                </div>
              ) : error ? (
                <div style={{ textAlign: 'center', padding: '1.5rem 1rem' }}>
                  <div className={styles.error}>{error}</div>
                  <button
                    onClick={() => {
                      setError(null);
                      generateQRCodes();
                    }}
                    className={styles.retryButton}
                    style={{ marginTop: '0.75rem', fontSize: '0.875rem', padding: '0.5rem 1rem' }}
                    type="button"
                  >
                    Retry
                  </button>
                </div>
              ) : qrCodes.length > 0 ? (
                <>
                  {/* QR Code Display */}
                  <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
                    <h3 style={{ 
                      fontSize: '0.875rem', 
                      fontWeight: 600, 
                      marginBottom: '0.375rem',
                      color: 'var(--text-primary)'
                    }}>
                      {accounts[currentIndex].accountName}
                    </h3>
                    <p style={{ 
                      fontSize: '0.75rem', 
                      color: 'var(--text-secondary)',
                      marginBottom: '0.75rem'
                    }}>
                      QR Code {currentIndex + 1} of {qrCodes.length}
                    </p>
                    
                    <div style={{
                      display: 'flex',
                      justifyContent: 'center',
                      alignItems: 'center',
                      padding: '0.75rem',
                      backgroundColor: 'white',
                      borderRadius: '8px',
                      marginBottom: '0.75rem'
                    }}>
                      <Image
                        src={qrCodes[currentIndex]}
                        alt={`QR code for ${accounts[currentIndex].accountName}`}
                        width={200}
                        height={200}
                        style={{ display: 'block' }}
                      />
                    </div>

                    {/* Navigation arrows */}
                    <div style={{
                      display: 'flex',
                      justifyContent: 'center',
                      alignItems: 'center',
                      gap: '1.5rem',
                      marginTop: '0.75rem'
                    }}>
                      <button
                        onClick={handlePrevious}
                        disabled={currentIndex === 0}
                        className={styles.connectButton}
                        style={{
                          width: '40px',
                          height: '40px',
                          padding: 0,
                          fontSize: '1.25rem',
                          opacity: currentIndex === 0 ? 0.3 : 1,
                          cursor: currentIndex === 0 ? 'not-allowed' : 'pointer'
                        }}
                        type="button"
                        title="Previous QR code"
                      >
                        ←
                      </button>
                      
                      <div style={{
                        fontSize: '0.75rem',
                        color: 'var(--text-secondary)',
                        minWidth: '50px',
                        textAlign: 'center'
                      }}>
                        {currentIndex + 1} / {qrCodes.length}
                      </div>

                      <button
                        onClick={handleNext}
                        disabled={currentIndex === qrCodes.length - 1}
                        className={styles.connectButton}
                        style={{
                          width: '40px',
                          height: '40px',
                          padding: 0,
                          fontSize: '1.25rem',
                          opacity: currentIndex === qrCodes.length - 1 ? 0.3 : 1,
                          cursor: currentIndex === qrCodes.length - 1 ? 'not-allowed' : 'pointer'
                        }}
                        type="button"
                        title="Next QR code"
                      >
                        →
                      </button>
                    </div>
                  </div>

                  {/* Instructions */}
                  <p className={styles.hint} style={{ marginTop: '1rem', marginBottom: 0, fontSize: '0.75rem' }}>
                    💡 Scan with Google Authenticator or any compatible app. Use arrows to navigate.
                  </p>
                </>
              ) : (
                <div style={{ textAlign: 'center', padding: '1.5rem 1rem' }}>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                    No accounts available to export.
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

