'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  UtensilsCrossed,
  PlusCircle,
  QrCode,
  Share2,
  FileSpreadsheet,
  Lock,
  Camera,
  ArrowRight,
  Clock,
  MapPin,
  User,
  CheckCircle2,
} from 'lucide-react';

interface LocalHistoryItem {
  id: string;
  title: string;
  restaurantName: string;
  date: string;
  adminPin?: string;
  role: 'pic' | 'participant';
}

export default function HomePage() {
  const router = useRouter();
  const [history, setHistory] = useState<LocalHistoryItem[]>([]);
  const [joinCode, setJoinCode] = useState('');

  useEffect(() => {
    try {
      const stored = localStorage.getItem('makan_kantor_history');
      if (stored) {
        setHistory(JSON.parse(stored));
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = joinCode.trim();
    if (clean) {
      router.push(`/order/${clean}`);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-8 pb-16 space-y-12">
      {/* Hero Section */}
      <section className="text-center space-y-6 pt-4 sm:pt-10">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-orange-100 border border-orange-200 text-orange-700 text-xs sm:text-sm font-semibold animate-pulse">
          <span>✨</span> Fitur Baru: AI Scanner Menu dari Foto / PDF
        </div>

        <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-slate-900 max-w-3xl mx-auto leading-tight sm:leading-tight">
          Koordinasi Makan Kantor Jadi <span className="text-orange-600">Simpel, Cepat, & Transparan</span>
        </h1>

        <p className="text-base sm:text-lg text-slate-600 max-w-2xl mx-auto">
          PIC cukup input acara & menu (bisa scan foto/PDF), bagikan public link ke WhatsApp. Teman kantor pilih menu di HP, tagihan split-bill + PPN terhitung otomatis.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <Link
            href="/create"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-semibold text-base shadow-lg shadow-orange-500/25 transition hover:scale-[1.02]"
          >
            <PlusCircle className="w-5 h-5" />
            Buat Acara Baru (Sebagai PIC)
          </Link>

          <form onSubmit={handleJoin} className="w-full sm:w-auto flex items-center gap-2">
            <input
              type="text"
              placeholder="Masukkan ID / Kode Acara..."
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              className="w-full sm:w-64 px-4 py-3 rounded-xl border border-slate-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            />
            <button
              type="submit"
              disabled={!joinCode.trim()}
              className="px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-900 disabled:opacity-50 text-white text-sm font-medium transition"
            >
              Buka
            </button>
          </form>
        </div>
      </section>

      {/* History Section (if any) */}
      {history.length > 0 && (
        <section className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <span>🕒</span> Acara Terakhir Anda
            </h2>
            <span className="text-xs text-slate-500">Tersimpan di browser ini</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {history.map((item) => (
              <div
                key={item.id}
                className="p-4 rounded-xl border border-slate-200 hover:border-orange-300 hover:shadow-md transition bg-slate-50 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between text-xs font-semibold mb-1">
                    <span className="text-orange-600 truncate">{item.restaurantName}</span>
                    <span
                      className={`px-2 py-0.5 rounded-full ${
                        item.role === 'pic' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'
                      }`}
                    >
                      {item.role === 'pic' ? 'PIC' : 'Peserta'}
                    </span>
                  </div>
                  <h3 className="font-bold text-slate-800 line-clamp-1">{item.title}</h3>
                  <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" /> {item.date}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-200/60 flex items-center justify-between text-xs">
                  {item.role === 'pic' && item.adminPin ? (
                    <Link
                      href={`/event/${item.id}/admin?pin=${item.adminPin}`}
                      className="text-orange-600 hover:text-orange-700 font-semibold flex items-center gap-1"
                    >
                      Buka Dashboard PIC <ArrowRight className="w-3 h-3" />
                    </Link>
                  ) : (
                    <Link
                      href={`/order/${item.id}`}
                      className="text-slate-700 hover:text-orange-600 font-semibold flex items-center gap-1"
                    >
                      Buka Form Menu <ArrowRight className="w-3 h-3" />
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Feature Highlights Grid */}
      <section className="space-y-6">
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold text-slate-900">Kenapa Menggunakan MakanKantor?</h2>
          <p className="text-slate-600 text-sm max-w-lg mx-auto">
            Dibuat khusus untuk alur makan-makan kantor di Indonesia tanpa kerumitan instalasi aplikasi.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-3">
            <div className="w-10 h-10 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center font-bold">
              <Camera className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-800 text-base">Scan Menu dari Foto / PDF</h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              Cukup screenshot atau foto daftar menu resto / upload flyer PDF. AI otomatis mengubahnya menjadi pilihan menu berharga siap klik!
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center font-bold">
              <Share2 className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-800 text-base">Public Link WhatsApp</h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              Sebar satu link ke grup WhatsApp. Teman kantor buka di browser HP masing-masing tanpa harus install app atau daftar akun.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold">
              <Lock className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-800 text-base">Fitur Lock Order PIC</h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              Saat batas waktu pesanan tiba, PIC tinggal klik Kunci (Lock). Anggota tidak bisa mengubah atau menambah pesanan lagi.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-3">
            <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center font-bold">
              <UtensilsCrossed className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-800 text-base">Rekap Resto Otomatis</h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              Restoran tidak butuh tahu siapa pesan apa. Sistem otomatis merangkum: <em>"Ayam Bakar: 14 porsi, Es Jeruk: 10 gelas"</em>.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center font-bold">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-800 text-base">PPN & Pembulatan Akurat</h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              Hitungan per nama langsung diproporsikan dengan PPN 10% dan pembulatan (misal Rp 1.000 terdekat) agar transfer pas tanpa uang receh.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-3">
            <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center font-bold">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-800 text-base">Tarik Excel, PDF & Print</h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              Tarik laporan rapi siap cetak atau download file Excel untuk catatan keuangan kantor dan bukti pembayaran.
            </p>
          </div>
        </div>
      </section>

      {/* Step by Step Flow */}
      <section className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-2xl border border-orange-200 p-6 sm:p-8 space-y-6">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900 text-center">
          Alur Sederhana: 3 Langkah Mudah
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-5 rounded-xl border border-orange-100 shadow-sm space-y-2">
            <div className="w-8 h-8 rounded-full bg-orange-600 text-white font-bold flex items-center justify-center text-sm">
              1
            </div>
            <h3 className="font-bold text-slate-900">PIC Bikin Acara & Menu</h3>
            <p className="text-xs text-slate-600">
              Isi info tempat makan, jam, dan upload menu (manual / foto / PDF). Atur PPN & pembulatan.
            </p>
          </div>

          <div className="bg-white p-5 rounded-xl border border-orange-100 shadow-sm space-y-2">
            <div className="w-8 h-8 rounded-full bg-orange-600 text-white font-bold flex items-center justify-center text-sm">
              2
            </div>
            <h3 className="font-bold text-slate-900">Sebar Link ke WhatsApp</h3>
            <p className="text-xs text-slate-600">
              Teman kantor buka link di HP, input nama masing-masing, lalu klik menu yang diinginkan.
            </p>
          </div>

          <div className="bg-white p-5 rounded-xl border border-orange-100 shadow-sm space-y-2">
            <div className="w-8 h-8 rounded-full bg-orange-600 text-white font-bold flex items-center justify-center text-sm">
              3
            </div>
            <h3 className="font-bold text-slate-900">Kunci & Rekap Otomatis</h3>
            <p className="text-xs text-slate-600">
              PIC klik Kunci Pesanan, lalu download rekap pesanan untuk resto dan daftar tagihan per nama.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
