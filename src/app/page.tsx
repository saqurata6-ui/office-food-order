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
  Store,
  X,
} from 'lucide-react';

interface LocalHistoryItem {
  id: string;
  title: string;
  restaurantName: string;
  date: string;
  adminPin?: string;
  role: 'pic' | 'participant';
}

interface EventSummary {
  id: string;
  title: string;
  picName: string;
  date: string;
  time: string;
  restaurantName: string;
  isLocked: boolean;
  createdAt: string;
}

export default function HomePage() {
  const router = useRouter();
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [history, setHistory] = useState<LocalHistoryItem[]>([]);
  const [joinCode, setJoinCode] = useState('');

  // PIN modal state
  const [pinModalEvent, setPinModalEvent] = useState<EventSummary | null>(null);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [verifyingPin, setVerifyingPin] = useState(false);

  const fetchEvents = async () => {
    try {
      setLoadingEvents(true);
      const res = await fetch('/api/events');
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setEvents(json.data);
      }
    } catch (e) {
      console.error('Error fetching events:', e);
    } finally {
      setLoadingEvents(false);
    }
  };

  useEffect(() => {
    fetchEvents();
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

  const handleOpenPicModal = (ev: EventSummary) => {
    setPinModalEvent(ev);
    // Cek apakah di browser ini sudah pernah tersimpan PIN untuk acara ini
    const saved = history.find((h) => h.id === ev.id && h.adminPin);
    if (saved && saved.adminPin) {
      setPinInput(saved.adminPin);
    } else {
      setPinInput('');
    }
    setPinError('');
  };

  const handleVerifyAndOpenPic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pinModalEvent || !pinInput.trim()) return;

    setVerifyingPin(true);
    setPinError('');

    try {
      const res = await fetch(
        `/api/events/${encodeURIComponent(pinModalEvent.id)}?pin=${encodeURIComponent(pinInput.trim())}`
      );
      const json = await res.json();

      if (json.success && json.isAdmin) {
        // Simpan ke local history sebagai PIC
        try {
          const stored = localStorage.getItem('makan_kantor_history');
          const list = stored ? JSON.parse(stored) : [];
          const filtered = list.filter((item: any) => item.id !== pinModalEvent.id);
          filtered.unshift({
            id: pinModalEvent.id,
            title: pinModalEvent.title,
            restaurantName: pinModalEvent.restaurantName,
            date: pinModalEvent.date,
            adminPin: pinInput.trim(),
            role: 'pic',
          });
          localStorage.setItem('makan_kantor_history', JSON.stringify(filtered.slice(0, 15)));
        } catch (e) {}

        router.push(`/event/${pinModalEvent.id}/admin?pin=${encodeURIComponent(pinInput.trim())}`);
      } else {
        setPinError('PIN PIC salah. Silakan periksa kembali.');
      }
    } catch (err) {
      console.error(err);
      setPinError('Terjadi kesalahan koneksi.');
    } finally {
      setVerifyingPin(false);
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

      {/* Daftar Acara Aktif dari Server */}
      <section className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <span>📋</span> Daftar Acara Makan Kantor
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Dapat dibuka di perangkat mana pun. Pilih acara untuk memesan menu atau kelola sebagai PIC.
            </p>
          </div>
          <button
            type="button"
            onClick={fetchEvents}
            className="text-xs text-orange-600 hover:text-orange-700 font-semibold"
          >
            Muat Ulang
          </button>
        </div>

        {loadingEvents ? (
          <div className="p-8 text-center text-xs text-slate-400">
            <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            Memuat daftar acara...
          </div>
        ) : events.length === 0 ? (
          <div className="p-8 text-center space-y-3 bg-slate-50 rounded-xl border border-slate-100">
            <div className="w-12 h-12 rounded-2xl bg-orange-100 text-orange-600 flex items-center justify-center mx-auto font-bold">
              <UtensilsCrossed className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-800">Belum Ada Acara Makan</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Belum ada acara makan yang dibuat. Silakan buat acara makan baru untuk mulai mengumpulkan pesanan teman kantor!
            </p>
            <Link
              href="/create"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold transition shadow-xs"
            >
              <PlusCircle className="w-4 h-4" /> + Buat Acara Pertama
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {events.map((item) => (
              <div
                key={item.id}
                className="p-4 rounded-xl border border-slate-200 hover:border-orange-300 hover:shadow-md transition bg-slate-50 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between text-xs font-semibold mb-1.5">
                    <span className="text-orange-600 truncate font-bold flex items-center gap-1">
                      <Store className="w-3.5 h-3.5 shrink-0" />
                      {item.restaurantName}
                    </span>
                    {item.isLocked ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700 border border-red-200">
                        Dikunci
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">
                        Buka
                      </span>
                    )}
                  </div>
                  <h3 className="font-extrabold text-slate-900 text-sm line-clamp-1">{item.title}</h3>
                  <div className="mt-2 space-y-1 text-xs text-slate-500">
                    <div className="flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-slate-400" />
                      <span>PIC: <strong>{item.picName}</strong></span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span>{item.date} • {item.time} WIB</span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-200/70 flex items-center gap-2">
                  <Link
                    href={`/order/${item.id}`}
                    className="flex-1 py-2 px-3 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs text-center transition shadow-2xs flex items-center justify-center gap-1"
                  >
                    Buka Form Menu
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                  <button
                    type="button"
                    onClick={() => handleOpenPicModal(item)}
                    className="py-2 px-3 rounded-xl bg-slate-200/80 hover:bg-slate-300 text-slate-800 font-bold text-xs transition flex items-center gap-1.5 shrink-0"
                    title="Buka sebagai PIC (perlu PIN)"
                  >
                    <Lock className="w-3 h-3 text-slate-700" />
                    <span>Buka PIC</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Modal Masukkan PIN PIC */}
      {pinModalEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col animate-in zoom-in-95 duration-150">
            <div className="px-5 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center font-bold">
                  <Lock className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Verifikasi PIC Admin
                  </span>
                  <h3 className="font-extrabold text-slate-900 text-sm leading-tight truncate max-w-[200px]">
                    {pinModalEvent.title}
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPinModalEvent(null)}
                className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleVerifyAndOpenPic} className="p-5 space-y-4">
              <p className="text-xs text-slate-600 leading-relaxed">
                Masukkan 4-digit PIN Admin PIC yang dibuat saat mendaftarkan acara <strong>{pinModalEvent.title}</strong>:
              </p>

              {pinError && (
                <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium text-center">
                  {pinError}
                </div>
              )}

              <div>
                <input
                  type="password"
                  maxLength={6}
                  autoFocus
                  placeholder="PIN PIC (4 digit)"
                  value={pinInput}
                  onChange={(e) => {
                    setPinInput(e.target.value);
                    setPinError('');
                  }}
                  className="w-full text-center text-2xl tracking-widest font-mono py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-orange-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setPinModalEvent(null)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={!pinInput.trim() || verifyingPin}
                  className="flex-1 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm shadow-orange-600/20"
                >
                  {verifyingPin ? 'Memeriksa...' : 'Buka Dashboard'}
                </button>
              </div>
            </form>
          </div>
        </div>
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
