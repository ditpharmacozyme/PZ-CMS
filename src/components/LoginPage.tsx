import React, { useState, useEffect, useRef } from 'react';
import { TeamMember } from '../types';

interface LoginPageProps {
  teamMembers: TeamMember[];
  onLogin: (teammate: TeamMember, rememberMe: boolean) => void;
  isLoading?: boolean;
}

const MAX_ATTEMPTS = 3;
const LOCKOUT_SECONDS = 30;

export const LoginPage: React.FC<LoginPageProps> = ({ teamMembers, onLogin, isLoading = false }) => {
  const [selectedMemberId, setSelectedMemberId] = useState<string>('');
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [lockoutUntil, setLockoutUntil] = useState<number | null>(null);
  const [countdown, setCountdown] = useState(0);
  const [shake, setShake] = useState(false);
  const pinRef = useRef<HTMLInputElement>(null);

  // Pre-select Hamza Ansari or first member
  useEffect(() => {
    if (teamMembers.length > 0 && !selectedMemberId) {
      const hamza = teamMembers.find(m => m.name === 'Hamza Ansari');
      setSelectedMemberId(hamza ? hamza.id : teamMembers[0].id);
    }
  }, [teamMembers, selectedMemberId]);

  // Lockout countdown
  useEffect(() => {
    if (!lockoutUntil) return;
    const interval = setInterval(() => {
      const remaining = Math.ceil((lockoutUntil - Date.now()) / 1000);
      if (remaining <= 0) {
        setLockoutUntil(null);
        setAttempts(0);
        setCountdown(0);
        setError(null);
      } else {
        setCountdown(remaining);
      }
    }, 200);
    return () => clearInterval(interval);
  }, [lockoutUntil]);

  const selectedMember = teamMembers.find(m => m.id === selectedMemberId) || null;
  const isLockedOut = lockoutUntil !== null && Date.now() < lockoutUntil;

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 400);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isLockedOut || isLoading || !selectedMember) return;

    const expected = selectedMember.passcode || '1234';

    if (pin === expected) {
      setError(null);
      setAttempts(0);
      onLogin(selectedMember, rememberMe);
    } else {
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);
      triggerShake();

      if (newAttempts >= MAX_ATTEMPTS) {
        const until = Date.now() + LOCKOUT_SECONDS * 1000;
        setLockoutUntil(until);
        setError(`Too many failed attempts. Locked for ${LOCKOUT_SECONDS} seconds.`);
      } else {
        setError(`Incorrect PIN. ${MAX_ATTEMPTS - newAttempts} attempt${MAX_ATTEMPTS - newAttempts === 1 ? '' : 's'} remaining.`);
      }
      setPin('');
      pinRef.current?.focus();
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF9F5] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-xl bg-white border border-[#bfcab4] p-2 mx-auto flex items-center justify-center shadow-2xs overflow-hidden mb-3">
            <img src="/logos/PZ_Logo.png" alt="Pharmacozyme" className="w-full h-full object-contain" />
          </div>
          <h1 className="font-display-xl text-xl text-[#1b1c1a] font-bold">Brand-Ops Studio</h1>
          <p className="font-body-md text-xs text-[#707a67] mt-1">Sign in to continue</p>
        </div>

        {teamMembers.length === 0 ? (
          <div className="text-center p-8 bg-white border border-[#bfcab4] rounded-lg shadow-2xs">
            <span className="material-symbols-outlined text-3xl text-[#bfcab4] block mb-2">group_off</span>
            <p className="text-[#707a67] text-sm">No team members found. Loading…</p>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className={`bg-white border border-[#bfcab4] rounded-lg shadow-2xs p-6 space-y-4 ${shake ? 'animate-[shake_0.4s_ease-in-out]' : ''}`}
          >
            {/* Account */}
            <div className="space-y-1.5">
              <label className="font-label-caps text-[10px] text-[#707a67] uppercase font-bold block">
                Account
              </label>
              <select
                value={selectedMemberId}
                onChange={e => { setSelectedMemberId(e.target.value); setPin(''); setError(null); }}
                disabled={isLockedOut || isLoading}
                className="w-full bg-[#faf9f5] border border-[#bfcab4] p-2.5 text-sm text-[#1b1c1a] rounded focus:outline-none focus:border-[#296c00] disabled:opacity-50"
              >
                {teamMembers.map(member => (
                  <option key={member.id} value={member.id}>{member.name}</option>
                ))}
              </select>
            </div>

            {/* PIN */}
            <div className="space-y-1.5">
              <label className="font-label-caps text-[10px] text-[#707a67] uppercase font-bold flex items-center gap-1">
                <span className="material-symbols-outlined text-xs">lock</span>
                PIN
              </label>
              <div className="relative">
                <input
                  ref={pinRef}
                  type={showPin ? 'text' : 'password'}
                  value={pin}
                  onChange={e => { setPin(e.target.value); setError(null); }}
                  placeholder="Enter your PIN"
                  disabled={isLockedOut || isLoading}
                  autoComplete="current-password"
                  autoFocus
                  className="w-full bg-[#faf9f5] border border-[#bfcab4] focus:border-[#296c00] text-[#1b1c1a] text-center tracking-[0.3em] p-2.5 rounded outline-none transition-colors placeholder:tracking-normal placeholder:text-[#bfcab4] placeholder:text-xs disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={() => setShowPin(v => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#707a67] hover:text-[#1b1c1a] transition-colors"
                  tabIndex={-1}
                >
                  <span className="material-symbols-outlined text-base">
                    {showPin ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>
            </div>

            {/* Error / Lockout */}
            {error && (
              <div className="p-2.5 rounded bg-[#fce8e6] border border-[#ba1a1a]/20 text-[#ba1a1a] text-xs text-center font-body-md">
                {isLockedOut ? (
                  <span>Locked — try again in <strong>{countdown}s</strong></span>
                ) : error}
              </div>
            )}

            {/* Remember me */}
            <label className="flex items-center gap-2 cursor-pointer group select-none">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={e => setRememberMe(e.target.checked)}
                className="w-3.5 h-3.5 rounded border-[#bfcab4] text-[#296c00] focus:ring-[#296c00]"
              />
              <span className="text-[#707a67] text-xs font-body-md">Remember me on this device</span>
            </label>

            {/* Submit */}
            <button
              type="submit"
              disabled={isLockedOut || isLoading || !pin}
              className="w-full bg-[#296c00] hover:bg-[#1f5700] text-white font-bold py-2.5 rounded transition-colors text-sm disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Signing in…
                </span>
              ) : isLockedOut ? (
                `Locked (${countdown}s)`
              ) : (
                'Sign In'
              )}
            </button>
          </form>
        )}

        <p className="text-center text-[#bfcab4] text-[10px] font-body-md mt-5">
          Pharmacozyme Brand-Ops Studio · Internal Use Only
        </p>
      </div>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-5px); }
          50% { transform: translateX(5px); }
          75% { transform: translateX(-3px); }
        }
      `}</style>
    </div>
  );
};
