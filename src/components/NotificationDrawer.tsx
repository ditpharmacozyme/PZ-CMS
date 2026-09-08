import React, { useMemo } from 'react';
import { AppNotification } from '../types';

interface NotificationDrawerProps {
  notifications: AppNotification[];
  isOpen: boolean;
  onClose: () => void;
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
  onViewPost: (postId: string) => void;
}

const GROUP_ORDER = ['Action Needed', 'Overdue', 'Upcoming', 'Updates'] as const;

/** Material icon + Calm Clarity tint for each notification type. */
function iconFor(type: AppNotification['type']): { icon: string; fg: string; bg: string } {
  switch (type) {
    case 'overdue':
      return { icon: 'error', fg: '#dc2626', bg: '#fcebeb' };
    case 'stage_complete':
      return { icon: 'check_circle', fg: '#15803d', bg: '#dcfce7' };
    case 'due_soon':
      return { icon: 'schedule', fg: '#4f46e5', bg: '#eef2ff' };
    case 'stage_blocking':
    case 'unassigned':
      return { icon: 'pending_actions', fg: '#b45309', bg: '#fef3c7' };
    default:
      return { icon: 'campaign', fg: '#57574f', bg: '#f1f1f0' };
  }
}

export const NotificationDrawer: React.FC<NotificationDrawerProps> = ({
  notifications,
  isOpen,
  onClose,
  onMarkAsRead,
  onMarkAllAsRead,
  onViewPost
}) => {
  const unreadCount = notifications.filter(n => !n.read).length;

  const grouped = useMemo(() => {
    const groups: Record<string, AppNotification[]> = {
      'Action Needed': [],
      'Overdue': [],
      'Upcoming': [],
      'Updates': []
    };

    notifications.forEach(n => {
      if (n.type === 'overdue') groups['Overdue'].push(n);
      else if (n.type === 'unassigned' || n.type === 'stage_blocking') groups['Action Needed'].push(n);
      else if (n.type === 'due_soon') groups['Upcoming'].push(n);
      else groups['Updates'].push(n);
    });

    return groups;
  }, [notifications]);

  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 bg-[#1b1c1a]/25 backdrop-blur-sm z-40 animate-fadeIn"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-label="Notifications"
        className="fixed inset-y-0 right-0 w-full sm:w-[400px] bg-[#fbfbfa] border-l border-[#e9e9e7] shadow-2xl z-50 flex flex-col h-full notif-panel-in"
      >
        {/* Header */}
        <div className="px-4 sm:px-5 py-4 border-b border-[#e9e9e7] flex items-center justify-between bg-white shrink-0">
          <div className="flex items-center gap-2">
            <h2 className="font-headline-md text-lg font-bold text-[#1b1c1a]">Notifications</h2>
            {unreadCount > 0 && (
              <span className="bg-[#4f46e5] text-white text-[11px] font-bold px-2 py-0.5 rounded-full min-w-[20px] text-center">
                {unreadCount}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <button
                onClick={onMarkAllAsRead}
                className="text-[#4f46e5] hover:bg-[#eef2ff] font-label-caps text-xs font-bold px-2 py-1.5 rounded transition-colors"
              >
                Mark all read
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 hover:bg-[#f1f1f0] rounded-full text-[#5f5f5b] transition-colors min-w-[40px] min-h-[40px] flex items-center justify-center"
              aria-label="Close notifications"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-3 sm:px-4 pt-4 pb-28 sm:pb-4 space-y-6">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center text-[#8a8a82] py-20 gap-3">
              <span className="material-symbols-outlined text-5xl opacity-40">notifications_off</span>
              <p className="font-body-md text-sm font-medium text-[#57574f]">You're all caught up</p>
              <p className="font-body-md text-xs">New alerts will show up here.</p>
            </div>
          ) : (
            GROUP_ORDER.map(groupName => {
              const items = grouped[groupName];
              if (!items || items.length === 0) return null;
              const groupUnread = items.filter(n => !n.read).length;
              return (
                <div key={groupName} className="space-y-2">
                  <div className="flex items-center justify-between px-1">
                    <h3 className="font-label-caps text-[11px] font-bold text-[#8a8a82]">{groupName}</h3>
                    <span className="font-code-sm text-[10px] text-[#8a8a82]">
                      {groupUnread > 0 ? `${groupUnread} new` : items.length}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {items.map(n => {
                      const { icon, fg, bg } = iconFor(n.type);
                      const clickable = Boolean(n.postId);
                      const open = () => {
                        onViewPost(n.postId!);
                        onClose();
                      };
                      return (
                        <div
                          key={n.id}
                          {...(clickable
                            ? {
                                role: 'button',
                                tabIndex: 0,
                                onClick: open,
                                onKeyDown: (e: React.KeyboardEvent) => {
                                  if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    open();
                                  }
                                }
                              }
                            : {})}
                          className={`w-full text-left rounded-lg border p-3.5 flex gap-3 transition-colors ${
                            n.read
                              ? 'bg-transparent border-[#ececea]'
                              : 'bg-white border-[#e9e9e7] border-l-[3px] border-l-[#4f46e5] shadow-2xs'
                          } ${clickable ? 'hover:bg-white hover:border-[#d4d4d0] cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4f46e5]' : ''}`}
                        >
                          <span
                            className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                            style={{ backgroundColor: n.read ? '#f1f1f0' : bg }}
                          >
                            <span
                              className="material-symbols-outlined text-[16px]"
                              style={{ color: n.read ? '#8a8a82' : fg }}
                            >
                              {icon}
                            </span>
                          </span>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-start gap-2">
                              <h4
                                className={`font-headline-md text-sm flex-1 min-w-0 ${
                                  n.read ? 'text-[#8a8a82]' : 'text-[#1b1c1a] font-bold'
                                }`}
                              >
                                {n.title}
                              </h4>
                              {!n.read && (
                                <span className="w-2 h-2 rounded-full bg-[#4f46e5] mt-1.5 shrink-0" aria-label="Unread" />
                              )}
                            </div>
                            <p className={`font-body-md text-xs mt-0.5 ${n.read ? 'text-[#8a8a82]' : 'text-[#57574f]'}`}>
                              {n.message}
                            </p>
                            <div className="flex items-center justify-between mt-2">
                              <span className="font-code-sm text-[10px] text-[#8a8a82]">{n.date}</span>
                              {!n.read && (
                                <button
                                  onClick={e => {
                                    e.stopPropagation();
                                    onMarkAsRead(n.id);
                                  }}
                                  className="font-label-caps text-[10px] font-bold text-[#5f5f5b] hover:text-[#1b1c1a] px-1.5 py-1 rounded hover:bg-[#f1f1f0] transition-colors"
                                >
                                  Mark read
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </>
  );
};
