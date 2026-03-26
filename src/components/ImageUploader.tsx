import React, { useState, useRef } from 'react';
import { UploadCloud, X, Image as ImageIcon } from 'lucide-react';
import { motion } from 'framer-motion';

interface ImageUploaderProps {
  onUpload: (base64Image: string, mimeType: string) => void;
  onClose: () => void;
}

export function ImageUploader({ onUpload, onClose }: ImageUploaderProps) {
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const processFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        onUpload(event.target.result as string, file.type);
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative w-full max-w-md overflow-hidden bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800/50 bg-zinc-900/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/10 rounded-lg">
              <ImageIcon className="w-5 h-5 text-indigo-400" />
            </div>
            <h2 className="text-sm font-medium text-zinc-200">Upload Sketch</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6">
          <form
            onDragEnter={handleDrag}
            onSubmit={(e) => e.preventDefault()}
            className="relative flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-xl transition-colors cursor-pointer"
            style={{
              borderColor: dragActive ? '#6366f1' : '#3f3f46',
              backgroundColor: dragActive ? 'rgba(99, 102, 241, 0.05)' : 'rgba(24, 24, 27, 0.5)',
            }}
            onClick={() => inputRef.current?.click()}
          >
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              onChange={handleChange}
              className="hidden"
            />
            <UploadCloud
              className="w-12 h-12 mb-4 transition-colors"
              style={{ color: dragActive ? '#6366f1' : '#71717a' }}
            />
            <p className="text-sm font-medium text-zinc-300">
              Drag & drop your sketch here
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              or click to browse from your computer
            </p>
            {dragActive && (
              <div
                className="absolute inset-0 z-10"
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
              />
            )}
          </form>
        </div>
      </motion.div>
    </div>
  );
}
