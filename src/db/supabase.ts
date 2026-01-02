import { createClient, SupabaseClient } from "@supabase/supabase-js";

let supabaseClient: SupabaseClient | null = null;
let isAvailable = false;

export interface SupabaseConfig {
  url: string;
  serviceRoleKey: string;
}

/**
 * Initialize the Supabase client.
 * Returns true if connection is successful, false otherwise.
 */
export async function initializeSupabase(
  config?: SupabaseConfig
): Promise<boolean> {
  const url = config?.url || process.env.SUPABASE_URL;
  const serviceRoleKey =
    config?.serviceRoleKey || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    console.log(
      "⚠️ Supabase credentials not configured - running without database persistence"
    );
    isAvailable = false;
    return false;
  }

  try {
    supabaseClient = createClient(url, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Test connection by querying the properties table
    const { error } = await supabaseClient
      .from("properties")
      .select("id")
      .limit(1);

    if (error) {
      console.error("❌ Supabase connection test failed:", error.message);
      isAvailable = false;
      return false;
    }

    console.log("✅ Supabase connected successfully");
    isAvailable = true;
    return true;
  } catch (error) {
    console.error("❌ Failed to initialize Supabase:", error);
    isAvailable = false;
    return false;
  }
}

/**
 * Get the Supabase client instance.
 * Returns null if not initialized or unavailable.
 */
export function getSupabase(): SupabaseClient | null {
  return supabaseClient;
}

/**
 * Check if Supabase is available and connected.
 */
export function isSupabaseAvailable(): boolean {
  return isAvailable && supabaseClient !== null;
}

/**
 * Close the Supabase connection (cleanup).
 */
export function closeSupabase(): void {
  supabaseClient = null;
  isAvailable = false;
}
