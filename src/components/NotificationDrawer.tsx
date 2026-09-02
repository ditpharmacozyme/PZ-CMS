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
        className="fixed inset-0 bg-[#1b1c1a]/30 backdrop-blur-sm z-40 transition-opacity" 
        onClick={onClose}
      />
      <div className="fixed inset-y-0 right-0 w-full sm:w-96 bg-[#f4f4f3] border-l border-[#e9e9e7] shadow-2xl z-50 flex flex-col h-full transform transition-transform duration-300">
        
        <div className="p-4 sm:p-6 border-b border-[#e9e9e7] flex items-center justify-between bg-white shrink-0">
          <div className="flex items-center gap-2">
            <h2 className="font-headline-md text-xl font-bold text-[#1b1c1a]">Notifications</h2>
            {unreadCount > 0 && (
              <span className="bg-[#dc2626] text-white text-[10px] font-label-caps px-2 py-0.5 rounded-full font-bold">
                {unreadCount}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            {unreadCount > 0 && (
              <button 
                onClick={onMarkAllAsRead}
                className="text-[#4f46e5] hover:underline font-label-caps text-xs font-bold"
              >
                Mark all read
              </button>
            )}
            <button onClick={onClose} className="p-1 hover:bg-[#f1f1f0] rounded-full text-[#5f5f5b]">
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {notifications.length === 0 ? (
            <div className="text-center text-[#5f5f5b] py-10">
              <span className="material-symbols-outlined text-4xl mb-2 opacity-50">notifications_off</span>
              <p className="font-body-md text-sm">You're all caught up!</p>
            </div>
          ) : (
            Object.entries(grouped).map(([groupName, items]) => {
              if (items.length === 0) return null;
              return (
                <div key={groupName} className="space-y-3">
                  <h3 className="font-label-caps text-xs font-bold text-[#5f5f5b] border-b border-[#e9e9e7]/50 pb-1">
                    {groupName}
                  </h3>
                  <div className="space-y-2">
                    {items.map(n => (
                      <div 
                        key={n.id} 
                        className={`p-3 rounded border transition-colors ${
                          n.read ? 'bg-white border-[#e9e9e7] opacity-70' : 'bg-[#eef2ff] border-[#4f46e5] shadow-2xs'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              {n.type === 'overdue' && <span className="material-symbols-outlined text-[#dc2626] text-[14px]">error</span>}
                              {n.type === 'stage_complete' && <span className="material-symbols-outlined text-[#15803d] text-[14px]">check_circle</span>}
                              {n.type === 'due_soon' && <span className="material-symbols-outlined text-[#4f46e5] text-[14px]">schedule</span>}
                              {n.type === 'stage_blocking' && <span className="material-symbols-outlined text-[#b45309] text-[14px]">pending_actions</span>}
                              
                              <h4 className={`font-headline-md text-sm truncate ${n.read ? 'text-[#57574f]' : 'text-[#1b1c1a] font-bold'}`}>
                                {n.title}
                              </h4>
                            </div>
                            <p className="font-body-md text-xs text-[#57574f] mb-2">{n.message}</p>
                            
                            <div className="flex items-center justify-between">
                              <span className="font-code-sm text-[10px] text-[#5f5f5b]">{n.date}</span>
                              <div className="flex items-center gap-2">
                                {n.postId && (
                                  <button 
                                    onClick={() => {
                                      onViewPost(n.postId!);
                                      onClose();
                                    }}
                                    className="font-label-caps text-[10px] font-bold text-[#4f46e5] hover:underline"
                                  >
                                    View Post
                                  </button>
                                )}
                                {!n.read && (
                                  <button 
                                    onClick={() => onMarkAsRead(n.id)}
                                    className="font-label-caps text-[10px] font-bold text-[#5f5f5b] hover:text-[#1b1c1a]"
                                  >
                                    Mark Read
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
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
