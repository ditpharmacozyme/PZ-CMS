import { useState, useEffect } from 'react';
import { AppNotification, Post } from '../types';
import { getStoredNotifications, saveStoredNotifications } from '../utils/storage';
import { generateNotifications, mergeNotifications } from '../utils/notifications';

export function useNotifications(posts: Post[]) {
  const [notifications, setNotifications] = useState<AppNotification[]>(() =>
    getStoredNotifications()
  );

  useEffect(() => {
    const generated = generateNotifications(posts) as AppNotification[];
    setNotifications((prev) => mergeNotifications(prev, generated));
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
