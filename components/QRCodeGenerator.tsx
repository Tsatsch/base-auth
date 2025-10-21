"use client";

import { useState } from 'react';
import { generateTOTPQRCode, generateSimpleQRCode, generateTestTOTPQRCode } from '../lib/qrGenerator';
import styles from '../app/page.module.css';

interface QRCodeGeneratorProps {
  onClose: () => void;
  isOpen: boolean;
}

export default function QRCodeGenerator({ onClose, isOpen }: QRCodeGeneratorProps) {
  const [secret, setSecret] = useState('JBSWY3DPEHPK3PXP');
  const [accountName, setAccountName] = useState('Test Account');
  const [issuer, setIssuer] = useState('Test App');
  const [qrCodeDataURL, setQrCodeDataURL] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerateQR = async () => {
    if (!secret.trim() || !accountName.trim()) {
      setError('Please enter both secret and account name');
      return;
    }

    try {
      setIsGenerating(true);
      setError(null);
      
      const dataURL = await generateTOTPQRCode(
        secret.trim(),
        accountName.trim(),
        issuer.trim() || 'Test Issuer'
      );
      
      setQrCodeDataURL(dataURL);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate QR code');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateTestQR = async () => {
    try {
      setIsGenerating(true);
      setError(null);
      
      const dataURL = await generateTestTOTPQRCode();
      setQrCodeDataURL(dataURL);
      
      // Update form fields with test data
      setSecret('JBSWY3DPEHPK3PXP');
      setAccountName('Test Account');
      setIssuer('Test App');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate test QR code');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyToClipboard = async () => {
    if (qrCodeDataURL) {
      try {
        // Convert data URL to blob and copy to clipboard
        const response = await fetch(qrCodeDataURL);
        const blob = await response.blob();
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': blob })
        ]);
        alert('QR code copied to clipboard!');
      } catch (err) {
        console.error('Failed to copy QR code:', err);
        alert('Failed to copy QR code to clipboard');
      }
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className={styles.modal} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <div className={styles.sheetHandle} aria-hidden />
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>Generate Test QR Code</h2>
          <button
            className={styles.closeButton}
            onClick={onClose}
            type="button"
          >
            ✕
          </button>
        </div>

        <div className={styles.form}>
          <div className={styles.formGroup}>
            <label htmlFor="testSecret" className={styles.label}>
              Secret Key
            </label>
            <input
              id="testSecret"
              type="text"
              placeholder="Enter base32 secret (e.g., JBSWY3DPEHPK3PXP)"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              className={styles.input}
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="testAccount" className={styles.label}>
              Account Name
            </label>
            <input
              id="testAccount"
              type="text"
              placeholder="Enter account name"
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
              className={styles.input}
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="testIssuer" className={styles.label}>
              Issuer (Optional)
            </label>
            <input
              id="testIssuer"
              type="text"
              placeholder="Enter issuer name"
              value={issuer}
              onChange={(e) => setIssuer(e.target.value)}
              className={styles.input}
            />
          </div>

          {error && <div className={styles.error}>{error}</div>}

          <div className={styles.buttonGroup}>
            <button
              type="button"
              className={styles.submitButton}
              onClick={handleGenerateTestQR}
              disabled={isGenerating}
            >
              {isGenerating ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span className={styles.spinner} aria-hidden />
                  Generating...
                </span>
              ) : (
                'Generate Test QR Code'
              )}
            </button>

            <button
              type="button"
              className={styles.connectButton}
              onClick={handleGenerateQR}
              disabled={isGenerating}
            >
              Generate Custom QR Code
            </button>
          </div>

          {qrCodeDataURL && (
            <div className={styles.qrCodeDisplay}>
              <h3 className={styles.qrCodeTitle}>Generated QR Code</h3>
              <div className={styles.qrCodeImageContainer}>
                <img
                  src={qrCodeDataURL}
                  alt="Generated QR Code"
                  className={styles.qrCodeImage}
                />
              </div>
              <button
                type="button"
                className={styles.connectButton}
                onClick={handleCopyToClipboard}
              >
                Copy QR Code
              </button>
              <p className={styles.hint}>
                Scan this QR code with the scanner in the app to test the functionality.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
