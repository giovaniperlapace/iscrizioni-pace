/** Server-only configuration: never export this value to client components. */
export function getStaffLoginPath(): string | null {
  const token = process.env.STAFF_LOGIN_TOKEN;
  return token && /^[a-f0-9]{48}$/.test(token) ? `/login/${token}` : null;
}

export function isStaffLoginPath(path: string): boolean {
  const expected = getStaffLoginPath();
  return expected !== null && path === expected;
}
