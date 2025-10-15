import * as OTPAuth from "otpauth";

/**
 * Generates a TOTP (Time-based One-Time Password) code from a secret
 * @param secret The base32 encoded secret
 * @param accountName Optional account name for the TOTP instance
 * @returns The current 6-digit TOTP code
 */
export function generateTOTP(secret: string, accountName: string = "Account"): string {
  try {
    // Create a new TOTP object
    const totp = new OTPAuth.TOTP({
      issuer: "Base Auth",
      label: accountName,
      algorithm: "SHA1",
      digits: 6,
      period: 30,
      secret: secret,
    });

    // Generate the current token
    const token = totp.generate();
    return token;
  } catch (error) {
    console.error("Error generating TOTP:", error);
    return "000000";
  }
}

/**
 * Gets the remaining seconds until the current TOTP code expires
 * @returns Seconds remaining (0-29)
 */
export function getTimeRemaining(): number {
  const epoch = Math.round(new Date().getTime() / 1000.0);
  return 30 - (epoch % 30);
}

/**
 * Validates if a secret can generate a valid TOTP
 * @param secret The base32 encoded secret
 * @returns true if the secret can generate a TOTP, false otherwise
 */
export function validateTOTPSecret(secret: string): boolean {
  try {
    const totp = new OTPAuth.TOTP({
      algorithm: "SHA1",
      digits: 6,
      period: 30,
      secret: secret,
    });
    
    // Try to generate a token
    const token = totp.generate();
    return token.length === 6;
  } catch {
    return false;
  }
}

/**
 * Parses a TOTP URI and extracts the secret
 * @param uri The otpauth:// URI
 * @returns The extracted secret or null if invalid
 */
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

