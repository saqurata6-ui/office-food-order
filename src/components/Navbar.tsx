'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { UtensilsCrossed, PlusCircle, History } from 'lucide-react';

export default function Navbar() {
  const pathname = usePathname();

  // Sembunyikan tombol "Buat Acara Baru" jika berada di halaman pemesanan peserta (/order/...)
  const isParticipantOrderPage = pathname?.startsWith('/order/');

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-gray-200">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5 font-bold text-gray-900 group">
          <div className="w-10 h-10 rounded-xl bg-orange-500 text-white flex items-center justify-center shadow-md shadow-orange-500/20 group-hover:scale-105 transition-transform">
            <UtensilsCrossed className="w-5 h-5" />
          </div>
          <div className="flex flex-col">
            <span className="text-lg leading-tight tracking-tight text-orange-600 font-extrabold">MakanKantor</span>
            <span className="text-xs text-gray-500 font-normal">Order & Split Bill Simple</span>
          </div>
        </Link>

        {!isParticipantOrderPage && (
          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/create"
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium transition shadow-sm"
            >
              <PlusCircle className="w-4 h-4" />
              <span className="hidden xs:inline">Buat Acara Baru</span>
              <span className="xs:hidden">Acara Baru</span>
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}
