import { operationsReturnPath } from './operations-table.ts';

/** Keep only the participant-list context, never a caller-supplied destination. */
export function manualRegistrationPath(
  value: unknown,
  dashboard: 'admin' | 'manager' = 'manager',
  open = false,
): string {
  const expanded = typeof value === 'string' && value.startsWith(`/dashboard/${dashboard}?`)
    && new URL(value, 'https://local.invalid').searchParams.get('nav') === 'full';
  const url = new URL(operationsReturnPath(value, dashboard, expanded ? 'full' : 'mini'), 'https://local.invalid');
  url.searchParams.delete('edit');
  if (open) url.searchParams.set('manual', '1');
  return `${url.pathname}?${url.searchParams}`;
}
