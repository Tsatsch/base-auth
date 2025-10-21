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

export async function startQRScan(
  videoElement: HTMLVideoElement,
  onResult: (result: QRScanResult) => void
): Promise<void> {
  try {
    if (!QrScanner.hasCamera()) {
      onResult({
        success: false,
        error: 'No camera found on this device'
      });
      return;
    }

    const originalGetContext = HTMLCanvasElement.prototype.getContext;
    const patchedGetContext = function(this: HTMLCanvasElement, contextType: string, contextAttributes?: CanvasRenderingContext2DSettings) {
      if (contextType === '2d') {
        const attrs = contextAttributes || {};
        attrs.willReadFrequently = true;
        return originalGetContext.call(this, contextType, attrs);
      }
      return originalGetContext.call(this, contextType, contextAttributes);
    };
    
    HTMLCanvasElement.prototype.getContext = patchedGetContext as typeof originalGetContext;

    const qrScanner = new QrScanner(
      videoElement,
      (result) => {
        const parsedData = parseQRCodeData(result);
        
        if (parsedData) {
          if (parsedData.isMigration && parsedData.migrationData) {
            onResult({
              success: true,
              migrationData: parsedData.migrationData
            });
          } else {
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
        
        qrScanner.stop();
      },
      {
        highlightScanRegion: true,
        highlightCodeOutline: true,
        maxScansPerSecond: 5,
      }
    );

    HTMLCanvasElement.prototype.getContext = originalGetContext;

    await qrScanner.start();
    
    (videoElement as HTMLVideoElement & { qrScanner?: QrScanner }).qrScanner = qrScanner;
    
  } catch (error) {
    try {
      const originalGetContext = HTMLCanvasElement.prototype.getContext;
      if (HTMLCanvasElement.prototype.getContext.name === 'patchedGetContext') {
        HTMLCanvasElement.prototype.getContext = originalGetContext;
      }
    } catch {
    }
    
    onResult({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to start camera'
    });
  }
}

export function stopQRScan(videoElement: HTMLVideoElement): void {
  const qrScanner = (videoElement as HTMLVideoElement & { qrScanner?: QrScanner }).qrScanner;
  if (qrScanner) {
    qrScanner.stop();
    qrScanner.destroy();
    delete (videoElement as HTMLVideoElement & { qrScanner?: QrScanner }).qrScanner;
  }
}

function parseQRCodeData(qrData: QrScanner.ScanResult): { secret: string; issuer?: string; account?: string; isMigration?: boolean; migrationData?: { accounts: ParsedMigrationAccount[]; metadata?: { version: number; batchSize: number; batchIndex: number; batchId: number } } } | null {
  try {
    const data = qrData.data;
    
    if (isMigrationURI(data)) {
      const result = parseMigrationURI(data);
      
      if (result.success && result.accounts && result.accounts.length > 0) {
        return {
          secret: '',
          isMigration: true,
          migrationData: {
            accounts: result.accounts,
            metadata: result.metadata
          }
        };
      } else {
        return null;
      }
    }
    
    if (data.startsWith('otpauth://totp/')) {
      return parseOTPAuthURI(data);
    }
    
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
    return null;
  }
}

function parseOTPAuthURI(uri: string): { secret: string; issuer?: string; account?: string } | null {
  try {
    const url = new URL(uri);
    
    if (url.protocol !== 'otpauth:') {
      return null;
    }
    
    const secret = url.searchParams.get('secret');
    if (!secret) {
      return null;
    }
    
    const pathname = url.pathname.substring(1);
    const parts = pathname.split(':');
    
    const issuer = url.searchParams.get('issuer') || parts[0] || 'Unknown';
    const account = parts[1] || parts[0] || 'Account';
    
    return {
      secret: secret.toUpperCase(),
      issuer,
      account
    };
  } catch (error) {
    return null;
  }
}

export async function checkCameraSupport(): Promise<boolean> {
  try {
    if (!QrScanner.hasCamera()) {
      return false;
    }
    
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    stream.getTracks().forEach(track => track.stop());
    return true;
  } catch (error) {
    return false;
  }
}
