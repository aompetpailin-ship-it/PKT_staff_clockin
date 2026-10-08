import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const THAI_MONTH_NAMES = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
];

export async function GET() {
  try {
    const attendances = await prisma.attendance.findMany({
      select: { dateStr: true },
    });

    const sales = await prisma.dailySales.findMany({
      select: { dateStr: true },
    });

    const monthMap = new Map<string, { attendanceCount: number; salesCount: number }>();

    for (const a of attendances) {
      if (!a.dateStr) continue;
      const m = a.dateStr.slice(0, 7);
      if (!monthMap.has(m)) {
        monthMap.set(m, { attendanceCount: 0, salesCount: 0 });
      }
      monthMap.get(m)!.attendanceCount += 1;
    }

    for (const s of sales) {
      if (!s.dateStr) continue;
      const m = s.dateStr.slice(0, 7);
      if (!monthMap.has(m)) {
        monthMap.set(m, { attendanceCount: 0, salesCount: 0 });
      }
      monthMap.get(m)!.salesCount += 1;
    }

    const sortedMonths = Array.from(monthMap.keys()).sort((a, b) => b.localeCompare(a));

    const months = sortedMonths.map((m) => {
      const [yearStr, monthStr] = m.split('-');
      const year = parseInt(yearStr, 10);
      const monthIdx = parseInt(monthStr, 10) - 1;
      const thaiMonth = THAI_MONTH_NAMES[monthIdx] || monthStr;
      const stats = monthMap.get(m)!;

      let tag = '';
      if (stats.salesCount > 0 && stats.attendanceCount > 0) {
        tag = ` (ยอดขาย ${stats.salesCount} วัน, ลงเวลา ${stats.attendanceCount} ครั้ง)`;
      } else if (stats.salesCount > 0) {
        tag = ` (ยอดขาย ${stats.salesCount} วัน)`;
      } else if (stats.attendanceCount > 0) {
        tag = ` (ลงเวลา ${stats.attendanceCount} ครั้ง)`;
      }

      return {
        value: m,
        label: `${thaiMonth} ${year}${tag}`,
        thaiMonthName: thaiMonth,
        year,
        ...stats,
      };
    });

    return NextResponse.json({ success: true, months });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
