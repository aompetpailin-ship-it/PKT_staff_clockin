import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const monthYear = searchParams.get('monthYear') || new Date().toISOString().slice(0, 7); // e.g. "2026-09"
    const employeeId = searchParams.get('employeeId');

    // 1. High Performance Batch Queries (Only 3 fast parallel queries instead of N*M nested queries)
    const [employees, allAttendances, allBonusPayouts] = await Promise.all([
      prisma.employee.findMany({
        where: employeeId ? { id: employeeId } : {},
        include: { homeBranch: true },
        orderBy: { fullName: 'asc' },
      }),
      prisma.attendance.findMany({
        where: {
          dateStr: { startsWith: monthYear },
        },
        include: { branch: true, employee: true },
        orderBy: { clockInAt: 'asc' },
      }),
      prisma.bonusPayout.findMany({
        where: {
          dateStr: { startsWith: monthYear },
        },
        include: {
          dailySales: { include: { branch: true } },
          employee: true,
        },
        orderBy: { dateStr: 'asc' },
      }),
    ]);

    // 2. Pre-index shift attendances by "branchId_dateStr"
    const shiftMap = new Map<string, any[]>();
    for (const att of allAttendances) {
      const key = `${att.branchId}_${att.dateStr}`;
      if (!shiftMap.has(key)) {
        shiftMap.set(key, []);
      }
      shiftMap.get(key)!.push(att);
    }

    // 3. Pre-index attendances & bonus payouts by employeeId
    const empAttMap = new Map<string, any[]>();
    for (const att of allAttendances) {
      if (!empAttMap.has(att.employeeId)) {
        empAttMap.set(att.employeeId, []);
      }
      empAttMap.get(att.employeeId)!.push(att);
    }

    const empPayoutMap = new Map<string, any[]>();
    for (const p of allBonusPayouts) {
      if (!empPayoutMap.has(p.employeeId)) {
        empPayoutMap.set(p.employeeId, []);
      }
      empPayoutMap.get(p.employeeId)!.push(p);
    }

    const performanceReport = [];

    for (const emp of employees) {
      const attendances = empAttMap.get(emp.id) || [];
      const bonusPayouts = empPayoutMap.get(emp.id) || [];

      const totalBonusAmount = bonusPayouts.reduce((sum, p) => sum + (p.amount || 0), 0);

      const bonusDetails = bonusPayouts.map((p) => {
        let shiftStaffText = '';
        let shiftStaffCount = 0;
        let fullTimeCount = 0;
        let partTimeCount = 0;
        let shiftStaffList: { id: string; name: string; fullName: string; employmentType: string }[] = [];

        const branchId = p.dailySales?.branchId || p.branchId;
        if (branchId) {
          const shiftAttendances = shiftMap.get(`${branchId}_${p.dateStr}`) || [];
          shiftStaffCount = shiftAttendances.length;
          shiftStaffList = shiftAttendances.map((att) => ({
            id: att.employee.id,
            name: att.employee.nickname || att.employee.fullName.split(' ')[0],
            fullName: att.employee.fullName,
            employmentType: att.employee.employmentType || 'FULL_TIME',
          }));

          fullTimeCount = shiftStaffList.filter((s) => s.employmentType !== 'PART_TIME').length;
          partTimeCount = shiftStaffList.filter((s) => s.employmentType === 'PART_TIME').length;

          const nameStrings = shiftStaffList.map((s) => s.name);
          shiftStaffText = shiftStaffCount > 0
            ? `👥 เข้างาน ${shiftStaffCount} คน (${nameStrings.join(', ')})`
            : '👥 ไม่พบข้อมูลการเข้างาน';
        }

        return {
          id: p.id,
          dateStr: p.dateStr,
          amount: p.amount,
          reason: p.reason,
          branchName: p.dailySales?.branch?.name || 'ไม่ทราบสาขา',
          branchCode: p.dailySales?.branch?.code || 'N/A',
          totalSales: p.dailySales?.totalSales || 0,
          shiftStaffCount,
          fullTimeCount,
          partTimeCount,
          shiftStaffList,
          shiftStaffText,
        };
      });

      // Branch breakdown stats
      const branchStatsMap: Record<string, { branchId: string; branchName: string; branchCode: string; count: number }> = {};
      let onTimeCount = 0;
      let lateCount = 0;
      let totalLateMinutes = 0;

      for (const att of attendances) {
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
          totalLateMinutes += (att.lateMinutes || 0);
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
        bonusDetails,
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
