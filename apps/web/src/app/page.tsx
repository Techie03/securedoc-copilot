'use client';

import React from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { Shield, Brain, Sparkles, Cpu, ChevronRight, BarChart2, FolderLock, Database, GitFork } from 'lucide-react';
import Github from '@/components/icons/Github';

const features = [
  {
    icon: Shield,
    title: 'Enterprise Workspace Isolation',
    desc: 'Strict multi-user access control and permission-aware vector segment filtering.',
    color: 'from-blue-500 to-indigo-600',
  },
  {
    icon: Brain,
    title: 'Persistent Memory Manager',
    desc: 'SQL-backed semantic memory extraction for user preferences and project terminology.',
    color: 'from-violet-500 to-purple-600',
  },
  {
    icon: Cpu,
    title: 'NVIDIA NIM Orchestrator',
    desc: 'LLMs, embeddings, and custom rerankers powered exclusively by high-speed NVIDIA NIM.',
    color: 'from-cyan-500 to-emerald-500',
  },
  {
    icon: BarChart2,
    title: 'RAG Evaluation Dashboard',
    desc: 'Live tracking of precision, faithfulness, citation accuracy, token count, and cost.',
    color: 'from-pink-500 to-rose-600',
  },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15,
    },
  },
};

const itemVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: { y: 0, opacity: 1, transition: { duration: 0.5, ease: 'easeOut' as const } },
};

export default function Home() {
  return (
    <div className="relative min-h-[calc(100vh-4rem)] flex flex-col justify-between overflow-hidden bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
      
      {/* Glow effects */}
      <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 h-[350px] w-[350px] rounded-full bg-violet-600/10 blur-[100px] pointer-events-none dark:bg-violet-500/15" />
      <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 h-[400px] w-[400px] rounded-full bg-cyan-600/10 blur-[120px] pointer-events-none dark:bg-cyan-500/15" />

      {/* Grid Pattern overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:14px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none" />

      {/* Main Content */}
      <div className="relative z-10 mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8 flex-1 flex flex-col justify-center items-center text-center">
        
        {/* Banner badge */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6 }}
          className="inline-flex items-center gap-1.5 rounded-full border border-violet-200 bg-violet-50/50 px-3.5 py-1 text-xs font-semibold text-violet-700 dark:border-violet-500/30 dark:bg-violet-950/30 dark:text-violet-400"
        >
          <Sparkles className="h-3.5 w-3.5 animate-pulse" />
          <span>Exclusive NVIDIA NIM AI Model Provider Policy</span>
        </motion.div>

        {/* Hero title */}
        <motion.h1
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.6 }}
          className="mt-6 text-4xl font-extrabold tracking-tight sm:text-6xl max-w-4xl"
        >
          <span className="bg-gradient-to-r from-gray-950 via-slate-900 to-gray-800 bg-clip-text text-transparent dark:from-white dark:via-slate-100 dark:to-slate-300">
            SecureDoc Copilot
          </span>
          <br />
          <span className="bg-gradient-to-r from-violet-600 via-indigo-500 to-cyan-500 bg-clip-text text-transparent">
            Agentic Knowledge Intelligence
          </span>
        </motion.h1>

        {/* Description */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.6 }}
          className="mt-6 max-w-2xl text-lg text-slate-600 dark:text-slate-400"
        >
          Search. Reason. Remember. Act. A futuristic next-generation AI assistant that operates securely across your private documents, enterprise APIs, and codebase using private workspace isolation.
        </motion.p>

        {/* Actions */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.6 }}
          className="mt-10 flex flex-wrap justify-center gap-4"
        >
          <Link href="/dashboard" className="group relative flex h-12 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-r from-violet-600 to-cyan-600 px-6 font-semibold text-white shadow-lg shadow-violet-500/20 hover:shadow-cyan-500/30 transition-all duration-300">
            <span className="relative z-10 flex items-center gap-2">
              Launch Agent Dashboard
              <ChevronRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
            </span>
            <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-cyan-500 to-violet-500 transition-transform duration-300 hover:translate-x-0"></span>
          </Link>
          <a
            href="https://github.com/Techie03/securedoc-copilot/fork"
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-12 items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white/50 px-6 font-semibold text-slate-700 backdrop-blur-sm hover:bg-gray-100 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10 transition-colors duration-200"
          >
            <Github className="h-5 w-5" />
            <span>Fork Blueprint</span>
          </a>
        </motion.div>

        {/* Product Demo Video */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.8 }}
          className="mt-16 w-full max-w-4xl mx-auto rounded-3xl bg-gradient-to-tr from-violet-500 via-cyan-500 to-indigo-500 p-[1.5px] shadow-2xl shadow-violet-500/10 dark:shadow-violet-950/20 relative"
        >
          {/* Neon background glows */}
          <div className="absolute -inset-1 rounded-3xl bg-gradient-to-tr from-violet-500 to-cyan-500 opacity-20 blur-lg -z-10 animate-pulse" />
          
          <div className="overflow-hidden rounded-[22px] bg-slate-900 aspect-video relative flex items-center justify-center">
            <video
              src="https://github.com/user-attachments/assets/63005eb6-0282-4944-b7e6-89ece03d411c"
              controls
              autoPlay
              muted
              loop
              playsInline
              preload="metadata"
              className="w-full h-full object-cover"
            />
          </div>
        </motion.div>

        {/* Core Features Grid */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="mt-20 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 max-w-6xl w-full"
        >
          {features.map((feat, idx) => {
            const IconComp = feat.icon;
            return (
              <motion.div
                key={idx}
                variants={itemVariants}
                whileHover={{ y: -6, transition: { duration: 0.2 } }}
                className="relative overflow-hidden rounded-2xl border border-gray-200/50 bg-white/40 p-6 text-left backdrop-blur-md shadow-sm dark:border-white/5 dark:bg-slate-900/40"
              >
                <div className={`inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${feat.color} text-white shadow-md`}>
                  <IconComp className="h-6 w-6" />
                </div>
                <h3 className="mt-4 text-base font-bold text-slate-900 dark:text-white">
                  {feat.title}
                </h3>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                  {feat.desc}
                </p>
              </motion.div>
            );
          })}
        </motion.div>

      </div>

      {/* Footer Info */}
      <footer className="relative z-10 border-t border-gray-200/40 py-6 text-center text-xs text-slate-500 dark:border-white/5 dark:text-slate-600 transition-colors">
        <div className="mx-auto max-w-7xl px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4 text-cyan-500" />
            <span>Qdrant Vector Database + PostgreSQL Engine</span>
          </div>
          <div>
            <span>© 2026 SecureDoc Copilot. Built with LangGraph & NVIDIA NIM.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
