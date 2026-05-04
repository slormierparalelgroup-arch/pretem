import { supabase } from "@/lib/supabase";

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export async function getCurrentUser() {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const { data, error } = await supabase.auth.getUser();
      if (error) throw error;
      return data.user;
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (!message.includes("Lock was stolen") || attempt === 2) throw error;
      await wait(150 * (attempt + 1));
    }
  }

  return null;
}
