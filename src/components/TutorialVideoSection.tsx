'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  Play,
  Pause,
  RotateCcw,
  Sparkles,
  Maximize2,
  Minimize2,
  Film,
  CheckCircle2,
  ArrowRight,
  Settings,
  ExternalLink,
  Store,
  Globe,
  Share2,
  Lock,
  PlusCircle,
  HelpCircle,
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
    title: '1. Isi Info Acara & PIC',
    subtitle: 'Nama acara, nama PIC, dan nama restoran pilihan',
    durationSec: 6,
    highlightIcon: '📝',
  },
  {
    id: 2,
    title: '2. Masukkan Menu',
    subtitle: '1-Klik Preset Mr. Suprek, Link Web, atau Upload Foto',
    durationSec: 8,
    highlightIcon: '🍗',
  },
  {
    id: 3,
    title: '3. Pajak & Pembulatan',
    subtitle: 'Setel PPN & pembulatan rupiah agar tagihan pas tanpa receh',
    durationSec: 6,
    highlightIcon: '🧮',
  },
  {
    id: 4,
    title: '4. Sebar Link WhatsApp',
    subtitle: 'Dapatkan PIN Admin & sebarkan link ke teman kantor',
    durationSec: 6,
    highlightIcon: '📱',
  },
];

const TOTAL_DURATION_SEC = CHAPTERS.reduce((acc, c) => acc + c.durationSec, 0); // 26s

