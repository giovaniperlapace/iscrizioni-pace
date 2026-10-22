import { NextResponse, type NextRequest } from 'next/server';
import { loadCeremonyAssignmentHistory } from '../../ceremony-seats-actions';
import { parseHistoryQuery } from '@/lib/ceremonies/assignment-history';
const headers = { 'Cache-Control': 'private, no-store' };
// A plain authenticated read never invokes the Server Action navigation protocol,
// including when Supabase renews the session cookie.
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams;
  const input = parseHistoryQuery({ planId:q.get('planId'),page:Number(q.get('page')),search:q.get('search'),state:q.get('state') });
  if (!input) return NextResponse.json({status:'invalid'}, {status:400,headers});
  try {return NextResponse.json(await loadCeremonyAssignmentHistory(input), {headers});}
  catch {return NextResponse.json({status:'unavailable'}, {status:500,headers});}
}
