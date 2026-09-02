import React, { useState, useEffect, useMemo } from 'react';
import { AuditEvent, AuditActionType, TeamMember } from '../types';
import { getAuditLog } from '../utils/audit';

interface AuditLogViewProps {
  teamMembers: TeamMember[];
}

const ACTION_COLORS: Record<AuditActionType, { bg: string; text: string; border: string; icon: string }> = {
  post_created: { bg: '#e6f4ea', text: '#137333', border: '#ceead6', icon: 'add_circle' },
  post_edited: { bg: '#e8f0fe', text: '#1a73e8', border: '#d2e3fc', icon: 'edit' },
  post_deleted: { bg: '#fce8e6', text: '#c5221f', border: '#fad2cf', icon: 'delete' },
  post_approved: { bg: '#f3e8fd', text: '#8420d3', border: '#e9d2fc', icon: 'verified' },
  post_scheduled: { bg: '#e8f8f5', text: '#0e8a73', border: '#c2f0e8', icon: 'calendar_month' },
  post_duplicated: { bg: '#fef7e0', text: '#b06000', border: '#feefc3', icon: 'content_copy' },
  status_changed: { bg: '#feeffc', text: '#9c27b0', border: '#f9d6f8', icon: 'published_with_changes' },
  member_added: { bg: '#e6f4ea', text: '#137333', border: '#ceead6', icon: 'person_add' },
  member_removed: { bg: '#fce8e6', text: '#c5221f', border: '#fad2cf', icon: 'person_remove' },
  research_uploaded: { bg: '#e6f4ea', text: '#137333', border: '#ceead6', icon: 'upload_file' },
  research_deleted: { bg: '#fce8e6', text: '#c5221f', border: '#fad2cf', icon: 'delete' },
  login: { bg: '#e8f0fe', text: '#1a73e8', border: '#d2e3fc', icon: 'login' },
  logout: { bg: '#f1f3f4', text: '#5f6368', border: '#dadce0', icon: 'logout' }
};

