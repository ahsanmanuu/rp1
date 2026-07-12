"use client";

import React from "react";
import { X, Lock, LogIn, UserPlus } from "lucide-react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";

interface LoginPromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  message?: string;
}

export default function LoginPromptModal({
  isOpen,
  onClose,
  title = "Scholarly Access Required",
  message = "Please sign in or register to view the Templates Gallery and access premium LaTeX formats."
}: LoginPromptModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md" onClick={onClose}>
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-md overflow-hidden rounded-3xl border border-white/10 bg-slate-950 p-8 text-center shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close btn */}
            <button
              onClick={onClose}
              className="absolute right-6 top-6 rounded-xl bg-white/5 p-2 text-slate-400 hover:bg-white/10 hover:text-white transition-colors"
            >
              <X size={16} />
            </button>

            {/* Icon */}
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-400">
              <Lock size={32} />
            </div>

            {/* Title & Msg */}
            <h3 className="mb-3 text-2xl font-black tracking-tight text-white">{title}</h3>
            <p className="mb-8 text-sm leading-relaxed text-slate-400">{message}</p>

            {/* Buttons */}
            <div className="flex flex-col gap-3">
              <Link
                href="/login"
                className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 font-bold text-white shadow-lg shadow-indigo-600/30 hover:bg-indigo-500 transition-colors"
              >
                <LogIn size={16} /> Log In
              </Link>
              <Link
                href="/register"
                className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 font-bold text-white hover:bg-white/10 transition-colors"
              >
                <UserPlus size={16} /> Create Free Account
              </Link>
              <button
                onClick={onClose}
                className="mt-2 text-xs font-semibold uppercase tracking-wider text-slate-500 hover:text-slate-300 transition-colors"
              >
                Maybe Later
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
