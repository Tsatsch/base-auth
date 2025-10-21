/**
 * QR Code Generator Utilities
 * Used for testing and generating QR codes with TOTP secrets
 */

import QRCode from 'qrcode';

/**
 * Generates a QR code data URL from TOTP secret information
 * @param secret The base32 encoded secret
 * @param accountName The account name
 * @param issuer The issuer name
 * @returns Promise that resolves to a data URL containing the QR code image
 */
export async function generateTOTPQRCode(
  secret: string,
  accountName: string,
  issuer: string = 'Test Issuer'
): Promise<string> {
  // Create OTPAuth URI
  const uri = `otpauth://totp/${encodeURIComponent(accountName)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
  
  try {
    // Generate QR code as data URL
    const qrCodeDataURL = await QRCode.toDataURL(uri, {
      width: 256,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });
    
    return qrCodeDataURL;
  } catch (error) {
    console.error('Error generating QR code:', error);
    throw new Error('Failed to generate QR code');
  }
}

/**
 * Generates a simple QR code from plain text
 * @param text The text to encode
 * @returns Promise that resolves to a data URL containing the QR code image
 */
export async function generateSimpleQRCode(text: string): Promise<string> {
  try {
    const qrCodeDataURL = await QRCode.toDataURL(text, {
      width: 256,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });
    
    return qrCodeDataURL;
  } catch (error) {
    console.error('Error generating QR code:', error);
    throw new Error('Failed to generate QR code');
  }
}

/**
 * Creates a test TOTP QR code for development/testing purposes
 * @returns Promise that resolves to a data URL containing a test QR code
 */
export async function generateTestTOTPQRCode(): Promise<string> {
  // Use a well-known test secret
  const testSecret = 'JBSWY3DPEHPK3PXP';
  const testAccount = 'Test Account';
  const testIssuer = 'Test App';
  
  return generateTOTPQRCode(testSecret, testAccount, testIssuer);
}
