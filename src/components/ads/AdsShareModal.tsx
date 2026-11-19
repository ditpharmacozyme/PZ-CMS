import React, { useEffect, useRef, useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import type { AdShareLink } from '../../types';

interface AdsShareModalProps {
  level: AdShareLink['level'];
  targetId: string;
  targetName: string;
  links: AdShareLink[];
  onCreate: () => void | Promise<unknown>;
  onRevoke: (token: string) => void | Promise<unknown>;
  onClose: () => void;
}

export const AdsShareModal: React.FC<AdsShareModalProps> = ({
  level, targetId, targetName, links, onCreate, onRevoke, onClose,
}) => {
  const [copied, setCopied] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [revoking, setRevoking] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const mine = links.filter((l) => l.level === level && l.targetId === targetId);
  const origin = window.location.origin;

  const copy = async (key: string, url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      if (!mounted.current) return;
      setError(null);
      setCopied(key);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(null), 2000);
    } catch {
      if (!mounted.current) return;
      setCopied(null);
      setError("Couldn't copy — select the link and copy it manually.");
    }
  };

  const create = async () => {
    if (creating) return;
    setError(null);
    setCreating(true);
    try {
      await onCreate();
    } catch {
      if (mounted.current) setError("Couldn't create the link. Please try again.");
    } finally {
      if (mounted.current) setCreating(false);
    }
  };

  const revoke = async (token: string) => {
    if (revoking.includes(token)) return;
    setError(null);
    setRevoking((r) => [...r, token]);
    try {
      await onRevoke(token);
    } catch {
      if (mounted.current) setError("Couldn't revoke the link. Please try again.");
    } finally {
      if (mounted.current) setRevoking((r) => r.filter((t) => t !== token));
    }
  };

  return (
    <Modal isOpen onClose={onClose} title={`Share "${targetName}"`} size="sm">
      <div className="flex flex-col gap-5 min-w-0">
        <p role="status" aria-live="polite" className="sr-only">{copied ? 'Link copied to clipboard.' : ''}</p>
        {error && <p role="alert" className="text-xs text-[var(--color-danger)]">{error}</p>}
        <section className="flex flex-col gap-1.5">
          <h3 className="text-xs font-bold text-[#1b1c1a]">Standing link</h3>
          <p className="text-[11px] text-[#5f5f5b]">Anyone with this link sees everything not hidden from the public ads page.</p>
          <div className="flex items-center gap-2 min-w-0">
            <code className="flex-1 min-w-0 truncate text-xs bg-[#f4f4f3] border border-[#efefed] rounded-lg px-2.5 py-2">{origin}/ads</code>
            <Button size="sm" aria-label="Copy standing link" onClick={() => void copy('standing', `${origin}/ads`)}>
              {copied === 'standing' ? 'Copied' : 'Copy'}
            </Button>
          </div>
        </section>

        <section className="flex flex-col gap-2">
          <h3 className="text-xs font-bold text-[#1b1c1a]">Share links</h3>
          {mine.length === 0 && <p className="text-xs text-[#5f5f5b]">No share links yet.</p>}
          {mine.map((l) => {
            const revoked = Boolean(l.revokedAt);
            const url = `${origin}/s/${l.token}`;
            return (
              <div
                key={l.token}
                className={`flex items-center gap-2 min-w-0 rounded-lg border border-[#efefed] p-2 ${revoked ? 'bg-[#f4f4f3] opacity-60' : 'bg-white'}`}
              >
                <code className={`flex-1 min-w-0 truncate text-xs ${revoked ? 'line-through' : ''}`}>{url}</code>
                {revoked ? (
                  <span className="text-[11px] font-semibold text-[#5f5f5b] px-2">Revoked</span>
                ) : (
                  <>
                    <Button size="sm" aria-label={`Copy share link ${l.token}`} onClick={() => void copy(l.token, url)}>
                      {copied === l.token ? 'Copied' : 'Copy'}
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      aria-label={`Revoke share link ${l.token}`}
                      disabled={revoking.includes(l.token)}
                      onClick={() => void revoke(l.token)}
                    >
                      Revoke
                    </Button>
                  </>
                )}
              </div>
            );
          })}
          <Button variant="primary" icon="add_link" loading={creating} onClick={() => void create()}>
            Create new link
          </Button>
        </section>
      </div>
    </Modal>
  );
};
