'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Play,
  Pause,
  RotateCcw,
  Sparkles,
  Film,
  CheckCircle2,
  ArrowRight,
  Store,
  Globe,
  Share2,
  Lock,
  PlusCircle,
  X,
} from 'lucide-react';

interface StepChapter {
  id: number;
  title: string;
  subtitle: string;
  durationSec: number;
  highlightIcon: string;
}

const CHAPTERS: StepChapter[] = [
  {
    id: 1,
    title: '1. Info Acara & PIC',
    subtitle: 'Nama acara, PIC, dan tempat makan',
    durationSec: 6,
    highlightIcon: '📝',
  },
  {
    id: 2,
    title: '2. Masukkan Menu',
    subtitle: '1-Klik Preset Mr. Suprek, Link Web, atau Foto',
    durationSec: 8,
    highlightIcon: '🍗',
  },
  {
    id: 3,
    title: '3. Pajak & Pembulatan',
    subtitle: 'PPN 10% & pembulatan tanpa uang receh',
    durationSec: 6,
    highlightIcon: '🧮',
  },
  {
    id: 4,
    title: '4. Sebar Link WhatsApp',
    subtitle: 'Dapatkan PIN & kirim link ke grup kantor',
    durationSec: 6,
    highlightIcon: '📱',
  },
];

const TOTAL_DURATION_SEC = CHAPTERS.reduce((acc, c) => acc + c.durationSec, 0); // 26s

interface TutorialVideoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function TutorialVideoModal({ isOpen, onClose }: TutorialVideoModalProps) {
  const [isPlaying, setIsPlaying] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [activeChapterIndex, setActiveChapterIndex] = useState(0);

  // Reset and auto-play when modal opens
  useEffect(() => {
    if (isOpen) {
      setCurrentTime(0);
      setActiveChapterIndex(0);
      setIsPlaying(true);
    } else {
      setIsPlaying(false);
    }
  }, [isOpen]);

  // Handle escape key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  // Animation timer
  useEffect(() => {
    if (!isOpen || !isPlaying) return;

    const interval = setInterval(() => {
      setCurrentTime((prev) => {
        if (prev >= TOTAL_DURATION_SEC) {
          setIsPlaying(false);
          return TOTAL_DURATION_SEC;
        }
        const next = Math.round((prev + 0.1) * 10) / 10;

        let elapsed = 0;
        for (let i = 0; i < CHAPTERS.length; i++) {
          elapsed += CHAPTERS[i].durationSec;
          if (next <= elapsed) {
            setActiveChapterIndex(i);
            break;
          }
        }

        return next;
      });
    }, 100);

    return () => clearInterval(interval);
  }, [isOpen, isPlaying]);

  if (!isOpen) return null;

  const handleTogglePlay = () => {
    if (currentTime >= TOTAL_DURATION_SEC) {
      setCurrentTime(0);
      setActiveChapterIndex(0);
    }
    setIsPlaying(!isPlaying);
  };

  const handleRestart = () => {
    setCurrentTime(0);
    setActiveChapterIndex(0);
    setIsPlaying(true);
  };

  const handleSelectChapter = (index: number) => {
    let startSec = 0;
    for (let i = 0; i < index; i++) {
      startSec += CHAPTERS[i].durationSec;
    }
    setCurrentTime(startSec);
    setActiveChapterIndex(index);
    setIsPlaying(true);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/75 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl bg-slate-950 rounded-2xl border border-slate-700 shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Window Top Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-slate-900 border-b border-slate-800 select-none">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-rose-500/90" />
            <div className="w-3 h-3 rounded-full bg-amber-500/90" />
            <div className="w-3 h-3 rounded-full bg-emerald-500/90" />
            <span className="ml-2 text-xs font-mono text-slate-300 font-semibold flex items-center gap-1.5">
              <Film className="w-3.5 h-3.5 text-orange-400" />
              <span>Video Tutorial: Cara Bikin Acara Makan</span>
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono text-orange-400 bg-orange-950/80 px-2 py-0.5 rounded border border-orange-800">
              ⏱️ ~30 Detik
            </span>
            <button
              type="button"
              onClick={onClose}
              className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Video Canvas Stage */}
        <div className="relative aspect-[16/10] sm:aspect-[16/9] w-full bg-gradient-to-b from-slate-900 via-slate-925 to-slate-950 flex flex-col justify-between p-4 sm:p-6 select-none overflow-hidden text-white">
          {/* Ambient Glows */}
          <div className="absolute top-1/4 left-1/3 w-60 h-60 bg-orange-600/15 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-5 right-1/4 w-60 h-60 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

