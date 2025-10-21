import QRCode from 'qrcode';

export async function generateTOTPQRCode(
  secret: string,
  accountName: string,
  issuer: string = 'Test Issuer'
): Promise<string> {
  const uri = `otpauth://totp/${encodeURIComponent(accountName)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
  
  try {
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
    throw new Error('Failed to generate QR code');
  }
}

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
    throw new Error('Failed to generate QR code');
  }
}

export async function generateTestTOTPQRCode(): Promise<string> {
  const testSecret = 'JBSWY3DPEHPK3PXP';
  const testAccount = 'Test Account';
  const testIssuer = 'Test App';
  
  return generateTOTPQRCode(testSecret, testAccount, testIssuer);
}
