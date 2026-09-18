'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Utensils,
  Plus,
  Trash2,
  UploadCloud,
  FileText,
  Sparkles,
  Check,
  Copy,
  ArrowRight,
  Calculator,
  Store,
  Calendar,
  Clock,
  User,
  MapPin,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { MenuItem, TaxConfig, RoundingType } from '@/types';
import { formatRupiah } from '@/lib/calculator';
import { nanoid } from 'nanoid';
import { getFullHjHestiMenu } from '../api/parse-menu/route';

export default function CreateEventPage() {
  const router = useRouter();

  // Basic Info
  const [title, setTitle] = useState('');
  const [picName, setPicName] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [time, setTime] = useState('12:00');
  const [restaurantName, setRestaurantName] = useState('');
  const [restaurantAddress, setRestaurantAddress] = useState('');

  // Tax & Rounding Config
  const [useTax, setUseTax] = useState(true);
  const [taxPercent, setTaxPercent] = useState(10);
  const [useServiceCharge, setUseServiceCharge] = useState(false);
  const [serviceChargePercent, setServiceChargePercent] = useState(5);
  const [rounding, setRounding] = useState<RoundingType>('floor_1000'); // Default sesuai nota user!

  // Menu items list
  const [menuItems, setMenuItems] = useState<MenuItem[]>([
    { id: '1', name: 'Soto Ayam Kampung Besar', price: 13000, category: 'Menu Makanan', description: 'Best Seller' },
    { id: '2', name: 'Soto Sapi Pisah', price: 16000, category: 'Menu Makanan' },
    { id: '3', name: 'Sate Telur Puyuh', price: 6000, category: 'Menu Sate' },
    { id: '4', name: 'Tempe Mendoan', price: 2500, category: 'Menu Gorengan' },
    { id: '5', name: 'Es Teh Manis', price: 6000, category: 'Menu Minuman' },
  ]);

  // Single manual item form
  const [newItemName, setNewItemName] = useState('');
  const [newItemPrice, setNewItemPrice] = useState('');
  const [newItemCategory, setNewItemCategory] = useState('Menu Makanan');
  const [newItemDesc, setNewItemDesc] = useState('');

  // OCR AI state
  const [isScanning, setIsScanning] = useState(false);
  const [scanMessage, setScanMessage] = useState('');
  const [rawTextMenu, setRawTextMenu] = useState('');
  const [showTextImport, setShowTextImport] = useState(false);

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [createdEvent, setCreatedEvent] = useState<{ id: string; adminPin: string } | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedPin, setCopiedPin] = useState(false);

  const handleAddManualItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim() || !newItemPrice) return;
    const price = parseInt(newItemPrice.replace(/\D/g, ''), 10);
    if (isNaN(price) || price <= 0) return;

    const item: MenuItem = {
      id: `item_${nanoid(6)}`,
      name: newItemName.trim(),
      price,
      category: newItemCategory || 'Menu Makanan',
      description: newItemDesc.trim(),
    };

    setMenuItems((prev) => [...prev, item]);
    setNewItemName('');
    setNewItemPrice('');
    setNewItemDesc('');
  };

  const handleRemoveItem = (id: string) => {
    setMenuItems((prev) => prev.filter((it) => it.id !== id));
  };

  const handleLoadHjHesti = () => {
    const full = getFullHjHestiMenu();
    setMenuItems(full);
    setRestaurantName('Soto SSB Hj. Hesti');
    setRestaurantAddress('Spesialis Soto Seger Boyolali');
    setScanMessage(`Berhasil memasukkan ${full.length} menu lengkap dari daftar menu Soto SSB Hj. Hesti!`);
  };

  const handleQuickPreset = () => {
    const samples: MenuItem[] = [
      { id: nanoid(6), name: 'Nasi Ayam Bakar Madu', price: 28000, category: 'Menu Makanan', description: 'Lengkap sambal & lalapan' },
      { id: nanoid(6), name: 'Nasi Goreng Spesial + Telur', price: 25000, category: 'Menu Makanan' },
      { id: nanoid(6), name: 'Mie Godhog Jawa Telur Bebek', price: 26000, category: 'Menu Makanan' },
      { id: nanoid(6), name: 'Ayam Geprek Sambal Bawang + Nasi', price: 22000, category: 'Menu Makanan' },
      { id: nanoid(6), name: 'Es Teh Manis Jumbo', price: 6000, category: 'Menu Minuman' },
      { id: nanoid(6), name: 'Es Jeruk Peras Segar', price: 9000, category: 'Menu Minuman' },
      { id: nanoid(6), name: 'Kopi Susu Gula Aren', price: 18000, category: 'Menu Minuman' },
      { id: nanoid(6), name: 'Tahu & Tempe Mendoan Crispy (Isi 4)', price: 14000, category: 'Menu Gorengan' },
    ];
    setMenuItems(samples);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsScanning(true);
    setScanMessage('Menganalisis seluruh kolom foto menu...');

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/parse-menu', {
        method: 'POST',
        body: formData,
      });

      const json = await res.json();
      if (json.success && json.items?.length > 0) {
        setMenuItems(json.items);
        setScanMessage(`Berhasil mengekstrak ${json.items.length} menu lengkap dari foto/dokumen!`);
      } else {
        setScanMessage('Tidak ada menu yang terdeteksi, silakan coba foto yang lebih jelas.');
      }
    } catch (err) {
      console.error(err);
      setScanMessage('Gagal memproses file. Silakan gunakan tombol preset atau input manual.');
    } finally {
      setIsScanning(false);
      e.target.value = '';
    }
  };

  const handleTextImport = async () => {
    if (!rawTextMenu.trim()) return;
    setIsScanning(true);
    setScanMessage('Memproses teks menu...');

    const formData = new FormData();
    formData.append('text', rawTextMenu);

    try {
      const res = await fetch('/api/parse-menu', {
        method: 'POST',
        body: formData,
      });

      const json = await res.json();
      if (json.success && json.items?.length > 0) {
        setMenuItems((prev) => [...prev, ...json.items]);
        setScanMessage(`Berhasil menambahkan ${json.items.length} menu dari teks!`);
        setRawTextMenu('');
        setShowTextImport(false);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsScanning(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!title.trim()) {
      setErrorMsg('Nama acara tidak boleh kosong.');
      return;
    }
    if (!picName.trim()) {
      setErrorMsg('Nama PIC tidak boleh kosong.');
      return;
    }
    if (!restaurantName.trim()) {
      setErrorMsg('Nama tempat makan / restoran tidak boleh kosong.');
      return;
    }
    if (menuItems.length === 0) {
      setErrorMsg('Harap masukkan minimal 1 menu makanan atau minuman.');
      return;
    }

    setIsSubmitting(true);

    const taxConfig: TaxConfig = {
      useTax,
      taxPercent: Number(taxPercent) || 0,
      useServiceCharge,
      serviceChargePercent: Number(serviceChargePercent) || 0,
      rounding,
    };

    try {
      const res = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          picName: picName.trim(),
          date,
          time,
          restaurantName: restaurantName.trim(),
          restaurantAddress: restaurantAddress.trim(),
          taxConfig,
          menuItems,
        }),
      });

      const data = await res.json();
      if (!data.success) {
        setErrorMsg(data.message || 'Gagal membuat acara.');
        setIsSubmitting(false);
        return;
      }

      const newId = data.data.id;
      const adminPin = data.adminPin;

      try {
        const stored = localStorage.getItem('makan_kantor_history');
        const list = stored ? JSON.parse(stored) : [];
        list.unshift({
          id: newId,
          title: title.trim(),
          restaurantName: restaurantName.trim(),
          date,
          adminPin,
          role: 'pic',
        });
        localStorage.setItem('makan_kantor_history', JSON.stringify(list.slice(0, 15)));
      } catch (e) {
        console.error(e);
      }

      setCreatedEvent({ id: newId, adminPin });
    } catch (err) {
      console.error(err);
      setErrorMsg('Terjadi kesalahan koneksi server.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getPublicUrl = () => {
    if (typeof window === 'undefined' || !createdEvent) return '';
    return `${window.location.origin}/order/${createdEvent.id}`;
  };

  const copyPublicLink = () => {
    navigator.clipboard.writeText(getPublicUrl());
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const copyPin = () => {
    if (createdEvent) {
      navigator.clipboard.writeText(createdEvent.adminPin);
      setCopiedPin(true);
      setTimeout(() => setCopiedPin(false), 2500);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          Buat Acara Makan Kantor Baru
        </h1>
        <p className="text-sm text-slate-600 mt-1">
          Lengkapi detail acara, daftar menu resto (bisa scan foto/PDF), dan aturan pajaknya.
        </p>
      </div>

      {errorMsg && (
        <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-2">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* 1. INFORMASI ACARA & PIC */}
        <div className="bg-white p-5 sm:p-7 rounded-2xl border border-slate-200 shadow-sm space-y-5">
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
            <div className="w-8 h-8 rounded-lg bg-orange-100 text-orange-600 flex items-center justify-center font-bold text-sm">
              1
            </div>
            <h2 className="text-lg font-bold text-slate-900">Informasi Acara & PIC</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Nama PIC (Penanggung Jawab) *
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
                <input
                  type="text"
                  required
                  placeholder="Contoh: Budi Santoso / Sarah"
                  value={picName}
                  onChange={(e) => setPicName(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Nama Acara *
              </label>
              <input
                type="text"
                required
                placeholder="Contoh: Makan Siang Bersama / Traktir Ultah"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Tanggal Acara
              </label>
              <div className="relative">
                <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Jam Acara
              </label>
              <div className="relative">
                <Clock className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
                <input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Nama Tempat Makan / Restoran *
              </label>
              <div className="relative">
                <Store className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
                <input
                  type="text"
                  required
                  placeholder="Contoh: Soto SSB Hj. Hesti / Bebek Kaleyo"
                  value={restaurantName}
                  onChange={(e) => setRestaurantName(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Alamat / Cabang Tempat Makan
              </label>
              <div className="relative">
                <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
                <input
                  type="text"
                  placeholder="Contoh: Spesialis Soto Seger Boyolali"
                  value={restaurantAddress}
                  onChange={(e) => setRestaurantAddress(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                />
              </div>
            </div>
          </div>
        </div>

        {/* 2. DAFTAR MENU & OCR / SCANNER */}
        <div className="bg-white p-5 sm:p-7 rounded-2xl border border-slate-200 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-orange-100 text-orange-600 flex items-center justify-center font-bold text-sm">
                2
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">Daftar Pilihan Menu</h2>
                <p className="text-xs text-slate-500">
                  Total <strong className="text-orange-600 font-bold">{menuItems.length} menu</strong> siap dipilih oleh rekan kantor.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleLoadHjHesti}
                className="text-xs text-emerald-700 hover:text-emerald-800 font-bold bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 px-3 py-1.5 rounded-lg transition flex items-center gap-1 shadow-xs"
              >
                <span>🍜</span>
                <span>Preset SSB Hj. Hesti (50+ Menu)</span>
              </button>

              <button
                type="button"
                onClick={handleQuickPreset}
                className="text-xs text-slate-600 hover:text-slate-800 font-medium bg-slate-100 hover:bg-slate-200 border border-slate-300 px-3 py-1.5 rounded-lg transition"
              >
                ⚡ Preset Sederhana
              </button>
            </div>
          </div>

          {/* AI Scan & Import Box */}
          <div className="bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 rounded-xl p-4 sm:p-5 space-y-4">
            <div className="flex items-center gap-2 text-orange-950 font-bold text-sm">
              <Sparkles className="w-4 h-4 text-orange-600" />
              <span>Pilihan Ekstraksi Cepat: Upload Foto Menu atau Paste Teks</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="cursor-pointer flex items-center gap-3 p-3.5 rounded-xl bg-white border border-slate-300 hover:border-orange-400 hover:shadow-sm transition">
                <UploadCloud className="w-6 h-6 text-orange-500 shrink-0" />
                <div className="text-left overflow-hidden">
                  <span className="block text-xs font-bold text-slate-800">
                    Upload Foto Screenshot Menu / PDF
                  </span>
                  <span className="block text-[11px] text-slate-500 truncate">
                    Mengekstrak seluruh kolom menu sekaligus
                  </span>
                </div>
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  className="hidden"
                  onChange={handleFileUpload}
                  disabled={isScanning}
                />
              </label>

              <button
                type="button"
                onClick={() => setShowTextImport(!showTextImport)}
                className="flex items-center gap-3 p-3.5 rounded-xl bg-white border border-slate-300 hover:border-orange-400 hover:shadow-sm transition text-left"
              >
                <FileText className="w-6 h-6 text-slate-600 shrink-0" />
                <div>
                  <span className="block text-xs font-bold text-slate-800">
                    Paste Teks Daftar Menu
                  </span>
                  <span className="block text-[11px] text-slate-500">
                    Salin dari chat WhatsApp / pesan teks
                  </span>
                </div>
              </button>
            </div>

            {isScanning && (
              <div className="flex items-center gap-2 text-xs text-orange-800 font-medium py-1 animate-pulse">
                <div className="w-4 h-4 border-2 border-orange-600 border-t-transparent rounded-full animate-spin"></div>
                <span>{scanMessage}</span>
              </div>
            )}

            {scanMessage && !isScanning && (
              <p className="text-xs text-emerald-800 font-medium bg-emerald-50 border border-emerald-200 p-2.5 rounded-lg flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{scanMessage}</span>
              </p>
            )}

            {showTextImport && (
              <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3">
                <label className="block text-xs font-bold text-slate-700">
                  Tempel daftar menu di sini (contoh: &ldquo;Soto Ayam Kampung - 13.000&rdquo;):
                </label>
                <textarea
                  rows={4}
                  value={rawTextMenu}
                  onChange={(e) => setRawTextMenu(e.target.value)}
                  placeholder="Soto Ayam Kampung Besar 13.000&#10;Sate Telur Puyuh 6.000&#10;Es Teh Manis 6.000"
                  className="w-full p-2.5 rounded-lg border border-slate-300 bg-white text-slate-900 text-xs font-mono focus:ring-2 focus:ring-orange-500"
                ></textarea>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowTextImport(false)}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    onClick={handleTextImport}
                    disabled={isScanning || !rawTextMenu.trim()}
                    className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-orange-600 hover:bg-orange-700 text-white transition disabled:opacity-50"
                  >
                    Ekstrak Jadi Menu
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Form Tambah Menu Manual */}
          <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 space-y-3">
            <span className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
              + Tambah Menu Satuan Secara Manual
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
              <div className="sm:col-span-5">
                <input
                  type="text"
                  placeholder="Nama menu (misal: Sate Telur Puyuh)"
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white text-slate-900 focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div className="sm:col-span-3">
                <input
                  type="number"
                  placeholder="Harga (misal: 6000)"
                  value={newItemPrice}
                  onChange={(e) => setNewItemPrice(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white text-slate-900 focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div className="sm:col-span-2">
                <select
                  value={newItemCategory}
                  onChange={(e) => setNewItemCategory(e.target.value)}
                  className="w-full px-2 py-2 rounded-lg border border-slate-300 text-xs bg-white text-slate-900 focus:ring-2 focus:ring-orange-500"
                >
                  <option value="Menu Makanan">Menu Makanan</option>
                  <option value="Menu Sate">Menu Sate</option>
                  <option value="Menu Gorengan">Menu Gorengan</option>
                  <option value="Menu Minuman">Menu Minuman</option>
                  <option value="Lainnya">Lainnya</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <button
                  type="button"
                  onClick={handleAddManualItem}
                  disabled={!newItemName.trim() || !newItemPrice}
                  className="w-full py-2 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white text-xs font-semibold transition"
                >
                  Tambah
                </button>
              </div>
            </div>
          </div>

          {/* List Menu Saat Ini */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <div className="bg-slate-100 px-4 py-2.5 flex items-center justify-between text-xs font-semibold text-slate-700">
              <span>Daftar Menu Tersedia ({menuItems.length} menu)</span>
              {menuItems.length > 0 && (
                <button
                  type="button"
                  onClick={() => setMenuItems([])}
                  className="text-red-600 hover:text-red-700 text-[11px]"
                >
                  Hapus Semua
                </button>
              )}
            </div>

            {menuItems.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                Belum ada menu yang ditambahkan. Gunakan tombol preset atau upload foto menu di atas.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
                {menuItems.map((item, idx) => (
                  <div
                    key={item.id || idx}
                    className="px-4 py-2.5 flex items-center justify-between hover:bg-slate-50 transition text-xs"
                  >
                    <div className="flex items-center gap-2 overflow-hidden pr-2">
                      <span className="w-6 text-slate-400 font-mono shrink-0">{idx + 1}.</span>
                      <span className="font-semibold text-slate-900 truncate">{item.name}</span>
                      <span className="px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 text-[10px] shrink-0 font-medium">
                        {item.category}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span className="font-bold text-slate-900">{formatRupiah(item.price)}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(item.id)}
                        className="text-slate-400 hover:text-red-600 transition p-1"
                        title="Hapus menu"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 3. PENGATURAN PAJAK & PEMBULATAN */}
        <div className="bg-white p-5 sm:p-7 rounded-2xl border border-slate-200 shadow-sm space-y-5">
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
            <div className="w-8 h-8 rounded-lg bg-orange-100 text-orange-600 flex items-center justify-center font-bold text-sm">
              3
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Pengaturan Pajak (PPN) & Pembulatan</h2>
              <p className="text-xs text-slate-500">
                Membantu kalkulasi split-bill persis dengan sistem POS kasir restoran.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {/* PPN */}
            <div className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 bg-slate-50">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="useTax"
                  checked={useTax}
                  onChange={(e) => setUseTax(e.target.checked)}
                  className="w-4 h-4 text-orange-600 rounded focus:ring-orange-500"
                />
                <label htmlFor="useTax" className="cursor-pointer">
                  <span className="block text-xs sm:text-sm font-bold text-slate-800">
                    Gunakan PPN / Pajak Restoran
                  </span>
                  <span className="block text-[11px] text-slate-500">
                    Pajak resto (default 10% seperti di nota)
                  </span>
                </label>
              </div>

              {useTax && (
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={taxPercent}
                    onChange={(e) => setTaxPercent(Number(e.target.value))}
                    className="w-16 px-2.5 py-1.5 text-center text-xs font-bold rounded-lg border border-slate-300 bg-white text-slate-900"
                  />
                  <span className="text-xs font-semibold text-slate-600">%</span>
                </div>
              )}
            </div>

            {/* Service Charge */}
            <div className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 bg-slate-50">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="useService"
                  checked={useServiceCharge}
                  onChange={(e) => setUseServiceCharge(e.target.checked)}
                  className="w-4 h-4 text-orange-600 rounded focus:ring-orange-500"
                />
                <label htmlFor="useService" className="cursor-pointer">
                  <span className="block text-xs sm:text-sm font-bold text-slate-800">
                    Gunakan Biaya Layanan (Service Charge)
                  </span>
                  <span className="block text-[11px] text-slate-500">
                    Opsional untuk resto yang mengenakan service charge
                  </span>
                </label>
              </div>

              {useServiceCharge && (
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={serviceChargePercent}
                    onChange={(e) => setServiceChargePercent(Number(e.target.value))}
                    className="w-16 px-2.5 py-1.5 text-center text-xs font-bold rounded-lg border border-slate-300 bg-white text-slate-900"
                  />
                  <span className="text-xs font-semibold text-slate-600">%</span>
                </div>
              )}
            </div>

            {/* Rounding Selection */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-3">
              <div>
                <label className="block text-xs sm:text-sm font-bold text-slate-900">
                  Aturan Pembulatan (Rounding)
                </label>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Pilih aturan pembulatan untuk menyesuaikan dengan nota kasir restoran Anda:
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {[
                  {
                    value: 'floor_1000',
                    badge: 'Sesuai Nota Resto',
                    label: 'Bulatkan ke Bawah (Sesuai Nota Resto)',
                    sub: 'Contoh: Rp 206.250 ➔ Rp 206.000 (-Rp 250) | Rp 17.600 ➔ Rp 17.500 (-Rp 100)',
                  },
                  {
                    value: 'floor_500',
                    badge: 'Sesuai Nota Resto',
                    label: 'Bulatkan ke Bawah ke Rp 500',
                    sub: 'Contoh: Rp 17.600 ➔ Rp 17.500 (-Rp 100) | Rp 206.250 ➔ Rp 206.000 (-Rp 250)',
                  },
                  {
                    value: 'round_1000',
                    badge: 'Matematis',
                    label: 'Bulatkan ke Rp 1.000 Terdekat (Bisa +/-)',
                    sub: 'Rp 206.250 ➔ Rp 206.000 | Rp 206.750 ➔ Rp 207.000',
                  },
                  {
                    value: 'ceil_1000',
                    badge: 'Ke Atas',
                    label: 'Bulatkan ke Atas ke Rp 1.000',
                    sub: 'Rp 206.250 ➔ Rp 207.000 (+Rp 750)',
                  },
                  {
                    value: 'none',
                    badge: 'Standard',
                    label: 'Tanpa Pembulatan',
                    sub: 'Nominal asli tanpa perubahan: Rp 206.250',
                  },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setRounding(opt.value as any)}
                    className={`p-3 text-left rounded-xl border transition ${
                      rounding === opt.value
                        ? 'border-orange-500 bg-orange-50/70 text-orange-950 font-semibold ring-1 ring-orange-500'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className="text-xs font-bold text-slate-900 leading-tight">{opt.label}</span>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-bold shrink-0 ${
                          opt.value.startsWith('floor')
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {opt.badge}
                      </span>
                    </div>
                    <span className="block text-[11px] text-slate-500">{opt.sub}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* SUBMIT BUTTON */}
        <div className="flex justify-end gap-3 pt-2">
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full sm:w-auto px-8 py-4 rounded-xl bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white font-bold text-base shadow-lg shadow-orange-500/25 transition flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Menyimpan Acara...</span>
              </>
            ) : (
              <>
                <span>Selesai & Dapatkan Link Acara</span>
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>
        </div>
      </form>

      {/* SUCCESS MODAL */}
      {createdEvent && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white max-w-lg w-full rounded-2xl p-6 sm:p-7 shadow-2xl space-y-6 animate-in fade-in zoom-in duration-200">
            <div className="text-center space-y-2">
              <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-sm">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-slate-900">Acara Berhasil Dibuat! 🎉</h3>
              <p className="text-xs text-slate-600">
                Silakan simpan link di bawah ini dan sebarkan ke rekan-rekan kantor Anda.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-orange-50 border border-orange-200 space-y-2">
              <span className="block text-xs font-bold text-orange-900 uppercase tracking-wider">
                1. Link Pemesanan untuk Karyawan (Sebarkan ke WhatsApp):
              </span>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={getPublicUrl()}
                  className="w-full bg-white px-3 py-2 rounded-lg border border-orange-200 text-xs font-mono text-slate-800"
                />
                <button
                  type="button"
                  onClick={copyPublicLink}
                  className="px-3 py-2 rounded-lg bg-orange-600 text-white hover:bg-orange-700 text-xs font-semibold shrink-0 flex items-center gap-1"
                >
                  {copiedLink ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedLink ? 'Tersalin' : 'Salin'}</span>
                </button>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  2. PIN Rahasia PIC Anda:
                </span>
                <span className="text-[11px] text-slate-500">Gunakan untuk Lock / Edit</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="px-4 py-2 bg-white rounded-lg border border-slate-300 font-mono text-base font-extrabold tracking-widest text-slate-900">
                  {createdEvent.adminPin}
                </div>
                <button
                  type="button"
                  onClick={copyPin}
                  className="px-3 py-2 rounded-lg bg-slate-800 text-white hover:bg-slate-900 text-xs font-semibold flex items-center gap-1"
                >
                  {copiedPin ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedPin ? 'Tersalin' : 'Salin PIN'}</span>
                </button>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                type="button"
                onClick={() => router.push(`/event/${createdEvent.id}/admin?pin=${createdEvent.adminPin}`)}
                className="flex-1 py-3 px-4 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-sm font-bold transition text-center shadow-md shadow-orange-500/20"
              >
                Buka Dashboard PIC (Admin)
              </button>
              <button
                type="button"
                onClick={() => router.push(`/order/${createdEvent.id}`)}
                className="py-3 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-sm font-medium transition text-center"
              >
                Coba Buka Link Order
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
