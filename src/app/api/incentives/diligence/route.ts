import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { evaluateMonthlyDiligence } from '@/lib/diligenceEngine';

export const dynamic = 'force-dynamic';

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

      const [yearStr, monthStr] = monthYear.split('-');
      const year = parseInt(yearStr, 10);
      const month = parseInt(monthStr, 10);

      const thaiDateNow = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });
      const [nowYear, nowMonth, nowDay] = thaiDateNow.split('-').map((v) => parseInt(v, 10));

      let lastDay = new Date(year, month, 0).getDate();
      if (year === nowYear && month === nowMonth) {
        lastDay = Math.min(lastDay, nowDay);
      }

      // Determine employee's first active working date
      const sortedLogDates = attendances.map((a) => a.dateStr).sort();
      const firstClockInDateStr = sortedLogDates.length > 0 ? sortedLogDates[0] : null;
      const createdAtDateStr = emp.createdAt ? new Date(emp.createdAt).toISOString().slice(0, 10) : null;
      const firstActiveDateStr = firstClockInDateStr || createdAtDateStr;

      const clockedInDateSet = new Set(
        attendances
          .filter((a) => a.status !== 'ABSENT' && a.status !== 'LEAVE')
          .map((a) => a.dateStr)
      );

      const leavesMap = new Map<string, any>();
      leaves.forEach((l) => leavesMap.set(l.dateStr, l));

      let lateCount = 0;
      let leaveCount = 0;
      let absentCount = 0;

      // Count late entries (status === 'LATE') from attendance logs
      for (const att of attendances) {
        if (att.status === 'LATE') {
          lateCount += 1;
        } else if (att.status === 'ABSENT' || att.lateMinutes > 30) {
          absentCount += 1;
        }
      }

      // Helper function to get Monday-Sunday week key
      const getWeekKeyStr = (dateObj: Date) => {
        const d = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate());
        const day = d.getDay() === 0 ? 7 : d.getDay();
        d.setDate(d.getDate() + 4 - day);
        const yearStart = new Date(d.getFullYear(), 0, 1);
        const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
        return `${d.getFullYear()}-W${String(weekNo).padStart(2, '0')}`;
      };

      const weeklyUnclockedCountMap: Record<string, number> = {};

      for (let day = 1; day <= lastDay; day++) {
        const dStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

        if (firstActiveDateStr && dStr < firstActiveDateStr) {
          continue;
        }

        if (!clockedInDateSet.has(dStr)) {
          const dObj = new Date(dStr + 'T00:00:00');
          const dayOfWeek = dObj.getDay();
          const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

          const leaveItem = leavesMap.get(dStr);

          if (leaveItem) {
            if (leaveItem.leaveType === 'ABSENT') {
              absentCount += 1;
            } else {
              leaveCount += 1;
            }
          } else if (isWeekend) {
            absentCount += 1; // Unclocked weekend day = absent / cut diligence
          } else {
            const weekKey = getWeekKeyStr(dObj);
            weeklyUnclockedCountMap[weekKey] = (weeklyUnclockedCountMap[weekKey] || 0) + 1;
            if (weeklyUnclockedCountMap[weekKey] > 1) {
              absentCount += 1; // 2nd+ unclocked weekday in same week = extra day off / absent
            }
          }
        }
      }

      const evalResult = evaluateMonthlyDiligence(
        emp.id,
        monthYear,
        lateCount,
        leaveCount,
        absentCount,
        emp.employmentType,
        emp.role
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
