'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';
import { api, Memory } from '@/lib/api';
import {
  Brain,
  Trash2,
  Plus,
  Lock,
  Globe,
  Loader2,
  Search,
  AlertTriangle,
  Info,
  ShieldCheck,
  Sparkles,
  ChevronRight,
  Database,
  ArrowRight
} from 'lucide-react';

export default function MemoryPage() {
  const { currentWorkspace, loading: authLoading } = useAuth();
  
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'user' | 'workspace'>('all');
  
  // Form states
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [newVisibility, setNewVisibility] = useState<'private' | 'workspace'>('private');
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState(false);

  useEffect(() => {
    if (currentWorkspace?.id) {
      loadMemories();
    } else {
      setMemories([]);
    }
  }, [currentWorkspace?.id]);

  const loadMemories = async () => {
    if (!currentWorkspace?.id) return;
    setLoading(true);
    try {
      const data = await api.listMemories(currentWorkspace.id);
      setMemories(data);
    } catch (err) {
      console.error("Failed to load memories", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateMemory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentWorkspace?.id || !newKey.trim() || !newValue.trim() || formLoading) return;

    setFormLoading(true);
    setFormError(null);
    setFormSuccess(false);

    try {
      const added = await api.createMemory(currentWorkspace.id, {
        memory_key: newKey.trim(),
        memory_value: newValue.trim(),
        visibility: newVisibility
      });
      
      setMemories(prev => [added, ...prev]);
      setNewKey('');
      setNewValue('');
      setFormSuccess(true);
      
      // Auto-hide success alert
      setTimeout(() => setFormSuccess(false), 3000);
    } catch (err: any) {
      setFormError(err.detail || 'Failed to manually write memory. Try again.');
    } finally {
      setFormLoading(false);
    }
  };

  const handleDeleteMemory = async (memoryId: string) => {
    if (!currentWorkspace?.id) return;
    if (!confirm("Are you sure you want to forget this memory? This cannot be undone.")) return;

    try {
      await api.deleteMemory(currentWorkspace.id, memoryId);
      setMemories(prev => prev.filter(m => m.id !== memoryId));
    } catch (err) {
      console.error("Failed to delete memory", err);
      alert("Error forgetting memory. Try again.");
    }
  };

  // Filter logic
  const filteredMemories = memories.filter((m) => {
    const matchesSearch = 
      m.memory_key.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.memory_value.toLowerCase().includes(searchQuery.toLowerCase());
      
    if (filterType === 'all') return matchesSearch;
    return matchesSearch && m.type === filterType;
  });

  if (authLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-white dark:bg-slate-955 text-slate-900 dark:text-white min-h-[calc(100vh-4rem)]">
        <Loader2 className="h-8 w-8 animate-spin text-cyan-500 dark:text-cyan-400" />
        <p className="mt-4 text-sm text-slate-655 dark:text-slate-400 font-medium">Authenticating secure context...</p>
      </div>
    );
  }

  if (!currentWorkspace) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-white dark:bg-slate-950 text-slate-900 dark:text-white min-h-[calc(100vh-4rem)] p-6">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full border border-slate-200 dark:border-white/5 bg-white/60 dark:bg-slate-900/40 rounded-3xl p-8 text-center backdrop-blur-md shadow-lg"
        >
          <div className="h-14 w-14 rounded-2xl bg-cyan-500/10 text-cyan-500 dark:text-cyan-400 flex items-center justify-center mx-auto mb-6">
            <Brain className="h-7 w-7" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">No Workspace Selected</h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-6 leading-relaxed">
            Choose an active workspace environment from the header menu to manage semantic memory profiles and AI facts.
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

      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 dark:border-white/10 pb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
              <Brain className="h-6 w-6 text-cyan-500 dark:text-cyan-400 animate-pulse" />
              Persistent Memory Manager
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
              Configure, audit, or disable AI semantic memories and user preferences in workspace: <span className="text-cyan-600 dark:text-cyan-400 font-semibold">{currentWorkspace.name}</span>
            </p>
          </div>
          
          <div className="flex items-center gap-2 rounded-xl bg-emerald-500/5 dark:bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
            <ShieldCheck className="h-4 w-4" />
            <span>Workspace Isolated</span>
          </div>
        </div>

        {/* Info Banner */}
        <div className="rounded-2xl border border-slate-200 dark:border-white/5 bg-white/60 dark:bg-slate-900/30 p-4 flex gap-3 text-xs text-slate-600 dark:text-slate-400 backdrop-blur-sm max-w-4xl leading-relaxed shadow-sm">
          <Info className="h-4 w-4 text-cyan-500 dark:text-cyan-400 shrink-0 mt-0.5" />
          <div>
            <p>
              <strong className="text-slate-800 dark:text-slate-200">How memory works:</strong> During agent chat sessions, SecureDoc Copilot dynamically extracts key parameters, preferences, and enterprise terminology using NVIDIA NIM classifiers. You can manually pre-seed keys below or delete any extracted data. User memories are private to you, while Workspace memories are shared with other members of the workspace.
            </p>
          </div>
        </div>

        {/* Content Layout Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Form Col: Add Memory */}
          <div className="lg:col-span-1">
            <div className="rounded-3xl border border-slate-200 dark:border-white/5 bg-white/60 dark:bg-slate-900/20 p-6 backdrop-blur-xl space-y-5 relative overflow-hidden shadow-xl">
              <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-cyan-500 to-violet-500" />
              
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Plus className="h-4.5 w-4.5 text-cyan-500 dark:text-cyan-400" />
                Pre-seed Memory
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Manually append custom criteria or domain facts to the cognitive layer.
              </p>

              <form onSubmit={handleCreateMemory} className="space-y-4">
                {formError && (
                  <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-500 dark:text-rose-400 flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    <span>{formError}</span>
                  </div>
                )}

                {formSuccess && (
                  <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 shrink-0" />
                    <span>Memory persisted successfully!</span>
                  </div>
                )}

                <div>
                  <label htmlFor="memory-key" className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                    Memory Key / Parameter
                  </label>
                  <input
                    id="memory-key"
                    type="text"
                    required
                    placeholder="e.g. Preferred Language, Coding Style"
                    value={newKey}
                    onChange={(e) => setNewKey(e.target.value)}
                    className="block w-full rounded-xl border border-slate-200 dark:border-white/5 bg-white/80 dark:bg-slate-955/50 py-2.5 px-3.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 outline-none ring-1 ring-transparent transition-all duration-300 focus:border-cyan-500 focus:ring-cyan-500/35"
                  />
                </div>

                <div>
                  <label htmlFor="memory-val" className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                    Memory Value / Fact description
                  </label>
                  <textarea
                    id="memory-val"
                    required
                    rows={3}
                    placeholder="e.g. Always write Python codes with clean docstrings and typing annotations."
                    value={newValue}
                    onChange={(e) => setNewValue(e.target.value)}
                    className="block w-full rounded-xl border border-slate-200 dark:border-white/5 bg-white/80 dark:bg-slate-950/50 py-2.5 px-3.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 outline-none ring-1 ring-transparent transition-all duration-300 focus:border-cyan-500 focus:ring-cyan-500/35 resize-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                    Visibility & Storage Scope
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setNewVisibility('private')}
                      className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl border text-xs font-semibold cursor-pointer transition-all ${
                        newVisibility === 'private'
                          ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-600 dark:text-cyan-400'
                          : 'bg-transparent border-slate-200 dark:border-white/5 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5'
                      }`}
                    >
                      <Lock className="h-3.5 w-3.5" />
                      <span>User Private</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewVisibility('workspace')}
                      className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl border text-xs font-semibold cursor-pointer transition-all ${
                        newVisibility === 'workspace'
                          ? 'bg-violet-500/10 border-violet-500/30 text-violet-600 dark:text-violet-400'
                          : 'bg-transparent border-slate-200 dark:border-white/5 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5'
                      }`}
                    >
                      <Globe className="h-3.5 w-3.5" />
                      <span>Workspace Shared</span>
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={formLoading || !newKey.trim() || !newValue.trim()}
                  className="w-full relative flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-600 to-violet-600 py-3 text-xs font-bold text-white shadow-md shadow-cyan-500/10 hover:shadow-violet-500/25 transition-all duration-300 cursor-pointer disabled:opacity-50"
                >
                  {formLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Sparkles className="h-3.5 w-3.5 animate-pulse" />
                      <span>Commit Fact to Agent</span>
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>

          {/* List Col: View & Filter Memories */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Toolbar */}
            <div className="flex flex-col sm:flex-row items-center gap-4 bg-white/40 dark:bg-slate-900/10 p-3 rounded-2xl border border-slate-200 dark:border-white/5 backdrop-blur-md">
              {/* Search Bar */}
              <div className="relative w-full sm:flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-slate-500" />
                <input
                  type="text"
                  placeholder="Filter memories by key or content..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-white/5 bg-white/60 dark:bg-slate-950/40 py-2.5 pl-10 pr-4 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 outline-none transition-all focus:border-cyan-500/40"
                />
              </div>

              {/* Filters */}
              <div className="flex items-center gap-1.5 self-start sm:self-auto">
                {(['all', 'user', 'workspace'] as const).map((type) => (
                  <button
                    key={type}
                    onClick={() => setFilterType(type)}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-semibold capitalize cursor-pointer transition-all ${
                      filterType === type
                        ? 'bg-white dark:bg-slate-800 border-slate-200 dark:border-white/10 text-cyan-600 dark:text-cyan-400 shadow-sm'
                        : 'bg-transparent border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                  >
                    {type === 'all' ? 'All Scope' : type === 'user' ? 'User' : 'Workspace'}
                  </button>
                ))}
              </div>
            </div>

            {/* List */}
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 space-y-3">
                <Loader2 className="h-8 w-8 animate-spin text-cyan-500 dark:text-cyan-400" />
                <p className="text-sm text-slate-500 dark:text-slate-400">Syncing cognitive profiles...</p>
              </div>
            ) : filteredMemories.length === 0 ? (
              <div className="rounded-3xl border border-slate-200 dark:border-white/5 bg-white/40 dark:bg-slate-900/10 p-12 text-center backdrop-blur-sm">
                <div className="h-12 w-12 rounded-xl bg-white/80 dark:bg-white/5 text-slate-400 dark:text-slate-500 flex items-center justify-center mx-auto mb-4">
                  <Database className="h-6 w-6" />
                </div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-1">No Memories Found</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto leading-relaxed">
                  {searchQuery 
                    ? "No memories match your active key or content filters." 
                    : "No persistent preferences are recorded. Chat normally to trigger automatic NIM extraction or pre-seed memory via the panel."}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <AnimatePresence mode="popLayout">
                  {filteredMemories.map((mem) => {
                    const isWorkspace = mem.type === 'workspace';
                    return (
                      <motion.div
                        key={mem.id}
                        layout
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.2 }}
                        className="rounded-2xl border border-slate-200 dark:border-white/5 bg-white/60 dark:bg-slate-900/30 p-4 flex flex-col justify-between backdrop-blur-md relative overflow-hidden group shadow-sm hover:border-slate-300 dark:hover:border-white/10 hover:bg-white/80 dark:hover:bg-slate-900/40 transition-all duration-300"
                      >
                        {/* Scope Indicator Glow */}
                        <div className={`absolute top-0 right-0 w-24 h-24 rounded-full blur-2xl pointer-events-none -z-10 opacity-30 ${
                          isWorkspace ? 'bg-violet-500/20' : 'bg-cyan-500/20'
                        }`} />

                        <div>
                          {/* Header */}
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors">
                              {mem.memory_key}
                            </span>
                            
                            {/* Scope Badge */}
                            <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider border shrink-0 ${
                              isWorkspace
                                ? 'bg-violet-500/10 border-violet-500/20 text-violet-600 dark:text-violet-400'
                                : 'bg-cyan-500/10 border-cyan-500/20 text-cyan-600 dark:text-cyan-400'
                            }`}>
                              {isWorkspace ? <Globe className="h-2.5 w-2.5" /> : <Lock className="h-2.5 w-2.5" />}
                              <span>{mem.type}</span>
                            </span>
                          </div>

                          {/* Fact Content */}
                          <p className="text-slate-600 dark:text-slate-300 text-xs leading-relaxed font-medium break-words">
                            {mem.memory_value}
                          </p>
                        </div>

                        {/* Footer details & delete button */}
                        <div className="flex items-center justify-between border-t border-slate-100 dark:border-white/5 pt-3 mt-4 text-[10px] text-slate-400 dark:text-slate-500">
                          <span className="flex items-center gap-1">
                            Added: {new Date(mem.created_at).toLocaleDateString(undefined, {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric'
                            })}
                          </span>
                          
                          <button
                            onClick={() => handleDeleteMemory(mem.id)}
                            className="p-1.5 rounded-lg bg-transparent hover:bg-rose-500/10 text-slate-400 dark:text-slate-500 hover:text-rose-500 dark:hover:text-rose-400 transition-colors cursor-pointer"
                            title="Delete Fact"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
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
