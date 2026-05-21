'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';
import { api, ChatSession, ChatMessage, Memory } from '@/lib/api';
import {
  MessageSquare,
  Plus,
  Trash2,
  Send,
  Loader2,
  Sparkles,
  Database,
  Brain,
  Code,
  FileText,
  HelpCircle,
  Clock,
  CircleDollarSign,
  Gauge,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Bookmark,
  ChevronRight,
  Info,
  LineChart,
  LayoutGrid
} from 'lucide-react';

const MODE_CONFIGS = [
  { value: 'auto', label: 'Auto (Nemotron Intent Router)', icon: Sparkles, color: 'text-cyan-400 bg-cyan-400/10' },
  { value: 'rag', label: 'Document RAG', icon: Database, color: 'text-violet-400 bg-violet-400/10' },
  { value: 'coding', label: 'Coding Assistant', icon: Code, color: 'text-amber-400 bg-amber-400/10' },
  { value: 'summary', label: 'Summarizer', icon: FileText, color: 'text-emerald-400 bg-emerald-400/10' },
  { value: 'compare', label: 'Document Compare', icon: LayoutGrid, color: 'text-pink-400 bg-pink-400/10' },
  { value: 'general', label: 'General / Chitchat', icon: HelpCircle, color: 'text-slate-400 bg-slate-400/10' }
];

