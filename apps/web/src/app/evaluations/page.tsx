'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';
import { api, EvaluationLog } from '@/lib/api';
import {
  LineChart,
  RefreshCw,
  Clock,
  CircleDollarSign,
  Cpu,
  BarChart3,
  Search,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  CheckCircle2,
  Gauge,
  HelpCircle,
  Code,
  Database,
  FileText,
  LayoutGrid,
  Sparkles,
  ArrowRight,
  TrendingUp,
  Brain,
  Award,
  Loader2
} from 'lucide-react';

const ROUTE_ICONS: Record<string, any> = {
  rag: Database,
  coding: Code,
  summary: FileText,
  compare: LayoutGrid,
  memory: Brain,
  general: HelpCircle,
  auto: Sparkles
};

const ROUTE_COLORS: Record<string, string> = {
  rag: 'text-violet-600 dark:text-violet-400 bg-violet-500/5 dark:bg-violet-400/10 border-violet-500/25',
  coding: 'text-amber-600 dark:text-amber-400 bg-amber-500/5 dark:bg-amber-400/10 border-amber-500/25',
  summary: 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/5 dark:bg-emerald-400/10 border-emerald-500/25',
  compare: 'text-pink-600 dark:text-pink-400 bg-pink-500/5 dark:bg-pink-400/10 border-pink-500/25',
  memory: 'text-cyan-600 dark:text-cyan-400 bg-cyan-500/5 dark:bg-cyan-400/10 border-cyan-500/25',
  general: 'text-slate-600 dark:text-slate-400 bg-slate-500/5 dark:bg-slate-400/10 border-slate-500/25'
};

