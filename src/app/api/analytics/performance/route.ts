import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const monthYear = searchParams.get('monthYear') || new Date().toISOString().slice(0, 7); // e.g. "2026-08"
    const employeeId = searchParams.get('employeeId');

    const employees = await prisma.employee.findMany({
      where: employeeId ? { id: employeeId } : {},
      include: { homeBranch: true },
      orderBy: { fullName: 'asc' },
    });

    const performanceReport = [];

    for (const emp of employees) {
      // Find all attendance records for this month
      const attendances = await prisma.attendance.findMany({
        where: {
          employeeId: emp.id,
          dateStr: {
            startsWith: monthYear,
          },
        },
        include: { branch: true },
      });

      // Find all bonus payouts for this month
      const bonusPayouts = await prisma.bonusPayout.findMany({
        where: {
          employeeId: emp.id,
          dateStr: {
            startsWith: monthYear,
          },
        },
      });

      const totalBonusAmount = bonusPayouts.reduce((sum, p) => sum + p.amount, 0);

      // Branch breakdown stats
      const branchStatsMap: Record<string, { branchId: string; branchName: string; branchCode: string; count: number }> = {};
      let onTimeCount = 0;
      let lateCount = 0;
      let totalLateMinutes = 0;

      for (const att of attendances) {
        // Count branch shifts
        const bId = att.branchId;
        if (!branchStatsMap[bId]) {
          branchStatsMap[bId] = {
            branchId: bId,
            branchName: att.branch?.name || 'ไม่ทราบสาขา',
            branchCode: att.branch?.code || 'N/A',
            count: 0,
          };
        }
        branchStatsMap[bId].count += 1;

        if (att.status === 'ON_TIME') {
          onTimeCount += 1;
        } else if (att.status === 'LATE') {
          lateCount += 1;
          totalLateMinutes += att.lateMinutes;
        }
      }

      const totalShifts = attendances.length;

      // Convert branch stats to array with percentage calculation for Pie Chart
      const branchBreakdown = Object.values(branchStatsMap).map((b) => ({
        ...b,
        percentage: totalShifts > 0 ? Math.round((b.count / totalShifts) * 100) : 0,
      }));

      const onTimeRate = totalShifts > 0 ? Math.round((onTimeCount / totalShifts) * 100) : 100;

      performanceReport.push({
        employee: emp,
        monthYear,
        totalShifts,
        onTimeCount,
        lateCount,
        totalLateMinutes,
        onTimeRate,
        totalBonusAmount,
        branchBreakdown,
      });
    }

    return NextResponse.json({
      success: true,
      monthYear,
      report: performanceReport,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
