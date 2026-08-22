import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { attendanceId, employeeId } = body;

    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];

    let attendance;
    if (attendanceId) {
      attendance = await prisma.attendance.findUnique({
        where: { id: attendanceId },
      });
    } else if (employeeId) {
      attendance = await prisma.attendance.findFirst({
        where: {
          employeeId,
          dateStr,
          clockOutAt: null,
        },
      });
    }

    if (!attendance) {
      return NextResponse.json(
        { success: false, error: 'ไม่พบรายการเข้างานที่ต้องออกงาน' },
        { status: 404 }
      );
    }

    const updated = await prisma.attendance.update({
      where: { id: attendance.id },
      data: {
        clockOutAt: now,
      },
      include: {
        employee: true,
        branch: true,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'ลงเวลาออกงานเรียบร้อยแล้ว',
      attendance: updated,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
