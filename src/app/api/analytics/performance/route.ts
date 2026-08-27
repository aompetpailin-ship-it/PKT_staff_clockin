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

      // Find all bonus payouts for this month with branch details
      const bonusPayouts = await prisma.bonusPayout.findMany({
        where: {
          employeeId: emp.id,
          dateStr: {
            startsWith: monthYear,
          },
        },
        include: {
          dailySales: {
            include: { branch: true },
          },
        },
        orderBy: { dateStr: 'asc' },
      });

      const totalBonusAmount = bonusPayouts.reduce((sum, p) => sum + p.amount, 0);

      const bonusDetails = await Promise.all(
        bonusPayouts.map(async (p) => {
          let shiftStaffText = '';
          let shiftStaffCount = 0;
          let fullTimeCount = 0;
          let partTimeCount = 0;
          let shiftStaffList: { id: string; name: string; fullName: string; employmentType: string }[] = [];

          if (p.dailySales?.branchId) {
            const shiftAttendances = await prisma.attendance.findMany({
              where: {
                dateStr: p.dateStr,
                branchId: p.dailySales.branchId,
              },
              include: { employee: true },
              orderBy: { clockInAt: 'asc' },
            });

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
        })
      );

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
