/**
 * QR Code Scanner Utilities
 * Handles QR code scanning and parsing for TOTP secrets
 */

import QrScanner from 'qr-scanner';
import { parseMigrationURI, isMigrationURI, type ParsedMigrationAccount } from './googleAuthMigration';

export interface QRScanResult {
  success: boolean;
  data?: {
    secret: string;
    issuer?: string;
    account?: string;
  };
  migrationData?: {
    accounts: ParsedMigrationAccount[];
    metadata?: {
      version: number;
      batchSize: number;
      batchIndex: number;
      batchId: number;
    };
  };
  error?: string;
}

/**
 * Scans QR code from camera stream or image file
 * @param videoElement HTML video element to display camera feed
 * @param onResult Callback function called when QR code is detected
 * @returns Promise that resolves when scanning starts
 */
export async function startQRScan(
  videoElement: HTMLVideoElement,
  onResult: (result: QRScanResult) => void
): Promise<void> {
  try {
    // Check if camera is available
    if (!QrScanner.hasCamera()) {
      onResult({
        success: false,
        error: 'No camera found on this device'
      });
      return;
    }

    // Patch canvas context creation to add willReadFrequently attribute
    // This prevents the Canvas2D performance warning when using getImageData repeatedly
    const originalGetContext = HTMLCanvasElement.prototype.getContext;
    const patchedGetContext = function(this: HTMLCanvasElement, contextType: string, contextAttributes?: CanvasRenderingContext2DSettings) {
      if (contextType === '2d') {
        const attrs = contextAttributes || {};
        attrs.willReadFrequently = true;
        return originalGetContext.call(this, contextType, attrs);
      }
      return originalGetContext.call(this, contextType, contextAttributes);
    };
    
    // Temporarily patch the getContext method
    HTMLCanvasElement.prototype.getContext = patchedGetContext as typeof originalGetContext;

    // Create QR scanner instance
    const qrScanner = new QrScanner(
      videoElement,
      (result) => {
        console.log('QR Code detected:', result);
        
        // Parse the QR code data
        const parsedData = parseQRCodeData(result);
        
        if (parsedData) {
          // Check if it's a migration (batch import)
          if (parsedData.isMigration && parsedData.migrationData) {
            onResult({
              success: true,
              migrationData: parsedData.migrationData
            });
          } else {
            // Single account
            onResult({
              success: true,
              data: {
                secret: parsedData.secret,
                issuer: parsedData.issuer,
                account: parsedData.account
              }
            });
          }
        } else {
          onResult({
            success: false,
            error: 'Invalid QR code format. Please scan a valid TOTP QR code.'
          });
        }
        
        // Stop scanning after successful scan
        qrScanner.stop();
      },
      {
        highlightScanRegion: true,
        highlightCodeOutline: true,
        maxScansPerSecond: 5,
      }
    );

    // Restore original getContext method
    HTMLCanvasElement.prototype.getContext = originalGetContext;

    // Start scanning
    await qrScanner.start();
    
    // Store scanner instance for cleanup
    (videoElement as HTMLVideoElement & { qrScanner?: QrScanner }).qrScanner = qrScanner;
    
  } catch (error) {
    console.error('QR Scanner error:', error);
    
    // Restore original getContext method in case of error
    try {
      const originalGetContext = HTMLCanvasElement.prototype.getContext;
      if (HTMLCanvasElement.prototype.getContext.name === 'patchedGetContext') {
        HTMLCanvasElement.prototype.getContext = originalGetContext;
      }
    } catch {
      // Ignore restoration errors
    }
    
    onResult({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to start camera'
    });
  }
}

/**
 * Stops QR code scanning
 * @param videoElement HTML video element used for scanning
 */
export function stopQRScan(videoElement: HTMLVideoElement): void {
  const qrScanner = (videoElement as HTMLVideoElement & { qrScanner?: QrScanner }).qrScanner;
  if (qrScanner) {
    qrScanner.stop();
    qrScanner.destroy();
    delete (videoElement as HTMLVideoElement & { qrScanner?: QrScanner }).qrScanner;
  }
}

/**
 * Parses QR code data to extract TOTP information
 * @param qrData Raw QR code data
 * @returns Parsed TOTP data or null if invalid
 */
function parseQRCodeData(qrData: QrScanner.ScanResult): { secret: string; issuer?: string; account?: string; isMigration?: boolean; migrationData?: { accounts: ParsedMigrationAccount[]; metadata?: { version: number; batchSize: number; batchIndex: number; batchId: number } } } | null {
  try {
    const data = qrData.data;
    
    // Check if it's a Google Authenticator migration URI
    if (isMigrationURI(data)) {
      console.log('🔄 Detected Google Authenticator migration URI');
      const result = parseMigrationURI(data);
      
      if (result.success && result.accounts && result.accounts.length > 0) {
        console.log(`✅ Successfully parsed ${result.accounts.length} accounts from migration`);
        return {
          secret: '', // Will be handled differently for migration
          isMigration: true,
          migrationData: {
            accounts: result.accounts,
            metadata: result.metadata
          }
        };
      } else {
        console.error('Failed to parse migration URI:', result.error);
        return null;
      }
    }
    
    // Check if it's a standard TOTP URI
    if (data.startsWith('otpauth://totp/')) {
      return parseOTPAuthURI(data);
    }
    
    // Check if it's a base32 secret (common format)
    const base32Regex = /^[A-Z2-7]+=*$/;
    if (base32Regex.test(data.toUpperCase()) && data.length >= 16) {
      return {
        secret: data.toUpperCase(),
        issuer: 'Unknown',
        account: 'Scanned Account'
      };
    }
    
    return null;
  } catch (error) {
    console.error('Error parsing QR code data:', error);
    return null;
  }
}

/**
 * Parses an OTPAuth URI and extracts the secret and metadata
 * @param uri The otpauth:// URI
 * @returns Parsed data or null if invalid
 */
function parseOTPAuthURI(uri: string): { secret: string; issuer?: string; account?: string } | null {
  try {
    const url = new URL(uri);
    
    // Validate protocol
    if (url.protocol !== 'otpauth:') {
      return null;
    }
    
    // Get secret from query parameters
    const secret = url.searchParams.get('secret');
    if (!secret) {
      return null;
    }
    
    // Parse pathname to get issuer and account
    const pathname = url.pathname.substring(1); // Remove leading slash
    const parts = pathname.split(':');
    
    const issuer = url.searchParams.get('issuer') || parts[0] || 'Unknown';
    const account = parts[1] || parts[0] || 'Account';
    
    return {
      secret: secret.toUpperCase(),
      issuer,
      account
    };
  } catch (error) {
    console.error('Error parsing OTPAuth URI:', error);
    return null;
  }
}

/**
 * Checks if the browser supports camera access
 * @returns Promise that resolves to true if camera is available
 */
export async function checkCameraSupport(): Promise<boolean> {
  try {
    if (!QrScanner.hasCamera()) {
      return false;
    }
    
    // Try to get camera permissions
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    stream.getTracks().forEach(track => track.stop());
    return true;
  } catch (error) {
    console.error('Camera support check failed:', error);
    return false;
  }
}
