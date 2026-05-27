"use client";

import Link from "next/link";
import { Bell } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLanguage } from "@/components/LanguageProvider";
import { NotificationItem } from "@/lib/notifications";
import { getCurrentUser } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

export function NotificationsMenu() {
  const { t } = useLanguage();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [open, setOpen] = useState(false);
  const initializedRef = useRef(false);
  const interactionRef = useRef(false);
  const newestIdRef = useRef<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const unreadCount = useMemo(() => items.filter((item) => !item.read_at).length, [items]);

  const playNotificationSound = useCallback(() => {
    if (!interactionRef.current) return;

    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;

    try {
      const audioContext = new AudioContextClass();
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      const now = audioContext.currentTime;

      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(740, now);
      oscillator.frequency.setValueAtTime(880, now + 0.08);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.08, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);

      oscillator.connect(gain);
      gain.connect(audioContext.destination);
      oscillator.start(now);
      oscillator.stop(now + 0.3);
      oscillator.onended = () => audioContext.close();
    } catch {
      // Browsers can block sound until the visitor taps or clicks the page.
    }
  }, []);

  const loadNotifications = useCallback(async () => {
    const user = await getCurrentUser();
    if (!user) {
      setItems([]);
      initializedRef.current = false;
      newestIdRef.current = null;
      return;
    }

    const { data } = await supabase
      .from("notifications")
      .select("id, title, body, link, read_at, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(8);

    const nextItems = (data || []) as NotificationItem[];
    const newestUnread = nextItems.find((item) => !item.read_at);

    if (initializedRef.current && newestUnread && newestUnread.id !== newestIdRef.current) {
      playNotificationSound();
    }

    newestIdRef.current = newestUnread?.id || nextItems[0]?.id || null;
    initializedRef.current = true;
    setItems(nextItems);
  }, [playNotificationSound]);

  useEffect(() => {
    loadNotifications();
    const { data } = supabase.auth.onAuthStateChange(() => loadNotifications());
    const intervalId = window.setInterval(loadNotifications, 20000);

    function unlockSound() {
      interactionRef.current = true;
    }

    document.addEventListener("pointerdown", unlockSound);
    document.addEventListener("keydown", unlockSound);

    return () => {
      data.subscription.unsubscribe();
      window.clearInterval(intervalId);
      document.removeEventListener("pointerdown", unlockSound);
      document.removeEventListener("keydown", unlockSound);
    };
  }, [loadNotifications]);

  useEffect(() => {
    if (!open) return;

    function closeOnOutsideClick(event: MouseEvent | TouchEvent) {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (menuRef.current?.contains(target)) return;
      setOpen(false);
    }

    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("touchstart", closeOnOutsideClick);

    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("touchstart", closeOnOutsideClick);
    };
  }, [open]);

  async function markAllRead() {
    const unreadIds = items.filter((item) => !item.read_at).map((item) => item.id);
    if (!unreadIds.length) return;

    const readAt = new Date().toISOString();
    await supabase.from("notifications").update({ read_at: readAt }).in("id", unreadIds);
    setItems((current) => current.map((item) => (unreadIds.includes(item.id) ? { ...item, read_at: readAt } : item)));
  }

  if (!items.length) {
    return null;
  }

  return (
    <div className="notifications-wrapper" ref={menuRef}>
      <button
        aria-expanded={open}
        aria-label={t("notifications")}
        className="notification-button secondary"
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        <Bell size={18} />
        {unreadCount ? <span>{unreadCount}</span> : null}
      </button>
      {open ? (
        <div className="notifications-panel">
          <div className="notifications-header">
            <strong>{t("notifications")}</strong>
            {unreadCount ? (
              <button className="link-button" onClick={markAllRead} type="button">
                {t("markAllRead")}
              </button>
            ) : null}
          </div>
          <div className="notifications-list">
            {items.map((item) => {
              const content = (
                <>
                  <strong>{item.title}</strong>
                  {item.body ? <span>{item.body}</span> : null}
                  <small>{new Date(item.created_at).toLocaleString()}</small>
                </>
              );

              return item.link ? (
                <Link className={item.read_at ? "notification-item" : "notification-item unread"} href={item.link} key={item.id} onClick={() => setOpen(false)}>
                  {content}
                </Link>
              ) : (
                <div className={item.read_at ? "notification-item" : "notification-item unread"} key={item.id}>
                  {content}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
