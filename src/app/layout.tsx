import './globals.css';
import Link from 'next/link';

export const metadata = {
  title: 'ระบบลงเวลาเข้างานร้านผมขอทอด - PKT Staff Clock-In',
  description: 'ระบบ Clock In / Clock Out ผ่าน LINE + Geofence GPS + โบนัสยอดขาย + เบี้ยขยัน ร้านผมขอทอด',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="th">
      <body className="min-h-screen bg-[#F8F4EE] text-stone-900 font-sans p-2 md:p-6 flex flex-col items-center">
        {/* Warm Cream Modern Dashboard Container */}
        <div className="w-full max-w-6xl bg-[#FCFAF7] rounded-[32px] border border-[#EBE4D8] shadow-sm overflow-hidden flex flex-col min-h-[90vh]">
          {/* Warm Pastel Header */}
          <header className="bg-[#FAF5EF] text-stone-900 px-3.5 sm:px-6 py-3 flex justify-between items-center sticky top-0 z-50 border-b border-[#E8E1D5] shadow-xs">
            <Link href="/" className="flex items-center gap-2.5 group min-w-0">
              <div className="w-9 h-9 sm:w-10 sm:h-10 relative flex-shrink-0 bg-white rounded-2xl p-1 shadow-xs border border-[#E8E1D5] group-hover:scale-105 transition-transform duration-300">
                {/* eslint-disable-next-html-extension/no-img-element */}
                <img
                  src="/logo.png"
                  alt="ร้านผมขอทอด Logo"
                  className="w-full h-full object-contain"
                />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-extrabold text-base sm:text-lg tracking-tight text-stone-900 group-hover:text-[#F97316] transition-colors whitespace-nowrap">
                    ร้านผมขอทอด
                  </span>
                  <span className="bg-[#F97316] text-white text-[9px] sm:text-[10px] font-bold px-2 py-0.5 rounded-full shadow-xs whitespace-nowrap">
                    4 สาขา
                  </span>
                </div>
                <p className="text-[9px] sm:text-[10px] text-stone-500 font-bold tracking-wide truncate hidden sm:block">
                  "ที่มันอร่อยเกินไป" • Staff Clock-In System
                </p>
              </div>
            </Link>

            <nav className="flex items-center gap-1.5 flex-shrink-0">
              <Link
                href="/"
                className="px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-2xl bg-[#EFE8E2] hover:bg-[#E5DDD4] text-xs font-bold text-stone-800 transition-all duration-200 flex items-center gap-1 shadow-xs whitespace-nowrap"
              >
                <span>📱 <span className="hidden sm:inline">เข้างาน </span>(Staff)</span>
              </Link>
              <Link
                href="/admin"
                className="px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-2xl bg-[#2D2A26] hover:bg-[#1E1C1A] text-white font-bold text-xs transition-all duration-200 flex items-center gap-1 shadow-xs whitespace-nowrap"
              >
                <span>⚙️ Admin</span>
              </Link>
            </nav>
          </header>

          {/* Main Body */}
          <main className="flex-1 p-4 md:p-6 space-y-6 bg-[#F8F4EE]/60">
            {children}
          </main>

          {/* Footer */}
          <footer className="bg-[#FAF5EF] border-t border-[#E8E1D5] text-stone-500 py-4 text-center text-xs">
            <p>© 2026 ร้านผมขอทอด "ที่มันอร่อยเกินไป" • Multi-Branch Staff Incentive Platform</p>
          </footer>
        </div>
      </body>
    </html>
  );
}