export const AuditLogView: React.FC<AuditLogViewProps> = ({ teamMembers }) => {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedActor, setSelectedActor] = useState<string>('all');
  const [selectedAction, setSelectedAction] = useState<string>('all');
  const [selectedEntity, setSelectedEntity] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);

  const loadLogs = async () => {
    setIsLoading(true);
    try {
      const logs = await getAuditLog(300);
      setEvents(logs);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, []);

  const filteredEvents = useMemo(() => {
    return events.filter(ev => {
      if (selectedActor !== 'all' && ev.actorName !== selectedActor && ev.actorId !== selectedActor) return false;
      if (selectedAction !== 'all' && ev.actionType !== selectedAction) return false;
      if (selectedEntity !== 'all' && ev.entityType !== selectedEntity) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const haystack = [
          ev.actorName,
          ev.actionType,
          ev.entityTitle,
          ev.entityType,
          JSON.stringify(ev.beforeValue || {}),
          JSON.stringify(ev.afterValue || {})
        ].join(' ').toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [events, selectedActor, selectedAction, selectedEntity, searchQuery]);

  const handleExportCSV = () => {
    const headers = ['Timestamp', 'Actor Name', 'Action Type', 'Entity Type', 'Entity Title', 'Session ID'];
    const rows = filteredEvents.map(e => [
      `"${e.timestamp}"`,
      `"${e.actorName}"`,
      `"${e.actionType}"`,
      `"${e.entityType}"`,
      `"${(e.entityTitle || '').replace(/"/g, '""')}"`,
      `"${e.sessionId || ''}"`
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `audit_log_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#e9e9e7]">
        <div>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#4f46e5]">shield_person</span>
            <span className="font-label-caps text-xs text-[#4f46e5] font-bold tracking-widest">
              Team Transparency
            </span>
          </div>
          <h2 className="font-display-xl text-2xl md:text-3xl text-[#1b1c1a] font-bold mt-1">
            Activity Log
          </h2>
          <p className="font-body-md text-sm text-[#5f5f5b] mt-1">
            Complete transparent record of who did what, when, and what changed across the team.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadLogs}
            className="bg-[#f1f1f0] text-[#1b1c1a] hover:bg-[#e9e9e7]/40 font-label-caps text-xs px-3.5 py-2 rounded shadow-2xs transition-all flex items-center gap-1.5 font-bold"
          >
            <span className={`material-symbols-outlined text-sm ${isLoading ? 'animate-spin' : ''}`}>sync</span>
            <span>Refresh</span>
          </button>

          <button
            onClick={handleExportCSV}
            className="bg-[#4f46e5] text-white hover:bg-[#4338ca] font-label-caps text-xs px-4 py-2 rounded shadow-sm transition-all flex items-center gap-1.5 font-bold"
          >
            <span className="material-symbols-outlined text-sm">download</span>
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="p-4 bg-white border border-[#e9e9e7] rounded shadow-2xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          {/* Search Input */}
          <div className="relative">
            <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-[#5f5f5b]">search</span>
            <input
              type="text"
              placeholder="Search activity log..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-[#f4f4f3] border border-[#e9e9e7] pl-8 pr-3 py-1.5 text-xs text-[#1b1c1a] rounded focus:outline-none focus:border-[#4f46e5]"
            />
          </div>

          {/* Actor Filter */}
          <select
            value={selectedActor}
            onChange={e => setSelectedActor(e.target.value)}
            className="bg-[#f4f4f3] border border-[#e9e9e7] px-3 py-1.5 text-xs text-[#1b1c1a] rounded focus:outline-none focus:border-[#4f46e5]"
          >
            <option value="all">All Teammates</option>
            {teamMembers.map(m => (
              <option key={m.id} value={m.name}>{m.name}</option>
            ))}
          </select>

          {/* Action Filter */}
          <select
            value={selectedAction}
            onChange={e => setSelectedAction(e.target.value)}
            className="bg-[#f4f4f3] border border-[#e9e9e7] px-3 py-1.5 text-xs text-[#1b1c1a] rounded focus:outline-none focus:border-[#4f46e5]"
          >
            <option value="all">All Action Types</option>
            <option value="post_created">Post Created</option>
            <option value="post_edited">Post Edited</option>
            <option value="post_approved">Post Approved</option>
            <option value="post_deleted">Post Deleted</option>
            <option value="post_scheduled">Post Scheduled</option>
            <option value="post_duplicated">Post Duplicated</option>
            <option value="status_changed">Status Changed</option>
            <option value="login">Login</option>
            <option value="logout">Logout</option>
          </select>

          {/* Entity Type Filter */}
          <select
            value={selectedEntity}
            onChange={e => setSelectedEntity(e.target.value)}
            className="bg-[#f4f4f3] border border-[#e9e9e7] px-3 py-1.5 text-xs text-[#1b1c1a] rounded focus:outline-none focus:border-[#4f46e5]"
          >
            <option value="all">All Entity Types</option>
            <option value="post">Posts</option>
            <option value="member">Team Members</option>
            <option value="template">Templates</option>
            <option value="asset">Assets</option>
            <option value="content_bank">Content Bank</option>
            <option value="session">Sessions</option>
          </select>
        </div>

        {(selectedActor !== 'all' || selectedAction !== 'all' || selectedEntity !== 'all' || searchQuery) && (
          <div className="flex items-center justify-between text-xs text-[#5f5f5b] pt-2 border-t border-[#e9e9e7]/30">
            <span>Found <strong>{filteredEvents.length}</strong> matching audit entries</span>
            <button
              onClick={() => {
                setSelectedActor('all');
                setSelectedAction('all');
                setSelectedEntity('all');
                setSearchQuery('');
              }}
              className="text-[#dc2626] hover:underline font-bold text-[11px]"
            >
              Clear Filters
            </button>
          </div>
        )}
      </div>

      {/* Events Timeline */}
      <div className="bg-white border border-[#e9e9e7] rounded shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-[#5f5f5b] space-y-2">
            <span className="material-symbols-outlined text-3xl animate-spin text-[#4f46e5]">sync</span>
            <p className="text-xs">Fetching audit trail...</p>
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="p-12 text-center text-[#5f5f5b] space-y-2">
            <span className="material-symbols-outlined text-4xl text-[#e9e9e7]">shield</span>
            <p className="font-bold text-sm text-[#1b1c1a]">No Activity Yet</p>
            <p className="text-xs">No events match your current filter settings.</p>
          </div>
        ) : (
          <div className="divide-y divide-[#e9e9e7]/40">
            {filteredEvents.map(event => {
              const actorMember = teamMembers.find(m => m.name === event.actorName);
              const initials = actorMember ? actorMember.avatarInitials : event.actorName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
              const bgColor = actorMember ? actorMember.color : '#4f46e5';
              const actionMeta = ACTION_COLORS[event.actionType] || { bg: '#f1f3f4', text: '#5f6368', border: '#dadce0', icon: 'info' };
              const isExpanded = expandedEventId === event.id;
              const hasDiff = !!(event.beforeValue || event.afterValue);

              return (
                <div key={event.id} className="p-4 hover:bg-[#f4f4f3] transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      {/* Avatar */}
                      <div
                        className="w-9 h-9 rounded-full flex items-center justify-center text-white font-label-caps text-xs font-bold flex-shrink-0 shadow-2xs mt-0.5"
                        style={{ backgroundColor: bgColor }}
                      >
                        {initials}
                      </div>

                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <strong className="text-sm font-semibold text-[#1b1c1a]">{event.actorName}</strong>
                          
                          {/* Action Badge */}
                          <span
                            className="inline-flex items-center gap-1 font-label-caps text-[10px] font-bold px-2 py-0.5 rounded border"
                            style={{
                              backgroundColor: actionMeta.bg,
                              color: actionMeta.text,
                              borderColor: actionMeta.border
                            }}
                          >
                            <span className="material-symbols-outlined text-xs">{actionMeta.icon}</span>
                            {event.actionType.replace('_', ' ')}
                          </span>

                          {event.entityType && (
                            <span className="font-label-caps text-[9px] text-[#5f5f5b] bg-[#f1f1f0] px-1.5 py-0.5 rounded font-mono">
                              {event.entityType}
                            </span>
                          )}
                        </div>

                        {event.entityTitle && (
                          <p className="text-xs text-[#57574f] font-medium leading-relaxed">
                            Target: <span className="font-bold text-[#1b1c1a]">"{event.entityTitle}"</span>
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <span className="font-mono text-[10px] text-[#5f5f5b]">
                        {new Date(event.timestamp).toLocaleString()}
                      </span>

                      {hasDiff && (
                        <button
                          onClick={() => setExpandedEventId(isExpanded ? null : event.id)}
                          className="font-label-caps text-[10px] text-[#4f46e5] hover:underline font-bold flex items-center gap-0.5"
                        >
                          <span>{isExpanded ? 'Hide Diffs' : 'View Changes'}</span>
                          <span className="material-symbols-outlined text-xs">
                            {isExpanded ? 'expand_less' : 'expand_more'}
                          </span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Diff View Accordion */}
                  {isExpanded && hasDiff && (
                    <div className="mt-3 p-3 bg-[#1b1c1a] text-white rounded border border-[#2c2e2a] font-mono text-[11px] space-y-2 animate-fadeIn">
                      {event.beforeValue && (
                        <div>
                          <span className="text-[#ff8a80] font-bold block mb-1">Before:</span>
                          <pre className="bg-[#111310] p-2 rounded overflow-x-auto text-[10px] text-[#e0e0e0]">
                            {JSON.stringify(event.beforeValue, null, 2)}
                          </pre>
                        </div>
                      )}
                      {event.afterValue && (
                        <div>
                          <span className="text-[#86efac] font-bold block mb-1">After:</span>
                          <pre className="bg-[#111310] p-2 rounded overflow-x-auto text-[10px] text-[#e0e0e0]">
                            {JSON.stringify(event.afterValue, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
