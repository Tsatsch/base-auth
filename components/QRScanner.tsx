"use client";

import { useEffect, useRef, useState } from 'react';
import { startQRScan, stopQRScan, checkCameraSupport, QRScanResult } from '../lib/qrScanner';
import styles from '../app/page.module.css';

interface QRScannerProps {
  onScanSuccess: (result: QRScanResult) => void;
  onClose: () => void;
  isOpen: boolean;
}

export default function QRScanner({ onScanSuccess, onClose, isOpen }: QRScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cameraSupported, setCameraSupported] = useState<boolean | null>(null);

  // Check camera support when component mounts
  useEffect(() => {
    const checkCamera = async () => {
      try {
        const supported = await checkCameraSupport();
        setCameraSupported(supported);
        if (!supported) {
          setError('Camera not available or access denied. Please check your camera permissions.');
        }
    } catch {
      setCameraSupported(false);
      setError('Failed to check camera support.');
    }
    };

    if (isOpen) {
      checkCamera();
    }
  }, [isOpen]);

  // Start/stop scanning when modal opens/closes
  useEffect(() => {
    if (!isOpen || !videoRef.current || cameraSupported === false) {
      return;
    }

    const startScanning = async () => {
      if (!videoRef.current) return;

      try {
        setIsScanning(true);
        setError(null);
        
        await startQRScan(videoRef.current, (result) => {
          setIsScanning(false);
          if (result.success && (result.data || result.migrationData)) {
            onScanSuccess(result);
          } else {
            setError(result.error || 'Failed to scan QR code');
          }
        });
      } catch (err) {
        setIsScanning(false);
        setError(err instanceof Error ? err.message : 'Failed to start camera');
      }
    };

    startScanning();

    // Cleanup function
    const videoElement = videoRef.current;
    return () => {
      if (videoElement) {
        stopQRScan(videoElement);
      }
      setIsScanning(false);
    };
  }, [isOpen, cameraSupported, onScanSuccess]);

  // Handle escape key for modal closing
  useEffect(() => {
    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscapeKey);
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
          <h2 className={styles.modalTitle}>Scan QR Code</h2>
          <button
            className={styles.closeButton}
            onClick={onClose}
            type="button"
          >
            ✕
          </button>
        </div>

        <div className={styles.qrScannerContainer}>
          {cameraSupported === null ? (
            <div className={styles.scannerLoading}>
              <div className={styles.spinner} aria-hidden />
              <p>Checking camera support...</p>
            </div>
          ) : cameraSupported === false ? (
            <div className={styles.scannerError}>
              <div className={styles.errorIcon}>📷</div>
              <p>Camera not available</p>
              <p className={styles.errorText}>
                Please ensure your device has a camera and grant permission to access it.
              </p>
            </div>
          ) : (
            <>
              <div className={styles.videoContainer}>
                <video
                  ref={videoRef}
                  className={styles.scannerVideo}
                  playsInline
                  muted
                />
                <div className={styles.scannerOverlay}>
                  <div className={styles.scannerFrame} />
                  <div className={styles.scannerInstructions}>
                    <p>Position the QR code within the frame</p>
                    <p className={styles.scannerHint}>
                      The QR code should contain TOTP secret information
                    </p>
                  </div>
                </div>
              </div>
              
              {isScanning && (
                <div className={styles.scannerStatus}>
                  <div className={styles.spinner} aria-hidden />
                  <span>Scanning...</span>
                </div>
              )}
            </>
          )}

          {error && (
            <div className={styles.scannerError}>
              <div className={styles.errorIcon}>⚠️</div>
              <p className={styles.errorText}>{error}</p>
              {cameraSupported && (
                <button
                  className={styles.retryButton}
                  onClick={async () => {
                    setError(null);
                    setIsScanning(true);
                    if (videoRef.current) {
                      try {
                        await startQRScan(videoRef.current, (result) => {
                          setIsScanning(false);
                          if (result.success && (result.data || result.migrationData)) {
                            onScanSuccess(result);
                          } else {
                            setError(result.error || 'Failed to scan QR code');
                          }
                        });
                      } catch (err) {
                        setIsScanning(false);
                        setError(err instanceof Error ? err.message : 'Failed to start camera');
                      }
                    }
                  }}
                  type="button"
                >
                  Try Again
                </button>
              )}
            </div>
          )}
        </div>

        <div className={styles.scannerFooter}>
          <p className={styles.scannerHelp}>
            Make sure the QR code is clearly visible and well-lit. 
            Common TOTP QR codes contain otpauth:// URLs or base32 secrets.
          </p>
        </div>
      </div>
    </div>
  );
}
