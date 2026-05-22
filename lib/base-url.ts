export function publicBaseUrl(): string {
  const redirectUri = process.env.REDIRECT_URI;
  if (!redirectUri) {
    throw new Error("REDIRECT_URI is not set");
  }
  return new URL(redirectUri).origin;
}
