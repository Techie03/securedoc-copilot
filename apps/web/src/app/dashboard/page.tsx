'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { 
  FolderLock, 
  MessageSquare, 
  Database, 
  Brain, 
  BarChart2, 
  ArrowRight, 
  Plus, 
  Users, 
  FileText,
  Clock,
  CircleDollarSign,
  Loader2,
  X,
  Sparkles,
  Link as LinkIcon,
  Network
} from 'lucide-react';
import TokenFlowChart from '@/components/analytics/TokenFlowChart';
import EvaluationRadar from '@/components/analytics/EvaluationRadar';
import SemanticDensityChart from '@/components/analytics/SemanticDensityChart';

const navigationGrid = [
  { title: 'Agent RAG Chat', href: '/chat', desc: 'Secure document-grounded AI search and multi-route assistant.', icon: MessageSquare, color: 'hover:border-violet-500/40 text-violet-500 bg-violet-500/10' },
  { title: 'Knowledge Graph', href: '/graph', desc: 'Explore extracted entity-relationship triples visually.', icon: Network, color: 'hover:border-indigo-500/40 text-indigo-500 bg-indigo-500/10' },
  { title: 'Data Connectors', href: '/connectors', desc: 'Connect GitHub, Google Drive, and other external data sources.', icon: LinkIcon, color: 'hover:border-emerald-500/40 text-emerald-500 bg-emerald-500/10' },
  { title: 'Ingested Documents', href: '/documents', desc: 'Upload, parse, chunk, and index PDFs, DOCX, CSVs into Qdrant.', icon: Database, color: 'hover:border-blue-500/40 text-blue-500 bg-blue-500/10' },
  { title: 'Memory Manager', href: '/memory', desc: 'Edit or disable user-level and workspace-level semantic memory.', icon: Brain, color: 'hover:border-cyan-500/40 text-cyan-500 bg-cyan-500/10' },
  { title: 'Evaluation Analytics', href: '/evaluations', desc: 'Inspect citation correctness, faithfulness scores, and model latency.', icon: BarChart2, color: 'hover:border-pink-500/40 text-pink-500 bg-pink-500/10' },
];

