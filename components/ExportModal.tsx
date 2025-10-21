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
            <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚠️</div>
              <h3 style={{ 
                fontSize: '1.25rem', 
                fontWeight: 600, 
                marginBottom: '1rem',
                color: 'var(--text-primary)'
              }}>
                Security Warning
              </h3>
              <p style={{ 
                fontSize: '0.875rem', 
                lineHeight: '1.6',
                color: 'var(--text-secondary)',
                marginBottom: '1.5rem',
                textAlign: 'left'
              }}>
                The QR codes you are about to view contain <strong>sensitive information</strong> that 
                can be used to access your 2FA accounts. Please ensure:
              </p>
              <ul style={{ 
                textAlign: 'left', 
                fontSize: '0.875rem',
                lineHeight: '1.8',
                color: 'var(--text-secondary)',
                marginBottom: '2rem',
                paddingLeft: '1.5rem'
              }}>
                <li>You are in a private location</li>
                <li>No one can see your screen</li>
                <li>No cameras are recording</li>
                <li>You trust the device you&apos;re scanning to</li>
              </ul>
              <p style={{ 
                fontSize: '0.75rem', 
                color: 'var(--text-tertiary)',
                marginBottom: '2rem',
                fontStyle: 'italic'
              }}>
                Anyone with access to these QR codes can generate authentication codes for your accounts.
              </p>
              <button
                onClick={handleAcceptDisclaimer}
                className={styles.submitButton}
                type="button"
              >
                I Understand, Show QR Codes
              </button>
            </div>
          ) : (
            // QR code display screen
            <>
              {isGenerating ? (
                <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
                  <span className={styles.spinner} style={{ fontSize: '2rem' }} aria-hidden />
                  <p style={{ marginTop: '1rem', color: 'var(--text-secondary)' }}>
                    Generating QR codes...
                  </p>
                </div>
              ) : error ? (
                <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
                  <div className={styles.error}>{error}</div>
                  <button
                    onClick={() => {
                      setError(null);
                      generateQRCodes();
                    }}
                    className={styles.retryButton}
                    style={{ marginTop: '1rem' }}
                    type="button"
                  >
                    Retry
                  </button>
                </div>
              ) : qrCodes.length > 0 ? (
                <>
                  {/* QR Code Display */}
                  <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                    <h3 style={{ 
                      fontSize: '1rem', 
                      fontWeight: 600, 
                      marginBottom: '0.5rem',
                      color: 'var(--text-primary)'
                    }}>
                      {accounts[currentIndex].accountName}
                    </h3>
                    <p style={{ 
                      fontSize: '0.875rem', 
                      color: 'var(--text-secondary)',
                      marginBottom: '1rem'
                    }}>
                      QR Code {currentIndex + 1} of {qrCodes.length}
                    </p>
                    
                    <div style={{
                      display: 'flex',
                      justifyContent: 'center',
                      alignItems: 'center',
                      padding: '1rem',
                      backgroundColor: 'white',
                      borderRadius: '12px',
                      marginBottom: '1rem'
                    }}>
                      <Image
                        src={qrCodes[currentIndex]}
                        alt={`QR code for ${accounts[currentIndex].accountName}`}
                        width={256}
                        height={256}
                        style={{ display: 'block' }}
                      />
                    </div>

                    {/* Navigation arrows */}
                    <div style={{
                      display: 'flex',
                      justifyContent: 'center',
                      alignItems: 'center',
                      gap: '2rem',
                      marginTop: '1rem'
                    }}>
                      <button
                        onClick={handlePrevious}
                        disabled={currentIndex === 0}
                        className={styles.connectButton}
                        style={{
                          width: '48px',
                          height: '48px',
                          padding: 0,
                          fontSize: '1.5rem',
                          opacity: currentIndex === 0 ? 0.3 : 1,
                          cursor: currentIndex === 0 ? 'not-allowed' : 'pointer'
                        }}
                        type="button"
                        title="Previous QR code"
                      >
                        ←
                      </button>
                      
                      <div style={{
                        fontSize: '0.875rem',
                        color: 'var(--text-secondary)',
                        minWidth: '60px',
                        textAlign: 'center'
                      }}>
                        {currentIndex + 1} / {qrCodes.length}
                      </div>

                      <button
                        onClick={handleNext}
                        disabled={currentIndex === qrCodes.length - 1}
                        className={styles.connectButton}
                        style={{
                          width: '48px',
                          height: '48px',
                          padding: 0,
                          fontSize: '1.5rem',
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
                  <p className={styles.hint} style={{ marginTop: '1.5rem', marginBottom: 0 }}>
                    💡 Scan this QR code with Google Authenticator or any compatible authenticator app 
                    to import this account. Use the arrows to view other accounts.
                  </p>
                </>
              ) : (
                <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
                  <p style={{ color: 'var(--text-secondary)' }}>
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

