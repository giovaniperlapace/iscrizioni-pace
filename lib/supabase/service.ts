import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let serviceClient: SupabaseClient | null = null;
let serviceClientUrl: string | null = null;
let serviceClientKey: string | null = null;

export function createSupabaseServiceClient() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }

  if (
    serviceClient &&
    serviceClientUrl === url &&
    serviceClientKey === serviceRoleKey
  ) {
    return serviceClient;
  }

  serviceClient = createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
  serviceClientUrl = url;
  serviceClientKey = serviceRoleKey;

  return serviceClient;
}
