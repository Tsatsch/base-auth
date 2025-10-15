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
    name: "Cubey", 
    subtitle: "Your AI Ad Companion", 
    description: "Ads",
    screenshotUrls: [`${ROOT_URL}/screenshot-portrait.png`],
    iconUrl: `${ROOT_URL}/blue-icon.png`,
    splashImageUrl: `${ROOT_URL}/blue-hero.png`,
    splashBackgroundColor: "#000000",
    homeUrl: ROOT_URL,
    webhookUrl: `${ROOT_URL}/api/webhook`,
    primaryCategory: "social",
    tags: ["marketing", "ads", "quickstart", "waitlist"],
    heroImageUrl: `${ROOT_URL}/blue-hero.png`, 
    tagline: "",
    ogTitle: "",
    ogDescription: "",
    ogImageUrl: `${ROOT_URL}/blue-hero.png`,
  },
} as const;