          {/* Current Chapter Indicator */}
          <div className="relative z-10 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xl sm:text-2xl">
                {CHAPTERS[activeChapterIndex].highlightIcon}
              </span>
              <div>
                <span className="text-[10px] font-bold text-orange-400 uppercase tracking-widest block">
                  Tahap {activeChapterIndex + 1} dari 4
                </span>
                <h3 className="text-sm sm:text-base font-extrabold text-white">
                  {CHAPTERS[activeChapterIndex].title}
                </h3>
              </div>
            </div>

            <div className="text-right">
              <span className="text-[11px] font-mono text-slate-400 bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700">
                {Math.floor(currentTime)}s / {TOTAL_DURATION_SEC}s
              </span>
            </div>
          </div>

          {/* Animated Walkthrough Scene */}
          <div className="relative z-10 my-auto py-1">
            {/* Scene 1: Basic Info */}
            {activeChapterIndex === 0 && (
              <div className="max-w-md mx-auto bg-slate-900/90 border border-slate-700/80 rounded-xl p-3.5 sm:p-4 shadow-xl backdrop-blur-md space-y-2.5 animate-in fade-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    <Store className="w-3.5 h-3.5 text-orange-400" />
                    1. Info Acara & Restoran
                  </span>
                  <span className="text-[9px] text-emerald-400 bg-emerald-950/80 border border-emerald-800 px-1.5 py-0.5 rounded font-bold">
                    ✓ Otomatis
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-left text-xs">
                  <div className="bg-slate-950/80 p-2 rounded-lg border border-slate-800">
                    <span className="text-slate-500 block text-[9px]">Nama Acara:</span>
                    <strong className="text-orange-300 text-[11px] font-semibold truncate block">
                      Makan Siang Tim 🍱
                    </strong>
                  </div>
                  <div className="bg-slate-950/80 p-2 rounded-lg border border-slate-800">
                    <span className="text-slate-500 block text-[9px]">Nama PIC Admin:</span>
                    <strong className="text-slate-200 text-[11px] font-semibold truncate block">
                      Budi (Divisi IT)
                    </strong>
                  </div>
                  <div className="bg-slate-950/80 p-2 rounded-lg border border-slate-800 col-span-2 flex items-center justify-between">
                    <div>
                      <span className="text-slate-500 block text-[9px]">Restoran Terpilih:</span>
                      <strong className="text-amber-400 text-[11px] font-semibold">
                        Ayam Geprek Mr. Suprek
                      </strong>
                    </div>
                    <span className="text-[10px] text-slate-400">Cabang Surabaya</span>
                  </div>
                </div>
              </div>
            )}

            {/* Scene 2: Menu Import Options */}
            {activeChapterIndex === 1 && (
              <div className="max-w-md mx-auto bg-slate-900/90 border border-slate-700/80 rounded-xl p-3.5 sm:p-4 shadow-xl backdrop-blur-md space-y-2.5 animate-in fade-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-orange-400" />
                    2. Masukkan Menu Pilihan
                  </span>
                  <span className="text-[9px] text-orange-400 bg-orange-950/80 border border-orange-800 px-1.5 py-0.5 rounded font-bold">
                    65+ Menu Siap Klik
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="p-2.5 rounded-lg bg-orange-950/70 border-2 border-orange-500 text-orange-200 flex flex-col items-center justify-center gap-1 shadow-md scale-105">
                    <span className="text-lg">🍗</span>
                    <span className="font-extrabold text-[10px]">1-Klik Preset</span>
                    <span className="text-[8px] text-orange-300/80">Suprek / Tanjung Api</span>
                  </div>

                  <div className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800 text-slate-300 flex flex-col items-center justify-center gap-1">
                    <Globe className="w-4 h-4 text-blue-400" />
                    <span className="font-bold text-[10px]">Link Web</span>
                    <span className="text-[8px] text-slate-500">mrsuprek.com</span>
                  </div>

                  <div className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800 text-slate-300 flex flex-col items-center justify-center gap-1">
                    <span className="text-lg">📸</span>
                    <span className="font-bold text-[10px]">Upload Foto</span>
                    <span className="text-[8px] text-slate-500">Kamera HP / PDF</span>
                  </div>
                </div>

                <p className="text-[10px] text-center text-slate-400 pt-0.5">
                  👉 Cukup klik <strong>Preset Mr. Suprek</strong>, seluruh menu, harga, dan foto resmi langsung masuk seketika!
                </p>
              </div>
            )}

