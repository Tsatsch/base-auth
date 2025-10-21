import * as OTPAuth from "otpauth";

export function generateTOTP(secret: string, accountName: string = "Account"): string {
  try {
    const totp = new OTPAuth.TOTP({
      issuer: "Base Auth",
      label: accountName,
      algorithm: "SHA1",
      digits: 6,
      period: 30,
      secret: secret,
    });

    const token = totp.generate();
    return token;
  } catch (error) {
    return "000000";
  }
}

export function getTimeRemaining(): number {
  const epoch = Math.round(new Date().getTime() / 1000.0);
  return 30 - (epoch % 30);
}

export function validateTOTPSecret(secret: string): boolean {
  try {
    const totp = new OTPAuth.TOTP({
      algorithm: "SHA1",
      digits: 6,
      period: 30,
      secret: secret,
    });
    
    const token = totp.generate();
    return token.length === 6;
  } catch {
    return false;
  }
}

export function parseOTPAuthURI(uri: string): { secret: string; issuer?: string; account?: string } | null {
  try {
    const totp = OTPAuth.URI.parse(uri);
    
    if (totp instanceof OTPAuth.TOTP) {
      return {
        secret: totp.secret.base32,
        issuer: totp.issuer,
        account: totp.label,
      };
    }
    
    return null;
  } catch {
    return null;
  }
}
