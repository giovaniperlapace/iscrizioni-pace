export function buildAppMagicLink(
  redirectTo: string,
  hashedToken: string | null
): string | null {
  if (!hashedToken) {
    return null;
  }

  const callbackUrl = new URL(redirectTo);
  callbackUrl.searchParams.set("token_hash", hashedToken);
  callbackUrl.searchParams.set("type", "email");

  return callbackUrl.toString();
}