export default function EvaluationsPage() {
  const { currentWorkspace, loading: authLoading } = useAuth();
  
  const [logs, setLogs] = useState<EvaluationLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRoute, setSelectedRoute] = useState<string>('all');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  useEffect(() => {
    if (currentWorkspace?.id) {
      loadLogs();
    } else {
      setLogs([]);
    }
  }, [currentWorkspace?.id]);

  const loadLogs = async () => {
    if (!currentWorkspace?.id) return;
    setLoading(true);
    try {
      const data = await api.listEvaluations(currentWorkspace.id);
      setLogs(data);
    } catch (err) {
      console.error("Failed to load evaluations log", err);
    } finally {
      setLoading(false);
    }
  };

  // Toggle log details drawer
  const toggleExpandLog = (id: string) => {
    setExpandedLogId(prev => (prev === id ? null : id));
  };

  // Filter logs
  const filteredLogs = logs.filter(log => {
    const matchesSearch = log.query?.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          log.model?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRoute = selectedRoute === 'all' || log.route === selectedRoute;
    return matchesSearch && matchesRoute;
  });

  // Calculate aggregates
  const logsWithEval = logs.filter(l => l.evaluation);
  const totalCount = logs.length;
  const evalCount = logsWithEval.length;

  const avgLatency = totalCount > 0 
    ? Math.round(logs.reduce((sum, l) => sum + (l.latency_ms || 0), 0) / totalCount) 
    : 0;

  const totalCost = logs.reduce((sum, l) => sum + (l.estimated_cost || 0), 0);

  const avgFaithfulness = evalCount > 0
    ? Math.round((logsWithEval.reduce((sum, l) => sum + (l.evaluation?.faithfulness || 0), 0) / evalCount) * 100)
    : 0;

  const avgRelevance = evalCount > 0
    ? Math.round((logsWithEval.reduce((sum, l) => sum + (l.evaluation?.relevance || 0), 0) / evalCount) * 100)
    : 0;

  const avgHallucination = evalCount > 0
    ? Math.round((logsWithEval.reduce((sum, l) => sum + (l.evaluation?.hallucination_risk || 0), 0) / evalCount) * 100)
    : 0;

  // Route breakdown distribution
  const routeBreakdown = logs.reduce((acc, log) => {
    const r = log.route || 'unknown';
    acc[r] = (acc[r] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  if (authLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-white dark:bg-slate-950 text-slate-900 dark:text-white min-h-[calc(100vh-4rem)]">
        <Loader2 className="h-8 w-8 animate-spin text-cyan-500 dark:text-cyan-400" />
        <p className="mt-4 text-sm text-slate-600 dark:text-slate-400 font-medium">Authenticating secure context...</p>
      </div>
    );
  }

  if (!currentWorkspace) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-white dark:bg-slate-950 text-slate-900 dark:text-white min-h-[calc(100vh-4rem)] p-6">
        <motion.div 
          initial={{ opacity: 0, scale: 0.955 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full border border-slate-200 dark:border-white/5 bg-white/60 dark:bg-slate-900/40 rounded-3xl p-8 text-center backdrop-blur-md shadow-lg"
        >
          <div className="h-14 w-14 rounded-2xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 flex items-center justify-center mx-auto mb-6">
            <LineChart className="h-7 w-7" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">No Workspace Selected</h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-6 leading-relaxed">
            Choose an active workspace environment from the header menu to examine evaluation scores and execution pipelines.
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 min-h-[calc(100vh-4rem)] py-8 px-4 sm:px-6 lg:px-8 relative transition-colors duration-300">
      {/* Ambient background glows */}
      <div className="absolute top-10 right-10 w-96 h-96 bg-cyan-500/5 rounded-full blur-[100px] pointer-events-none -z-10" />
      <div className="absolute bottom-10 left-10 w-96 h-96 bg-violet-600/5 rounded-full blur-[100px] pointer-events-none -z-10" />

      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 dark:border-white/10 pb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
              <LineChart className="h-6 w-6 text-cyan-500 dark:text-cyan-400 animate-pulse" />
              RAG Evaluation & Telemetry Analytics
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
              Live audit logs of intent classifications, token usage, latency averages, and NVIDIA NIM RAG precision models.
            </p>
          </div>
          
          <button
            onClick={loadLogs}
            disabled={loading}
            className="flex items-center gap-2 rounded-xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/5 px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10 transition-all cursor-pointer disabled:opacity-50 shadow-sm"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh Diagnostics</span>
          </button>
        </div>

        {/* Aggregates Dashboard Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {/* Card 1: Latency */}
          <div className="rounded-2xl border border-slate-200 dark:border-white/5 bg-white/60 dark:bg-slate-900/30 p-5 backdrop-blur-md relative overflow-hidden group shadow-sm">
            <div className="absolute top-0 right-0 w-20 h-20 bg-cyan-500/5 rounded-full blur-xl pointer-events-none" />
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span>Avg NIM Response Latency</span>
              <div className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-600 dark:text-cyan-400">
                <Clock className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3 text-3xl font-extrabold text-slate-900 dark:text-white">{avgLatency} ms</div>
            <div className="mt-1.5 text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
              <TrendingUp className="h-3 w-3 text-cyan-500 dark:text-cyan-400" />
              <span>Calculated across {totalCount} execution logs.</span>
            </div>
          </div>

          {/* Card 2: Faithfulness */}
          <div className="rounded-2xl border border-slate-200 dark:border-white/5 bg-white/60 dark:bg-slate-900/30 p-5 backdrop-blur-md relative overflow-hidden group shadow-sm">
            <div className="absolute top-0 right-0 w-20 h-20 bg-emerald-500/5 rounded-full blur-xl pointer-events-none" />
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span>Avg Answer Faithfulness</span>
              <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3 text-3xl font-extrabold text-emerald-600 dark:text-emerald-400">{avgFaithfulness}%</div>
            <div className="mt-1.5 text-[10px] text-slate-500 dark:text-slate-400">
              Target requirement threshold is &gt;80%.
            </div>
          </div>

          {/* Card 3: Relevance */}
          <div className="rounded-2xl border border-slate-200 dark:border-white/5 bg-white/60 dark:bg-slate-900/30 p-5 backdrop-blur-md relative overflow-hidden group shadow-sm">
            <div className="absolute top-0 right-0 w-20 h-20 bg-violet-500/5 rounded-full blur-xl pointer-events-none" />
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span>Avg Context Relevance</span>
              <div className="p-1.5 rounded-lg bg-violet-500/10 text-violet-600 dark:text-violet-400">
                <Award className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3 text-3xl font-extrabold text-violet-600 dark:text-violet-400">{avgRelevance}%</div>
            <div className="mt-1.5 text-[10px] text-slate-500 dark:text-slate-400">
              Retrieval chunk relevance score index.
            </div>
          </div>

          {/* Card 4: Billing Cost */}
          <div className="rounded-2xl border border-slate-200 dark:border-white/5 bg-white/60 dark:bg-slate-900/30 p-5 backdrop-blur-md relative overflow-hidden group shadow-sm">
            <div className="absolute top-0 right-0 w-20 h-20 bg-pink-500/5 rounded-full blur-xl pointer-events-none" />
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span>Estimated NIM Run Costs</span>
              <div className="p-1.5 rounded-lg bg-pink-500/10 text-pink-600 dark:text-pink-400">
                <CircleDollarSign className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3 text-3xl font-extrabold text-pink-600 dark:text-pink-400">${totalCost.toFixed(5)}</div>
            <div className="mt-1.5 text-[10px] text-slate-500 dark:text-slate-400">
              Mock tokens conversion estimated index.
            </div>
          </div>
        </div>

        {/* Breakdown Analysis Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left Column: Route breakdown & NIM status */}
          <div className="lg:col-span-1 space-y-6">
            
            {/* Route Intent Distribution */}
            <div className="rounded-3xl border border-slate-200 dark:border-white/5 bg-white/60 dark:bg-slate-900/20 p-6 backdrop-blur-xl space-y-4 shadow-sm">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <BarChart3 className="h-4.5 w-4.5 text-cyan-500 dark:text-cyan-400" />
                Route Intent Distribution
              </h3>
              
              <div className="space-y-3.5 pt-2">
                {Object.keys(ROUTE_ICONS).filter(r => r !== 'auto').map((route) => {
                  const count = routeBreakdown[route] || 0;
                  const pct = totalCount > 0 ? Math.round((count / totalCount) * 100) : 0;
                  const Icon = ROUTE_ICONS[route];
                  
                  return (
                    <div key={route} className="text-xs">
                      <div className="flex items-center justify-between text-[11px] font-semibold mb-1">
                        <span className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 capitalize">
                          <Icon className="h-3.5 w-3.5 shrink-0" />
                          {route === 'rag' ? 'Document RAG' : route === 'general' ? 'Chitchat' : route}
                        </span>
                        <span className="text-slate-700 dark:text-slate-300 font-bold">{count} runs ({pct}%)</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-white/5 overflow-hidden">
                        <div 
                          className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-violet-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
                {totalCount === 0 && (
                  <div className="text-xs text-slate-500 dark:text-slate-400 text-center py-4">No route breakdowns recorded.</div>
                )}
              </div>
            </div>

            {/* Quality Summary Info */}
            <div className="rounded-3xl border border-slate-200 dark:border-white/5 bg-white/60 dark:bg-slate-900/20 p-6 backdrop-blur-xl space-y-4 shadow-sm">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Gauge className="h-4.5 w-4.5 text-cyan-500 dark:text-cyan-400" />
                Evaluator Metrics Info
              </h3>
              
              <div className="space-y-3 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                <div>
                  <h4 className="font-bold text-slate-800 dark:text-slate-200 mb-0.5">Answer Faithfulness</h4>
                  <p>Measures how well the assistant answers are fully grounded in the retrieved documents without hallucination. Standard threshold limit is 80%.</p>
                </div>
                <div>
                  <h4 className="font-bold text-slate-800 dark:text-slate-200 mb-0.5">Context Relevance</h4>
                  <p>Measures the precise applicability and retrieval accuracy of the documents extracted from Qdrant corresponding to the query.</p>
                </div>
                <div>
                  <h4 className="font-bold text-slate-800 dark:text-slate-200 mb-0.5">Hallucination Risk</h4>
                  <p>Represents the risk level of LLM fabrications. Calculated dynamically using NIM evaluation prompting algorithms.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Execution History Log */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Search & Filter Toolbar */}
            <div className="flex flex-col sm:flex-row items-center gap-4 bg-white/40 dark:bg-slate-900/10 p-3 rounded-2xl border border-slate-200 dark:border-white/5 backdrop-blur-md shadow-sm">
              <div className="relative w-full sm:flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-slate-500" />
                <input
                  type="text"
                  placeholder="Filter logs by query text or models..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-white/5 bg-white/60 dark:bg-slate-950/40 py-2.5 pl-10 pr-4 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 outline-none transition-all focus:border-cyan-500/40"
                />
              </div>

              <div className="flex items-center gap-1.5 shrink-0 self-start sm:self-auto">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Route:</span>
                <select
                  value={selectedRoute}
                  onChange={(e) => setSelectedRoute(e.target.value)}
                  className="rounded-xl border border-slate-200 dark:border-white/5 bg-white dark:bg-slate-950/50 py-2 px-3 text-xs text-slate-700 dark:text-slate-300 outline-none cursor-pointer focus:border-cyan-500/30"
                >
                  <option value="all">All Routes</option>
                  <option value="rag">Document RAG</option>
                  <option value="coding">Coding</option>
                  <option value="summary">Summary</option>
                  <option value="compare">Compare</option>
                  <option value="memory">Memory</option>
                  <option value="general">Chitchat</option>
                </select>
              </div>
            </div>

            {/* List of executions */}
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 space-y-3">
                <Loader2 className="h-8 w-8 animate-spin text-cyan-500 dark:text-cyan-400" />
                <p className="text-sm text-slate-500 dark:text-slate-400">Loading telemetry logs...</p>
              </div>
            ) : filteredLogs.length === 0 ? (
              <div className="rounded-3xl border border-slate-200 dark:border-white/5 bg-white/40 dark:bg-slate-900/10 p-12 text-center backdrop-blur-sm">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-1">No Evaluation Logs</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto leading-relaxed">
                  {searchQuery 
                    ? "No executions match your active query or route selection."
                    : "No evaluations are registered. Chat with the agent in any session to record live metrics."}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <AnimatePresence mode="popLayout">
                  {filteredLogs.map((log) => {
                    const isExpanded = expandedLogId === log.run_id;
                    const RouteIcon = ROUTE_ICONS[log.route || 'general'] || HelpCircle;
                    const hasEval = !!log.evaluation;
                    
                    return (
                      <motion.div
                        key={log.run_id}
                        layout
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="rounded-2xl border border-slate-200 dark:border-white/5 bg-white/60 dark:bg-slate-900/30 backdrop-blur-md overflow-hidden transition-all duration-300 hover:border-slate-300 dark:hover:border-white/10 shadow-sm"
                      >
                        {/* Summary Header bar */}
                        <div
                          onClick={() => toggleExpandLog(log.run_id)}
                          className="p-4 flex items-center justify-between gap-4 cursor-pointer select-none"
                        >
                          <div className="flex items-center gap-3 overflow-hidden min-w-0 flex-1">
                            {/* Route Badge icon */}
                            <div className={`p-2 rounded-xl border shrink-0 ${ROUTE_COLORS[log.route || 'general'] || 'text-slate-600 bg-slate-100 border-slate-200 dark:text-slate-400 dark:bg-white/5 dark:border-white/5'}`}>
                              <RouteIcon className="h-4 w-4" />
                            </div>
                            
                            {/* Query text */}
                            <div className="truncate min-w-0 flex-1">
                              <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate pr-4">
                                {log.query}
                              </p>
                              <div className="flex items-center gap-2 text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                                <span className="truncate">{log.model?.replace('nvidia/', '') || 'NIM Model'}</span>
                                <span>•</span>
                                <span>{log.latency_ms} ms</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-4 shrink-0">
                            {/* Mini score indicators */}
                            {hasEval && log.evaluation && (
                              <div className="hidden sm:flex items-center gap-3 text-[10px] font-bold">
                                <div className="text-center">
                                  <span className="text-slate-500 dark:text-slate-400 block text-[9px] font-normal uppercase">Faith</span>
                                  <span className={log.evaluation.faithfulness && log.evaluation.faithfulness >= 0.8 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>
                                    {Math.round((log.evaluation.faithfulness || 0) * 100)}%
                                  </span>
                                </div>
                                <div className="text-center">
                                  <span className="text-slate-500 dark:text-slate-400 block text-[9px] font-normal uppercase">Relev</span>
                                  <span className={log.evaluation.relevance && log.evaluation.relevance >= 0.8 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>
                                    {Math.round((log.evaluation.relevance || 0) * 100)}%
                                  </span>
                                </div>
                              </div>
                            )}

                            {isExpanded ? <ChevronUp className="h-4 w-4 text-slate-500 dark:text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-500 dark:text-slate-400" />}
                          </div>
                        </div>

                        {/* Collapsible details Drawer */}
                        {isExpanded && (
                           <motion.div
                             initial={{ height: 0, opacity: 0 }}
                             animate={{ height: 'auto', opacity: 1 }}
                             exit={{ height: 0, opacity: 0 }}
                             transition={{ duration: 0.2 }}
                             className="border-t border-slate-100 dark:border-white/5 bg-white/50 dark:bg-slate-950/40 p-4 text-xs space-y-4"
                           >
                            {/* Telemetry metadata Grid */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
                              <div className="rounded-xl border border-slate-200 dark:border-white/5 bg-white/80 dark:bg-white/5 p-2.5">
                                <span className="text-[10px] text-slate-500 dark:text-slate-400 block uppercase font-bold">Estimated Cost</span>
                                <span className="text-emerald-600 dark:text-emerald-400 font-bold text-sm mt-0.5 block">${log.estimated_cost?.toFixed(5)}</span>
                              </div>
                              <div className="rounded-xl border border-slate-200 dark:border-white/5 bg-white/80 dark:bg-white/5 p-2.5">
                                <span className="text-[10px] text-slate-500 dark:text-slate-400 block uppercase font-bold">Total Tokens</span>
                                <span className="text-slate-800 dark:text-slate-200 font-bold text-sm mt-0.5 block">{(log.prompt_tokens || 0) + (log.completion_tokens || 0)}</span>
                              </div>
                              <div className="rounded-xl border border-slate-200 dark:border-white/5 bg-white/80 dark:bg-white/5 p-2.5">
                                <span className="text-[10px] text-slate-500 dark:text-slate-400 block uppercase font-bold">Prompt Tokens</span>
                                <span className="text-slate-700 dark:text-slate-300 font-semibold text-xs mt-0.5 block">{log.prompt_tokens}</span>
                              </div>
                              <div className="rounded-xl border border-slate-200 dark:border-white/5 bg-white/80 dark:bg-white/5 p-2.5">
                                <span className="text-[10px] text-slate-500 dark:text-slate-400 block uppercase font-bold">Completion Tokens</span>
                                <span className="text-slate-700 dark:text-slate-300 font-semibold text-xs mt-0.5 block">{log.completion_tokens}</span>
                              </div>
                            </div>

                            {/* Full score detail parameters */}
                            <div>
                              <h4 className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2.5">
                                NVIDIA NIM Quality Evaluators Breakdown
                              </h4>
                              
                              {hasEval && log.evaluation ? (
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                  {/* Faithfulness */}
                                  <div>
                                    <div className="flex justify-between text-[11px] mb-1 font-semibold">
                                      <span className="text-slate-500 dark:text-slate-400">Faithfulness</span>
                                      <span className="text-emerald-600 dark:text-emerald-400">{Math.round((log.evaluation.faithfulness || 0) * 100)}%</span>
                                    </div>
                                    <div className="h-1.5 w-full rounded-full bg-slate-200/50 dark:bg-white/5 overflow-hidden">
                                      <div 
                                        className="h-full rounded-full bg-emerald-500" 
                                        style={{ width: `${(log.evaluation.faithfulness || 0) * 100}%` }}
                                      />
                                    </div>
                                  </div>

                                  {/* Relevance */}
                                  <div>
                                    <div className="flex justify-between text-[11px] mb-1 font-semibold">
                                      <span className="text-slate-500 dark:text-slate-400">Context Relevance</span>
                                      <span className="text-cyan-600 dark:text-cyan-400">{Math.round((log.evaluation.relevance || 0) * 100)}%</span>
                                    </div>
                                    <div className="h-1.5 w-full rounded-full bg-slate-200/50 dark:bg-white/5 overflow-hidden">
                                      <div 
                                        className="h-full rounded-full bg-cyan-500" 
                                        style={{ width: `${(log.evaluation.relevance || 0) * 100}%` }}
                                      />
                                    </div>
                                  </div>

                                  {/* Hallucination */}
                                  <div>
                                    <div className="flex justify-between text-[11px] mb-1 font-semibold">
                                      <span className="text-slate-500 dark:text-slate-400">Hallucination Risk</span>
                                      <span className={log.evaluation.hallucination_risk && log.evaluation.hallucination_risk > 0.2 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-500 dark:text-slate-400'}>
                                        {Math.round((log.evaluation.hallucination_risk || 0) * 100)}%
                                      </span>
                                    </div>
                                    <div className="h-1.5 w-full rounded-full bg-slate-200/50 dark:bg-white/5 overflow-hidden">
                                      <div 
                                        className={`h-full rounded-full ${
                                          log.evaluation.hallucination_risk && log.evaluation.hallucination_risk > 0.2 ? 'bg-rose-500' : 'bg-slate-400 dark:bg-slate-500'
                                        }`}
                                        style={{ width: `${(log.evaluation.hallucination_risk || 0) * 100}%` }}
                                      />
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-normal">
                                  No RAG metrics parsed for this route. RAG evaluations are only triggered on Document RAG pathway logs to check context faithfulness scores.
                                </p>
                              )}
                            </div>

                            {/* Run Time Stamp & UUID */}
                            <div className="pt-2 border-t border-slate-100 dark:border-white/5 flex items-center justify-between text-[9px] text-slate-400 dark:text-slate-500">
                              <span>Run ID: {log.run_id}</span>
                              <span>Timestamp: {new Date(log.created_at).toLocaleString()}</span>
                            </div>
                          </motion.div>
                        )}
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            )}
            
          </div>
          
        </div>

      </div>
    </div>
  );
}
