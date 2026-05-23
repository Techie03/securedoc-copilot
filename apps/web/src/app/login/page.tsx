'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { Shield, Mail, Lock, ArrowRight, Loader2, Sparkles } from 'lucide-react';

import { Suspense } from 'react';

// Global set to track processed OAuth codes across mount/unmount cycles in React StrictMode
const oauthProcessedCodes = new Set<string>();

function LoginContent() {
  const { login, githubLogin, googleLogin } = useAuth();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const processedRef = React.useRef(false);

  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState<string | null>(null);
  const [forgotSuccess, setForgotSuccess] = useState<string | null>(null);

  // OTP reset flow steps: 'email' | 'otp' | 'password' | 'success'
  const [forgotStep, setForgotStep] = useState<'email' | 'otp' | 'password' | 'success'>('email');
  const [otpVerifyToken, setOtpVerifyToken] = useState<string | null>(null);
  const [sandboxOtp, setSandboxOtp] = useState<string | null>(null);
  const [otpCode, setOtpCode] = useState('');
  const [resetToken, setResetToken] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail) {
      setForgotError('Please enter your email address.');
      return;
    }
    setForgotLoading(true);
    setForgotError(null);
    setForgotSuccess(null);
    setOtpVerifyToken(null);
    setSandboxOtp(null);
    try {
      const res = await api.forgotPassword(forgotEmail);
      if (res.otp_verify_token) {
        setOtpVerifyToken(res.otp_verify_token);
        setSandboxOtp(res.sandbox_otp || null);
        setForgotStep('otp');
        setForgotSuccess(res.detail || 'OTP code sent successfully.');
      } else {
        setForgotSuccess(null);
        setForgotError('No registered account was found for this email address.');
      }
    } catch (err: any) {
      setForgotError(err.detail || 'Failed to submit reset request.');
    } finally {
      setForgotLoading(false);
    }
  };

  const handleOtpVerifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode) {
      setForgotError('Please enter the 6-digit OTP code.');
      return;
    }
    if (!otpVerifyToken) {
      setForgotError('Verification token is missing. Please restart.');
      return;
    }
    setForgotLoading(true);
    setForgotError(null);
    try {
      const res = await api.verifyOtp(otpVerifyToken, otpCode);
      setResetToken(res.reset_token);
      setForgotStep('password');
      setForgotError(null);
      setForgotSuccess(null);
    } catch (err: any) {
      setForgotError(err.detail || 'Incorrect OTP code. Please try again.');
    } finally {
      setForgotLoading(false);
    }
  };

  const handlePasswordResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || !confirmPassword) {
      setForgotError('Please fill in both password fields.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setForgotError('Passwords do not match.');
      return;
    }
    if (newPassword.length < 6) {
      setForgotError('Password must be at least 6 characters long.');
      return;
    }
    if (!resetToken) {
      setForgotError('Reset token is missing. Please restart.');
      return;
    }
    setForgotLoading(true);
    setForgotError(null);
    try {
      const res = await api.resetPassword({ token: resetToken, new_password: newPassword });
      setForgotSuccess(res.detail || 'Your password has been successfully reset.');
      setForgotStep('success');
    } catch (err: any) {
      setForgotError(err.detail || 'Failed to reset password. Please try again.');
    } finally {
      setForgotLoading(false);
    }
  };

  React.useEffect(() => {
    const code = searchParams.get('code');
    const stateParam = searchParams.get('state');
    
    let provider = 'github';
    if (stateParam) {
      try {
        const decodedState = JSON.parse(decodeURIComponent(stateParam));
        if (decodedState.provider) {
          provider = decodedState.provider;
        }
      } catch (e) {
        console.error("Failed to parse OAuth state", e);
      }
    }
    if (code && !processedRef.current && !oauthProcessedCodes.has(code)) {
      processedRef.current = true;
      oauthProcessedCodes.add(code);
      setLoading(true);
      if (provider === 'google') {
        const redirectUri = window.location.origin + '/login';
        googleLogin(code, redirectUri).catch(err => {
          setError(err.detail || 'Google login failed.');
          setLoading(false);
        });
      } else {
        const redirectUri = window.location.origin + '/login';
        githubLogin(code, redirectUri).catch(err => {
          setError(err.detail || 'GitHub login failed.');
          setLoading(false);
        });
      }
    }
  }, [searchParams, githubLogin, googleLogin]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please enter both email and password.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await login({ email, password });
    } catch (err: any) {
      setError(err.detail || 'Invalid email or password.');
    } finally {
      setLoading(false);
    }
  };

  const startGithubOAuth = () => {
    const clientId = process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID;
    if (!clientId) {
      setError('GitHub OAuth client ID is not configured.');
      return;
    }

    setError(null);
    setLoading(true);
    const redirectUri = window.location.origin + '/login';
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: 'user:email',
    });
    window.location.href = `https://github.com/login/oauth/authorize?${params.toString()}`;
  };

  const startGoogleOAuth = () => {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (!clientId) {
      setError('Google OAuth client ID is not configured.');
      return;
    }

    setError(null);
    setLoading(true);
    const redirectUri = window.location.origin + '/login';
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'email profile',
      state: JSON.stringify({ provider: 'google' }),
    });
    window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  };

  if (showForgotPassword) {
    return (
      <div className="relative min-h-[calc(100vh-4rem)] flex items-center justify-center overflow-hidden py-12 px-4 sm:px-6 lg:px-8">
        {/* Background Cyberpunk Elements */}
        <div className="absolute inset-0 bg-slate-50 dark:bg-slate-950 transition-colors duration-300 -z-20" />
        <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-cyan-500/5 dark:bg-cyan-500/10 rounded-full blur-3xl -z-10" />
        <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-96 h-96 bg-violet-600/5 dark:bg-violet-600/10 rounded-full blur-3xl -z-10" />
        
        {/* Decorative Grid Pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-70 dark:opacity-30 -z-10" />

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="w-full max-w-md"
        >
          <div className="relative overflow-hidden rounded-3xl border border-gray-200/80 bg-white/80 dark:border-white/5 dark:bg-slate-900/60 p-8 shadow-2xl backdrop-blur-xl">
            <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-cyan-500 to-violet-500" />

            <div className="flex flex-col items-center mb-8 text-center">
              <motion.div
                whileHover={{ rotate: -360 }}
                transition={{ duration: 0.8 }}
                className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-cyan-500 to-violet-600 p-[1.5px] shadow-lg shadow-cyan-500/20"
              >
                <div className="flex h-full w-full items-center justify-center rounded-[14px] bg-slate-50 dark:bg-slate-950">
                  <Shield className="h-6 w-6 text-cyan-500 dark:text-cyan-400" />
                </div>
              </motion.div>
              <h2 className="mt-4 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                {forgotStep === 'email' && "Reset Access Key"}
                {forgotStep === 'otp' && "Enter OTP"}
                {forgotStep === 'password' && "Set New Password"}
                {forgotStep === 'success' && "Reset Successful"}
              </h2>
              <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
                {forgotStep === 'email' && "Enter your secure email to receive a 6-digit OTP code."}
                {forgotStep === 'otp' && "Enter the 6-digit verification code sent to your inbox."}
                {forgotStep === 'password' && "Set a new secure password for your credentials."}
                {forgotStep === 'success' && "Your password has been updated. You can now log in."}
              </p>
            </div>

            {forgotStep === 'email' && (
              <form className="space-y-5" onSubmit={handleForgotPasswordSubmit}>
                {forgotError && (
                  <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-3.5 text-sm text-rose-500 dark:text-rose-450">
                    {forgotError}
                  </div>
                )}
                <div>
                  <label htmlFor="forgot-email" className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                    Email Address
                  </label>
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                      <Mail className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                    </div>
                    <input
                      id="forgot-email"
                      type="email"
                      required
                      placeholder="name@company.com"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      autoComplete="off"
                      className="block w-full rounded-xl border border-gray-200 bg-white/60 dark:border-white/5 dark:bg-slate-950/40 py-3 pl-10 pr-4 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 outline-none ring-1 ring-transparent focus:border-cyan-500 focus:bg-white dark:focus:bg-slate-950/80 focus:ring-cyan-500/30 transition-all duration-300"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={forgotLoading}
                  className="w-full flex items-center justify-center rounded-xl bg-gradient-to-r from-cyan-500 to-violet-600 px-4 py-3.5 text-sm font-semibold text-white shadow-lg disabled:opacity-50 cursor-pointer transition-all duration-300 hover:shadow-cyan-400/30 hover:scale-[1.01] active:scale-[0.99]"
                >
                  {forgotLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send OTP Verification"}
                </button>

                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => {
                      setShowForgotPassword(false);
                      setForgotError(null);
                      setForgotSuccess(null);
                    }}
                    className="text-xs font-semibold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white transition-colors cursor-pointer"
                  >
                    Cancel and Go Back
                  </button>
                </div>
              </form>
            )}

            {forgotStep === 'otp' && (
              <form className="space-y-5" onSubmit={handleOtpVerifySubmit}>
                {forgotSuccess && (
                  <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3.5 text-sm text-emerald-600 dark:text-emerald-400 text-center leading-relaxed">
                    {forgotSuccess}
                  </div>
                )}
                {forgotError && (
                  <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-3.5 text-sm text-rose-500 dark:text-rose-450">
                    {forgotError}
                  </div>
                )}
                
                {sandboxOtp && (
                  <div className="p-4 rounded-xl border border-cyan-500/20 bg-cyan-500/5 dark:bg-cyan-500/10 text-center space-y-1.5">
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                      Since this is a secure sandbox environment, we have generated your OTP code below:
                    </p>
                    <div className="text-2xl font-bold tracking-widest text-cyan-500 dark:text-cyan-400 font-mono animate-pulse">
                      {sandboxOtp}
                    </div>
                  </div>
                )}

                <div>
                  <label htmlFor="otp-code" className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                    6-Digit OTP Code
                  </label>
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                      <Shield className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                    </div>
                    <input
                      id="otp-code"
                      type="text"
                      required
                      maxLength={6}
                      pattern="\d{6}"
                      placeholder="123456"
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                      autoComplete="off"
                      className="block w-full rounded-xl border border-gray-200 bg-white/60 dark:border-white/5 dark:bg-slate-950/40 py-3 pl-10 pr-4 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 outline-none ring-1 ring-transparent focus:border-cyan-500 focus:bg-white dark:focus:bg-slate-950/80 focus:ring-cyan-500/30 font-mono tracking-widest text-center transition-all duration-300"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={forgotLoading}
                  className="w-full flex items-center justify-center rounded-xl bg-gradient-to-r from-cyan-500 to-violet-600 px-4 py-3.5 text-sm font-semibold text-white shadow-lg disabled:opacity-50 cursor-pointer transition-all duration-300 hover:shadow-cyan-400/30 hover:scale-[1.01] active:scale-[0.99]"
                >
                  {forgotLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify OTP Code"}
                </button>

                <div className="flex flex-col gap-2.5 text-center mt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setForgotStep('email');
                      setForgotError(null);
                      setForgotSuccess(null);
                      setOtpCode('');
                    }}
                    className="text-xs font-semibold text-cyan-600 hover:text-cyan-500 dark:text-cyan-400 dark:hover:text-cyan-300 transition-colors cursor-pointer"
                  >
                    Request another OTP
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowForgotPassword(false);
                      setForgotStep('email');
                      setForgotError(null);
                      setForgotSuccess(null);
                      setOtpCode('');
                    }}
                    className="text-xs font-semibold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}

            {forgotStep === 'password' && (
              <form className="space-y-5" onSubmit={handlePasswordResetSubmit}>
                {forgotError && (
                  <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-3.5 text-sm text-rose-500 dark:text-rose-450">
                    {forgotError}
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
                      className="block w-full rounded-xl border border-gray-200 bg-white/60 dark:border-white/5 dark:bg-slate-950/40 py-3 pl-10 pr-4 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 outline-none ring-1 ring-transparent focus:border-cyan-500 focus:bg-white dark:focus:bg-slate-950/80 focus:ring-cyan-500/30 transition-all duration-300"
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
                      className="block w-full rounded-xl border border-gray-200 bg-white/60 dark:border-white/5 dark:bg-slate-950/40 py-3 pl-10 pr-4 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 outline-none ring-1 ring-transparent focus:border-cyan-500 focus:bg-white dark:focus:bg-slate-950/80 focus:ring-cyan-500/30 transition-all duration-300"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={forgotLoading}
                  className="w-full flex items-center justify-center rounded-xl bg-gradient-to-r from-cyan-500 to-violet-600 px-4 py-3.5 text-sm font-semibold text-white shadow-lg disabled:opacity-50 cursor-pointer transition-all duration-300 hover:shadow-cyan-400/30 hover:scale-[1.01] active:scale-[0.99]"
                >
                  {forgotLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Set New Password"}
                </button>

                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => {
                      setForgotStep('otp');
                      setForgotError(null);
                      setForgotSuccess(null);
                      setNewPassword('');
                      setConfirmPassword('');
                    }}
                    className="text-xs font-semibold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white transition-colors cursor-pointer"
                  >
                    Go Back to OTP
                  </button>
                </div>
              </form>
            )}

            {forgotStep === 'success' && (
              <div className="space-y-6">
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-600 dark:text-emerald-450 text-center leading-relaxed">
                  {forgotSuccess || "Your password has been successfully reset."}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setShowForgotPassword(false);
                    setForgotStep('email');
                    setForgotError(null);
                    setForgotSuccess(null);
                    setForgotEmail('');
                    setOtpCode('');
                    setNewPassword('');
                    setConfirmPassword('');
                    setResetToken(null);
                    setOtpVerifyToken(null);
                    setSandboxOtp(null);
                  }}
                  className="w-full flex items-center justify-center rounded-xl bg-gradient-to-r from-cyan-500 to-violet-600 px-4 py-3.5 text-sm font-semibold text-white shadow-lg cursor-pointer transition-all duration-300 hover:shadow-cyan-400/30 hover:scale-[1.01] active:scale-[0.99]"
                >
                  Back to Sign In
                </button>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="relative min-h-[calc(100vh-4rem)] flex items-center justify-center overflow-hidden py-12 px-4 sm:px-6 lg:px-8">
      {/* Background Cyberpunk Elements */}
      <div className="absolute inset-0 bg-slate-50 dark:bg-slate-950 transition-colors duration-300 -z-20" />
      <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-cyan-500/5 dark:bg-cyan-500/10 rounded-full blur-3xl -z-10" />
      <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-96 h-96 bg-violet-600/5 dark:bg-violet-600/10 rounded-full blur-3xl -z-10" />
      
      {/* Decorative Grid Pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-70 dark:opacity-30 -z-10" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="w-full max-w-md"
      >
        {/* Card wrapper with glassmorphism */}
        <div className="relative overflow-hidden rounded-3xl border border-gray-200/80 bg-white/80 dark:border-white/5 dark:bg-slate-900/60 p-8 shadow-2xl backdrop-blur-xl">
          
          {/* Top subtle ambient glow bar */}
          <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-cyan-500 to-violet-500" />

          <div className="flex flex-col items-center mb-8 text-center">
            {/* Animated Logo Container */}
            <motion.div
              whileHover={{ rotate: -360 }}
              transition={{ duration: 0.8 }}
              className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-cyan-500 to-violet-600 p-[1.5px] shadow-lg shadow-cyan-500/20"
            >
              <div className="flex h-full w-full items-center justify-center rounded-[14px] bg-slate-50 dark:bg-slate-950">
                <Shield className="h-6 w-6 text-cyan-500 dark:text-cyan-400" />
              </div>
            </motion.div>
            <h2 className="mt-4 text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-1.5 justify-center">
              Welcome back Agent <Sparkles className="h-4 w-4 text-cyan-500 dark:text-cyan-400 animate-pulse" />
            </h2>
            <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
              Sign in to resume secure session operations.
            </p>
          </div>

          <form className="space-y-5" onSubmit={handleSubmit}>
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-3.5 text-sm text-rose-500 dark:text-rose-400"
              >
                {error}
              </motion.div>
            )}

            <div>
              <label htmlFor="email" className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                Email Address
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <Mail className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                </div>
                <input
                  id="email"
                  type="email"
                  required
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="off"
                  className="block w-full rounded-xl border border-gray-200 bg-white/60 dark:border-white/5 dark:bg-slate-950/40 py-3 pl-10 pr-4 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 outline-none ring-1 ring-transparent transition-all duration-300 focus:border-cyan-500 focus:bg-white dark:focus:bg-slate-950/80 focus:ring-cyan-500/30"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label htmlFor="password" className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => setShowForgotPassword(true)}
                  className="text-xs font-semibold text-cyan-600 hover:text-cyan-500 dark:text-cyan-400 dark:hover:text-cyan-300 transition-colors cursor-pointer"
                >
                  Forgot Password?
                </button>
              </div>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <Lock className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                </div>
                <input
                  id="password"
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  className="block w-full rounded-xl border border-gray-200 bg-white/60 dark:border-white/5 dark:bg-slate-950/40 py-3 pl-10 pr-4 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 outline-none ring-1 ring-transparent transition-all duration-300 focus:border-cyan-500 focus:bg-white dark:focus:bg-slate-950/80 focus:ring-cyan-500/30"
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
                  Verify Credentials
                  <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform duration-200" />
                </>
              )}
            </motion.button>
          </form>

          <div className="mt-6 flex items-center justify-between">
            <div className="h-px w-full bg-gray-200 dark:bg-slate-800" />
            <span className="px-3 text-xs text-slate-400 dark:text-slate-500 uppercase">Or</span>
            <div className="h-px w-full bg-gray-200 dark:bg-slate-800" />
          </div>

          <div className="mt-6">
            <button
              onClick={startGithubOAuth}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 dark:border-white/10 dark:bg-slate-800/50 px-4 py-3 text-sm font-medium text-slate-700 dark:text-white transition-all dark:hover:bg-slate-700/50 dark:hover:border-white/20 disabled:opacity-50 mb-3 shadow-sm"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current text-slate-700 dark:text-white">
                <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/>
              </svg>
              Continue with GitHub
            </button>

            <button
              onClick={startGoogleOAuth}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 dark:border-white/10 dark:bg-slate-800/50 px-4 py-3 text-sm font-medium text-slate-700 dark:text-white transition-all dark:hover:bg-slate-700/50 dark:hover:border-white/20 disabled:opacity-50 shadow-sm"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5 bg-white rounded-full p-[2px] shadow-sm">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Continue with Google
            </button>
          </div>

          <div className="mt-6 text-center text-xs">
            <span className="text-slate-500 dark:text-slate-400">New agent? </span>
            <Link href="/signup" className="font-semibold text-cyan-600 hover:text-cyan-500 dark:text-cyan-400 dark:hover:text-cyan-300 transition-colors duration-200">
              Create secure profile
            </Link>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="flex-1 flex items-center justify-center bg-slate-50 dark:bg-slate-950 min-h-[calc(100vh-4rem)]">
        <Loader2 className="h-8 w-8 animate-spin text-cyan-500" />
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}
