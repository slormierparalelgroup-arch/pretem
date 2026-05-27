import { supabase } from "@/lib/supabase";

export type NotificationItem = {
  id: string;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
};

export async function notifyAdmins(title: string, body: string, link?: string) {
  return supabase.rpc("notify_admins", {
    notification_body: body,
    notification_link: link || null,
    notification_title: title
  });
}

export async function notifyUser(userId: string, title: string, body: string, link?: string) {
  return supabase.rpc("notify_user", {
    notification_body: body,
    notification_link: link || null,
    notification_title: title,
    target_user_id: userId
  });
}

