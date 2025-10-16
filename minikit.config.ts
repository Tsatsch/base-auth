const ROOT_URL =
  process.env.NEXT_PUBLIC_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : 'http://localhost:3000');

/**
 * MiniApp configuration object. Must follow the Farcaster MiniApp specification.
 *
 * @see {@link https://miniapps.farcaster.xyz/docs/guides/publishing}
 */
export const minikitConfig = {
  accountAssociation: {
    header: "eyJmaWQiOjIyNzczMCwidHlwZSI6ImN1c3RvZHkiLCJrZXkiOiIweDliNUUzN0UzNTBGNjZBMkYzNGU4NUMzOEQwYTM3NDc4ZDQxYWYzOUIifQ",
    payload: "eyJkb21haW4iOiJiYXNlLWF1dGgtb3JjaW4udmVyY2VsLmFwcCJ9",
    signature: "MHg3NDg0YmIyZjVlMTdjYjI3NzAzOGI1YzZjOTQwOGZlMmZjZWIwNDRiNDJkMTIwNGNjYzBmZjc3MzUzYTFiNjI4NTFjZTRlODNjZTk0NDEyYjExNDdjNjUxZDc1ZTA4NzA0MjlkNjFhNDFkMTRlNzdkNWVkZTRiNDg1YWY1ZTM5ZDFj"
  },
  miniapp: {
    version: "1",
    name: "Base Auth", 
    subtitle: "OnChain TwoFA Authenticator", 
    description: "Secure onchain two factor authentication Two FA management for the Base blockchain. Store and manage your TwoFA secrets with blockchain security",
    screenshotUrls: [`${ROOT_URL}/screenshot-portrait.png`],
    iconUrl: `${ROOT_URL}/blue-icon.png`,
    splashImageUrl: `${ROOT_URL}/blue-hero.png`,
    splashBackgroundColor: "#FFFFFF",
    homeUrl: ROOT_URL,
    webhookUrl: `${ROOT_URL}/api/webhook`,
    primaryCategory: "utility",
    tags: ["security", "2fa", "authentication", "crypto", "blockchain"],
    heroImageUrl: `${ROOT_URL}/blue-hero.png`, 
    tagline: "Secure your accounts on-chain",
    ogTitle: "BaseAuth OnChain Authenticator",
    ogDescription: "Secure two-factor authentication management on Base blockchain",
    ogImageUrl: `${ROOT_URL}/blue-hero.png`,
  },
  baseBuilder: {
    ownerAddress: "0xA3a2Db8224a49FC803Dd1B004959e0Bf05f88Cfb"
  },

} as const;

