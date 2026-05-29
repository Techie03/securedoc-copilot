'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';
import { api, ChatSession, ChatMessage, Memory, DocumentResponse } from '@/lib/api';
import { useDevicePlatform } from '@/lib/hooks/useDevicePlatform';
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
  LayoutGrid,
  RefreshCw,
  X,
  Mic,
  ArrowLeftRight,
  ImageIcon,
  Video,
  ExternalLink
} from 'lucide-react';

const MODE_CONFIGS = [
  { value: 'rag', label: 'Document RAG', icon: Database, color: 'text-cyan-400 bg-cyan-400/10' },
  { value: 'coding', label: 'Coding', icon: Code, color: 'text-purple-400 bg-purple-400/10' },
  { value: 'summary', label: 'Summary', icon: FileText, color: 'text-emerald-400 bg-emerald-400/10' },
  { value: 'compare', label: 'Compare', icon: ArrowLeftRight, color: 'text-orange-400 bg-orange-400/10' },
  { value: 'memory', label: 'Memory', icon: Brain, color: 'text-pink-400 bg-pink-400/10' },
  { value: 'chitchat', label: 'Chitchat', icon: MessageSquare, color: 'text-slate-400 bg-slate-400/10' }
];

function getMockFileSize(filename: string, id: string): string {
  let hash = 0;
  const str = filename + id;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const sizeInBytes = Math.abs(hash % (5 * 1024 * 1024 - 15 * 1024)) + 15 * 1024;
  if (sizeInBytes > 1024 * 1024) {
    return `${(sizeInBytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${(sizeInBytes / 1024).toFixed(0)} KB`;
}

export default function ChatPage() {
  const { currentWorkspace, loading: authLoading } = useAuth();
  const platform = useDevicePlatform();
  
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSession, setActiveSession] = useState<ChatSession | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [memories, setMemories] = useState<Memory[]>([]);
  
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [memoriesLoading, setMemoriesLoading] = useState(false);
  const [sendLoading, setSendLoading] = useState(false);
  
  const [inputMessage, setInputMessage] = useState('');
  const [selectedMode, setSelectedMode] = useState('rag');
  const [showTelemetry, setShowTelemetry] = useState(false);
  const [mobileSessionsOpen, setMobileSessionsOpen] = useState(false);
  const [documents, setDocuments] = useState<DocumentResponse[]>([]);
  const [documentsLoading, setDocumentsLoading] = useState(false);
  const [activeRightTab, setActiveRightTab] = useState<'documents' | 'telemetry'>('documents');
  const [isListening, setIsListening] = useState(false);
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = window.SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onresult = (event: any) => {
          let finalTranscript = '';
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              finalTranscript += event.results[i][0].transcript;
            }
          }
          if (finalTranscript) {
            setInputMessage((prev) => prev + (prev ? ' ' : '') + finalTranscript.trim());
          }
        };

        recognition.onerror = (event: any) => {
          console.error("Speech recognition error", event.error);
          setIsListening(false);
        };

        recognition.onend = () => {
          setIsListening(false);
        };

        recognitionRef.current = recognition;
      }
    }
  }, []);

  const toggleListen = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      if (!recognitionRef.current) {
        alert("Speech recognition is not supported in your browser.");
        return;
      }
      setInputMessage('');
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

  // Scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, messagesLoading]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;
    
    const files = Array.from(e.target.files);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        if (ev.target?.result && typeof ev.target.result === 'string') {
          setSelectedImages(prev => [...prev, ev.target!.result as string]);
        }
      };
      reader.readAsDataURL(file);
    });
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeImage = (index: number) => {
    setSelectedImages(prev => prev.filter((_, i) => i !== index));
  };

  // Load chat sessions when workspace changes
  useEffect(() => {
    if (currentWorkspace?.id) {
      loadSessions();
      loadMemories();
      loadDocuments();
    } else {
      setSessions([]);
      setActiveSession(null);
      setMessages([]);
      setMemories([]);
      setDocuments([]);
    }
  }, [currentWorkspace?.id]);

  const loadDocuments = async (silent = false) => {
    if (!currentWorkspace?.id) return;
    if (!silent) setDocumentsLoading(true);
    try {
      const res = await api.listDocuments(currentWorkspace.id);
      setDocuments(res);
    } catch (err) {
      console.error("Failed to load documents", err);
    } finally {
      if (!silent) setDocumentsLoading(false);
    }
  };

  // Poll for processing documents in the background every 5 seconds
  useEffect(() => {
    const hasProcessing = documents.some(doc => doc.status === 'processing');
    if (!hasProcessing) return;

    const interval = setInterval(() => {
      loadDocuments(true);
    }, 5000);

    return () => clearInterval(interval);
  }, [documents]);

  const getCompactFileIcon = (fileType: string) => {
    const type = fileType.toUpperCase();
    if (type === 'PDF') {
      return (
        <div className="h-8 w-8 rounded-lg bg-rose-500/10 flex items-center justify-center text-[10px] font-bold text-rose-600 dark:text-rose-400 border border-rose-500/20 shrink-0">
          PDF
        </div>
      );
    }
    if (type === 'DOCX' || type === 'DOC') {
      return (
        <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-[10px] font-bold text-blue-600 dark:text-blue-400 border border-blue-500/20 shrink-0">
          DOC
        </div>
      );
    }
    if (type === 'CSV' || type === 'XLSX') {
      return (
        <div className="h-8 w-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-[10px] font-bold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shrink-0">
          CSV
        </div>
      );
    }
    if (type === 'YOUTUBE') {
      return (
        <div className="h-8 w-8 rounded-lg bg-red-500/10 flex items-center justify-center text-red-600 dark:text-red-400 border border-red-500/20 shrink-0">
          <Video className="h-4 w-4" />
        </div>
      );
    }
    return (
      <div className="h-8 w-8 rounded-lg bg-slate-500/10 flex items-center justify-center text-[10px] font-bold text-slate-500 dark:text-slate-400 border border-slate-500/20 shrink-0">
        TXT
      </div>
    );
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'processing':
        return (
          <span className="inline-flex items-center gap-1 rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400 border border-amber-500/20 animate-pulse">
            <Loader2 className="h-2.5 w-2.5 animate-spin" />
            Indexing
          </span>
        );
      case 'ready':
        return (
          <span className="inline-flex items-center gap-1 rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="h-2.5 w-2.5 text-emerald-500" />
            Ready
          </span>
        );
      case 'error':
        return (
          <span className="inline-flex items-center gap-1 rounded bg-rose-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-rose-600 dark:text-rose-400 border border-rose-500/20">
            <AlertTriangle className="h-2.5 w-2.5 text-rose-500" />
            Failed
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded bg-slate-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 dark:text-slate-400 border border-slate-500/20">
            {status}
          </span>
        );
    }
  };

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
    if ((!inputMessage.trim() && selectedImages.length === 0) || !activeSession?.id || !currentWorkspace?.id || sendLoading) return;

    const userText = inputMessage.trim();
    const imagesToSend = [...selectedImages];
    setInputMessage('');
    setSelectedImages([]);
    setSendLoading(true);

    // 1. Optimistic UI update: user message
    const tempUserMsg: ChatMessage = {
      id: `temp-${Date.now()}`,
      session_id: activeSession.id,
      role: 'user',
      content: userText,
      mode: selectedMode,
      images_json: imagesToSend.length > 0 ? imagesToSend : undefined,
      created_at: new Date().toISOString()
    };
    setMessages(prev => [...prev, tempUserMsg]);

    try {
      // 2. Call backend
      const res = await api.sendChatMessage(
        currentWorkspace.id, 
        activeSession.id, 
        userText || "Analyze this image.", 
        selectedMode, 
        imagesToSend.length > 0 ? imagesToSend : undefined
      );
      
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
      <div className="flex-1 flex flex-col items-center justify-center bg-white dark:bg-slate-950 text-slate-900 dark:text-white min-h-[calc(100vh-4rem)]">
        <Loader2 className="h-8 w-8 animate-spin text-cyan-500 dark:text-cyan-400" />
        <p className="mt-4 text-sm text-slate-500 dark:text-slate-400 font-medium">Authenticating secure context...</p>
      </div>
    );
  }

  if (!currentWorkspace) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-white dark:bg-slate-950 text-slate-900 dark:text-white min-h-[calc(100vh-4rem)] p-6">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full border border-gray-200 dark:border-white/5 bg-white dark:bg-slate-900/40 rounded-3xl p-8 text-center backdrop-blur-md shadow-sm"
        >
          <div className="h-14 w-14 rounded-2xl bg-cyan-500/10 text-cyan-500 dark:text-cyan-400 flex items-center justify-center mx-auto mb-6">
            <Database className="h-7 w-7" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">No Workspace Selected</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
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

  const getUserBubbleClass = () => {
    if (platform === 'ios') {
      return 'bg-gray-100 dark:bg-gradient-to-tr dark:from-blue-600 dark:to-indigo-600 text-gray-900 dark:text-white rounded-3xl rounded-tr-sm border-transparent shadow-sm';
    }
    if (platform === 'android') {
      return 'bg-gray-100 dark:bg-cyan-700 text-gray-900 dark:text-white rounded-2xl rounded-tr-none border-transparent shadow-md';
    }
    return 'bg-gray-100 dark:bg-slate-800 border-gray-200 dark:border-white/5 rounded-tr-none text-gray-900 dark:text-slate-100 shadow-sm';
  };

  const getAssistantBubbleClass = () => {
    if (platform === 'ios') {
      return 'bg-gray-100 dark:bg-slate-900/60 border-gray-200 dark:border-white/5 rounded-3xl rounded-tl-sm text-gray-900 dark:text-slate-200 backdrop-blur-md';
    }
    if (platform === 'android') {
      return 'bg-gray-100 dark:bg-slate-900 border-gray-200 dark:border-white/10 rounded-2xl rounded-tl-none text-gray-900 dark:text-slate-200 shadow-sm';
    }
    return 'bg-gray-100 dark:bg-slate-900/40 border-gray-200 dark:border-white/5 rounded-tl-none text-gray-900 dark:text-slate-200 backdrop-blur-sm shadow-sm';
  };

  return (
    <div className="flex-1 flex bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 h-[calc(100vh-4rem)] max-h-[calc(100vh-4rem)] overflow-hidden w-full relative">
      {/* Glow Effect */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-violet-600/5 rounded-full blur-3xl -z-10" />
      <div className="absolute bottom-0 left-0 w-80 h-80 bg-cyan-500/5 rounded-full blur-3xl -z-10" />

      {/* Sessions Sidebar Backdrop (mobile only) */}
      <AnimatePresence>
        {mobileSessionsOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm lg:hidden"
            onClick={() => setMobileSessionsOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* 1. SESSIONS SIDEBAR */}
      <div className={`w-80 border-r border-slate-200/60 dark:border-white/5 bg-white/70 dark:bg-slate-950 lg:bg-white/50 lg:dark:bg-slate-900/10 lg:backdrop-blur-xl flex flex-col shrink-0 transition-transform duration-300 fixed inset-y-0 left-0 z-50 lg:z-0 lg:static lg:translate-x-0 ${
        mobileSessionsOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        {/* Mobile Header for Sidebar Drawer */}
        <div className="p-4 border-b border-gray-200 dark:border-white/5 flex items-center justify-between lg:hidden shrink-0">
          <span className="font-bold text-xs text-slate-500 uppercase tracking-wider">Chat History</span>
          <button
            onClick={() => setMobileSessionsOpen(false)}
            className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-4 border-b border-gray-200 dark:border-white/5 shrink-0">
          <button
            onClick={() => {
              handleCreateSession();
              setMobileSessionsOpen(false); // Auto-close drawer on selection
            }}
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
                onClick={() => {
                  setActiveSession(s);
                  setMobileSessionsOpen(false); // Auto-close drawer on selection
                }}
                className={`group flex items-center justify-between p-3.5 rounded-xl border cursor-pointer transition-all duration-300 ${
                  activeSession?.id === s.id
                    ? 'bg-slate-100 dark:bg-white/5 border-cyan-500/30 dark:border-cyan-500/30 text-slate-900 dark:text-white font-semibold'
                    : 'bg-transparent border-transparent text-slate-500 dark:text-slate-400 hover:bg-slate-100/50 dark:hover:bg-white/5/40 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <div className="flex items-center gap-3 overflow-hidden">
                  <MessageSquare className={`h-4 w-4 shrink-0 ${activeSession?.id === s.id ? 'text-cyan-500 dark:text-cyan-400' : 'text-slate-500'}`} />
                  <span className="text-sm font-medium truncate">{s.title}</span>
                </div>
                <button
                  onClick={(e) => handleDeleteSession(e, s.id)}
                  className="opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-rose-500 rounded transition-all cursor-pointer"
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
        <div className="h-16 border-b border-gray-200 dark:border-white/5 px-4 sm:px-6 flex items-center justify-between bg-white/50 dark:bg-slate-900/10 backdrop-blur-md shrink-0">
          <div className="flex items-center gap-2 overflow-hidden">
            {/* Sessions history button on mobile */}
            <button
              onClick={() => setMobileSessionsOpen(true)}
              className="lg:hidden p-2 -ml-1 rounded-xl border border-gray-200 dark:border-white/10 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
              title="View Chat History"
            >
              <MessageSquare className="h-4 w-4" />
            </button>

            <span className="font-bold text-slate-900 dark:text-white truncate text-sm sm:text-base">
              {activeSession ? activeSession.title : 'Secure Agent Interface'}
            </span>
            {activeSession && (
              <span className="hidden sm:inline-flex items-center rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                NVIDIA NIM Meta Llama 70B Active
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Mode selection button */}
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-white/5 rounded-xl p-1 border border-slate-200 dark:border-white/5">
              {MODE_CONFIGS.map((m) => {
                const Icon = m.icon;
                return (
                  <button
                    key={m.value}
                    onClick={() => setSelectedMode(m.value)}
                    title={m.label}
                    className={`p-2 rounded-lg transition-all duration-300 cursor-pointer ${
                      selectedMode === m.value
                        ? 'bg-white dark:bg-slate-800 text-cyan-600 dark:text-cyan-400 border border-slate-200 dark:border-white/5 shadow-sm'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                  </button>
                );
              })}
            </div>
            
            <button
              onClick={() => setShowTelemetry(!showTelemetry)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-1.5 rounded-xl border text-xs font-semibold cursor-pointer transition-all ${
                showTelemetry 
                  ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-500 dark:text-cyan-400' 
                  : 'bg-transparent border-slate-200 text-slate-500 dark:text-slate-400'
              }`}
            >
              <Gauge className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Telemetry</span>
            </button>
          </div>
        </div>

        {/* Message Panel */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {messagesLoading ? (
            <div className="h-full flex flex-col items-center justify-center space-y-3">
              <Loader2 className="h-8 w-8 animate-spin text-cyan-500 dark:text-cyan-400" />
              <p className="text-sm text-slate-500 dark:text-slate-400">Retrieving chat memory...</p>
            </div>
          ) : !activeSession ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6">
              <div className="h-16 w-16 rounded-3xl bg-violet-600/10 text-violet-500 dark:text-violet-400 flex items-center justify-center mb-6">
                <MessageSquare className="h-8 w-8" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Initialize a Chat Session</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm mb-6">
                Generate a new chat thread to trigger document RAG pipelines, general intent classification, and automated memory profiles.
              </p>
              <button
                onClick={handleCreateSession}
                className="flex items-center gap-2 rounded-xl bg-slate-100 dark:bg-white/5 px-4 py-2.5 text-sm font-semibold border border-slate-200 dark:border-white/5 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-white/10 transition-all cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                <span>Create Session</span>
              </button>
            </div>
          ) : messages.length === 0 ? (
            <div className="max-w-2xl mx-auto py-12 text-center">
              {/* Rotating NIM Core Graphic */}
              <div className="relative w-32 h-32 mx-auto mb-6 flex items-center justify-center">
                {/* Outer Ring */}
                <motion.div
                  className="absolute inset-0 border-2 border-dashed border-cyan-500/30 rounded-full animate-none"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
                />
                {/* Inner Ring */}
                <motion.div
                  className="absolute inset-2 border border-violet-500/40 rounded-full"
                  animate={{ rotate: -360 }}
                  transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                />
                {/* Glowing Core */}
                <div className="absolute inset-6 rounded-full bg-gradient-to-tr from-cyan-500/20 to-violet-500/20 dark:from-cyan-500/10 dark:to-violet-500/10 backdrop-blur-md flex items-center justify-center border border-slate-200 dark:border-white/10 shadow-lg shadow-cyan-500/10">
                  <Sparkles className="h-6 w-6 text-cyan-600 dark:text-cyan-400 animate-pulse" />
                </div>
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Secure Doc Agentic RAG Platform</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto mb-8 leading-relaxed">
                Platform is secure. Send any query to analyze private workspace documents, draft reports, generate clean code, or manage your memories.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-left">
                {[
                  { text: "Summarize the key facts from our uploaded documents.", mode: "rag" },
                  { text: "Analyze client onboarding trends based on uploaded reports.", mode: "rag" },
                  { text: "What is stored in our workspace memories?", mode: "general" },
                  { text: "Verify system latency statistics and check active memory.", mode: "general" }
                ].map((item, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setInputMessage(item.text);
                      setSelectedMode(item.mode);
                    }}
                    className="p-4 rounded-2xl border border-gray-200 dark:border-white/5 bg-gray-100 dark:bg-slate-900/30 text-xs text-gray-900 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-900 hover:border-gray-300 dark:hover:border-white/10 transition-all text-left flex items-center justify-between group cursor-pointer"
                  >
                    <span>{item.text}</span>
                    <ArrowRight className="h-3.5 w-3.5 text-slate-400 group-hover:text-cyan-500 dark:group-hover:text-cyan-400 group-hover:translate-x-1 transition-all" />
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
                      className={`relative max-w-2xl px-5 py-4 text-sm leading-relaxed shadow-sm whitespace-pre-wrap ${
                        isUser ? getUserBubbleClass() : getAssistantBubbleClass()
                      }`}
                    >
                      {msg.images_json && msg.images_json.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-3">
                          {msg.images_json.map((imgStr, i) => (
                            <div key={i} className="relative rounded-xl overflow-hidden border border-slate-200 dark:border-white/10 shadow-sm max-w-[250px]">
                              {imgStr.startsWith('data:application/pdf') ? (
                                <div className="w-[150px] h-[150px] flex flex-col items-center justify-center bg-rose-50 text-rose-500 dark:bg-rose-500/10 dark:text-rose-400">
                                  <FileText className="h-10 w-10 mb-2" />
                                  <span className="text-xs font-bold uppercase tracking-wider">PDF Attached</span>
                                </div>
                              ) : (
                                <img src={imgStr} alt="Attached" className="object-cover w-full h-auto" />
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                      {msg.content}

                      {/* Source/Citation Popovers */}
                      {!isUser && msg.sources_json && msg.sources_json.length > 0 && (
                        <div className="mt-4 pt-3 border-t border-slate-200 dark:border-white/5">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-2">
                            Retrieved Sources & Citations:
                          </span>
                          <div className="flex flex-wrap gap-2">
                            {msg.sources_json.map((cite, cIdx) => (
                              <div
                                key={cIdx}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/5 text-xs font-medium text-slate-600 dark:text-slate-300"
                              >
                                <Bookmark className="h-3 w-3 text-cyan-500 dark:text-cyan-400" />
                                <span>{cite.filename}</span>
                                {cite.page_number && (
                                  <span className="text-slate-400 dark:text-slate-500 ml-0.5">Page {cite.page_number}</span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Inline Route Classification & Eval Info (Assistant message only) */}
                      {!isUser && (
                        <div className="mt-3.5 flex flex-wrap items-center gap-2 border-t border-slate-200 dark:border-white/5 pt-3">
                          {/* Route Badge */}
                          {msg.mode && (
                            <span className="inline-flex items-center gap-1 rounded bg-cyan-500/10 border border-cyan-500/20 px-2 py-0.5 text-[10px] font-semibold text-cyan-600 dark:text-cyan-400 uppercase tracking-wide">
                              Route: {msg.mode}
                            </span>
                          )}

                          {/* Mini RAG Meter */}
                          {msg.evaluation_scores && (
                            <>
                              <span className="text-slate-400 dark:text-slate-600 text-xs">•</span>
                              <div className="flex items-center gap-3 text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                                <span className="flex items-center gap-1">
                                  Faithfulness: 
                                  <span className={msg.evaluation_scores.faithfulness && msg.evaluation_scores.faithfulness >= 0.8 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>
                                    {Math.round((msg.evaluation_scores.faithfulness || 0) * 100)}%
                                  </span>
                                </span>
                                <span className="flex items-center gap-1">
                                  Relevance: 
                                  <span className={msg.evaluation_scores.relevance && msg.evaluation_scores.relevance >= 0.8 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>
                                    {Math.round((msg.evaluation_scores.relevance || 0) * 100)}%
                                  </span>
                                </span>
                                <span className="flex items-center gap-1">
                                  Hallucination Risk: 
                                  <span className={msg.evaluation_scores.hallucination_risk && msg.evaluation_scores.hallucination_risk > 0.2 ? 'text-rose-600 dark:text-rose-400 animate-pulse' : 'text-emerald-600 dark:text-emerald-400'}>
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
              
              {sendLoading && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex flex-col items-start max-w-3xl mx-auto w-full relative"
                >
                  <div className="flex items-center gap-1.5 mb-1.5 px-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      SecureDoc Copilot is scanning...
                    </span>
                  </div>
                  <div className="relative w-full max-w-2xl px-5 py-4 rounded-3xl border border-slate-200 dark:border-white/5 bg-white/80 dark:bg-slate-900/40 rounded-tl-none text-slate-500 dark:text-slate-400 overflow-hidden shadow-sm">
                    {/* Scanning Beam */}
                    <div className="absolute inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-cyan-500 to-transparent animate-scan" />
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin text-cyan-500 dark:text-cyan-400" />
                      <span>RAG telemetry evaluation running...</span>
                    </div>
                  </div>
                </motion.div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input Bar */}
        {activeSession && (
          <div 
            className="p-4 sm:p-6 bg-white/50 dark:bg-slate-900/10 border-t border-slate-200 dark:border-white/5 shrink-0"
            style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))' }}
          >
            {/* Image Preview Area */}
            {selectedImages.length > 0 && (
              <div className="max-w-3xl mx-auto mb-3 flex flex-wrap gap-3">
                {selectedImages.map((imgUrl, i) => (
                  <div key={i} className="relative h-20 w-20 rounded-xl overflow-hidden border border-slate-200 dark:border-white/10 shadow-sm group">
                    {imgUrl.startsWith('data:application/pdf') ? (
                      <div className="w-full h-full flex flex-col items-center justify-center bg-rose-50 text-rose-500 dark:bg-rose-500/10 dark:text-rose-400">
                        <FileText className="h-8 w-8 mb-1" />
                        <span className="text-[10px] font-bold">PDF</span>
                      </div>
                    ) : (
                      <img src={imgUrl} alt="Preview" className="w-full h-full object-cover" />
                    )}
                    <button
                      onClick={() => removeImage(i)}
                      className="absolute top-1 right-1 p-1 bg-slate-900/60 hover:bg-rose-500 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            
            <form onSubmit={handleSendMessage} className="max-w-3xl mx-auto relative flex items-center gap-3">
              <input 
                type="file" 
                multiple 
                accept="image/*,application/pdf" 
                className="hidden" 
                ref={fileInputRef} 
                onChange={handleImageUpload} 
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-3 sm:py-3.5 rounded-2xl border border-gray-200 dark:border-white/5 bg-gray-100 dark:bg-slate-900/50 text-slate-500 hover:text-cyan-600 dark:hover:text-cyan-400 hover:bg-slate-200 dark:hover:bg-white/10 transition-all cursor-pointer shadow-sm shrink-0"
                title="Attach Images"
              >
                <ImageIcon className="h-5 w-5" />
              </button>
              
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder="Ask secure agent... (e.g. Find key clauses, code assistance, memory summary)"
                className="flex-1 rounded-2xl border border-gray-200 dark:border-white/5 bg-gray-100 dark:bg-slate-900/50 py-3 sm:py-3.5 pl-4 pr-24 sm:pr-28 text-sm text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-slate-500 outline-none ring-1 ring-transparent focus:border-cyan-500 focus:ring-cyan-500/35 transition-all duration-300 shadow-sm"
                disabled={sendLoading}
              />
              
              <div className="absolute right-2 sm:right-2.5 flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={toggleListen}
                  title={isListening ? "Stop Voice Input" : "Start Voice Input"}
                  className={`p-2 rounded-xl transition-all cursor-pointer ${
                    isListening 
                      ? 'text-rose-500 bg-rose-500/10 hover:bg-rose-500/20 animate-pulse'
                      : 'text-slate-400 hover:bg-slate-200 hover:text-cyan-600 dark:hover:bg-white/10 dark:hover:text-cyan-400'
                  }`}
                >
                  <Mic className="h-4 w-4" />
                </button>
                <button
                  type="submit"
                  disabled={sendLoading || (!inputMessage.trim() && selectedImages.length === 0)}
                  className="p-2 rounded-xl bg-cyan-600 text-white disabled:opacity-40 hover:bg-cyan-500 shadow-md shadow-cyan-500/10 transition-all cursor-pointer"
                >
                  {sendLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </button>
              </div>
            </form>
            <div className="max-w-3xl mx-auto mt-2.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1.5 text-[10px] text-slate-500">
              <span className="flex items-center gap-1">
                <Info className="h-3 w-3 text-slate-400 dark:text-slate-500 shrink-0" />
                <span className="truncate max-w-[280px] sm:max-w-none">
                  Context window personalizes responses dynamically via workspace filter memory.
                </span>
              </span>
              <span>
                Selected: <span className="text-cyan-600 dark:text-cyan-400 font-bold uppercase">{selectedMode === 'rag' ? 'Document-Based' : 'General'}</span>
              </span>
            </div>
          </div>
        )}
      </div>

      {/* 3. TELEMETRY & MEMORY PANEL */}
      {/* Telemetry Sidebar Backdrop (mobile only) */}
      <AnimatePresence>
        {showTelemetry && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm lg:hidden"
            onClick={() => setShowTelemetry(false)}
          />
        )}
      </AnimatePresence>

      <div
        className={`border-l border-slate-200/60 dark:border-white/5 bg-white/75 dark:bg-slate-950 lg:bg-white/50 lg:dark:bg-slate-900/10 lg:backdrop-blur-xl flex flex-col shrink-0 transition-all duration-300 overflow-hidden
          fixed inset-y-0 right-0 z-50 lg:z-0 w-80 max-w-[calc(100vw-3rem)] lg:static lg:w-[380px] lg:translate-x-0 ${
            showTelemetry ? 'translate-x-0 opacity-100 lg:w-[380px]' : 'translate-x-full opacity-0 lg:translate-x-0 lg:w-0 lg:border-l-0 lg:opacity-100'
          }`}
      >
        {/* Mobile Header for Telemetry Drawer */}
        <div className="p-4 border-b border-gray-200 dark:border-white/5 flex items-center justify-between lg:hidden shrink-0">
          <span className="font-bold text-xs text-slate-500 uppercase tracking-wider">Telemetry & Quality</span>
          <button
            onClick={() => setShowTelemetry(false)}
            className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Header Tabs */}
        <div className="p-3 border-b border-gray-200 dark:border-white/5 bg-slate-100/50 dark:bg-slate-950/20 shrink-0 font-bold">
          <div className="flex gap-1.5 bg-slate-200/50 dark:bg-slate-950/40 p-1 rounded-xl border border-gray-200 dark:border-white/5">
            <button
              type="button"
              onClick={() => setActiveRightTab('documents')}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all duration-300 flex items-center justify-center gap-1.5 cursor-pointer ${
                activeRightTab === 'documents'
                  ? 'bg-white dark:bg-slate-800 text-cyan-600 dark:text-cyan-400 border border-slate-200 dark:border-white/10 shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
            >
              <Database className="h-3.5 w-3.5 text-cyan-500 dark:text-cyan-400" />
              <span>Ingested Docs</span>
              {documents.length > 0 && (
                <span className="ml-1 px-1.5 py-0.2 rounded-full bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 text-[9px] font-extrabold border border-cyan-500/30">
                  {documents.length}
                </span>
              )}
            </button>
            
            <button
              type="button"
              onClick={() => setActiveRightTab('telemetry')}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all duration-300 flex items-center justify-center gap-1.5 cursor-pointer ${
                activeRightTab === 'telemetry'
                  ? 'bg-white dark:bg-slate-800 text-cyan-600 dark:text-cyan-400 border border-slate-200 dark:border-white/10 shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
            >
              <Gauge className="h-3.5 w-3.5 text-cyan-500 dark:text-cyan-400" />
              <span>Telemetry</span>
            </button>
          </div>
        </div>
        {activeRightTab === 'documents' ? (
          <div className="flex-1 flex flex-col min-h-0 bg-transparent">
            <div className="p-4 border-b border-gray-200 dark:border-white/5 flex items-center justify-between bg-slate-100/30 dark:bg-slate-900/10 shrink-0">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Workspace Ingested Data
              </span>
              <button
                type="button"
                onClick={() => loadDocuments()}
                disabled={documentsLoading}
                title="Refresh document list"
                className="p-1.5 rounded-lg border border-gray-200 dark:border-white/5 bg-slate-100 dark:bg-slate-900/30 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-900/80 transition-all duration-300 disabled:opacity-50 cursor-pointer"
              >
                <RefreshCw className={`h-3 w-3 ${documentsLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
              {documentsLoading && documents.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 space-y-2">
                  <Loader2 className="h-6 w-6 animate-spin text-cyan-500 dark:text-cyan-400" />
                  <span className="text-xs text-slate-500">Loading ingested documents...</span>
                </div>
              ) : documents.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-center py-12 px-4 rounded-2xl border border-gray-200 dark:border-white/5 bg-slate-100/50 dark:bg-slate-900/20">
                  <FileText className="h-8 w-8 text-slate-400 dark:text-slate-500 mb-3" />
                  <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300">No Documents Ingested</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-[240px] leading-relaxed">
                    To enable Document-Based query mode, upload files in the document workspace first.
                  </p>
                  <a
                    href="/documents"
                    className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-cyan-600 px-3 py-1.5 text-xs font-bold text-white shadow-md hover:bg-cyan-500 transition-all duration-300"
                  >
                    <span>Upload Documents</span>
                    <ArrowRight className="h-3 w-3" />
                  </a>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {documents.map((doc) => (
                    <div
                      key={doc.id}
                      className="flex items-center justify-between p-3 rounded-xl border border-gray-200 dark:border-white/5 bg-white/50 dark:bg-slate-900/30 hover:bg-white/70 dark:hover:bg-slate-900/50 transition-all duration-200"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {getCompactFileIcon(doc.file_type)}
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-slate-800 dark:text-white truncate max-w-[150px]" title={doc.filename}>
                            {doc.filename}
                          </p>
                          {doc.file_type === 'YOUTUBE' ? (
                            <a href={doc.storage_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[10px] text-red-500 hover:text-red-600 mt-0.5 font-medium transition-colors">
                              <ExternalLink className="h-2.5 w-2.5" />
                              Watch Source
                            </a>
                          ) : (
                            <p className="text-[10px] text-slate-500 mt-0.5 font-medium">
                              Size: {getMockFileSize(doc.filename, doc.id)}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="shrink-0 flex items-center gap-1">
                        {getStatusBadge(doc.status)}
                      </div>
                    </div>
                  ))}

                  <div className="pt-2">
                    <a
                      href="/documents"
                      className="w-full flex items-center justify-center gap-1.5 rounded-xl border border-gray-200 dark:border-white/5 bg-white/50 dark:bg-slate-900/30 hover:bg-white/70 dark:hover:bg-slate-900/60 py-2.5 text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white transition-all duration-300"
                    >
                      <span>Manage Workspace Documents</span>
                      <ChevronRight className="h-3.5 w-3.5" />
                    </a>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
            {/* Run Stats */}
            <div className="p-5 border-b border-gray-200 dark:border-white/5 space-y-4 shrink-0">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Last Assistant Run Performance
              </h3>
              
              {activeRun ? (
                <div className="grid grid-cols-2 gap-3.5">
                  <div className="rounded-xl border border-gray-200 dark:border-white/5 bg-white/80 dark:bg-white/5 p-3">
                    <div className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
                      <Clock className="h-3 w-3" /> Latency
                    </div>
                    <div className="mt-1 text-base font-bold text-slate-800 dark:text-white">
                      {activeRun.latency_ms} ms
                    </div>
                  </div>
                  <div className="rounded-xl border border-gray-200 dark:border-white/5 bg-white/80 dark:bg-white/5 p-3">
                    <div className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
                      <CircleDollarSign className="h-3 w-3 text-emerald-500 dark:text-emerald-400" /> Cost Est.
                    </div>
                    <div className="mt-1 text-base font-bold text-emerald-600 dark:text-emerald-400">
                      ${activeRun.estimated_cost?.toFixed(5)}
                    </div>
                  </div>
                  <div className="rounded-xl border border-gray-200 dark:border-white/5 bg-white/80 dark:bg-white/5 p-3">
                    <div className="text-[10px] font-bold text-slate-500 uppercase">
                      Prompt Tokens
                    </div>
                    <div className="mt-1 text-sm font-bold text-slate-700 dark:text-slate-200">
                      {activeRun.prompt_tokens}
                    </div>
                  </div>
                  <div className="rounded-xl border border-gray-200 dark:border-white/5 bg-white/80 dark:bg-white/5 p-3">
                    <div className="text-[10px] font-bold text-slate-500 uppercase">
                      Completion Tokens
                    </div>
                    <div className="mt-1 text-sm font-bold text-slate-700 dark:text-slate-200">
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
            <div className="p-5 border-b border-gray-200 dark:border-white/5 space-y-4 shrink-0">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <LineChart className="h-4 w-4 text-cyan-500 dark:text-cyan-400" />
                NVIDIA NIM Quality Evaluators
              </h3>
              
              {activeEval ? (
                <div className="space-y-3 text-xs">
                  <div>
                    <div className="flex justify-between text-[11px] mb-1 font-semibold">
                      <span className="text-slate-500 dark:text-slate-400">Faithfulness Metric</span>
                      <span className="text-emerald-600 dark:text-emerald-400">{Math.round((activeEval.faithfulness || 0) * 100)}%</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-white/5 overflow-hidden">
                      <div 
                        className="h-full rounded-full bg-emerald-500 transition-all duration-500" 
                        style={{ width: `${(activeEval.faithfulness || 0) * 100}%` }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-[11px] mb-1 font-semibold">
                      <span className="text-slate-500 dark:text-slate-400">Context Relevance</span>
                      <span className="text-cyan-600 dark:text-cyan-400">{Math.round((activeEval.relevance || 0) * 100)}%</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-white/5 overflow-hidden">
                      <div 
                        className="h-full rounded-full bg-cyan-500 transition-all duration-500" 
                        style={{ width: `${(activeEval.relevance || 0) * 100}%` }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-[11px] mb-1 font-semibold">
                      <span className="text-slate-500 dark:text-slate-400">Hallucination Risk</span>
                      <span className={activeEval.hallucination_risk && activeEval.hallucination_risk > 0.2 ? 'text-rose-500 dark:text-rose-400' : 'text-slate-500'}>
                        {Math.round((activeEval.hallucination_risk || 0) * 100)}%
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-white/5 overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all duration-500 ${
                          activeEval.hallucination_risk && activeEval.hallucination_risk > 0.2 ? 'bg-rose-500' : 'bg-slate-400 dark:bg-slate-500'
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
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <Brain className="h-4 w-4 text-cyan-500 dark:text-cyan-400" />
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
                      className="rounded-xl border border-gray-200 dark:border-white/5 bg-white/70 dark:bg-slate-900/50 p-3 text-xs backdrop-blur-sm"
                    >
                      <div className="flex items-center justify-between font-bold text-cyan-600 dark:text-cyan-400 mb-1 text-[10px] uppercase tracking-wide">
                        <span>{mem.memory_key}</span>
                        <span className="text-slate-400 dark:text-slate-500 font-normal lowercase">{mem.type}</span>
                      </div>
                      <p className="text-slate-600 dark:text-slate-300 leading-normal text-[11px]">{mem.memory_value}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