export default function Dashboard() {
  const { user, workspaces, currentWorkspace, selectWorkspace, createWorkspace, loading } = useAuth();
  
  // Dashboard local modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWorkspaceName.trim()) return;
    setModalLoading(true);
    setModalError(null);
    try {
      await createWorkspace(newWorkspaceName);
      setShowCreateModal(false);
      setNewWorkspaceName('');
    } catch (err: any) {
      setModalError(err.detail || 'Failed to create workspace.');
    } finally {
      setModalLoading(false);
    }
  };

  if (loading || !user) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-white dark:bg-slate-950 text-slate-900 dark:text-white min-h-[calc(100vh-4rem)]">
        <Loader2 className="h-8 w-8 animate-spin text-cyan-500 dark:text-cyan-400" />
        <p className="mt-4 text-sm text-slate-500 dark:text-slate-400 font-medium">Loading secure session data...</p>
      </div>
    );
  }

  const stats = [
    { label: 'Total Workspaces', value: workspaces.length.toString(), icon: FolderLock, color: 'text-cyan-500 bg-cyan-500/10' },
    { label: 'Indexed Documents', value: '0', icon: FileText, color: 'text-violet-500 bg-violet-500/10' },
    { label: 'Avg NIM Latency', value: '185 ms', icon: Clock, color: 'text-amber-500 bg-amber-500/10' },
    { label: 'Evaluation Score', value: '98.2%', icon: BarChart2, color: 'text-emerald-500 bg-emerald-500/10' },
  ];

  return (
    <div className="relative min-h-[calc(100vh-4rem)] py-8 px-4 sm:px-6 lg:px-8 w-full flex flex-col">
      {/* Subtle background glow */}
      <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl -z-10" />
      <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-96 h-96 bg-violet-600/5 rounded-full blur-3xl -z-10" />

      <div className="mx-auto max-w-7xl w-full flex-1 flex flex-col">
        {/* Welcome Section */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 dark:border-white/10 pb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
              Welcome back, <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-600 to-violet-600 dark:from-cyan-400 dark:to-violet-400">{user.full_name}</span>
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-2 mt-1">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              System status is healthy. All intelligence nodes running exclusively on NVIDIA NIM.
            </p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-cyan-600 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-violet-500/15 hover:shadow-cyan-500/20 transition-all duration-300 cursor-pointer w-fit"
          >
            <Plus className="h-4 w-4" />
            <span>New Workspace</span>
          </button>
        </div>

        {/* Stats Section */}
        <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat, idx) => {
            const Icon = stat.icon;
            return (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="overflow-hidden rounded-2xl border border-slate-200/50 dark:border-white/5 bg-white/70 dark:bg-slate-900/40 p-5 backdrop-blur-md shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-500 dark:text-slate-400">{stat.label}</span>
                  <div className={`p-2 rounded-lg ${stat.color}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                </div>
                <div className="mt-2 text-3xl font-bold text-slate-900 dark:text-white">{stat.value}</div>
              </motion.div>
            );
          })}
        </div>

        {/* Main Grid */}
        <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-3 flex-1">
          
          {/* Left 2 Cols: Navigation & Workspaces */}
          <div className="lg:col-span-2 flex flex-col gap-8">
            
            {/* Quick Actions Grid */}
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Quick Navigation</h2>
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                {navigationGrid.map((item, idx) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={idx}
                      href={item.href}
                      className={`group flex items-start gap-4 rounded-2xl border border-slate-200/60 dark:border-white/5 bg-white/80 dark:bg-slate-900/30 p-5 backdrop-blur-md transition-all duration-300 hover:border-slate-300 hover:bg-white/95 dark:hover:bg-slate-900/45 dark:hover:border-white/10 shadow-sm shadow-slate-100/30 dark:shadow-none hover:shadow-md`}
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 group-hover:bg-gradient-to-tr group-hover:from-cyan-500 group-hover:to-violet-500 group-hover:text-white transition-all duration-300">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1">
                          {item.title}
                          <ArrowRight className="h-3 w-3 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300" />
                        </h3>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 leading-normal">{item.desc}</p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>

            {/* Workspaces List */}
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Active Workspaces</h2>
              <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200/50 dark:border-white/5 bg-white/80 dark:bg-slate-900/30 backdrop-blur-md shadow-sm">
                <div className="divide-y divide-slate-200/50 dark:divide-white/5">
                  {workspaces.map((ws) => (
                    <div 
                      key={ws.id} 
                      onClick={() => selectWorkspace(ws)}
                      className={`flex items-center justify-between p-4 hover:bg-slate-100/50 dark:hover:bg-slate-900/60 transition-colors cursor-pointer ${
                        currentWorkspace?.id === ws.id ? 'bg-cyan-500/5 border-l-2 border-cyan-500' : ''
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`h-8 w-8 rounded-lg flex items-center justify-center border transition-colors ${
                          currentWorkspace?.id === ws.id 
                            ? 'bg-cyan-500/10 border-cyan-500/30' 
                            : 'bg-slate-100 dark:bg-white/5 border-gray-200 dark:border-white/5'
                        }`}>
                          <FolderLock className={`h-4 w-4 ${
                            currentWorkspace?.id === ws.id ? 'text-cyan-500 dark:text-cyan-400' : 'text-slate-500 dark:text-slate-400'
                          }`} />
                        </div>
                        <div>
                          <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                            {ws.name}
                            {ws.owner_id === user.id && (
                              <span className="inline-flex items-center rounded bg-cyan-500/10 px-1 py-0.5 text-[9px] font-semibold text-cyan-600 dark:text-cyan-400">
                                Owner
                              </span>
                            )}
                          </h3>
                          <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                            <span className="flex items-center gap-0.5"><FileText className="h-3 w-3" /> 0 docs</span>
                            <span>•</span>
                            <span className="flex items-center gap-0.5"><Users className="h-3 w-3" /> 1 member</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          {currentWorkspace?.id === ws.id ? 'Currently Selected' : 'Switch Workspace'}
                        </span>
                        <div className="rounded-lg p-1.5 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors">
                          <ArrowRight className={`h-4 w-4 ${
                            currentWorkspace?.id === ws.id ? 'text-cyan-500 dark:text-cyan-400' : 'text-slate-400'
                          }`} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

          </div>

          {/* Right Col: Operations Telemetry */}
          <div className="flex flex-col gap-6">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Diagnostics</h2>
              <div className="rounded-2xl border border-slate-200/50 dark:border-white/5 bg-white/80 dark:bg-slate-900/40 p-5 backdrop-blur-md shadow-sm">
              <div className="flex items-center gap-2">
                <CircleDollarSign className="h-4 w-4 text-emerald-500 dark:text-emerald-400 animate-pulse" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Cost & Token Ingestion</h3>
              </div>
              <div className="mt-4 space-y-3.5">
                <div>
                  <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400">
                    <span>Input Tokens (This Month)</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-300">0</span>
                  </div>
                  <div className="mt-1 h-1.5 w-full rounded-full bg-slate-100 dark:bg-white/5">
                    <div className="h-full w-0 rounded-full bg-violet-600" />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400">
                    <span>Output Tokens (This Month)</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-300">0</span>
                  </div>
                  <div className="mt-1 h-1.5 w-full rounded-full bg-slate-100 dark:bg-white/5">
                    <div className="h-full w-0 rounded-full bg-cyan-500" />
                  </div>
                </div>
                <div className="pt-2 border-t border-slate-200/50 dark:border-white/5 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                  <span>Estimated NIM Billing:</span>
                  <span className="font-bold text-emerald-500 dark:text-emerald-400">$0.00</span>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200/50 dark:border-white/5 bg-white/80 dark:bg-slate-900/40 p-5 backdrop-blur-md shadow-sm">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Active NIM Model Nodes</h3>
              <div className="mt-4 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500 dark:text-slate-400">nvidia/llama-3.1-nemotron-70b-instruct</span>
                  <span className="inline-flex items-center gap-1 rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-500">Active</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500 dark:text-slate-400">nvidia/nv-embedqa-e5-v5</span>
                  <span className="inline-flex items-center gap-1 rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-500">Active</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500 dark:text-slate-400">nvidia/nv-rerankqa-mistral-4b-v3</span>
                  <span className="inline-flex items-center gap-1 rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-500">Active</span>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* Neural Analytics Console */}
        <div className="mt-12 mb-8">
          <div className="flex items-center gap-2 mb-6">
            <Sparkles className="h-5 w-5 text-cyan-500" />
            <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">Neural Analytics Console</h2>
          </div>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Token Flow */}
            <div className="rounded-2xl border border-slate-200/50 dark:border-white/5 bg-white/70 dark:bg-slate-900/40 p-5 backdrop-blur-md shadow-sm flex flex-col">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4">Live Token Inference Flow</h3>
              <div className="flex-1 min-h-[250px]">
                <TokenFlowChart />
              </div>
            </div>
            {/* Evaluation Radar */}
            <div className="rounded-2xl border border-slate-200/50 dark:border-white/5 bg-white/70 dark:bg-slate-900/40 p-5 backdrop-blur-md shadow-sm flex flex-col">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4">Agent Performance Metrics</h3>
              <div className="flex-1 min-h-[250px]">
                <EvaluationRadar />
              </div>
            </div>
            {/* Semantic Density */}
            <div className="rounded-2xl border border-slate-200/50 dark:border-white/5 bg-white/70 dark:bg-slate-900/40 p-5 backdrop-blur-md shadow-sm flex flex-col">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4">Semantic Density Vector Space</h3>
              <div className="flex-1 min-h-[250px]">
                <SemanticDensityChart />
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Futuristic Local Workspace Creation Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Dark Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowCreateModal(false)}
              className="absolute inset-0 bg-slate-950/40 dark:bg-slate-950/80 backdrop-blur-sm"
            />

            {/* Modal Body */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative w-full max-w-md overflow-hidden rounded-3xl border border-gray-200 dark:border-white/5 bg-white dark:bg-slate-900 p-6 shadow-2xl backdrop-blur-xl"
            >
              {/* Subtle top neon line */}
              <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-cyan-500 to-violet-500" />

              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <FolderLock className="h-5 w-5 text-cyan-500 dark:text-cyan-400" />
                  Create New Workspace
                </h3>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="rounded-lg p-1 text-slate-400 hover:bg-gray-100 hover:text-slate-900 dark:hover:bg-white/5 dark:hover:text-white transition-colors cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleCreateWorkspace} className="space-y-4">
                {modalError && (
                  <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-500 dark:text-rose-400">
                    {modalError}
                  </div>
                )}

                <div>
                  <label htmlFor="dashboard-ws-name" className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                    Workspace Name
                  </label>
                  <input
                    id="dashboard-ws-name"
                    type="text"
                    required
                    placeholder="e.g. Legal Audits, Team Project"
                    value={newWorkspaceName}
                    onChange={(e) => setNewWorkspaceName(e.target.value)}
                    className="block w-full rounded-xl border border-gray-200 dark:border-white/5 bg-gray-50 dark:bg-slate-950/50 py-2.5 px-3 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 outline-none ring-1 ring-transparent transition-all duration-300 focus:border-cyan-500 focus:ring-cyan-500/30"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="rounded-xl border border-gray-200 dark:border-white/5 bg-transparent px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-white/5 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={modalLoading || !newWorkspaceName.trim()}
                    className="relative flex items-center justify-center rounded-xl bg-gradient-to-r from-cyan-500 to-violet-600 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-cyan-500/15 disabled:opacity-50 cursor-pointer"
                  >
                    {modalLoading ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      'Initialize Workspace'
                    )}
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
