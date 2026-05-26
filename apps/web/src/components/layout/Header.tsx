'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTheme } from 'next-themes';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';
import Github from '@/components/icons/Github';
import { 
  GitFork, 
  ExternalLink, 
  Sun, 
  Moon, 
  Shield, 
  ChevronDown, 
  FolderLock, 
  LogOut, 
  Plus, 
  User as UserIcon,
  X,
  Loader2,
  Menu,
  Trash2
} from 'lucide-react';

export default function Header() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const { user, workspaces, currentWorkspace, selectWorkspace, createWorkspace, deleteWorkspace, logout } = useAuth();
  const pathname = usePathname();
  
  // Dropdown states
  const [showWorkspaceMenu, setShowWorkspaceMenu] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  
  // Modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const workspaceRef = useRef<HTMLDivElement>(null);
  const userRef = useRef<HTMLDivElement>(null);

  const navLinks = [
    { name: 'Chat', href: '/chat' },
    { name: 'Documents', href: '/documents' },
    { name: 'Memory', href: '/memory' },
    { name: 'Evaluations', href: '/evaluations' },
    { name: 'Connectors', href: '/connectors' },
  ];

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  // Listen to window scroll to adjust header aesthetics
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (workspaceRef.current && !workspaceRef.current.contains(event.target as Node)) {
        setShowWorkspaceMenu(false);
      }
      if (userRef.current && !userRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleTheme = () => {
    if (!mounted) return;
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  const handleDeleteWorkspace = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this workspace? All its data will be lost.')) return;
    try {
      await deleteWorkspace(id);
    } catch (err: any) {
      alert(err.detail || 'Failed to delete workspace.');
    }
  };

  const handleCreateWorkspaceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWorkspaceName.trim()) return;
    setModalLoading(true);
    setModalError(null);
    try {
      await createWorkspace(newWorkspaceName);
      setShowCreateModal(false);
      setNewWorkspaceName('');
    } catch (err: any) {
      setModalError(err.detail || 'Failed to create workspace. Please try again.');
    } finally {
      setModalLoading(false);
    }
  };

  return (
    <>
      <header className={`sticky top-0 z-40 w-full transition-all duration-300 backdrop-blur-md ${
        isScrolled
          ? 'border-b border-gray-200 bg-white/85 shadow-md shadow-slate-100/40 dark:border-white/10 dark:bg-slate-950/85 dark:shadow-cyan-950/10'
          : 'border-b border-transparent bg-white/40 dark:bg-slate-950/40'
      }`}>
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 xl:gap-8 px-4 sm:px-6 lg:px-8">
          
          {/* Left: Brand Logo & Title */}
          <div className="flex items-center gap-4 sm:gap-6 shrink-0">
            <Link href="/" className="flex items-center gap-2 sm:gap-2.5 group">
              <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-violet-600 to-cyan-500 p-[1.5px] shadow-lg shadow-violet-500/20 group-hover:shadow-cyan-500/30 transition-all duration-300">
                <div className="flex h-full w-full items-center justify-center rounded-[10px] bg-white dark:bg-slate-950 transition-colors duration-300">
                  <Shield className="h-5 w-5 text-violet-600 dark:text-cyan-400 group-hover:scale-110 transition-transform duration-300" />
                </div>
                <span className="absolute -top-0.5 -right-0.5 flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-cyan-500"></span>
                </span>
              </div>
              <div className="hidden min-[500px]:flex items-center">
                <span className="text-lg font-bold tracking-tight bg-gradient-to-r from-gray-950 via-slate-900 to-gray-800 bg-clip-text text-transparent dark:from-white dark:via-slate-100 dark:to-slate-300">
                  SecureDoc
                </span>
                <span className="ml-1.5 text-lg font-bold text-cyan-600 dark:text-cyan-400">
                  Copilot
                </span>
              </div>
            </Link>

            {/* Workspace Selector (Only when logged in) */}
            {mounted && user && (
              <div className="relative flex items-center gap-1" ref={workspaceRef}>
                <motion.button
                  onClick={() => setShowWorkspaceMenu(!showWorkspaceMenu)}
                  whileHover={{ y: -1 }}
                  className="flex items-center gap-2 rounded-xl border border-gray-200/60 bg-white/40 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-white/10 dark:text-slate-200 dark:bg-white/5 dark:hover:bg-white/10 transition-all duration-200 shadow-sm cursor-pointer"
                >
                  <FolderLock className="h-3.5 w-3.5 text-cyan-500" />
                  <span className="max-w-[70px] sm:max-w-[130px] truncate">
                    {currentWorkspace ? currentWorkspace.name : 'Select Workspace'}
                  </span>
                  <ChevronDown className={`h-3 w-3 text-slate-400 transition-transform duration-200 ${showWorkspaceMenu ? 'rotate-180' : ''}`} />
                </motion.button>
                
                {currentWorkspace && (
                  <button
                    onClick={(e) => handleDeleteWorkspace(e, currentWorkspace.id)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-all cursor-pointer"
                    title="Delete Current Workspace"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}

                <AnimatePresence>
                  {showWorkspaceMenu && (
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      transition={{ duration: 0.15 }}
                      className="absolute left-0 top-full mt-2 w-64 origin-top-left rounded-2xl border border-slate-200/50 bg-white/90 backdrop-blur-md p-2 shadow-xl dark:border-white/10 dark:bg-slate-900 z-50"
                    >
                      <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Workspaces
                      </div>
                      <div className="max-h-60 overflow-y-auto py-1">
                        {workspaces.map((ws) => (
                          <div key={ws.id} className="flex items-center group">
                            <button
                              onClick={() => {
                                selectWorkspace(ws);
                                setShowWorkspaceMenu(false);
                              }}
                              className={`flex-1 flex items-center gap-2 rounded-xl px-3 py-2 text-left text-xs transition-colors cursor-pointer ${
                                currentWorkspace?.id === ws.id
                                  ? 'bg-cyan-500/10 text-cyan-400 font-semibold'
                                  : 'text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-white/5'
                              }`}
                            >
                              <FolderLock className="h-3.5 w-3.5 shrink-0" />
                              <span className="truncate">{ws.name}</span>
                            </button>
                            <button
                              onClick={(e) => handleDeleteWorkspace(e, ws.id)}
                              className="p-2 text-slate-400 hover:text-rose-500 transition-all cursor-pointer"
                              title="Delete Workspace"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                      <div className="border-t border-slate-200/50 my-1.5 dark:border-white/5" />
                      <button
                        onClick={() => {
                          setShowCreateModal(true);
                          setShowWorkspaceMenu(false);
                        }}
                        className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-semibold text-violet-600 hover:bg-violet-50 dark:text-cyan-400 dark:hover:bg-white/5 cursor-pointer"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        <span>Create Workspace</span>
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>

          {/* Center: Desktop Navigation Links */}
          {mounted && user && currentWorkspace && (
            <nav className="hidden lg:flex items-center justify-center gap-1.5 px-1.5 py-1 rounded-2xl border border-slate-200/30 bg-slate-100/30 dark:border-white/5 dark:bg-white/5 backdrop-blur-sm shadow-inner">
              {navLinks.map((link) => {
                const isActive = pathname === link.href;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all duration-200 border ${
                      isActive
                        ? 'bg-white border-slate-200/60 text-cyan-600 dark:bg-slate-900 dark:border-white/10 dark:text-cyan-400 shadow-sm'
                        : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-100/60 dark:text-slate-400 dark:hover:text-white dark:hover:bg-white/5'
                    }`}
                  >
                    {link.name}
                  </Link>
                );
              })}
            </nav>
          )}

          {/* Right: Actions */}
          <div className="flex items-center gap-3 sm:gap-4 shrink-0">
            
            {/* GitHub Action Buttons (Desktop only) */}
            <nav className="hidden xl:flex items-center gap-3">
              <motion.a
                href="https://github.com/Techie03/securedoc-copilot"
                target="_blank"
                rel="noopener noreferrer"
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.98 }}
                className="flex items-center gap-1.5 rounded-xl border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 bg-white/40 hover:bg-gray-50 dark:border-white/10 dark:text-slate-200 dark:bg-white/5 dark:hover:bg-white/10 transition-colors duration-200 shadow-sm"
                title="View Code"
              >
                <Github className="h-4 w-4" />
                <span className="hidden xl:inline">View Code</span>
              </motion.a>

              <motion.a
                href="https://github.com/Techie03/securedoc-copilot/fork"
                target="_blank"
                rel="noopener noreferrer"
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.98 }}
                className="flex items-center gap-1.5 rounded-xl border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 bg-white/40 hover:bg-gray-50 dark:border-white/10 dark:text-slate-200 dark:bg-white/5 dark:hover:bg-white/10 transition-colors duration-200 shadow-sm"
                title="Fork Repo"
              >
                <GitFork className="h-3.5 w-3.5" />
                <span className="hidden xl:inline">Fork Repo</span>
              </motion.a>
            </nav>

            {/* Vertical Divider (Desktop Only) */}
            <span className="hidden xl:block h-6 w-[1px] bg-gray-200 dark:bg-white/10" />

            {/* User Login/Signup or User Profile menu */}
            {mounted && (
              user ? (
                /* User Menu Dropdown */
                <div className="relative" ref={userRef}>
                  <motion.button
                    onClick={() => setShowUserMenu(!showUserMenu)}
                    whileHover={{ y: -1 }}
                    className="flex items-center gap-2 rounded-xl border border-gray-200/60 bg-white/40 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-white/10 dark:text-slate-200 dark:bg-white/5 dark:hover:bg-white/10 transition-all duration-200 shadow-sm cursor-pointer"
                  >
                    <div className="flex h-5 w-5 items-center justify-center rounded-lg bg-gradient-to-tr from-cyan-500 to-violet-500 text-[10px] font-bold text-white uppercase">
                      {user.full_name.charAt(0)}
                    </div>
                    <span className="max-w-[100px] truncate hidden md:inline">{user.full_name}</span>
                    <ChevronDown className={`h-3 w-3 text-slate-400 transition-transform duration-200 ${showUserMenu ? 'rotate-180' : ''}`} />
                  </motion.button>

                  <AnimatePresence>
                    {showUserMenu && (
                      <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        transition={{ duration: 0.15 }}
                        className="absolute right-0 mt-2 w-48 origin-top-right rounded-2xl border border-slate-200/50 bg-white/90 backdrop-blur-md p-2 shadow-xl dark:border-white/10 dark:bg-slate-900"
                      >
                        <div className="px-3 py-2">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Signed in as</p>
                          <p className="truncate text-xs font-semibold text-slate-700 dark:text-slate-200">{user.email}</p>
                        </div>
                        <div className="border-t border-slate-200/50 my-1.5 dark:border-white/5" />
                        <Link
                          href="/dashboard"
                          onClick={() => setShowUserMenu(false)}
                          className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-white/5"
                        >
                          <UserIcon className="h-3.5 w-3.5" />
                          <span>Dashboard</span>
                        </Link>
                        <button
                          onClick={() => {
                            logout();
                            setShowUserMenu(false);
                          }}
                          className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-white/5 cursor-pointer"
                        >
                          <LogOut className="h-3.5 w-3.5" />
                          <span>Sign Out</span>
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ) : (
                /* Login / Signup buttons */
                <div className="flex items-center gap-2">
                  <Link href="/login">
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      className="rounded-xl px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 dark:text-slate-200 dark:hover:text-white transition-colors cursor-pointer"
                    >
                      Sign In
                    </motion.button>
                  </Link>
                  <Link href="/signup">
                    <motion.button
                      whileHover={{ scale: 1.02, y: -1 }}
                      className="relative overflow-hidden rounded-xl bg-gradient-to-r from-violet-600 to-cyan-600 px-4 py-1.5 text-xs font-semibold text-white shadow-md shadow-violet-500/10 cursor-pointer"
                    >
                      Sign Up
                    </motion.button>
                  </Link>
                </div>
              )
            )}

            {/* Theme Switcher Button */}
            <motion.button
              onClick={toggleTheme}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              aria-label="Toggle Night Mode"
              className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 bg-white/50 hover:bg-gray-50 shadow-sm dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10 transition-all duration-300 cursor-pointer"
            >
              <AnimatePresence mode="wait" initial={false}>
                {!mounted ? (
                  <motion.div key="loading" className="h-4 w-4 rounded-full border-2 border-cyan-500 border-t-transparent animate-spin" />
                ) : theme === 'dark' ? (
                  <motion.div
                    key="moon"
                    initial={{ opacity: 0, rotate: -90, scale: 0.7 }}
                    animate={{ opacity: 1, rotate: 0, scale: 1 }}
                    exit={{ opacity: 0, rotate: 90, scale: 0.7 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Moon className="h-5 w-5 text-cyan-400" />
                  </motion.div>
                ) : (
                  <motion.div
                    key="sun"
                    initial={{ opacity: 0, rotate: 90, scale: 0.7 }}
                    animate={{ opacity: 1, rotate: 0, scale: 1 }}
                    exit={{ opacity: 0, rotate: -90, scale: 0.7 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Sun className="h-5 w-5 text-amber-500" />
                  </motion.div>
                )
                }
              </AnimatePresence>
            </motion.button>

            {/* Mobile Menu Button (Hamburger) */}
            {mounted && user && (
              <motion.button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="flex lg:hidden h-10 w-10 items-center justify-center rounded-xl border border-gray-200 bg-white/50 hover:bg-gray-50 shadow-sm dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10 transition-all duration-300 cursor-pointer"
                aria-label="Toggle Menu"
              >
                {mobileMenuOpen ? (
                  <X className="h-5 w-5 text-gray-600 dark:text-slate-300" />
                ) : (
                  <Menu className="h-5 w-5 text-gray-600 dark:text-slate-300" />
                )}
              </motion.button>
            )}

          </div>
        </div>
      </header>

      {/* Mobile Navigation Drawer */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="lg:hidden border-b border-gray-200/40 bg-white/95 backdrop-blur-md dark:border-white/10 dark:bg-slate-950/95 overflow-hidden"
          >
            <div className="space-y-4 px-4 py-6">
              {/* Navigation Links */}
              <nav className="flex flex-col gap-1.5">
                {navLinks.map((link) => {
                  const isActive = pathname === link.href;
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex w-full items-center justify-between rounded-xl px-4 py-3 text-sm font-bold transition-all border ${
                        isActive
                          ? 'bg-cyan-50 border-cyan-200/60 text-cyan-600 dark:bg-cyan-500/10 dark:border-cyan-500/20 dark:text-cyan-400'
                          : 'border-transparent text-gray-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-white/5'
                      }`}
                    >
                      <span>{link.name}</span>
                      <ChevronDown className="h-4 w-4 -rotate-90 text-slate-400" />
                    </Link>
                  );
                })}
              </nav>

              <div className="border-t border-gray-200/40 dark:border-white/10 my-4" />

              {/* GitHub buttons (Mobile view) */}
              <div className="grid grid-cols-2 gap-3">
                <a
                  href="https://github.com/Techie03/securedoc-copilot"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 rounded-xl border border-gray-200 py-2.5 text-xs font-semibold text-gray-700 bg-white hover:bg-gray-50 dark:border-white/10 dark:text-slate-200 dark:bg-white/5 dark:hover:bg-white/10 transition-colors"
                >
                  <Github className="h-4 w-4" />
                  <span>View Code</span>
                </a>
                <a
                  href="https://github.com/Techie03/securedoc-copilot/fork"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 rounded-xl border border-gray-200 py-2.5 text-xs font-semibold text-gray-700 bg-white hover:bg-gray-50 dark:border-white/10 dark:text-slate-200 dark:bg-white/5 dark:hover:bg-white/10 transition-colors"
                >
                  <GitFork className="h-4 w-4" />
                  <span>Fork Repo</span>
                </a>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Futuristic Neon Workspace Creation Modal */}
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

              <form onSubmit={handleCreateWorkspaceSubmit} className="space-y-4">
                {modalError && (
                  <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-500 dark:text-rose-400">
                    {modalError}
                  </div>
                )}

                <div>
                  <label htmlFor="ws-name" className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                    Workspace Name
                  </label>
                  <input
                    id="ws-name"
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
    </>
  );
}
