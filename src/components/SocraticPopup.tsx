import React from 'react';
import { motion } from 'framer-motion';
import { X, Sparkles } from 'lucide-react';

interface SocraticPopupProps {
  questions: string[];
  onClose: () => void;
}

export function SocraticPopup({ questions, onClose }: SocraticPopupProps) {
  const sharpestQuestion = questions[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="relative w-full max-w-md p-8 bg-zinc-900/90 backdrop-blur-xl border border-indigo-500/30 rounded-3xl shadow-[0_0_40px_rgba(99,102,241,0.2)] text-center"
      >
        <div className="absolute -top-6 left-1/2 -translate-x-1/2 p-3 bg-indigo-500 rounded-full shadow-lg shadow-indigo-500/50">
          <Sparkles className="w-6 h-6 text-white" />
        </div>
        
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 rounded-full transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="mt-6 space-y-8">
          <p className="text-2xl font-medium text-zinc-100 leading-relaxed tracking-tight">
            "{sharpestQuestion}"
          </p>
          <button
            onClick={onClose}
            className="px-6 py-3 text-sm font-medium text-white bg-indigo-500 hover:bg-indigo-400 rounded-full transition-colors shadow-lg shadow-indigo-500/25"
          >
            Continue Thinking
          </button>
        </div>
      </motion.div>
    </div>
  );
}
