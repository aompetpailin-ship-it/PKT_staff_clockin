import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { evaluateMonthlyDiligence } from '@/lib/diligenceEngine';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const monthYear = searchParams.get('monthYear') || new Date().toISOString().slice(0, 7); // e.g. "2026-08"

    const employees = await prisma.employee.findMany({
      include: { homeBranch: true },
      orderBy: { fullName: 'asc' },
    });

    const report = [];

    for (const emp of employees) {
      // Find all attendances for this month (across all branches)
      const attendances = await prisma.attendance.findMany({
        where: {
          employeeId: emp.id,
          dateStr: {
            startsWith: monthYear,
          },
        },
      });

      // Find all recorded leaves for this month
      const leaves = await prisma.leaveRecord.findMany({
        where: {
          employeeId: emp.id,
          dateStr: {
            startsWith: monthYear,
          },
        },
      });

      let lateCount = 0;
      let leaveCount = 0;
      let absentCount = 0;

      for (const att of attendances) {
        if (att.status === 'LEAVE') {
          leaveCount += 1;
        } else if (att.status === 'ABSENT') {
          absentCount += 1;
        } else if (att.lateMinutes > 0 && att.lateMinutes <= 15) {
          lateCount += 1;
        } else if (att.lateMinutes > 15) {
          // Late by more than 15 mins counts as absent / severe late
          absentCount += 1;
        }
      }

      for (const lv of leaves) {
        if (lv.leaveType === 'ABSENT') {
          absentCount += 1;
        } else {
          leaveCount += 1;
        }
      }

      const evalResult = evaluateMonthlyDiligence(
        emp.id,
        monthYear,
        lateCount,
        leaveCount,
        absentCount
      );

      // Save/update MonthlyDiligence record
      const diligenceRecord = await prisma.monthlyDiligence.upsert({
        where: {
          employeeId_monthYear: {
            employeeId: emp.id,
            monthYear,
          },
        },
        update: {
          lateCount,
          leaveCount,
          absentCount,
          isEligible: evalResult.isEligible,
          allowanceAmount: evalResult.allowanceAmount,
          calculatedAt: new Date(),
        },
        create: {
          employeeId: emp.id,
          monthYear,
          lateCount,
          leaveCount,
          absentCount,
          isEligible: evalResult.isEligible,
          allowanceAmount: evalResult.allowanceAmount,
        },
      });

      report.push({
        employee: emp,
        diligence: diligenceRecord,
        evalResult,
        leaveRecords: leaves,
      });
    }

    return NextResponse.json({
      success: true,
      monthYear,
      report,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
