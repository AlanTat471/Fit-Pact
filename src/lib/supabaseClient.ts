import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  if (import.meta.env.PROD) {
    throw new Error(
      "[Supabase] FATAL: Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in production build."
    );
  }
  // eslint-disable-next-line no-console
  console.warn(
    "[Supabase] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Supabase client will not be fully initialised."
  );
}

export const supabase = createClient(supabaseUrl || "", supabaseAnonKey || "");

