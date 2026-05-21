'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';
import { api, DocumentResponse } from '@/lib/api';
import Github from '@/components/icons/Github';
import { 
  Database, 
  UploadCloud, 
  FileText, 
  Trash2, 
  Loader2, 
  AlertCircle, 
  CheckCircle2, 
  FileCode, 
  Search, 
  RefreshCw, 
  Info,
  FolderOpen,
  ArrowRight,
  ExternalLink
} from 'lucide-react';

export default function DocumentLibrary() {
  const { currentWorkspace, loading: authLoading } = useAuth();
  
  // State variables
  const [documents, setDocuments] = useState<DocumentResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Upload state variables
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dragActive, setDragActive] = useState(false);
  
  // Delete confirm state
  const [deleteTarget, setDeleteTarget] = useState<DocumentResponse | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch documents for the current workspace
  const fetchDocuments = async (silent = false) => {
    if (!currentWorkspace) return;
    if (!silent) setLoading(true);
    try {
      const docs = await api.listDocuments(currentWorkspace.id);
      setDocuments(docs);
      setError(null);
    } catch (err: any) {
      console.error(err);
      setError(err.detail || 'Failed to fetch documents.');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  // Initial fetch when workspace changes
  useEffect(() => {
    if (currentWorkspace) {
      fetchDocuments();
    } else {
      setDocuments([]);
    }
  }, [currentWorkspace]);

  // Polling for processing documents
  useEffect(() => {
    const hasProcessing = documents.some(doc => doc.status === 'processing');
    if (!hasProcessing) return;

    const interval = setInterval(() => {
      fetchDocuments(true);
    }, 3000); // Poll every 3 seconds

    return () => clearInterval(interval);
  }, [documents]);

  // Drag handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await handleFilesUpload(e.dataTransfer.files);
    }
  };

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      await handleFilesUpload(e.target.files);
    }
  };

  // Upload files logic
  const handleFilesUpload = async (files: FileList) => {
    if (!currentWorkspace) return;
    
    setUploading(true);
    setUploadProgress(10);
    setError(null);
    
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        // Allowed formats
        const allowedExts = ['pdf', 'docx', 'doc', 'csv', 'xlsx', 'txt', 'md'];
        const ext = file.name.split('.').pop()?.toLowerCase();
        if (!ext || !allowedExts.includes(ext)) {
          throw new Error(`Unsupported file type: .${ext}. Supported: PDF, DOCX, CSV, TXT, MD`);
        }

        setUploadProgress(30 + (i / files.length) * 40);
        await api.uploadDocument(currentWorkspace.id, file);
      }
      
      setUploadProgress(100);
      setTimeout(() => {
        setUploading(false);
        setUploadProgress(0);
        fetchDocuments();
      }, 500);

    } catch (err: any) {
      console.error(err);
      setError(err.message || err.detail || 'Upload failed.');
      setUploading(false);
      setUploadProgress(0);
    }
  };

  // Delete handler
  const handleDeleteDocument = async () => {
    if (!currentWorkspace || !deleteTarget) return;
    setDeleteLoading(true);
    try {
      await api.deleteDocument(currentWorkspace.id, deleteTarget.id);
      setDeleteTarget(null);
      fetchDocuments();
    } catch (err: any) {
      console.error(err);
      setError(err.detail || 'Failed to delete document.');
    } finally {
      setDeleteLoading(false);
    }
  };

  // File type icons mapping
  const getFileIcon = (fileType: string) => {
    const type = fileType.toUpperCase();
    if (type === 'PDF') return <span className="text-rose-500 font-bold">PDF</span>;
    if (type === 'DOCX' || type === 'DOC') return <span className="text-blue-400 font-bold">DOC</span>;
    if (type === 'CSV' || type === 'XLSX') return <span className="text-emerald-500 font-bold">CSV</span>;
    return <span className="text-slate-400 font-bold">TXT</span>;
  };

  // Format date helper
  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateStr;
    }
  };

  // Filtered documents
  const filteredDocs = documents.filter(doc => 
    doc.filename.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Statistics calculation
  const totalCount = documents.length;
  const readyCount = documents.filter(d => d.status === 'ready').length;
  const processingCount = documents.filter(d => d.status === 'processing').length;
  const errorCount = documents.filter(d => d.status === 'error').length;

  if (authLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-slate-950 text-white min-h-[calc(100vh-4rem)]">
        <Loader2 className="h-8 w-8 animate-spin text-cyan-400" />
        <p className="mt-4 text-sm text-slate-400 font-medium">Verifying authorization...</p>
      </div>
    );
  }

  return (
    <div className="relative min-h-[calc(100vh-4rem)] bg-slate-950 py-8 px-4 sm:px-6 lg:px-8 w-full flex flex-col">
      {/* Background glow effects */}
      <div className="absolute top-10 left-10 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl -z-10" />
      <div className="absolute bottom-10 right-10 w-96 h-96 bg-cyan-600/5 rounded-full blur-3xl -z-10" />

      <div className="mx-auto max-w-7xl w-full flex-1 flex flex-col">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 border-b border-white/10 pb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-3">
              <Database className="h-7 w-7 text-blue-400" />
              <span>Document Library</span>
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Upload, parse, chunk, and index PDFs, Word files, and CSV spreadsheets securely.
            </p>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            {/* Fork/View codebase block as requested */}
            <a 
              href="https://github.com" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-xl border border-white/10 bg-slate-900/40 px-3.5 py-2 text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-900/80 transition-all duration-300"
            >
              <Github className="h-4 w-4" />
              <span>View Codebase</span>
            </a>
            <button
              onClick={() => fetchDocuments()}
              disabled={loading || !currentWorkspace}
              className="flex items-center gap-2 rounded-xl border border-white/10 bg-slate-900/40 px-3.5 py-2 text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-900/80 transition-all duration-300 disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Sync Status</span>
            </button>
          </div>
        </div>

        {/* Check if Workspace is Selected */}
        {!currentWorkspace ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 rounded-2xl border border-white/5 bg-slate-900/20 backdrop-blur-md mt-8">
            <FolderOpen className="h-16 w-16 text-slate-600 mb-4" />
            <h3 className="text-lg font-semibold text-white">No Active Workspace</h3>
            <p className="text-sm text-slate-400 max-w-md mt-1">
              Please select or create a workspace from the dashboard to upload and view documents.
            </p>
            <a
              href="/dashboard"
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md hover:shadow-cyan-500/10 transition-all duration-300"
            >
              <span>Go to Dashboard</span>
              <ArrowRight className="h-4 w-4" />
            </a>
          </div>
        ) : (
          <div className="mt-8 flex flex-col gap-8 flex-1">
            
            {/* Quick Stats Grid */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div className="rounded-2xl border border-white/5 bg-slate-900/30 p-4 backdrop-blur-md">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Total Indexed</span>
                <div className="mt-1 text-2xl font-bold text-white">{totalCount}</div>
              </div>
              <div className="rounded-2xl border border-white/5 bg-slate-900/30 p-4 backdrop-blur-md">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-500">Ready</span>
                <div className="mt-1 text-2xl font-bold text-emerald-400">{readyCount}</div>
              </div>
              <div className="rounded-2xl border border-white/5 bg-slate-900/30 p-4 backdrop-blur-md">
                <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-500">Processing</span>
                <div className="mt-1 text-2xl font-bold text-cyan-400 flex items-center gap-2">
                  {processingCount}
                  {processingCount > 0 && <Loader2 className="h-4 w-4 animate-spin text-cyan-400" />}
                </div>
              </div>
              <div className="rounded-2xl border border-white/5 bg-slate-900/30 p-4 backdrop-blur-md">
                <span className="text-[10px] font-bold uppercase tracking-wider text-rose-500">Failed</span>
                <div className="mt-1 text-2xl font-bold text-rose-400">{errorCount}</div>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-400 flex items-start gap-3">
                <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold">Execution Error</h4>
                  <p className="mt-0.5">{error}</p>
                </div>
              </div>
            )}

            {/* Top Workspace Banner */}
            <div className="rounded-2xl border border-white/5 bg-slate-900/20 p-4 backdrop-blur-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center">
                  <Database className="h-4.5 w-4.5 text-blue-400" />
                </div>
                <div>
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Current Workspace context</div>
                  <div className="text-sm font-semibold text-white">{currentWorkspace.name}</div>
                </div>
              </div>
              
              <div className="flex items-center gap-2 text-xs text-slate-400 bg-white/5 px-3.5 py-1.5 rounded-xl border border-white/5">
                <Info className="h-3.5 w-3.5 text-blue-400 shrink-0" />
                <span>Workspace isolation active. Vectors are partitioned using metadata filters.</span>
              </div>
            </div>

            {/* Ingestion Sandbox / Upload Area */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              
              {/* Left Column: Drag & Drop Ingestion Sandbox */}
              <div className="lg:col-span-1 flex flex-col gap-4">
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Ingestion Sandbox</h3>
                
                <div
                  onDragEnter={handleDrag}
                  onDragOver={handleDrag}
                  onDragLeave={handleDrag}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`relative flex flex-col items-center justify-center border border-dashed rounded-3xl p-8 text-center cursor-pointer transition-all duration-300 min-h-[250px] backdrop-blur-md bg-slate-900/10 hover:bg-slate-900/30 ${
                    dragActive 
                      ? 'border-blue-500 bg-blue-500/5 shadow-lg shadow-blue-500/10 scale-[0.98]' 
                      : 'border-white/10 hover:border-white/20'
                  }`}
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    multiple
                    onChange={handleFileInputChange}
                    className="hidden"
                    accept=".pdf,.docx,.doc,.csv,.xlsx,.txt,.md"
                  />

                  {uploading ? (
                    <div className="flex flex-col items-center w-full px-4">
                      <Loader2 className="h-10 w-10 animate-spin text-blue-400 mb-4" />
                      <h4 className="text-sm font-semibold text-white">Ingesting file...</h4>
                      <p className="text-xs text-slate-400 mt-1 max-w-[200px]">Extracting document metadata, creating recursive character chunks, and generating dense 1024-d embeddings using NVIDIA NIM...</p>
                      
                      {/* Upload Progress Bar */}
                      <div className="mt-5 w-full h-1.5 rounded-full bg-white/5 overflow-hidden">
                        <motion.div 
                          className="h-full bg-gradient-to-r from-blue-500 to-cyan-500"
                          initial={{ width: 0 }}
                          animate={{ width: `${uploadProgress}%` }}
                          transition={{ duration: 0.1 }}
                        />
                      </div>
                      <span className="text-[10px] font-bold text-slate-500 mt-2">{Math.round(uploadProgress)}% Complete</span>
                    </div>
                  ) : (
                    <>
                      <div className="h-12 w-12 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-center mb-4 text-slate-400 group-hover:text-white transition-colors duration-300">
                        <UploadCloud className="h-6 w-6" />
                      </div>
                      <h4 className="text-sm font-bold text-white">Drag & drop files here</h4>
                      <p className="text-xs text-slate-400 mt-1 max-w-[220px]">
                        or click to browse from explorer
                      </p>
                      <div className="mt-4 flex flex-wrap justify-center gap-1.5 text-[9px] font-semibold text-slate-500">
                        <span className="border border-white/5 bg-white/5 px-2 py-0.5 rounded-md">PDF</span>
                        <span className="border border-white/5 bg-white/5 px-2 py-0.5 rounded-md">DOCX</span>
                        <span className="border border-white/5 bg-white/5 px-2 py-0.5 rounded-md">CSV</span>
                        <span className="border border-white/5 bg-white/5 px-2 py-0.5 rounded-md">TXT</span>
                        <span className="border border-white/5 bg-white/5 px-2 py-0.5 rounded-md">MD</span>
                      </div>
                    </>
                  )}
                </div>

                <div className="rounded-2xl border border-white/5 bg-slate-900/40 p-4 backdrop-blur-md text-xs text-slate-400 space-y-2">
                  <div className="flex items-center gap-2 font-semibold text-white">
                    <Info className="h-4 w-4 text-blue-400" />
                    <span>NVIDIA NIM Indexer Pipeline</span>
                  </div>
                  <p className="leading-relaxed">
                    Documents are automatically parsed in-memory, chunked using recursive overlapping character boundaries, and mapped to 1024-dimensional vectors.
                  </p>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Models in use: <strong>nvidia/nv-embedqa-e5-v5</strong>
                  </p>
                </div>
              </div>

              {/* Right Column: Files List Table */}
              <div className="lg:col-span-2 flex flex-col gap-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Document Library ({filteredDocs.length})</h3>
                  
                  {/* Search bar */}
                  <div className="relative w-full sm:max-w-xs">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                    <input
                      type="text"
                      placeholder="Search files..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="block w-full rounded-xl border border-white/5 bg-slate-900/30 py-2 pl-10 pr-4 text-xs text-white placeholder-slate-500 outline-none ring-1 ring-transparent transition-all focus:border-blue-500 focus:ring-blue-500/30"
                    />
                  </div>
                </div>

                {/* Table container */}
                <div className="overflow-hidden rounded-2xl border border-white/5 bg-slate-900/30 backdrop-blur-md flex-1 min-h-[300px] flex flex-col">
                  {loading ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-8">
                      <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
                      <p className="mt-3 text-xs text-slate-400">Loading library files...</p>
                    </div>
                  ) : filteredDocs.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                      <FileText className="h-12 w-12 text-slate-700 mb-3" />
                      <h4 className="text-sm font-semibold text-white">No documents found</h4>
                      <p className="text-xs text-slate-400 max-w-sm mt-1">
                        {searchQuery ? 'No documents match your search query.' : 'Upload files using the sandbox to start build your knowledge base.'}
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-white/5 text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-900/50">
                            <th className="py-3.5 px-4 text-xs font-semibold text-slate-400">Document Name</th>
                            <th className="py-3.5 px-4 text-xs font-semibold text-slate-400">Format</th>
                            <th className="py-3.5 px-4 text-xs font-semibold text-slate-400">Status</th>
                            <th className="py-3.5 px-4 text-xs font-semibold text-slate-400">Uploaded</th>
                            <th className="py-3.5 px-4 text-xs font-semibold text-slate-400 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {filteredDocs.map((doc) => (
                            <tr key={doc.id} className="hover:bg-white/[0.02] transition-colors">
                              <td className="py-3 px-4 text-xs font-semibold text-white truncate max-w-[200px]">
                                {doc.filename}
                              </td>
                              <td className="py-3 px-4 text-xs">
                                {getFileIcon(doc.file_type)}
                              </td>
                              <td className="py-3 px-4 text-xs">
                                {doc.status === 'ready' && (
                                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400 border border-emerald-500/20">
                                    <CheckCircle2 className="h-3 w-3" />
                                    Ready
                                  </span>
                                )}
                                {doc.status === 'processing' && (
                                  <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] font-medium text-blue-400 border border-blue-500/20 animate-pulse">
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                    Indexing
                                  </span>
                                )}
                                {doc.status === 'error' && (
                                  <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/10 px-2 py-0.5 text-[10px] font-medium text-rose-400 border border-rose-500/20">
                                    <AlertCircle className="h-3 w-3" />
                                    Failed
                                  </span>
                                )}
                              </td>
                              <td className="py-3 px-4 text-xs text-slate-400">
                                {formatDate(doc.created_at)}
                              </td>
                              <td className="py-3 px-4 text-xs text-right">
                                <button
                                  onClick={() => setDeleteTarget(doc)}
                                  className="rounded-lg p-1.5 text-slate-500 hover:bg-rose-500/10 hover:text-rose-400 transition-colors cursor-pointer"
                                  title="Delete Document"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>

            </div>
          </div>
        )}
      </div>

      {/* Glassmorphic Delete Confirmation Dialog */}
      <AnimatePresence>
        {deleteTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Dark Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDeleteTarget(null)}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
            />

            {/* Modal Body */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative w-full max-w-md overflow-hidden rounded-3xl border border-white/5 bg-slate-900 p-6 shadow-2xl backdrop-blur-xl"
            >
              {/* Subtle top neon warn line */}
              <div className="absolute top-0 inset-x-0 h-[2px] bg-rose-500" />

              <div className="flex items-center gap-3 text-white mb-4">
                <div className="h-9 w-9 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-400 border border-rose-500/20">
                  <Trash2 className="h-5 w-5" />
                </div>
                <h3 className="text-base font-bold">Delete Document?</h3>
              </div>

              <p className="text-xs text-slate-400 leading-relaxed mb-6">
                Are you sure you want to delete <strong>{deleteTarget.filename}</strong>? This will permanently remove its database record, all associated content chunks, and clear all vector indexes from Qdrant.
              </p>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setDeleteTarget(null)}
                  className="rounded-xl border border-white/5 bg-transparent px-4 py-2.5 text-xs font-semibold text-slate-300 hover:bg-white/5 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteDocument}
                  disabled={deleteLoading}
                  className="relative flex items-center justify-center rounded-xl bg-rose-600 px-4 py-2.5 text-xs font-semibold text-white shadow-md shadow-rose-500/15 disabled:opacity-50 cursor-pointer"
                >
                  {deleteLoading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    'Confirm Delete'
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
