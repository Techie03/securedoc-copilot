'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';
import { api, Connector } from '@/lib/api';
import { 
  Link as LinkIcon, 
  HardDrive, 
  RefreshCw, 
  Trash2, 
  Loader2, 
  Plus,
  AlertCircle,
  CheckCircle2,
  X
} from 'lucide-react';
import Github from '@/components/icons/Github';

export default function ConnectorsPage() {
  const { currentWorkspace, loading: authLoading } = useAuth();
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modals
  const [showGithubModal, setShowGithubModal] = useState(false);
  const [githubOwner, setGithubOwner] = useState('');
  const [githubRepo, setGithubRepo] = useState('');
  const [githubBranch, setGithubBranch] = useState('main');
  const [githubToken, setGithubToken] = useState('');
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  useEffect(() => {
    if (currentWorkspace) {
      fetchConnectors();
    }
  }, [currentWorkspace]);

  const fetchConnectors = async () => {
    if (!currentWorkspace) return;
    try {
      setLoading(true);
      const data = await api.listConnectors(currentWorkspace.id);
      setConnectors(data);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch connectors');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateGithub = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentWorkspace || !githubOwner || !githubRepo) return;

    setModalLoading(true);
    setModalError(null);
    try {
      const repoUrl = `https://github.com/${githubOwner}/${githubRepo}`;
      await api.syncGithubConnector(currentWorkspace.id, repoUrl);
      setShowGithubModal(false);
      setGithubOwner('');
      setGithubRepo('');
      setGithubToken('');
      // Optionally redirect to documents or refresh local state
    } catch (err: any) {
      setModalError(err.detail || 'Failed to connect and sync GitHub repository');
    } finally {
      setModalLoading(false);
    }
  };

  const handleCreateGdrive = async () => {
    if (!currentWorkspace) return;
    try {
      await api.createGdriveConnector(currentWorkspace.id);
      await fetchConnectors();
    } catch (err: any) {
      setError(err.detail || 'Failed to scaffold GDrive connector');
    }
  };

  const handleSync = async (connectorId: string) => {
    if (!currentWorkspace) return;
    try {
      await api.syncConnector(currentWorkspace.id, connectorId);
      await fetchConnectors(); // Refresh to show syncing status
    } catch (err: any) {
      setError(err.detail || 'Failed to trigger sync');
    }
  };

  const handleDelete = async (connectorId: string) => {
    if (!currentWorkspace) return;
    if (!confirm('Are you sure you want to delete this connector and all its ingested documents?')) return;
    
    try {
      await api.deleteConnector(currentWorkspace.id, connectorId);
      await fetchConnectors();
    } catch (err: any) {
      setError(err.detail || 'Failed to delete connector');
    }
  };

  if (authLoading || (!currentWorkspace && !loading)) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-white min-h-[calc(100vh-4rem)] transition-colors duration-300">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-500 dark:text-emerald-400" />
      </div>
    );
  }

  return (
    <div className="relative min-h-[calc(100vh-4rem)] bg-slate-50 dark:bg-slate-950 py-8 px-4 sm:px-6 lg:px-8 w-full flex flex-col transition-colors duration-300">
      {/* Background glow */}
      <div className="absolute top-1/3 left-1/4 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl -z-10" />

      <div className="mx-auto max-w-5xl w-full flex-1 flex flex-col">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 dark:border-white/10 pb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
              <LinkIcon className="h-6 w-6 text-emerald-500 dark:text-emerald-400" />
              Data Connectors
            </h1>
            <p className="text-sm text-slate-550 dark:text-slate-400 mt-1">
              Connect external data sources for automated ingestion, chunking, and GraphRAG extraction.
            </p>
          </div>
        </div>

        {error && (
          <div className="mt-6 rounded-xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-600 dark:text-rose-400 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
            <p>{error}</p>
          </div>
        )}

        {/* Available Connectors Grid */}
        <div className="mt-8">
          <h2 className="text-sm font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-4">Add New Source</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            {/* GitHub Card */}
            <motion.div 
              whileHover={{ y: -2 }}
              className="rounded-2xl border border-slate-200 dark:border-white/5 bg-white/60 dark:bg-slate-900/40 p-5 backdrop-blur-md flex items-center justify-between group cursor-pointer hover:border-emerald-500/30 transition-all shadow-sm hover:shadow-md dark:shadow-none"
              onClick={() => setShowGithubModal(true)}
            >
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 group-hover:text-emerald-600 group-hover:dark:text-emerald-400 group-hover:bg-emerald-500/10 transition-colors">
                  <Github className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 dark:text-white">GitHub Repository</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Ingest code & markdown</p>
                </div>
              </div>
              <Plus className="h-5 w-5 text-slate-400 dark:text-slate-500 group-hover:text-emerald-600 group-hover:dark:text-emerald-400 transition-colors" />
            </motion.div>

            {/* Google Drive Card */}
            <motion.div 
              whileHover={{ y: -2 }}
              className="rounded-2xl border border-slate-200 dark:border-white/5 bg-white/60 dark:bg-slate-900/40 p-5 backdrop-blur-md flex items-center justify-between group cursor-pointer hover:border-blue-500/30 transition-all shadow-sm hover:shadow-md dark:shadow-none"
              onClick={handleCreateGdrive}
            >
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 group-hover:text-blue-600 group-hover:dark:text-blue-400 group-hover:bg-blue-500/10 transition-colors">
                  <HardDrive className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                    Google Drive
                    <span className="text-[9px] font-bold uppercase bg-blue-500/20 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded">Soon</span>
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">OAuth placeholder (Phase 6)</p>
                </div>
              </div>
              <Plus className="h-5 w-5 text-slate-400 dark:text-slate-500 group-hover:text-blue-600 group-hover:dark:text-blue-400 transition-colors" />
            </motion.div>

          </div>
        </div>

        {/* Active Connectors List */}
        <div className="mt-12">
          <h2 className="text-sm font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-4 flex items-center gap-2">
            Active Connectors
            {loading && <Loader2 className="h-4 w-4 animate-spin text-emerald-500 dark:text-emerald-400" />}
          </h2>
          
          <div className="space-y-4">
            {!loading && connectors.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 dark:border-white/10 p-8 text-center bg-white/30 dark:bg-slate-900/10">
                <LinkIcon className="h-8 w-8 text-slate-400 dark:text-slate-600 mx-auto mb-3" />
                <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300">No active connectors</h3>
                <p className="text-xs text-slate-500 dark:text-slate-550 mt-1">Add a source above to automatically ingest data.</p>
              </div>
            ) : (
              connectors.map(conn => (
                <div key={conn.id} className="relative overflow-hidden rounded-2xl border border-slate-200 dark:border-white/10 bg-white/60 dark:bg-slate-900/50 p-5 backdrop-blur-sm shadow-sm dark:shadow-none">
                  {conn.status === 'syncing' && (
                    <div className="absolute inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-emerald-500 to-transparent animate-scan" />
                  )}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    
                    {/* Left: Info */}
                    <div className="flex items-center gap-4">
                      <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${
                        conn.provider === 'github' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' : 
                        'bg-blue-500/10 text-blue-650 dark:text-blue-400 border border-blue-500/20'
                      }`}>
                        {conn.provider === 'github' ? <Github className="h-6 w-6" /> : <HardDrive className="h-6 w-6" />}
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                          {conn.provider === 'github' ? `${conn.config?.owner}/${conn.config?.repo}` : 'Google Drive'}
                          {conn.status === 'syncing' && <span className="flex items-center gap-1 text-[10px] uppercase font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full"><Loader2 className="h-3 w-3 animate-spin"/> Syncing</span>}
                          {conn.status === 'connected' && <span className="flex items-center gap-1 text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full"><CheckCircle2 className="h-3 w-3"/> Connected</span>}
                          {conn.status === 'error' && <span className="flex items-center gap-1 text-[10px] uppercase font-bold text-rose-600 dark:text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-full"><AlertCircle className="h-3 w-3"/> Error</span>}
                          {conn.status === 'pending_oauth' && <span className="flex items-center gap-1 text-[10px] uppercase font-bold text-blue-600 dark:text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full">Pending Setup</span>}
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-3">
                          <span>{conn.doc_count || 0} documents ingested</span>
                          {conn.latest_sync?.completed_at && (
                            <>
                              <span className="text-slate-300 dark:text-slate-605">•</span>
                              <span>Last sync: {new Date(conn.latest_sync.completed_at).toLocaleString()}</span>
                            </>
                          )}
                        </p>
                      </div>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex items-center gap-2">
                      {conn.provider === 'github' && (
                        <button
                          onClick={() => handleSync(conn.id)}
                          disabled={conn.status === 'syncing'}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-white/10 text-xs font-medium text-slate-605 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 hover:text-slate-900 hover:dark:text-white transition-colors disabled:opacity-50"
                        >
                          <RefreshCw className={`h-3.5 w-3.5 ${conn.status === 'syncing' ? 'animate-spin' : ''}`} />
                          Sync
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(conn.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-rose-200 dark:border-rose-500/20 text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-500/5 dark:hover:bg-rose-500/10 transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Remove
                      </button>
                    </div>

                  </div>

                  {/* Sync Logs (if error or recent) */}
                  {conn.latest_sync?.logs && (
                    <div className="mt-4 pt-4 border-t border-slate-200 dark:border-white/5">
                      <p className="text-[10px] font-bold text-slate-450 dark:text-slate-550 uppercase tracking-wider mb-2">Latest Sync Logs</p>
                      <div className="bg-slate-100 dark:bg-slate-950 rounded-lg p-3 overflow-x-auto border border-slate-200/50 dark:border-none">
                        <pre className="text-[10px] text-slate-705 dark:text-slate-405 font-mono whitespace-pre-wrap">{conn.latest_sync.logs}</pre>
                      </div>
                    </div>
                  )}

                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* GitHub Connector Modal */}
      <AnimatePresence>
        {showGithubModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowGithubModal(false)}
              className="absolute inset-0 bg-slate-950/60 dark:bg-slate-950/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative w-full max-w-md overflow-hidden rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 p-6 shadow-2xl backdrop-blur-xl"
            >
              <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-emerald-500 to-cyan-500" />
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Github className="h-5 w-5 text-emerald-500 dark:text-emerald-400" />
                  Connect GitHub Repo
                </h3>
                <button
                  onClick={() => setShowGithubModal(false)}
                  className="rounded-lg p-1 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 hover:text-slate-900 hover:dark:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleCreateGithub} className="space-y-4">
                {modalError && (
                  <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-605 dark:text-rose-400">
                    {modalError}
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">Owner / Org</label>
                    <input
                      required
                      value={githubOwner}
                      onChange={e => setGithubOwner(e.target.value)}
                      placeholder="e.g. vercel"
                      className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-950/50 p-2.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:border-emerald-500 outline-none transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">Repository</label>
                    <input
                      required
                      value={githubRepo}
                      onChange={e => setGithubRepo(e.target.value)}
                      placeholder="e.g. next.js"
                      className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-950/50 p-2.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:border-emerald-500 outline-none transition-colors"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">Branch</label>
                  <input
                    value={githubBranch}
                    onChange={e => setGithubBranch(e.target.value)}
                    placeholder="main"
                    className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-950/50 p-2.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:border-emerald-500 outline-none transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">Personal Access Token (Optional)</label>
                  <input
                    type="password"
                    value={githubToken}
                    onChange={e => setGithubToken(e.target.value)}
                    placeholder="ghp_..."
                    className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-950/50 p-2.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:border-emerald-500 outline-none transition-colors"
                  />
                  <p className="text-[10px] text-slate-500 dark:text-slate-550 mt-1">Required only for private repositories.</p>
                </div>
                
                <div className="flex justify-end gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowGithubModal(false)}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={modalLoading || !githubOwner || !githubRepo}
                    className="flex items-center justify-center rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 px-4 py-2 text-xs font-semibold text-white shadow-md disabled:opacity-50"
                  >
                    {modalLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Connect & Sync'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
