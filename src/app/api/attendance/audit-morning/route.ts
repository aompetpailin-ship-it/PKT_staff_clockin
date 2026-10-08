import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getThaiDateStr } from '@/lib/dateUtils';
import { sendLineMorningStaffingAlert } from '@/lib/line';

export const dynamic = 'force-dynamic';

function getBranchMinRequiredStaff(branchCode: string, dateStr: string): number {
  const d = new Date(dateStr + 'T00:00:00');
  const dayOfWeek = d.getDay(); // 0 = Sunday, 6 = Saturday
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  const code = (branchCode || '').toUpperCase();

  if (code.includes('B1')) {
    return isWeekend ? 5 : 4;
  }
  // B2, B3, B4
  return isWeekend ? 4 : 3;
}

export async function GET(request: Request) {
  return handleAudit(request);
}

export async function POST(request: Request) {
  return handleAudit(request);
}

async function handleAudit(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get('dateStr');

    const now = new Date();
    const dateStr = dateParam || getThaiDateStr(now);
    const d = new Date(dateStr + 'T00:00:00');
    const dayOfWeek = d.getDay();

    const branches = await prisma.branch.findMany({
      orderBy: { code: 'asc' },
    });

    const auditResults = [];

    for (const b of branches) {
      // Find branch schedule override for this dayOfWeek if configured
      const schedule = await prisma.branchSchedule.findUnique({
        where: {
          branchId_dayOfWeek: {
            branchId: b.id,
            dayOfWeek,
          },
        },
      });

      const shiftStartTime = schedule?.shiftStartTime || b.shiftStartTime || '09:00';

      // Calculate 30-minute cutoff time dynamically from shiftStartTime
      const [startHour, startMin] = shiftStartTime.split(':').map((v) => parseInt(v, 10));
      const cutoffTotalMins = startHour * 60 + startMin + 30;
      const cutoffHour = Math.floor(cutoffTotalMins / 60);
      const cutoffMin = cutoffTotalMins % 60;
      const cutoffTime = `${String(cutoffHour).padStart(2, '0')}:${String(cutoffMin).padStart(2, '0')}`;

      // Get minimum required full-time staff count for this branch and day type
      const minRequiredStaff = getBranchMinRequiredStaff(b.code, dateStr);

      // Fetch attendances for this branch on dateStr
      const attendances = await prisma.attendance.findMany({
        where: {
          branchId: b.id,
          dateStr,
        },
        include: {
          employee: true,
        },
        orderBy: { clockInAt: 'asc' },
      });

      // Filter unique clocked-in FULL-TIME staff
      const empMap = new Map<string, string>();
      for (const att of attendances) {
        if (att.employee && att.employee.employmentType !== 'PART_TIME') {
          if (!empMap.has(att.employeeId)) {
            empMap.set(
              att.employeeId,
              att.employee?.nickname ? `${att.employee.fullName} (${att.employee.nickname})` : att.employee?.fullName || 'พนักงาน'
            );
          }
        }
      }

      const clockedInCount = empMap.size;
      const clockedInStaffNames = Array.from(empMap.values());
      const missingCount = Math.max(0, minRequiredStaff - clockedInCount);
      const isUnderstaffed = clockedInCount < minRequiredStaff;

      let alertSent = false;
      if (isUnderstaffed) {
        await sendLineMorningStaffingAlert({
          branchName: b.name,
          dateStr,
          shiftStartTime,
          cutoffTime,
          clockedInCount,
          minRequiredStaff,
          clockedInStaffNames,
          missingCount,
        }).catch((err) => console.error('[LINE Morning Alert Error]', err));
        alertSent = true;
      }

      auditResults.push({
        branchId: b.id,
        branchName: b.name,
        branchCode: b.code,
        shiftStartTime,
        cutoffTime,
        dateStr,
        minRequiredStaff,
        clockedInCount,
        missingCount,
        isUnderstaffed,
        alertSent,
        clockedInStaffNames,
      });
    }

    return NextResponse.json({
      success: true,
      message: `ประมวลผลการเช็กพนักงานกะเช้า (ตัดรอบ 30 นาทีหลังเวลาเข้างานรายสาขา) เรียบร้อยแล้ว`,
      auditedAt: new Date().toISOString(),
      auditResults,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