export default function TutorialVideoSection() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [activeChapterIndex, setActiveChapterIndex] = useState(0);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [customVideoUrl, setCustomVideoUrl] = useState('');
  const [savedVideoUrl, setSavedVideoUrl] = useState('');
  const [showSettings, setShowSettings] = useState(false);

  // Load custom video URL from localStorage if any
  useEffect(() => {
    try {
      const stored = localStorage.getItem('makan_kantor_custom_tutorial_url');
      if (stored) {
        setSavedVideoUrl(stored);
        setCustomVideoUrl(stored);
      }
    } catch {}
  }, []);

  // Animation timer for simulated tutorial video
  useEffect(() => {
    if (!isPlaying || savedVideoUrl) return;

    const interval = setInterval(() => {
      setCurrentTime((prev) => {
        if (prev >= TOTAL_DURATION_SEC) {
          setIsPlaying(false);
          return TOTAL_DURATION_SEC;
        }
        const next = Math.round((prev + 0.1) * 10) / 10;

        // Determine current chapter
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
  }, [isPlaying, savedVideoUrl]);

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

  const handleSaveCustomUrl = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = customVideoUrl.trim();
    setSavedVideoUrl(clean);
    try {
      if (clean) {
        localStorage.setItem('makan_kantor_custom_tutorial_url', clean);
      } else {
        localStorage.removeItem('makan_kantor_custom_tutorial_url');
      }
    } catch {}
    setShowSettings(false);
  };

  // Convert YouTube standard URL to embed URL if applicable
  const getEmbedUrl = (url: string) => {
    if (!url) return '';
    if (url.includes('youtube.com/watch?v=')) {
      const videoId = url.split('watch?v=')[1]?.split('&')[0];
      return `https://www.youtube.com/embed/${videoId}?autoplay=1`;
    }
    if (url.includes('youtu.be/')) {
      const videoId = url.split('youtu.be/')[1]?.split('?')[0];
      return `https://www.youtube.com/embed/${videoId}?autoplay=1`;
    }
    return url;
  };

  return (
    <section id="tutorial-section" className="space-y-6">
      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-100/80 text-orange-700 text-xs font-bold mb-2">
            <Film className="w-3.5 h-3.5" />
            <span>Panduan Interaktif PIC</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Video Tutorial: Cara Bikin Acara Makan Kantor
          </h2>
          <p className="text-slate-600 text-sm max-w-2xl mt-1">
            Pelajari alur cepat dari pembuatan acara, memilih menu restoran (preset/link/foto), hingga membagikan link pesanan ke grup WhatsApp dalam waktu kurang dari 1 menit!
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowSettings(!showSettings)}
            className="text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl transition flex items-center gap-1.5 shadow-2xs"
            title="Ganti URL video tutorial jika memiliki rekaman sendiri (YouTube/MP4)"
          >
            <Settings className="w-3.5 h-3.5 text-slate-500" />
            <span>{savedVideoUrl ? 'Ubah Link Video' : 'Pasang Video Sendiri'}</span>
          </button>

          <Link
            href="/create"
            className="text-xs font-bold text-white bg-orange-600 hover:bg-orange-700 px-3.5 py-2 rounded-xl transition flex items-center gap-1.5 shadow-xs"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>Praktikkan Sekarang</span>
          </Link>
        </div>
      </div>

      {/* Settings Form Modal/Dropdown */}
      {showSettings && (
        <form
          onSubmit={handleSaveCustomUrl}
          className="bg-white p-4 sm:p-5 rounded-2xl border border-orange-200 shadow-md space-y-3 animate-in fade-in zoom-in-95 duration-150"
        >
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Film className="w-4 h-4 text-orange-600" />
              <span>Gunakan Video Tutorial Sendiri (YouTube / Loom / File MP4)</span>
            </label>
            <button
              type="button"
              onClick={() => setShowSettings(false)}
              className="text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="text-xs text-slate-500">
            Jika kantor Anda memiliki video screen-recording cara pesan makan, tempel link video YouTube, Loom, atau link MP4 di sini agar otomatis diputar di halaman utama ini.
          </p>
          <div className="flex gap-2">
            <input
              type="url"
              placeholder="Contoh: https://www.youtube.com/watch?v=xxxx atau /videos/tutorial.mp4"
              value={customVideoUrl}
              onChange={(e) => setCustomVideoUrl(e.target.value)}
              className="flex-1 text-xs border border-slate-300 rounded-xl px-3 py-2 focus:ring-2 focus:ring-orange-500 focus:outline-none"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-bold transition shrink-0"
            >
              Terapkan
            </button>
            {savedVideoUrl && (
              <button
                type="button"
                onClick={() => {
                  setCustomVideoUrl('');
                  setSavedVideoUrl('');
                  try {
                    localStorage.removeItem('makan_kantor_custom_tutorial_url');
                  } catch {}
                  setShowSettings(false);
                }}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition shrink-0"
              >
                Gunakan Simulasi Bawaan
              </button>
            )}
          </div>
        </form>
      )}

      {/* Main Video Screen Container */}
      <div className="relative rounded-2xl border-2 border-slate-800 bg-slate-950 shadow-2xl overflow-hidden text-white">
        {/* Top Window Bar (Browser Mockup) */}
        <div className="flex items-center justify-between px-4 py-3 bg-slate-900 border-b border-slate-800 select-none">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-rose-500/90" />
            <div className="w-3 h-3 rounded-full bg-amber-500/90" />
            <div className="w-3 h-3 rounded-full bg-emerald-500/90" />
            <span className="ml-2 text-[11px] font-mono text-slate-400 hidden sm:inline">
              MakanKantor.id • Tutorial Panduan Pembuatan Acara PIC
            </span>
          </div>

          <div className="flex items-center gap-2 text-xs font-medium text-slate-400">
            <span className="px-2 py-0.5 rounded-md bg-slate-800 border border-slate-700 text-[11px] text-orange-400 font-bold">
              ⏱️ Durasi: ~30 Detik
            </span>
          </div>
        </div>

        {/* Video Canvas or Embedded Video */}
        {savedVideoUrl ? (
          <div className="relative aspect-video w-full bg-black">
            {savedVideoUrl.includes('youtube') || savedVideoUrl.includes('youtu.be') ? (
              <iframe
                src={getEmbedUrl(savedVideoUrl)}
                title="Tutorial Video"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="w-full h-full border-0"
              />
            ) : (
              <video
                src={savedVideoUrl}
                controls
                autoPlay
                className="w-full h-full object-contain"
              />
            )}
          </div>
        ) : (
          /* Simulated Interactive Tutorial Video Walkthrough */
          <div className="relative aspect-[16/9] sm:aspect-[16/8] w-full bg-gradient-to-b from-slate-900 via-slate-925 to-slate-950 flex flex-col justify-between p-4 sm:p-7 select-none overflow-hidden">
            {/* Ambient backdrop glow */}
            <div className="absolute top-1/4 left-1/3 w-80 h-80 bg-orange-600/15 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-10 right-1/4 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

            {/* Chapter Header Tag */}
            <div className="relative z-10 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xl sm:text-2xl">
                  {CHAPTERS[activeChapterIndex].highlightIcon}
                </span>
                <div>
                  <span className="text-[11px] font-bold text-orange-400 uppercase tracking-widest block">
                    Tahap {activeChapterIndex + 1} dari 4
                  </span>
                  <h3 className="text-base sm:text-xl font-extrabold text-white">
                    {CHAPTERS[activeChapterIndex].title}
                  </h3>
                </div>
              </div>

              <div className="text-right">
                <span className="text-xs font-mono text-slate-400 bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700">
                  {Math.floor(currentTime)}s / {TOTAL_DURATION_SEC}s
                </span>
              </div>
            </div>

            {/* Center Animated Walkthrough Scene */}
            <div className="relative z-10 my-auto py-2">
              {/* Scene 1: Basic Info */}
              {activeChapterIndex === 0 && (
                <div className="max-w-xl mx-auto bg-slate-900/90 border border-slate-700/80 rounded-2xl p-4 sm:p-6 shadow-2xl backdrop-blur-md space-y-3.5 animate-in fade-in zoom-in-95 duration-300">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                    <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                      <Store className="w-4 h-4 text-orange-400" />
                      1. Info Acara & Restoran
                    </span>
                    <span className="text-[10px] text-emerald-400 bg-emerald-950/80 border border-emerald-800 px-2 py-0.5 rounded-full font-bold">
                      ✓ Otomatis Siap
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-left text-xs">
                    <div className="bg-slate-950/80 p-2.5 rounded-xl border border-slate-800">
                      <span className="text-slate-500 block text-[10px]">Nama Acara:</span>
                      <strong className="text-orange-300 font-semibold">
                        Makan Siang Tim Kantor 🍱
                      </strong>
                    </div>
                    <div className="bg-slate-950/80 p-2.5 rounded-xl border border-slate-800">
                      <span className="text-slate-500 block text-[10px]">Nama PIC Admin:</span>
                      <strong className="text-slate-200 font-semibold">Budi (Divisi IT)</strong>
                    </div>
                    <div className="bg-slate-950/80 p-2.5 rounded-xl border border-slate-800 sm:col-span-2 flex items-center justify-between">
                      <div>
                        <span className="text-slate-500 block text-[10px]">Restoran Terpilih:</span>
                        <strong className="text-amber-400 font-semibold">
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
                <div className="max-w-xl mx-auto bg-slate-900/90 border border-slate-700/80 rounded-2xl p-4 sm:p-6 shadow-2xl backdrop-blur-md space-y-3 animate-in fade-in zoom-in-95 duration-300">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                    <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-orange-400" />
                      2. Tiga Cara Instan Masukkan Menu
                    </span>
                    <span className="text-[10px] text-orange-400 bg-orange-950/80 border border-orange-800 px-2 py-0.5 rounded-full font-bold">
                      Tersedia 65+ Menu Lengkap
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="p-3 rounded-xl bg-orange-950/60 border-2 border-orange-500 text-orange-200 flex flex-col items-center justify-center gap-1 shadow-lg scale-105">
                      <span className="text-xl">🍗</span>
                      <span className="font-extrabold text-[11px]">1-Klik Preset</span>
                      <span className="text-[9px] text-orange-300/80">Suprek / Tanjung Api</span>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-slate-300 flex flex-col items-center justify-center gap-1">
                      <Globe className="w-5 h-5 text-blue-400" />
                      <span className="font-bold text-[11px]">Link Website</span>
                      <span className="text-[9px] text-slate-500">mrsuprek.com/menu</span>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-slate-300 flex flex-col items-center justify-center gap-1">
                      <span className="text-xl">📸</span>
                      <span className="font-bold text-[11px]">Upload Foto</span>
                      <span className="text-[9px] text-slate-500">Kamera HP / PDF</span>
                    </div>
                  </div>

                  <p className="text-[11px] text-center text-slate-400 pt-1">
                    👉 Cukup klik <strong>Preset Mr. Suprek</strong>, seluruh 65+ menu, harga, dan foto resmi langsung masuk otomatis!
                  </p>
                </div>
              )}

              {/* Scene 3: Tax & Rounding */}
              {activeChapterIndex === 2 && (
                <div className="max-w-xl mx-auto bg-slate-900/90 border border-slate-700/80 rounded-2xl p-4 sm:p-6 shadow-2xl backdrop-blur-md space-y-3.5 animate-in fade-in zoom-in-95 duration-300">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                    <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      3. Pengaturan PPN & Pembulatan Otomatis
                    </span>
                    <span className="text-[10px] text-emerald-400 bg-emerald-950/80 border border-emerald-800 px-2 py-0.5 rounded-full font-bold">
                      Anti Uang Receh
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-left text-xs">
                    <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800 space-y-1">
                      <span className="text-slate-400 font-bold block text-[11px]">
                        Pajak Tambahan (PPN):
                      </span>
                      <span className="inline-block px-2 py-0.5 rounded bg-emerald-900/60 text-emerald-300 text-[11px] font-bold border border-emerald-700">
                        PPN 10% (Opsional)
                      </span>
                      <p className="text-[10px] text-slate-500">
                        Dihitung proporsional per harga pesanan tiap orang.
                      </p>
                    </div>

                    <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800 space-y-1">
                      <span className="text-slate-400 font-bold block text-[11px]">
                        Opsi Pembulatan:
                      </span>
                      <span className="inline-block px-2 py-0.5 rounded bg-orange-900/60 text-orange-300 text-[11px] font-bold border border-orange-700">
                        Pembulatan Rp 1.000
                      </span>
                      <p className="text-[10px] text-slate-500">
                        Contoh: Rp 24.600 jadi Rp 25.000 agar transfer mudah.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Scene 4: Finish & Share to WA */}
              {activeChapterIndex === 3 && (
                <div className="max-w-xl mx-auto bg-slate-900/90 border border-slate-700/80 rounded-2xl p-4 sm:p-6 shadow-2xl backdrop-blur-md space-y-3.5 animate-in fade-in zoom-in-95 duration-300">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                    <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                      <Share2 className="w-4 h-4 text-emerald-400" />
                      4. Selesai! Sebarkan Link ke WhatsApp
                    </span>
                    <span className="text-[10px] text-emerald-400 bg-emerald-950/80 border border-emerald-800 px-2 py-0.5 rounded-full font-bold">
                      Link Siap Dibagikan
                    </span>
                  </div>

                  <div className="space-y-2.5 text-center">
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs">
                      <Lock className="w-3.5 h-3.5 text-orange-400" />
                      <span>PIN Admin PIC Anda:</span>
                      <strong className="text-orange-400 font-mono text-sm tracking-wider">
                        8899
                      </strong>
                    </div>

                    <div className="flex items-center justify-center gap-2 pt-1">
                      <button
                        type="button"
                        className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-emerald-600/30 transition hover:scale-105"
                      >
                        <Share2 className="w-3.5 h-3.5" />
                        <span>Kirim Link ke WhatsApp Kantor</span>
                      </button>
                    </div>

                    <p className="text-[10px] text-slate-400">
                      Rekan kantor langsung buka di HP, pilih menu sendiri, & tagihan split-bill terhitung otomatis!
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Progress & Control Bar */}
            <div className="relative z-10 space-y-2">
              {/* Progress Scrubber */}
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

              {/* Player Controls */}
              <div className="flex items-center justify-between text-xs pt-1">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleTogglePlay}
                    className="w-8 h-8 rounded-full bg-orange-600 hover:bg-orange-500 text-white flex items-center justify-center transition shadow-md"
                  >
                    {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
                  </button>

                  <button
                    type="button"
                    onClick={handleRestart}
                    className="p-1.5 text-slate-400 hover:text-white transition"
                    title="Ulangi dari awal"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>

                  <span className="text-[11px] font-mono text-slate-400 hidden sm:inline">
                    {CHAPTERS[activeChapterIndex].subtitle}
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <Link
                    href="/create"
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white font-bold text-xs transition"
                  >
                    <span>Coba Sekarang</span>
                    <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Chapter Quick Jumper Tabs */}
        {!savedVideoUrl && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 p-2 bg-slate-900/90 border-t border-slate-800">
            {CHAPTERS.map((ch, idx) => (
              <button
                key={ch.id}
                type="button"
                onClick={() => handleSelectChapter(idx)}
                className={`p-2 rounded-xl text-left transition flex items-center gap-2 ${
                  activeChapterIndex === idx
                    ? 'bg-orange-600/20 text-orange-300 border border-orange-500/40'
                    : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
                }`}
              >
                <span className="text-base shrink-0">{ch.highlightIcon}</span>
                <div className="min-w-0">
                  <strong className="block text-[11px] font-bold truncate leading-tight">
                    {ch.title}
                  </strong>
                  <span className="text-[10px] text-slate-500 truncate block">
                    {ch.durationSec} detik
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
