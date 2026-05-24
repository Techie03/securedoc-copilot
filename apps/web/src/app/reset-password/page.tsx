'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { api } from '@/lib/api';
import { Shield, Lock, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token) {
      setError('Password reset token is missing. Please check your reset link.');
    }
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) {
      setError('Missing reset token.');
      return;
    }
    if (!newPassword) {
      setError('Please enter a new password.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await api.resetPassword({ token, new_password: newPassword });
      setSuccess(res.detail || 'Your password has been successfully reset.');
      setTimeout(() => {
        router.push('/login');
      }, 3000);
    } catch (err: any) {
      console.error(err);
      setError(err.detail || 'Failed to reset password. The link may have expired or is invalid.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-[calc(100vh-4rem)] flex items-center justify-center overflow-hidden py-12 px-4 sm:px-6 lg:px-8">
      {/* Background elements */}
      <div className="absolute inset-0 bg-white dark:bg-slate-950 transition-colors duration-300 -z-20" />
      <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-cyan-500/5 dark:bg-cyan-500/10 rounded-full blur-3xl -z-10" />
      <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-96 h-96 bg-violet-600/5 dark:bg-violet-600/10 rounded-full blur-3xl -z-10" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="w-full max-w-md"
      >
        <div className="relative overflow-hidden rounded-3xl border border-gray-200/80 bg-white/80 dark:border-white/5 dark:bg-slate-900/60 p-8 shadow-2xl backdrop-blur-xl">
          <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-cyan-500 to-violet-500" />

          <div className="flex flex-col items-center mb-8 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-cyan-500 to-violet-600 p-[1.5px] shadow-lg shadow-cyan-500/20">
              <div className="flex h-full w-full items-center justify-center rounded-[14px] bg-white dark:bg-slate-950">
                <Shield className="h-6 w-6 text-cyan-500 dark:text-cyan-400" />
              </div>
            </div>
            <h2 className="mt-4 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Update Secure Password
            </h2>
            <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
              Set new authentication credentials for your account.
            </p>
          </div>

          {success ? (
            <div className="space-y-6">
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-600 dark:text-emerald-400 flex flex-col items-center gap-2">
                <CheckCircle2 className="h-8 w-8 text-emerald-500" />
                <span className="text-center font-medium">{success}</span>
              </div>
              <p className="text-xs text-slate-500 text-center">
                Redirecting you to the secure login page...
              </p>
            </div>
          ) : (
            <form className="space-y-5" onSubmit={handleSubmit}>
              {error && (
                <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-3.5 text-sm text-rose-500 dark:text-rose-400 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div>
                <label htmlFor="new-password" className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                  New Password
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <Lock className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                  </div>
                  <input
                    id="new-password"
                    type="password"
                    required
                    placeholder="••••••••"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    autoComplete="new-password"
                    disabled={!token || loading}
                    className="block w-full rounded-xl border border-gray-200 bg-white/60 dark:border-white/5 dark:bg-slate-950/40 py-3 pl-10 pr-4 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 outline-none ring-1 ring-transparent focus:border-cyan-500 focus:bg-white dark:focus:bg-slate-950/80 focus:ring-cyan-500/30"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="confirm-password" className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                  Confirm Password
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <Lock className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                  </div>
                  <input
                    id="confirm-password"
                    type="password"
                    required
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    autoComplete="new-password"
                    disabled={!token || loading}
                    className="block w-full rounded-xl border border-gray-200 bg-white/60 dark:border-white/5 dark:bg-slate-950/40 py-3 pl-10 pr-4 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 outline-none ring-1 ring-transparent focus:border-cyan-500 focus:bg-white dark:focus:bg-slate-950/80 focus:ring-cyan-500/30"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={!token || loading}
                className="w-full flex items-center justify-center rounded-xl bg-gradient-to-r from-cyan-500 to-violet-600 px-4 py-3.5 text-sm font-semibold text-white shadow-lg disabled:opacity-50 cursor-pointer"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirm New Password'}
              </button>
            </form>
          )}
        </div>
      </motion.div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="flex-1 flex items-center justify-center bg-white dark:bg-slate-950 min-h-[calc(100vh-4rem)]">
        <Loader2 className="h-8 w-8 animate-spin text-cyan-500" />
      </div>
    }>
      <ResetPasswordContent />
    </Suspense>
  );
}