            {/* Scene 3: Tax & Rounding */}
            {activeChapterIndex === 2 && (
              <div className="max-w-md mx-auto bg-slate-900/90 border border-slate-700/80 rounded-xl p-3.5 sm:p-4 shadow-xl backdrop-blur-md space-y-2.5 animate-in fade-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    3. Pengaturan PPN & Pembulatan
                  </span>
                  <span className="text-[9px] text-emerald-400 bg-emerald-950/80 border border-emerald-800 px-1.5 py-0.5 rounded font-bold">
                    Anti Uang Receh
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-left text-xs">
                  <div className="bg-slate-950/80 p-2.5 rounded-lg border border-slate-800 space-y-1">
                    <span className="text-slate-400 font-bold block text-[10px]">
                      Pajak Tambahan (PPN):
                    </span>
                    <span className="inline-block px-1.5 py-0.5 rounded bg-emerald-900/60 text-emerald-300 text-[10px] font-bold border border-emerald-700">
                      PPN 10% (Opsional)
                    </span>
                    <p className="text-[9px] text-slate-500">
                      Dihitung otomatis proporsional per orang.
                    </p>
                  </div>

                  <div className="bg-slate-950/80 p-2.5 rounded-lg border border-slate-800 space-y-1">
                    <span className="text-slate-400 font-bold block text-[10px]">
                      Opsi Pembulatan:
                    </span>
                    <span className="inline-block px-1.5 py-0.5 rounded bg-orange-900/60 text-orange-300 text-[10px] font-bold border border-orange-700">
                      Pembulatan Rp 1.000
                    </span>
                    <p className="text-[9px] text-slate-500">
                      Rp 24.600 jadi Rp 25.000 agar transfer pas.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Scene 4: Finish & Share to WA */}
            {activeChapterIndex === 3 && (
              <div className="max-w-md mx-auto bg-slate-900/90 border border-slate-700/80 rounded-xl p-3.5 sm:p-4 shadow-xl backdrop-blur-md space-y-2.5 animate-in fade-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    <Share2 className="w-3.5 h-3.5 text-emerald-400" />
                    4. Selesai! Sebarkan Link ke WhatsApp
                  </span>
                  <span className="text-[9px] text-emerald-400 bg-emerald-950/80 border border-emerald-800 px-1.5 py-0.5 rounded font-bold">
                    Siap Pakai
                  </span>
                </div>

                <div className="space-y-2 text-center">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-slate-950 border border-slate-800 text-xs">
                    <Lock className="w-3 h-3 text-orange-400" />
                    <span className="text-slate-300 text-[11px]">PIN Admin PIC:</span>
                    <strong className="text-orange-400 font-mono text-xs tracking-wider">
                      8899
                    </strong>
                  </div>

                  <div>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-bold text-xs shadow-md">
                      <Share2 className="w-3 h-3" />
                      <span>Kirim Link ke WhatsApp Kantor</span>
                    </span>
                  </div>

                  <p className="text-[10px] text-slate-400">
                    Teman kantor tinggal buka di HP & tagihan split-bill terhitung otomatis!
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Progress Bar & Controls */}
          <div className="relative z-10 space-y-1.5 pt-1">
            <div
              className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden cursor-pointer"
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const clickX = e.clientX - rect.left;
                const ratio = Math.max(0, Math.min(1, clickX / rect.width));
                setCurrentTime(Math.round(ratio * TOTAL_DURATION_SEC));
              }}
            >
              <div
                className="bg-gradient-to-r from-orange-500 to-amber-400 h-full transition-all duration-100 ease-linear rounded-full"
                style={{
                  width: `${Math.min(100, (currentTime / TOTAL_DURATION_SEC) * 100)}%`,
                }}
              />
            </div>

            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleTogglePlay}
                  className="w-7 h-7 rounded-full bg-orange-600 hover:bg-orange-500 text-white flex items-center justify-center transition shadow-md"
                >
                  {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 ml-0.5" />}
                </button>

                <button
                  type="button"
                  onClick={handleRestart}
                  className="p-1 text-slate-400 hover:text-white transition"
                  title="Ulangi dari awal"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>

                <span className="text-[10px] font-mono text-slate-400 hidden sm:inline">
                  {CHAPTERS[activeChapterIndex].subtitle}
                </span>
              </div>

              <span className="text-[10px] text-slate-500">
                Klik bab di bawah untuk lompat
              </span>
            </div>
          </div>
        </div>

        {/* Chapter Tabs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 p-2 bg-slate-900 border-t border-slate-800">
          {CHAPTERS.map((ch, idx) => (
            <button
              key={ch.id}
              type="button"
              onClick={() => handleSelectChapter(idx)}
              className={`p-2 rounded-lg text-left transition flex items-center gap-1.5 ${
                activeChapterIndex === idx
                  ? 'bg-orange-600/20 text-orange-300 border border-orange-500/40'
                  : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
              }`}
            >
              <span className="text-sm shrink-0">{ch.highlightIcon}</span>
              <div className="min-w-0">
                <strong className="block text-[10px] font-bold truncate leading-tight">
                  {ch.title}
                </strong>
                <span className="text-[9px] text-slate-500 truncate block">
                  {ch.durationSec}d
                </span>
              </div>
            </button>
          ))}
        </div>

        {/* Modal Action Footer */}
        <div className="px-4 py-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
          >
            Tutup
          </button>

          <Link
            href="/create"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>Mulai Buat Acara Sekarang</span>
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      </div>
    </div>
  );
}
