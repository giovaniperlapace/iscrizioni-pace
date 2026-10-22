"use client";
import type { HistoryQuery, HistoryResult } from '@/lib/ceremonies/assignment-history';
export async function readCeremonyHistory(query: HistoryQuery): Promise<HistoryResult> {
  const params = new URLSearchParams({...query,page:String(query.page)});
  const response = await fetch(`/dashboard/ceremonies/history?${params}`, {cache:'no-store',signal:AbortSignal.timeout(25000)});
  if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) throw Error('Cronologia non disponibile');
  return response.json();
}