export default function ChatPage() {
  const { currentWorkspace, loading: authLoading } = useAuth();
  
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSession, setActiveSession] = useState<ChatSession | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [memories, setMemories] = useState<Memory[]>([]);
  
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [memoriesLoading, setMemoriesLoading] = useState(false);
  const [sendLoading, setSendLoading] = useState(false);
  
  const [inputMessage, setInputMessage] = useState('');
  const [selectedMode, setSelectedMode] = useState('auto');
  const [showTelemetry, setShowTelemetry] = useState(true);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, messagesLoading]);

  // Load chat sessions when workspace changes
  useEffect(() => {
    if (currentWorkspace?.id) {
      loadSessions();
      loadMemories();
    } else {
      setSessions([]);
      setActiveSession(null);
      setMessages([]);
      setMemories([]);
    }
  }, [currentWorkspace?.id]);

  // Load messages when active session changes
  useEffect(() => {
    if (activeSession?.id && currentWorkspace?.id) {
      loadMessages(activeSession.id);
    } else {
      setMessages([]);
    }
  }, [activeSession?.id]);

  const loadSessions = async () => {
    if (!currentWorkspace?.id) return;
    setSessionsLoading(true);
    try {
      const res = await api.listChatSessions(currentWorkspace.id);
      setSessions(res);
      if (res.length > 0 && !activeSession) {
        setActiveSession(res[0]);
      }
    } catch (err) {
      console.error("Failed to load sessions", err);
    } finally {
      setSessionsLoading(false);
    }
  };

  const loadMemories = async () => {
    if (!currentWorkspace?.id) return;
    setMemoriesLoading(true);
    try {
      const res = await api.listMemories(currentWorkspace.id);
      setMemories(res);
    } catch (err) {
      console.error("Failed to load memories", err);
    } finally {
      setMemoriesLoading(false);
    }
  };

  const loadMessages = async (sessionId: string) => {
    if (!currentWorkspace?.id) return;
    setMessagesLoading(true);
    try {
      const res = await api.listChatMessages(currentWorkspace.id, sessionId);
      setMessages(res);
    } catch (err) {
      console.error("Failed to load messages", err);
    } finally {
      setMessagesLoading(false);
    }
  };

  const handleCreateSession = async () => {
    if (!currentWorkspace?.id) return;
    try {
      const res = await api.createChatSession(currentWorkspace.id, `Chat Session ${sessions.length + 1}`);
      setSessions(prev => [res, ...prev]);
      setActiveSession(res);
    } catch (err) {
      console.error("Failed to create session", err);
    }
  };

  const handleDeleteSession = async (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    if (!currentWorkspace?.id) return;
    if (!confirm("Are you sure you want to delete this chat session?")) return;
    
    try {
      await api.deleteChatSession(currentWorkspace.id, sessionId);
      setSessions(prev => prev.filter(s => s.id !== sessionId));
      if (activeSession?.id === sessionId) {
        setActiveSession(null);
        setMessages([]);
      }
    } catch (err) {
      console.error("Failed to delete session", err);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() || !activeSession?.id || !currentWorkspace?.id || sendLoading) return;

    const userText = inputMessage.trim();
    setInputMessage('');
    setSendLoading(true);

    // 1. Optimistic UI update: user message
    const tempUserMsg: ChatMessage = {
      id: `temp-${Date.now()}`,
      session_id: activeSession.id,
      role: 'user',
      content: userText,
      mode: selectedMode,
      created_at: new Date().toISOString()
    };
    setMessages(prev => [...prev, tempUserMsg]);

    try {
      // 2. Call backend
      const res = await api.sendChatMessage(currentWorkspace.id, activeSession.id, userText, selectedMode);
      
      // 3. Update message list with final user and assistant messages
      // Simply reload to ensure state consistency (and get correct DB IDs)
      await loadMessages(activeSession.id);
      
      // Also reload memories in case the AI extracted any new preference
      loadMemories();
    } catch (err) {
      console.error("Failed to send message", err);
      alert("Error sending message. Check server connection.");
    } finally {
      setSendLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-slate-950 text-white min-h-[calc(100vh-4rem)]">
        <Loader2 className="h-8 w-8 animate-spin text-cyan-400" />
        <p className="mt-4 text-sm text-slate-400 font-medium">Authenticating secure context...</p>
      </div>
    );
  }

  if (!currentWorkspace) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-slate-950 text-white min-h-[calc(100vh-4rem)] p-6">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full border border-white/5 bg-slate-900/40 rounded-3xl p-8 text-center backdrop-blur-md"
        >
          <div className="h-14 w-14 rounded-2xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center mx-auto mb-6">
            <Database className="h-7 w-7" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">No Workspace Selected</h2>
          <p className="text-sm text-slate-400 mb-6 leading-relaxed">
            Please choose an active workspace or build a new environment from the header menu to start Secure Doc Copilot RAG chat.
          </p>
        </motion.div>
      </div>
    );
  }

  // Get last message telemetry
  const lastAssistantMsg = [...messages].reverse().find(m => m.role === 'assistant');
  const activeRun = lastAssistantMsg?.chat_run;
  const activeEval = lastAssistantMsg?.evaluation_scores;

  return (
    <div className="flex-1 flex bg-slate-950 text-slate-100 min-h-[calc(100vh-4rem)] overflow-hidden w-full relative">
      {/* Glow Effect */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-violet-600/5 rounded-full blur-3xl -z-10" />
      <div className="absolute bottom-0 left-0 w-80 h-80 bg-cyan-500/5 rounded-full blur-3xl -z-10" />

      {/* 1. SESSIONS SIDEBAR */}
      <div className="w-80 border-r border-white/5 bg-slate-900/20 backdrop-blur-xl flex flex-col shrink-0">
        <div className="p-4 border-b border-white/5">
          <button
            onClick={handleCreateSession}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-cyan-600 py-3 text-sm font-semibold text-white shadow-md shadow-violet-500/10 hover:shadow-cyan-500/25 transition-all duration-300 cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>New Chat Session</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {sessionsLoading ? (
            <div className="flex flex-col items-center justify-center py-10 space-y-2">
              <Loader2 className="h-5 w-5 animate-spin text-slate-500" />
              <span className="text-xs text-slate-500">Loading history...</span>
            </div>
          ) : sessions.length === 0 ? (
            <div className="text-center py-10 text-xs text-slate-500">
              No sessions found. Start a new chat!
            </div>
          ) : (
            sessions.map((s) => (
              <div
                key={s.id}
                onClick={() => setActiveSession(s)}
                className={`group flex items-center justify-between p-3.5 rounded-xl border cursor-pointer transition-all duration-300 ${
                  activeSession?.id === s.id
                    ? 'bg-white/5 border-cyan-500/30 text-white'
                    : 'bg-transparent border-transparent text-slate-400 hover:bg-white/5/40 hover:text-slate-200'
                }`}
              >
                <div className="flex items-center gap-3 overflow-hidden">
                  <MessageSquare className={`h-4 w-4 shrink-0 ${activeSession?.id === s.id ? 'text-cyan-400' : 'text-slate-500'}`} />
                  <span className="text-sm font-medium truncate">{s.title}</span>
                </div>
                <button
                  onClick={(e) => handleDeleteSession(e, s.id)}
                  className="opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-rose-400 rounded transition-all cursor-pointer"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 2. MAIN CHAT THREAD */}
      <div className="flex-1 flex flex-col bg-transparent min-w-0">
        {/* Chat Header */}
        <div className="h-16 border-b border-white/5 px-6 flex items-center justify-between bg-slate-900/10 backdrop-blur-md">
          <div className="flex items-center gap-3 overflow-hidden">
            <span className="font-bold text-white truncate">
              {activeSession ? activeSession.title : 'Secure Agent Interface'}
            </span>
            {activeSession && (
              <span className="inline-flex items-center rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-500/20">
                NVIDIA NIM Meta Llama 70B Active
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            {/* Mode selection button */}
            <div className="flex items-center gap-1 bg-white/5 rounded-xl p-1 border border-white/5">
              {MODE_CONFIGS.map((m) => {
                const Icon = m.icon;
                return (
                  <button
                    key={m.value}
                    onClick={() => setSelectedMode(m.value)}
                    title={m.label}
                    className={`p-2 rounded-lg transition-all duration-300 cursor-pointer ${
                      selectedMode === m.value
                        ? 'bg-slate-800 text-cyan-400 border border-white/5'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                  </button>
                );
              })}
            </div>
            
            <button
              onClick={() => setShowTelemetry(!showTelemetry)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold cursor-pointer transition-all ${
                showTelemetry 
                  ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400' 
                  : 'bg-transparent border-white/5 text-slate-400'
              }`}
            >
              <Gauge className="h-3.5 w-3.5" />
              <span>Telemetry</span>
            </button>
          </div>
        </div>

        {/* Message Panel */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {messagesLoading ? (
            <div className="h-full flex flex-col items-center justify-center space-y-3">
              <Loader2 className="h-8 w-8 animate-spin text-cyan-400" />
              <p className="text-sm text-slate-400">Retrieving chat memory...</p>
            </div>
          ) : !activeSession ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6">
              <div className="h-16 w-16 rounded-3xl bg-violet-600/10 text-violet-400 flex items-center justify-center mb-6">
                <MessageSquare className="h-8 w-8" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Initialize a Chat Session</h3>
              <p className="text-sm text-slate-400 max-w-sm mb-6">
                Generate a new chat thread to trigger document RAG pipelines, general intent classification, and automated memory profiles.
              </p>
              <button
                onClick={handleCreateSession}
                className="flex items-center gap-2 rounded-xl bg-white/5 px-4 py-2.5 text-sm font-semibold border border-white/5 text-slate-200 hover:bg-white/10 transition-all cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                <span>Create Session</span>
              </button>
            </div>
          ) : messages.length === 0 ? (
            <div className="max-w-2xl mx-auto py-12 text-center">
              <div className="h-14 w-14 rounded-2xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center mx-auto mb-6">
                <Sparkles className="h-6 w-6 animate-pulse" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Secure Doc Agentic RAG Platform</h3>
              <p className="text-sm text-slate-400 max-w-md mx-auto mb-8 leading-relaxed">
                Platform is secure. Send any query to analyze private workspace documents, draft reports, generate clean code, or manage your memories.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-left">
                {[
                  { text: "What is stored in our workspace memories?", mode: "general" },
                  { text: "Help me write a Python function to read files securely.", mode: "coding" },
                  { text: "Summarize the key facts from our uploaded documents.", mode: "rag" },
                  { text: "Check system status and outline model latency statistics.", mode: "general" }
                ].map((item, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setInputMessage(item.text);
                      setSelectedMode(item.mode);
                    }}
                    className="p-4 rounded-2xl border border-white/5 bg-slate-900/30 text-xs text-slate-300 hover:bg-slate-900 hover:border-white/10 transition-all text-left flex items-center justify-between group cursor-pointer"
                  >
                    <span>{item.text}</span>
                    <ArrowRight className="h-3.5 w-3.5 text-slate-500 group-hover:text-cyan-400 group-hover:translate-x-1 transition-all" />
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto space-y-6">
              {messages.map((msg, idx) => {
                const isUser = msg.role === 'user';
                return (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
                  >
                    {/* Role title */}
                    <div className="flex items-center gap-1.5 mb-1.5 px-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        {isUser ? 'Secure Client' : 'SecureDoc Copilot'}
                      </span>
                    </div>

                    {/* Bubble Content */}
                    <div
                      className={`relative max-w-2xl px-5 py-4 rounded-3xl border text-sm leading-relaxed shadow-sm whitespace-pre-wrap ${
                        isUser
                          ? 'bg-slate-900 border-white/5 rounded-tr-none text-slate-100'
                          : 'bg-slate-900/40 border-white/5 rounded-tl-none text-slate-200 backdrop-blur-sm'
                      }`}
                    >
                      {msg.content}

                      {/* Source/Citation Popovers */}
                      {!isUser && msg.sources_json && msg.sources_json.length > 0 && (
                        <div className="mt-4 pt-3 border-t border-white/5">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-2">
                            Retrieved Sources & Citations:
                          </span>
                          <div className="flex flex-wrap gap-2">
                            {msg.sources_json.map((cite, cIdx) => (
                              <div
                                key={cIdx}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/5 border border-white/5 text-xs font-medium text-slate-300"
                              >
                                <Bookmark className="h-3 w-3 text-cyan-400" />
                                <span>{cite.filename}</span>
                                {cite.page_number && (
                                  <span className="text-slate-500 ml-0.5">Page {cite.page_number}</span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Inline Route Classification & Eval Info (Assistant message only) */}
                      {!isUser && (
                        <div className="mt-3.5 flex flex-wrap items-center gap-2 border-t border-white/5 pt-3">
                          {/* Route Badge */}
                          {msg.mode && (
                            <span className="inline-flex items-center gap-1 rounded bg-cyan-500/10 border border-cyan-500/20 px-2 py-0.5 text-[10px] font-semibold text-cyan-400 uppercase tracking-wide">
                              Route: {msg.mode}
                            </span>
                          )}

                          {/* Mini RAG Meter */}
                          {msg.evaluation_scores && (
                            <>
                              <span className="text-slate-600 text-xs">•</span>
                              <div className="flex items-center gap-3 text-[10px] font-semibold text-slate-400">
                                <span className="flex items-center gap-1">
                                  Faithfulness: 
                                  <span className={msg.evaluation_scores.faithfulness && msg.evaluation_scores.faithfulness >= 0.8 ? 'text-emerald-400' : 'text-rose-400'}>
                                    {Math.round((msg.evaluation_scores.faithfulness || 0) * 100)}%
                                  </span>
                                </span>
                                <span className="flex items-center gap-1">
                                  Relevance: 
                                  <span className={msg.evaluation_scores.relevance && msg.evaluation_scores.relevance >= 0.8 ? 'text-emerald-400' : 'text-rose-400'}>
                                    {Math.round((msg.evaluation_scores.relevance || 0) * 100)}%
                                  </span>
                                </span>
                                <span className="flex items-center gap-1">
                                  Hallucination Risk: 
                                  <span className={msg.evaluation_scores.hallucination_risk && msg.evaluation_scores.hallucination_risk > 0.2 ? 'text-rose-400 animate-pulse' : 'text-emerald-400'}>
                                    {Math.round((msg.evaluation_scores.hallucination_risk || 0) * 100)}%
                                  </span>
                                </span>
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </motion.div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input Bar */}
        {activeSession && (
          <div className="p-6 bg-slate-900/10 border-t border-white/5">
            <form onSubmit={handleSendMessage} className="max-w-3xl mx-auto relative flex items-center gap-3">
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder="Ask secure agent... (e.g. Find key clauses, code assistance, memory summary)"
                className="flex-1 rounded-2xl border border-white/5 bg-slate-900/50 py-3.5 pl-4 pr-14 text-sm text-white placeholder-slate-500 outline-none ring-1 ring-transparent focus:border-cyan-500 focus:ring-cyan-500/35 transition-all duration-300"
                disabled={sendLoading}
              />
              
              <button
                type="submit"
                disabled={sendLoading || !inputMessage.trim()}
                className="absolute right-2.5 p-2 rounded-xl bg-cyan-600 text-white disabled:opacity-40 hover:bg-cyan-500 shadow-md shadow-cyan-500/10 transition-all cursor-pointer"
              >
                {sendLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </button>
            </form>
            <div className="max-w-3xl mx-auto mt-2.5 flex items-center justify-between text-[10px] text-slate-500">
              <span className="flex items-center gap-1">
                <Info className="h-3 w-3 text-slate-600" />
                Context window personalizes responses dynamically via workspace filter memory.
              </span>
              <span>
                Selected: <span className="text-cyan-400 font-bold uppercase">{selectedMode}</span>
              </span>
            </div>
          </div>
        )}
      </div>

      {/* 3. TELEMETRY & MEMORY PANEL */}
      <AnimatePresence>
        {showTelemetry && (
          <motion.div
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: 380 }}
            exit={{ opacity: 0, width: 0 }}
            className="border-l border-white/5 bg-slate-900/20 backdrop-blur-xl flex flex-col shrink-0 overflow-y-auto"
          >
            <div className="p-5 border-b border-white/5 flex items-center justify-between">
              <span className="font-bold text-white flex items-center gap-2 text-sm uppercase tracking-wide">
                <Gauge className="h-4 w-4 text-cyan-400" />
                Operations Telemetry
              </span>
            </div>

            {/* Run Stats */}
            <div className="p-5 border-b border-white/5 space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Last Assistant Run Performance
              </h3>
              
              {activeRun ? (
                <div className="grid grid-cols-2 gap-3.5">
                  <div className="rounded-xl border border-white/5 bg-white/5/30 p-3">
                    <div className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
                      <Clock className="h-3 w-3" /> Latency
                    </div>
                    <div className="mt-1 text-base font-bold text-white">
                      {activeRun.latency_ms} ms
                    </div>
                  </div>
                  <div className="rounded-xl border border-white/5 bg-white/5/30 p-3">
                    <div className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
                      <CircleDollarSign className="h-3 w-3 text-emerald-400" /> Cost Est.
                    </div>
                    <div className="mt-1 text-base font-bold text-emerald-400">
                      ${activeRun.estimated_cost?.toFixed(5)}
                    </div>
                  </div>
                  <div className="rounded-xl border border-white/5 bg-white/5/30 p-3">
                    <div className="text-[10px] font-bold text-slate-500 uppercase">
                      Prompt Tokens
                    </div>
                    <div className="mt-1 text-sm font-bold text-slate-200">
                      {activeRun.prompt_tokens}
                    </div>
                  </div>
                  <div className="rounded-xl border border-white/5 bg-white/5/30 p-3">
                    <div className="text-[10px] font-bold text-slate-500 uppercase">
                      Completion Tokens
                    </div>
                    <div className="mt-1 text-sm font-bold text-slate-200">
                      {activeRun.completion_tokens}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-xs text-slate-500 py-2">
                  No telemetry metrics captured yet. Send a message to run NVIDIA NIM evaluation models.
                </div>
              )}
            </div>

            {/* RAG Quality Evaluator details */}
            <div className="p-5 border-b border-white/5 space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <LineChart className="h-4 w-4 text-cyan-400" />
                NVIDIA NIM Quality Evaluators
              </h3>
              
              {activeEval ? (
                <div className="space-y-3 text-xs">
                  <div>
                    <div className="flex justify-between text-[11px] mb-1 font-semibold">
                      <span className="text-slate-400">Faithfulness Metric</span>
                      <span className="text-emerald-400">{Math.round((activeEval.faithfulness || 0) * 100)}%</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-white/5 overflow-hidden">
                      <div 
                        className="h-full rounded-full bg-emerald-500 transition-all duration-500" 
                        style={{ width: `${(activeEval.faithfulness || 0) * 100}%` }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-[11px] mb-1 font-semibold">
                      <span className="text-slate-400">Context Relevance</span>
                      <span className="text-cyan-400">{Math.round((activeEval.relevance || 0) * 100)}%</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-white/5 overflow-hidden">
                      <div 
                        className="h-full rounded-full bg-cyan-500 transition-all duration-500" 
                        style={{ width: `${(activeEval.relevance || 0) * 100}%` }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-[11px] mb-1 font-semibold">
                      <span className="text-slate-400">Hallucination Risk</span>
                      <span className={activeEval.hallucination_risk && activeEval.hallucination_risk > 0.2 ? 'text-rose-400' : 'text-slate-400'}>
                        {Math.round((activeEval.hallucination_risk || 0) * 100)}%
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-white/5 overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all duration-500 ${
                          activeEval.hallucination_risk && activeEval.hallucination_risk > 0.2 ? 'bg-rose-500' : 'bg-slate-500'
                        }`}
                        style={{ width: `${(activeEval.hallucination_risk || 0) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-xs text-slate-500">
                  Quality scores (Faithfulness, Hallucination Risk) are calculated automatically on assistant answers in document RAG pathways.
                </div>
              )}
            </div>

            {/* Context Workspace Memory values loaded */}
            <div className="p-5 space-y-4 flex-1">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Brain className="h-4 w-4 text-cyan-400" />
                  Active Memory Context ({memories.length})
                </h3>
              </div>

              {memoriesLoading ? (
                <div className="flex items-center gap-2 py-4">
                  <Loader2 className="h-4 w-4 animate-spin text-slate-500" />
                  <span className="text-xs text-slate-500">Syncing memory profiles...</span>
                </div>
              ) : memories.length === 0 ? (
                <div className="text-xs text-slate-500">
                  No memories detected in database. Speak normally or customize memories in the Memory Manager to persist preferences.
                </div>
              ) : (
                <div className="space-y-2.5 max-h-80 overflow-y-auto">
                  {memories.map((mem) => (
                    <div
                      key={mem.id}
                      className="rounded-xl border border-white/5 bg-slate-900/50 p-3 text-xs backdrop-blur-sm"
                    >
                      <div className="flex items-center justify-between font-bold text-cyan-400 mb-1 text-[10px] uppercase tracking-wide">
                        <span>{mem.memory_key}</span>
                        <span className="text-slate-500 font-normal lowercase">{mem.type}</span>
                      </div>
                      <p className="text-slate-300 leading-normal text-[11px]">{mem.memory_value}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
