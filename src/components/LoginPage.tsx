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

  const handleSelectMember = (id: string) => {
    setSelectedMemberId(id);
    setPin('');
    setError(null);
    setTimeout(() => pinRef.current?.focus(), 100);
  };

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 500);
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
    }
  };

  return (
    <div className="min-h-screen bg-[#0e0f0d] flex flex-col justify-center items-center p-4 relative overflow-hidden">
      {/* Animated background glows */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[20%] w-[500px] h-[500px] rounded-full bg-[#78d24b]/10 blur-[120px] animate-pulse" />
        <div className="absolute bottom-[-10%] right-[10%] w-[400px] h-[400px] rounded-full bg-[#296c00]/15 blur-[100px]" />
        <div className="absolute inset-0 opacity-5"
          style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.05) 1px, transparent 1px)',
            backgroundSize: '40px 40px'
          }}
        />
      </div>

      {/* Card */}
      <div className="w-full max-w-lg relative z-10">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-[#1b1c1a] border border-[#296c00]/40 p-2.5 mx-auto flex items-center justify-center shadow-[0_0_30px_rgba(120,210,75,0.2)] overflow-hidden mb-4">
            <img src="/logos/PZ_Logo.png" alt="Pharmacozyme" className="w-full h-full object-contain" />
          </div>
          <h1 className="font-bold text-2xl text-white tracking-tight">Brand-Ops Studio</h1>
          <p className="text-[#707a67] text-sm mt-1 font-mono">Select your profile to continue</p>
        </div>

        {/* Team Member Cards */}
        {teamMembers.length === 0 ? (
          <div className="text-center p-8 bg-[#1b1c1a] border border-[#2c2e2a] rounded-2xl">
            <span className="material-symbols-outlined text-4xl text-[#707a67] block mb-2">group_off</span>
            <p className="text-[#707a67] text-sm">No team members found. Loading...</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
            {teamMembers.map(member => {
              const isSelected = member.id === selectedMemberId;
              return (
                <button
                  key={member.id}
                  type="button"
                  onClick={() => handleSelectMember(member.id)}
                  className={`flex flex-col items-center gap-2.5 p-4 rounded-xl border transition-all text-left ${
                    isSelected
                      ? 'bg-[#1e2e1a] border-[#296c00] shadow-[0_0_20px_rgba(41,108,0,0.3)]'
                      : 'bg-[#1b1c1a] border-[#2c2e2a] hover:border-[#404a39] hover:bg-[#1e2019]'
                  }`}
                >
                  {/* Avatar */}
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0 shadow-lg relative"
                    style={{ backgroundColor: member.color }}
                  >
                    {member.avatarInitials}
                    {isSelected && (
                      <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#78d24b] border-2 border-[#1e2e1a] flex items-center justify-center">
                        <span className="material-symbols-outlined text-[8px] text-[#1b1c1a] font-bold">check</span>
                      </div>
                    )}
                  </div>
                  <div className="text-center">
                    <p className="text-white text-xs font-semibold leading-tight">{member.name.split(' ')[0]}</p>
                    <p className="text-[#707a67] text-[9px] font-mono uppercase tracking-wide mt-0.5">
                      {member.userRole || 'Editor'}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* PIN Form */}
        {selectedMember && (
          <form
            onSubmit={handleSubmit}
            className={`bg-[#1b1c1a] border border-[#2c2e2a] rounded-2xl p-6 space-y-5 ${shake ? 'animate-[shake_0.5s_ease-in-out]' : ''}`}
            style={shake ? { animation: 'shake 0.5s ease-in-out' } : {}}
          >
            {/* Selected member context */}
            <div className="flex items-center gap-3 pb-4 border-b border-[#2c2e2a]">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                style={{ backgroundColor: selectedMember.color }}
              >
                {selectedMember.avatarInitials}
              </div>
              <div>
                <p className="text-white text-sm font-semibold">{selectedMember.name}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-[#707a67] text-[10px] font-mono">{selectedMember.role}</span>
                  <span className="text-[#296c00] text-[9px] font-bold uppercase bg-[#296c00]/15 px-1.5 py-0.5 rounded font-mono">
                    {selectedMember.userRole || 'Editor'}
                  </span>
                </div>
              </div>
            </div>

            {/* PIN input */}
            <div className="space-y-2">
              <label className="text-[#707a67] text-[10px] font-mono uppercase tracking-widest block">
                PIN / Passcode
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
                  className="w-full bg-[#111310] border border-[#2c2e2a] focus:border-[#296c00] text-white text-center tracking-[0.3em] text-lg p-3.5 rounded-lg outline-none transition-colors placeholder:tracking-normal placeholder:text-[#404a39] placeholder:text-sm disabled:opacity-40"
                />
                <button
                  type="button"
                  onClick={() => setShowPin(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#707a67] hover:text-white transition-colors"
                  tabIndex={-1}
                >
                  <span className="material-symbols-outlined text-lg">
                    {showPin ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>

              {/* PIN dot indicators */}
              <div className="flex justify-center gap-2 mt-2">
                {Array.from({ length: Math.min(pin.length, 8) }).map((_, i) => (
                  <div
                    key={i}
                    className="w-2 h-2 rounded-full bg-[#78d24b] transition-all"
                    style={{ animationDelay: `${i * 50}ms` }}
                  />
                ))}
                {pin.length === 0 && (
                  <div className="w-2 h-2 rounded-full bg-[#2c2e2a]" />
                )}
              </div>
            </div>

            {/* Error / Lockout message */}
            {error && (
              <div className={`p-3 rounded-lg text-xs font-mono text-center ${
                isLockedOut
                  ? 'bg-[#2a1a1a] border border-[#ba1a1a]/30 text-[#ff8a80]'
                  : 'bg-[#2a1a1a] border border-[#ba1a1a]/20 text-[#ff8a80]'
              }`}>
                {isLockedOut ? (
                  <span>🔒 Locked — try again in <strong>{countdown}s</strong></span>
                ) : error}
              </div>
            )}

            {/* Attempt dots */}
            {attempts > 0 && attempts < MAX_ATTEMPTS && (
              <div className="flex justify-center gap-1.5">
                {Array.from({ length: MAX_ATTEMPTS }).map((_, i) => (
                  <div
                    key={i}
                    className={`w-2 h-2 rounded-full transition-colors ${
                      i < attempts ? 'bg-[#ba1a1a]' : 'bg-[#2c2e2a]'
                    }`}
                  />
                ))}
              </div>
            )}

            {/* Remember me */}
            <label className="flex items-center gap-2.5 cursor-pointer group">
              <div
                onClick={() => setRememberMe(v => !v)}
                className={`w-4 h-4 rounded border flex items-center justify-center transition-all flex-shrink-0 ${
                  rememberMe
                    ? 'bg-[#296c00] border-[#296c00]'
                    : 'border-[#404a39] bg-transparent group-hover:border-[#296c00]'
                }`}
              >
                {rememberMe && (
                  <span className="material-symbols-outlined text-white text-[10px]">check</span>
                )}
              </div>
              <span className="text-[#707a67] text-xs font-mono">Remember me on this device</span>
            </label>

            {/* Submit */}
            <button
              type="submit"
              disabled={isLockedOut || isLoading || !pin}
              className="w-full bg-[#296c00] hover:bg-[#78d24b] text-white hover:text-[#1b1c1a] font-bold py-3.5 rounded-lg transition-all text-sm uppercase tracking-widest font-mono disabled:opacity-40 disabled:cursor-not-allowed shadow-[0_4px_20px_rgba(41,108,0,0.3)] hover:shadow-[0_4px_30px_rgba(120,210,75,0.4)] active:scale-[0.98]"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Signing in...
                </span>
              ) : isLockedOut ? (
                `Locked (${countdown}s)`
              ) : (
                'Sign In →'
              )}
            </button>
          </form>
        )}

        <p className="text-center text-[#404a39] text-[10px] font-mono mt-6">
          Pharmacozyme Brand-Ops Studio · Internal Use Only
        </p>
      </div>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          15% { transform: translateX(-8px); }
          30% { transform: translateX(8px); }
          45% { transform: translateX(-6px); }
          60% { transform: translateX(6px); }
          75% { transform: translateX(-3px); }
          90% { transform: translateX(3px); }
        }
      `}</style>
    </div>
  );
};
