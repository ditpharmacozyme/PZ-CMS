import { useState, useEffect } from 'react';
import { AppNotification, Post } from '../types';
import { getStoredNotifications, saveStoredNotifications } from '../utils/storage';
import { generateNotifications, mergeNotifications } from '../utils/notifications';

export function useNotifications(posts: Post[]) {
  const [notifications, setNotifications] = useState<AppNotification[]>(() =>
    getStoredNotifications()
  );

  useEffect(() => {
    // mergeNotifications(fresh, previous) maps over its FIRST argument. This
    // used to be called as mergeNotifications(prev, generated) -- swapped --
    // so freshly generated notifications were discarded every render and the
    // bell showed whatever was in localStorage (nothing, on a first run,
    // since INITIAL_NOTIFICATIONS is []). Fixed: generated goes first.
    const generated = generateNotifications(posts);
    setNotifications((prev) => mergeNotifications(generated, prev));
  }, [posts]);

  useEffect(() => {
    saveStoredNotifications(notifications);
  }, [notifications]);

  const handleMarkNotificationRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  };

  const handleClearNotifications = () => {
    setNotifications([]);
  };

  return {
    notifications,
    setNotifications,
    handleMarkNotificationRead,
    handleClearNotifications
  };
}
