import React, { useState } from 'react';
import { supabase } from '../lib/supabase';

interface LoginPageProps {
  /** Forces the screen into a specific mode instead of the default sign-in
   * form — used after an invite/password-reset email link lands the user
   * back on the app with a session but no password set yet. */
  forcedMode?: 'set-password';
  /** Called once a forced 'set-password' flow completes successfully. */
  onPasswordSet?: () => void;
}

/**
 * Real Supabase Auth login — replaces the old client-side PIN picker.
 * On success this does nothing itself beyond clearing its own form state;
 * App.tsx's supabase.auth.onAuthStateChange listener picks up the new
 * session and re-renders past this screen automatically.
 */
export const LoginPage: React.FC<LoginPageProps> = ({ forcedMode, onPasswordSet }) => {
  const [mode, setMode] = useState<'signin' | 'reset' | 'set-password'>(forcedMode || 'signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetSent, setResetSent] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) {
      setError('Supabase isn’t configured for this deployment — contact Hamza.');
      return;
    }
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords don’t match.');
      return;
    }
    setIsSubmitting(true);
    setError(null);
    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
    setIsSubmitting(false);
    if (updateError) {
      setError(updateError.message);
    } else {
      onPasswordSet?.();
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) {
      setError('Supabase isn’t configured for this deployment — contact Hamza.');
      return;
    }
    setIsSubmitting(true);
    setError(null);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setIsSubmitting(false);
    if (signInError) {
      setError(signInError.message === 'Invalid login credentials'
        ? 'Incorrect email or password.'
        : signInError.message);
    }
  };

  const handleResetRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) {
      setError('Supabase isn’t configured for this deployment — contact Hamza.');
      return;
    }
    setIsSubmitting(true);
    setError(null);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim());
    setIsSubmitting(false);
    if (resetError) {
      setError(resetError.message);
    } else {
      setResetSent(true);
    }
  };

  return (
    <div className="min-h-screen bg-[#f4f4f3] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-xl bg-white border border-[#e9e9e7] p-2 mx-auto flex items-center justify-center shadow-2xs overflow-hidden mb-3">
            <img src="/logos/PZ_Logo.png" alt="Pharmacozyme" className="w-full h-full object-contain" />
          </div>
          <h1 className="font-display-xl text-xl text-[#1b1c1a] font-bold">Brand-Ops Studio</h1>
          <p className="font-body-md text-xs text-[#5f5f5b] mt-1">
            {mode === 'signin' ? 'Sign in to continue' : mode === 'set-password' ? 'Set your password to continue' : 'Reset your password'}
          </p>
        </div>

        {mode === 'set-password' ? (
          <form onSubmit={handleSetPassword} className="bg-white border border-[#e9e9e7] rounded-lg shadow-2xs p-6 space-y-4">
            <p className="text-xs text-[#5f5f5b] font-body-md">
              Welcome! Choose a password to finish setting up your account.
            </p>
            <div className="space-y-1.5">
              <label className="font-label-caps text-[10px] text-[#5f5f5b] uppercase font-bold block">
                New Password
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={e => { setNewPassword(e.target.value); setError(null); }}
                placeholder="At least 6 characters"
                autoComplete="new-password"
                autoFocus
                required
                disabled={isSubmitting}
                className="w-full bg-[#f4f4f3] border border-[#e9e9e7] focus:border-[#4f46e5] text-[#1b1c1a] p-2.5 rounded outline-none transition-colors placeholder:text-[#e9e9e7] placeholder:text-sm disabled:opacity-50"
              />
            </div>
            <div className="space-y-1.5">
              <label className="font-label-caps text-[10px] text-[#5f5f5b] uppercase font-bold block">
                Confirm Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={e => { setConfirmPassword(e.target.value); setError(null); }}
                placeholder="Re-enter your password"
                autoComplete="new-password"
                required
                disabled={isSubmitting}
                className="w-full bg-[#f4f4f3] border border-[#e9e9e7] focus:border-[#4f46e5] text-[#1b1c1a] p-2.5 rounded outline-none transition-colors placeholder:text-[#e9e9e7] placeholder:text-sm disabled:opacity-50"
              />
            </div>

            {error && (
              <div className="p-2.5 rounded bg-[#fce8e6] border border-[#dc2626]/20 text-[#dc2626] text-xs text-center font-body-md">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting || !newPassword || !confirmPassword}
              className="w-full bg-[#4f46e5] hover:bg-[#4338ca] text-white font-bold py-2.5 rounded transition-colors text-sm disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Saving…
                </span>
              ) : 'Set Password & Continue'}
            </button>
          </form>
        ) : mode === 'signin' ? (
          <form onSubmit={handleSignIn} className="bg-white border border-[#e9e9e7] rounded-lg shadow-2xs p-6 space-y-4">
            <div className="space-y-1.5">
              <label className="font-label-caps text-[10px] text-[#5f5f5b] uppercase font-bold block">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={e => { setEmail(e.target.value); setError(null); }}
                placeholder="you@pharmacozyme.com"
                autoComplete="email"
                autoFocus
                required
                disabled={isSubmitting}
                className="w-full bg-[#f4f4f3] border border-[#e9e9e7] focus:border-[#4f46e5] text-[#1b1c1a] p-2.5 rounded outline-none transition-colors placeholder:text-[#e9e9e7] placeholder:text-sm disabled:opacity-50"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-label-caps text-[10px] text-[#5f5f5b] uppercase font-bold flex items-center gap-1">
                <span className="material-symbols-outlined text-xs">lock</span>
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError(null); }}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  required
                  disabled={isSubmitting}
                  className="w-full bg-[#f4f4f3] border border-[#e9e9e7] focus:border-[#4f46e5] text-[#1b1c1a] p-2.5 pr-10 rounded outline-none transition-colors placeholder:text-[#e9e9e7] placeholder:text-sm disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#5f5f5b] hover:text-[#1b1c1a] transition-colors"
                  tabIndex={-1}
                >
                  <span className="material-symbols-outlined text-base">
                    {showPassword ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>
            </div>

            {error && (
              <div className="p-2.5 rounded bg-[#fce8e6] border border-[#dc2626]/20 text-[#dc2626] text-xs text-center font-body-md">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting || !email || !password}
              className="w-full bg-[#4f46e5] hover:bg-[#4338ca] text-white font-bold py-2.5 rounded transition-colors text-sm disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Signing in…
                </span>
              ) : 'Sign In'}
            </button>

            <button
              type="button"
              onClick={() => { setMode('reset'); setError(null); setResetSent(false); }}
              className="w-full text-center text-[#5f5f5b] hover:text-[#4f46e5] text-xs font-body-md transition-colors"
            >
              Forgot your password?
            </button>
          </form>
        ) : (
          <form onSubmit={handleResetRequest} className="bg-white border border-[#e9e9e7] rounded-lg shadow-2xs p-6 space-y-4">
            {resetSent ? (
              <div className="p-3 rounded bg-[#eef2ff] border border-[#4f46e5]/20 text-[#4f46e5] text-xs text-center font-body-md">
                If that email has an account, a reset link is on its way — check your inbox.
              </div>
            ) : (
              <>
                <div className="space-y-1.5">
                  <label className="font-label-caps text-[10px] text-[#5f5f5b] uppercase font-bold block">
                    Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => { setEmail(e.target.value); setError(null); }}
                    placeholder="you@pharmacozyme.com"
                    autoComplete="email"
                    autoFocus
                    required
                    disabled={isSubmitting}
                    className="w-full bg-[#f4f4f3] border border-[#e9e9e7] focus:border-[#4f46e5] text-[#1b1c1a] p-2.5 rounded outline-none transition-colors placeholder:text-[#e9e9e7] placeholder:text-sm disabled:opacity-50"
                  />
                </div>

                {error && (
                  <div className="p-2.5 rounded bg-[#fce8e6] border border-[#dc2626]/20 text-[#dc2626] text-xs text-center font-body-md">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting || !email}
                  className="w-full bg-[#4f46e5] hover:bg-[#4338ca] text-white font-bold py-2.5 rounded transition-colors text-sm disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? 'Sending…' : 'Send Reset Link'}
                </button>
              </>
            )}

            <button
              type="button"
              onClick={() => { setMode('signin'); setError(null); setResetSent(false); }}
              className="w-full text-center text-[#5f5f5b] hover:text-[#4f46e5] text-xs font-body-md transition-colors"
            >
              Back to sign in
            </button>
          </form>
        )}

        <p className="text-center text-[#e9e9e7] text-[10px] font-body-md mt-5">
          Pharmacozyme Brand-Ops Studio · Internal Use Only
        </p>
      </div>
    </div>
  );
};
