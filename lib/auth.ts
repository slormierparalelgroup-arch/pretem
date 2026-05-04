import { supabase } from "@/lib/supabase";

let authQueue = Promise.resolve();

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function isAuthLockError(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  return message.includes("lock") && (message.includes("stole") || message.includes("released"));
}

async function readCurrentUser() {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const { data, error } = await supabase.auth.getUser();
      if (error) throw error;
      return data.user;
    } catch (error) {
      if (!isAuthLockError(error) || attempt === 4) throw error;
      await wait(200 * (attempt + 1));
    }
  }

  return null;
}

export async function getCurrentUser() {
  const read = authQueue.then(readCurrentUser, readCurrentUser);
  authQueue = read.then(
    () => undefined,
    () => undefined
  );
  return read;
}
