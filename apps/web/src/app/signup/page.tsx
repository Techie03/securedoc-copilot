'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';
import { Shield, Mail, Lock, User, ArrowRight, Loader2, Sparkles } from 'lucide-react';

export default function SignupPage() {
  const { signup } = useAuth();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName || !email || !password) {
      setError('Please fill in all fields.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await signup({ fullName, email, password });
    } catch (err: any) {
      setError(err.detail || 'Failed to create account. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-[calc(100vh-4rem)] flex items-center justify-center overflow-hidden py-12 px-4 sm:px-6 lg:px-8">
      {/* Background Cyberpunk Elements */}
      <div className="absolute inset-0 bg-slate-950 -z-20" />
      <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl -z-10" />
      <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-96 h-96 bg-violet-600/10 rounded-full blur-3xl -z-10" />
      
      {/* Decorative Grid Pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#0f172a_1px,transparent_1px),linear-gradient(to_bottom,#0f172a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-30 -z-10" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="w-full max-w-md"
      >
        {/* Card wrapper with glassmorphism */}
        <div className="relative overflow-hidden rounded-3xl border border-white/5 bg-slate-900/60 p-8 shadow-2xl backdrop-blur-xl">
          
          {/* Top subtle ambient glow bar */}
          <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-cyan-500 to-violet-500" />

          <div className="flex flex-col items-center mb-8 text-center">
            {/* Animated Logo Container */}
            <motion.div
              whileHover={{ rotate: 360 }}
              transition={{ duration: 0.8 }}
              className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-cyan-500 to-violet-600 p-[1.5px] shadow-lg shadow-cyan-500/20"
            >
              <div className="flex h-full w-full items-center justify-center rounded-[14px] bg-slate-950">
                <Shield className="h-6 w-6 text-cyan-400" />
              </div>
            </motion.div>

            <h2 className="mt-4 text-2xl font-bold tracking-tight text-white flex items-center gap-1.5 justify-center">
              Create your secure vault <Sparkles className="h-4 w-4 text-cyan-400 animate-pulse" />
            </h2>
            <p className="mt-1.5 text-sm text-slate-400">
              Start searching, reasoning, and acting on private docs.
            </p>
          </div>

          <form className="space-y-5" onSubmit={handleSubmit}>
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-3.5 text-sm text-rose-400"
              >
                {error}
              </motion.div>
            )}

            <div>
              <label htmlFor="name" className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                Full Name
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <User className="h-4 w-4 text-slate-500" />
                </div>
                <input
                  id="name"
                  type="text"
                  required
                  placeholder="Alex Mercer"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="block w-full rounded-xl border border-white/5 bg-slate-950/40 py-3 pl-10 pr-4 text-sm text-white placeholder-slate-500 outline-none ring-1 ring-transparent transition-all duration-300 focus:border-cyan-500 focus:bg-slate-950/80 focus:ring-cyan-500/30"
                />
              </div>
            </div>

            <div>
              <label htmlFor="email" className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                Email Address
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <Mail className="h-4 w-4 text-slate-500" />
                </div>
                <input
                  id="email"
                  type="email"
                  required
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full rounded-xl border border-white/5 bg-slate-950/40 py-3 pl-10 pr-4 text-sm text-white placeholder-slate-500 outline-none ring-1 ring-transparent transition-all duration-300 focus:border-cyan-500 focus:bg-slate-950/80 focus:ring-cyan-500/30"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                Password
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <Lock className="h-4 w-4 text-slate-500" />
                </div>
                <input
                  id="password"
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full rounded-xl border border-white/5 bg-slate-950/40 py-3 pl-10 pr-4 text-sm text-white placeholder-slate-500 outline-none ring-1 ring-transparent transition-all duration-300 focus:border-cyan-500 focus:bg-slate-950/80 focus:ring-cyan-500/30"
                />
              </div>
            </div>

            <motion.button
              type="submit"
              disabled={loading}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              className="relative flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-cyan-500 to-violet-600 px-4 py-3.5 text-sm font-semibold text-white shadow-lg shadow-cyan-500/20 transition-all duration-300 hover:shadow-cyan-400/30 disabled:opacity-50 disabled:cursor-not-allowed group cursor-pointer"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  Create Account
                  <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform duration-200" />
                </>
              )}
            </motion.button>
          </form>

          <div className="mt-6 text-center text-xs">
            <span className="text-slate-400">Already registered? </span>
            <Link href="/login" className="font-semibold text-cyan-400 hover:text-cyan-300 transition-colors duration-200">
              Sign in to Copilot
            </Link>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
