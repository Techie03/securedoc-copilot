'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Shield, Activity, CheckCircle2, AlertTriangle, Globe, RefreshCw, Database, Server, Key, Terminal } from 'lucide-react';
import Link from 'next/link';
import { API_BASE_URL } from '@/lib/api';

export default function DiagnosticsPage() {
  const [loading, setLoading] = useState(false);
  const [apiBaseUrl, setApiBaseUrl] = useState('');
  const [githubClientId, setGithubClientId] = useState('');
  const [googleClientId, setGoogleClientId] = useState('');
  const [clientOrigin, setClientOrigin] = useState('');
  
  const [backendHealth, setBackendHealth] = useState<{ status: string; detail: string; data?: any }>({ status: 'Pending', detail: 'Not run yet' });
  const [backendDiagnostics, setBackendDiagnostics] = useState<{ status: string; detail: string; data?: any }>({ status: 'Pending', detail: 'Not run yet' });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setClientOrigin(window.location.origin);
    }
    setApiBaseUrl(API_BASE_URL);
    setGithubClientId(process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID || '(Not Configured)');
    setGoogleClientId(process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '(Not Configured)');
  }, []);

  const runDiagnostics = async () => {
    setLoading(true);
    setBackendHealth({ status: 'Checking', detail: 'Sending request...' });
    setBackendDiagnostics({ status: 'Checking', detail: 'Sending request...' });

    // Determine target API URL
    const baseUrl = API_BASE_URL;

    const healthUrl = baseUrl.replace('/api', '') + '/health';
    const diagUrl = baseUrl + '/diagnostics';

    // 1. Check Health
    try {
      console.log('Fetching health from:', healthUrl);
      const res = await fetch(healthUrl, { mode: 'cors' });
      if (res.ok) {
        const data = await res.json();
        setBackendHealth({ status: 'Healthy', detail: `HTTP ${res.status} OK`, data });
      } else {
        setBackendHealth({ status: 'Error', detail: `HTTP Error ${res.status}: ${res.statusText}` });
      }
    } catch (err: any) {
      console.error(err);
      setBackendHealth({ 
        status: 'Error', 
        detail: `Connection failed. This usually means either:\n1. The backend URL '${healthUrl}' is incorrect or down.\n2. CORS preflight is blocked (check if backend ALLOWED_ORIGINS contains '${window.location.origin}').\n3. The backend URL is http:// but you are visiting an https:// frontend (mixed content blocked by browser).\n\nError details: ${err.message}` 
      });
    }

    // 2. Check Backend Diagnostics
    try {
      console.log('Fetching diagnostics from:', diagUrl);
      const res = await fetch(diagUrl, { mode: 'cors' });
      if (res.ok) {
        const data = await res.json();
        setBackendDiagnostics({ status: 'Connected', detail: `HTTP ${res.status} OK`, data });
      } else {
        const text = await res.text();
        setBackendDiagnostics({ status: 'Error', detail: `HTTP Error ${res.status}: ${text || res.statusText}` });
      }
    } catch (err: any) {
      console.error(err);
      setBackendDiagnostics({ 
        status: 'Error', 
        detail: `Connection failed. Error details: ${err.message}` 
      });
    }

    setLoading(false);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Healthy':
      case 'Connected':
        return 'text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20 bg-emerald-50 dark:bg-emerald-500/10';
      case 'Error':
        return 'text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-500/20 bg-rose-50 dark:bg-rose-500/10';
      case 'Checking':
        return 'text-cyan-600 dark:text-cyan-400 border-cyan-200 dark:border-cyan-500/20 bg-cyan-50 dark:bg-cyan-500/10';
      default:
        return 'text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900/40';
    }
  };

  return (
    <div className="relative min-h-[calc(100vh-4rem)] bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 py-12 px-4 sm:px-6 lg:px-8 overflow-hidden transition-colors duration-300">
      {/* Ambient Cyberpunk Glows */}
      <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-cyan-500/5 dark:bg-cyan-500/10 rounded-full blur-3xl -z-10" />
      <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-96 h-96 bg-violet-600/5 dark:bg-violet-600/10 rounded-full blur-3xl -z-10" />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] -z-10" />

      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 dark:border-white/5 pb-6">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-violet-600 p-[1px] flex items-center justify-center">
              <div className="h-full w-full bg-white dark:bg-slate-950 rounded-[11px] flex items-center justify-center">
                <Activity className="h-5 w-5 text-cyan-500 dark:text-cyan-400" />
              </div>
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                SecureDoc Copilot System Diagnostics
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Debug connectivity issues, CORS headers, environment variables, and authentication configurations.
              </p>
            </div>
          </div>
          <button
            onClick={runDiagnostics}
            disabled={loading}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-violet-600 text-sm font-semibold text-white shadow-lg shadow-cyan-500/20 hover:shadow-cyan-400/30 transition-all disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Run System Audit
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Column 1: Frontend Config */}
          <div className="md:col-span-1 rounded-2xl border border-slate-200 dark:border-white/5 bg-white/60 dark:bg-slate-900/60 p-6 backdrop-blur-xl space-y-6 shadow-sm dark:shadow-none">
            <h2 className="text-lg font-semibold text-slate-800 dark:text-white flex items-center gap-2 border-b border-slate-200 dark:border-white/5 pb-3">
              <Globe className="h-4 w-4 text-cyan-500 dark:text-cyan-400" />
              Client Environment
            </h2>
            <div className="space-y-4 text-sm">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                  Client Origin URL
                </label>
                <div className="font-mono text-xs bg-white/80 dark:bg-slate-950 p-2.5 rounded-lg border border-slate-200 dark:border-white/5 break-all text-slate-700 dark:text-slate-300">
                  {clientOrigin}
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                  NEXT_PUBLIC_API_URL
                </label>
                <div className="font-mono text-xs bg-white/80 dark:bg-slate-950 p-2.5 rounded-lg border border-slate-200 dark:border-white/5 break-all text-slate-700 dark:text-slate-300">
                  {apiBaseUrl}
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                  GitHub Client ID
                </label>
                <div className="font-mono text-xs bg-white/80 dark:bg-slate-950 p-2.5 rounded-lg border border-slate-200 dark:border-white/5 break-all text-slate-700 dark:text-slate-300">
                  {githubClientId}
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                  Google Client ID
                </label>
                <div className="font-mono text-xs bg-white/80 dark:bg-slate-950 p-2.5 rounded-lg border border-slate-200 dark:border-white/5 break-all text-slate-700 dark:text-slate-300">
                  {googleClientId}
                </div>
              </div>
            </div>
          </div>

          {/* Column 2 & 3: Live Verification Status */}
          <div className="md:col-span-2 space-y-6">
            {/* Backend Health Check */}
            <div className="relative overflow-hidden rounded-2xl border border-slate-200 dark:border-white/5 bg-white/60 dark:bg-slate-900/60 p-6 backdrop-blur-xl shadow-sm dark:shadow-none">
              {loading && (
                <div className="absolute inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-cyan-500 to-transparent animate-scan" />
              )}
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/5 pb-3 mb-4">
                <h2 className="text-lg font-semibold text-slate-800 dark:text-white flex items-center gap-2">
                  <Server className="h-4 w-4 text-violet-500 dark:text-violet-400" />
                  Backend Health Ping (`/health`)
                </h2>
                <span className={`text-xs px-2.5 py-1 rounded-full border ${getStatusColor(backendHealth.status)}`}>
                  {backendHealth.status}
                </span>
              </div>
              <div className="space-y-4">
                <div className="font-mono text-xs bg-white/80 dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-white/5 whitespace-pre-wrap break-all text-slate-700 dark:text-slate-300 max-h-40 overflow-y-auto">
                  {backendHealth.detail}
                </div>
                {backendHealth.data && (
                  <div className="text-xs bg-white/50 dark:bg-slate-950/40 p-4 rounded-xl border border-slate-200 dark:border-white/5">
                    <div className="text-slate-500 dark:text-slate-400 font-semibold mb-2">Health Report Payload:</div>
                    <pre className="font-mono text-slate-700 dark:text-slate-300">{JSON.stringify(backendHealth.data, null, 2)}</pre>
                  </div>
                )}
              </div>
            </div>

            {/* Backend Diagnostic Connection Report */}
            <div className="relative overflow-hidden rounded-2xl border border-slate-200 dark:border-white/5 bg-white/60 dark:bg-slate-900/60 p-6 backdrop-blur-xl shadow-sm dark:shadow-none">
              {loading && (
                <div className="absolute inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-cyan-500 to-transparent animate-scan" />
              )}
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/5 pb-3 mb-4">
                <h2 className="text-lg font-semibold text-slate-800 dark:text-white flex items-center gap-2">
                  <Database className="h-4 w-4 text-cyan-500 dark:text-cyan-400" />
                  Internal Connections Report (`/api/diagnostics`)
                </h2>
                <span className={`text-xs px-2.5 py-1 rounded-full border ${getStatusColor(backendDiagnostics.status)}`}>
                  {backendDiagnostics.status}
                </span>
              </div>
              <div className="space-y-4">
                {backendDiagnostics.status === 'Connected' && backendDiagnostics.data ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-4 bg-white/80 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-white/5 space-y-1">
                      <div className="text-xs text-slate-500 dark:text-slate-400 font-semibold uppercase">PostgreSQL Database</div>
                      <div className={`text-sm font-semibold ${backendDiagnostics.data.database === 'connected' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                        {backendDiagnostics.data.database}
                      </div>
                    </div>
                    <div className="p-4 bg-white/80 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-white/5 space-y-1">
                      <div className="text-xs text-slate-500 dark:text-slate-400 font-semibold uppercase">Qdrant Vector Database</div>
                      <div className={`text-sm font-semibold ${backendDiagnostics.data.qdrant === 'connected' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                        {backendDiagnostics.data.qdrant}
                      </div>
                    </div>
                    <div className="p-4 bg-white/80 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-white/5 space-y-1">
                      <div className="text-xs text-slate-500 dark:text-slate-400 font-semibold uppercase">Redis Cache/Queue</div>
                      <div className={`text-sm font-semibold ${backendDiagnostics.data.redis === 'connected' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                        {backendDiagnostics.data.redis}
                      </div>
                    </div>
                    <div className="p-4 bg-white/80 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-white/5 space-y-1">
                      <div className="text-xs text-slate-500 dark:text-slate-400 font-semibold uppercase">NVIDIA NIM AI</div>
                      <div className={`text-sm font-semibold ${backendDiagnostics.data.nvidia_nim === 'connected' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                        {backendDiagnostics.data.nvidia_nim}
                      </div>
                    </div>
                    <div className="sm:col-span-2 p-4 bg-white/80 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-white/5 space-y-2">
                      <div className="text-xs text-slate-500 dark:text-slate-400 font-semibold uppercase">Backend OAuth Setup</div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="flex items-center gap-2">
                          <Key className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
                          <span className="text-slate-700 dark:text-slate-300">GitHub: {backendDiagnostics.data.oauth?.github_configured ? '✅ Ready' : '❌ Not Configured'}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Key className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
                          <span className="text-slate-700 dark:text-slate-300">Google: {backendDiagnostics.data.oauth?.google_configured ? '✅ Ready' : '❌ Not Configured'}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="font-mono text-xs bg-white/80 dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-white/5 whitespace-pre-wrap break-all text-slate-700 dark:text-slate-300">
                    {backendDiagnostics.detail}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Diagnostic Guide Alert */}
        <div className="rounded-2xl border border-yellow-500/20 bg-yellow-500/5 p-5 flex items-start gap-4 shadow-sm dark:shadow-none">
          <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-500 shrink-0 mt-0.5" />
          <div className="space-y-1 text-sm text-yellow-800 dark:text-yellow-200/80">
            <h4 className="font-semibold text-yellow-600 dark:text-yellow-400">Troubleshooting Network / Fetch Failures:</h4>
            <ul className="list-disc pl-4 space-y-1 text-xs">
              <li>Check your browser's Developer Tools Console (F12) for detailed errors.</li>
              <li>If you see a CORS error, check the Hugging Face Space settings environment variable <code className="bg-slate-200 dark:bg-slate-900 px-1 py-0.5 rounded text-slate-800 dark:text-white">ALLOWED_ORIGINS</code>. It must match your Vercel deployment URL (e.g. <code className="bg-slate-200 dark:bg-slate-900 px-1 py-0.5 rounded text-slate-800 dark:text-white">https://xxx.vercel.app</code>) or be set to <code className="bg-slate-200 dark:bg-slate-900 px-1 py-0.5 rounded text-slate-800 dark:text-white">*</code>.</li>
              <li>Verify that the Vercel frontend build configuration has the environment variable <code className="bg-slate-200 dark:bg-slate-900 px-1 py-0.5 rounded text-slate-800 dark:text-white">NEXT_PUBLIC_API_URL</code> set to the exact HTTPS URL of the Hugging Face Space (e.g. <code className="bg-slate-200 dark:bg-slate-900 px-1 py-0.5 rounded text-slate-800 dark:text-white">https://username-spacename.hf.space</code>). Do not use the embedding URL wrapping the iframe.</li>
            </ul>
          </div>
        </div>

        {/* Back Link */}
        <div className="text-center">
          <Link href="/login" className="text-xs text-cyan-600 dark:text-cyan-400 hover:text-cyan-700 dark:hover:text-cyan-300 font-medium flex items-center justify-center gap-1">
            <Shield className="h-3 w-3" /> Back to Secure Login
          </Link>
        </div>
      </div>
    </div>
  );
}
