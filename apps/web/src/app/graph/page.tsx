'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';
import { api, KnowledgeTriple } from '@/lib/api';
import {
  Network,
  Search,
  Loader2,
  Database,
  ShieldCheck,
  Info,
  ArrowRight
} from 'lucide-react';

export default function GraphPage() {
  const { currentWorkspace, loading: authLoading } = useAuth();
  
  const [triples, setTriples] = useState<KnowledgeTriple[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (currentWorkspace?.id) {
      loadGraph();
    } else {
      setTriples([]);
    }
  }, [currentWorkspace?.id]);

  const loadGraph = async () => {
    if (!currentWorkspace?.id) return;
    setLoading(true);
    try {
      const data = await api.getWorkspaceGraph(currentWorkspace.id);
      setTriples(data);
    } catch (err) {
      console.error("Failed to load graph triples", err);
    } finally {
      setLoading(false);
    }
  };

  // Filter logic
  const filteredTriples = triples.filter((t) => {
    const query = searchQuery.toLowerCase();
    return (
      t.subject.toLowerCase().includes(query) ||
      t.predicate.toLowerCase().includes(query) ||
      t.object_entity.toLowerCase().includes(query)
    );
  });

  if (authLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-white dark:bg-slate-950 text-slate-800 dark:text-white min-h-[calc(100vh-4rem)] transition-colors duration-300">
        <Loader2 className="h-8 w-8 animate-spin text-cyan-500 dark:text-cyan-400" />
        <p className="mt-4 text-sm text-slate-500 dark:text-slate-400 font-medium">Authenticating secure context...</p>
      </div>
    );
  }

  if (!currentWorkspace) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-white dark:bg-slate-950 text-slate-800 dark:text-white min-h-[calc(100vh-4rem)] p-6 transition-colors duration-300">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full border border-slate-200 dark:border-white/5 bg-white/60 dark:bg-slate-900/40 rounded-3xl p-8 text-center backdrop-blur-md shadow-sm dark:shadow-none"
        >
          <div className="h-14 w-14 rounded-2xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 flex items-center justify-center mx-auto mb-6">
            <Network className="h-7 w-7" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">No Workspace Selected</h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-6 leading-relaxed">
            Choose an active workspace to view extracted knowledge graph relationships.
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 min-h-[calc(100vh-4rem)] py-8 px-4 sm:px-6 lg:px-8 relative transition-colors duration-300">
      {/* Ambient background glows */}
      <div className="absolute top-10 right-10 w-96 h-96 bg-cyan-500/[0.03] dark:bg-cyan-500/5 rounded-full blur-[100px] pointer-events-none -z-10" />
      <div className="absolute bottom-10 left-10 w-96 h-96 bg-violet-600/[0.03] dark:bg-violet-600/5 rounded-full blur-[100px] pointer-events-none -z-10" />

      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 dark:border-white/10 pb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
              <Network className="h-6 w-6 text-cyan-500 dark:text-cyan-400" />
              Knowledge Graph Explorer
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Visualize semantic relationships extracted by NVIDIA NIM in workspace: <span className="text-cyan-600 dark:text-cyan-400 font-semibold">{currentWorkspace.name}</span>
            </p>
          </div>
          
          <div className="flex items-center gap-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
            <ShieldCheck className="h-4 w-4" />
            <span>GraphRAG Enabled</span>
          </div>
        </div>

        {/* Info Banner */}
        <div className="rounded-2xl border border-slate-200 dark:border-white/5 bg-white/60 dark:bg-slate-900/30 p-4 flex gap-3 text-xs text-slate-600 dark:text-slate-400 backdrop-blur-sm max-w-4xl leading-relaxed">
          <Info className="h-4 w-4 text-cyan-500 dark:text-cyan-400 shrink-0 mt-0.5" />
          <div>
            <p>
              <strong className="text-slate-800 dark:text-slate-200">How GraphRAG works:</strong> During document ingestion, our AI models automatically extract structured Entity-Relationship Triples (Subject &rarr; Predicate &rarr; Object). During chat sessions, this knowledge graph is traversed to supplement vector search and answer complex, multi-hop reasoning questions.
            </p>
          </div>
        </div>

        {/* Toolbar */}
        <div className="relative overflow-hidden flex flex-col sm:flex-row items-center gap-4 bg-white/40 dark:bg-slate-900/10 p-3 rounded-2xl border border-slate-200 dark:border-white/5 backdrop-blur-md">
          {loading && (
            <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-cyan-500 to-transparent animate-scan" />
          )}
          <div className="relative w-full sm:flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-slate-500" />
            <input
              type="text"
              placeholder="Search entities or relationships..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-slate-200 dark:border-white/5 bg-white dark:bg-slate-950/40 py-2.5 pl-10 pr-4 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 outline-none transition-all focus:border-cyan-500/40"
            />
          </div>
          <div className="px-4 py-2 bg-white/60 dark:bg-slate-900/40 border border-slate-200 dark:border-white/5 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300">
            Total Triples: <span className="text-cyan-600 dark:text-cyan-400">{filteredTriples.length}</span>
          </div>
        </div>

        {/* Triples Data Grid */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-3">
            <Loader2 className="h-8 w-8 animate-spin text-cyan-500 dark:text-cyan-400" />
            <p className="text-sm text-slate-500 dark:text-slate-400">Querying semantic graph database...</p>
          </div>
        ) : filteredTriples.length === 0 ? (
          <div className="rounded-3xl border border-slate-200 dark:border-white/5 bg-white/40 dark:bg-slate-900/10 p-12 text-center backdrop-blur-sm">
            <div className="h-12 w-12 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-400 dark:text-slate-500 flex items-center justify-center mx-auto mb-4">
              <Database className="h-6 w-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-800 dark:text-white mb-1">No Relationships Found</h3>
            <p className="text-xs text-slate-500 dark:text-slate-500 max-w-sm mx-auto leading-relaxed">
              {searchQuery 
                ? "No triples match your search query." 
                : "No knowledge graph data has been extracted yet. Upload documents to automatically trigger extraction."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <AnimatePresence mode="popLayout">
              {filteredTriples.map((triple) => (
                <motion.div
                  key={triple.id}
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                  className="rounded-2xl border border-slate-200 dark:border-white/5 bg-white/40 dark:bg-slate-900/30 p-5 flex flex-col justify-between backdrop-blur-md relative overflow-hidden group shadow-sm hover:border-slate-300 dark:hover:border-white/10 hover:bg-white/60 dark:hover:bg-slate-900/40 transition-all duration-300"
                >
                  <div className="flex flex-col space-y-3 relative z-10">
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">Subject</span>
                      <span className="text-sm font-semibold text-cyan-600 dark:text-cyan-400 group-hover:text-cyan-500 dark:group-hover:text-cyan-300 transition-colors bg-cyan-500/10 dark:bg-cyan-400/10 px-2 py-1 rounded w-fit">{triple.subject}</span>
                    </div>
                    
                    <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                      <ArrowRight className="h-4 w-4" />
                      <span className="text-xs font-mono bg-slate-100 dark:bg-white/5 px-2 py-0.5 rounded border border-slate-200 dark:border-white/5">{triple.predicate}</span>
                    </div>
                    
                    <div className="flex flex-col items-end">
                      <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1 w-full text-right">Object</span>
                      <span className="text-sm font-semibold text-violet-600 dark:text-violet-400 group-hover:text-violet-500 dark:group-hover:text-violet-300 transition-colors bg-violet-500/10 dark:bg-violet-400/10 px-2 py-1 rounded w-fit">{triple.object_entity}</span>
                    </div>
                  </div>
                  
                  {/* Subtle linking line in background */}
                  <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-[1px] bg-gradient-to-r from-cyan-500/0 via-cyan-500/20 to-violet-500/0 -z-10" />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}

      </div>
    </div>
  );
}
