import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const branchId = searchParams.get('branchId');

    const where: any = {};
    if (branchId) where.branchId = branchId;

    const schedules = await prisma.branchSchedule.findMany({
      where,
      include: { branch: true },
      orderBy: [{ branchId: 'asc' }, { dayOfWeek: 'asc' }],
    });

    return NextResponse.json({ success: true, schedules });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { branchId, dayOfWeek, shiftStartTime, shiftEndTime, notes } = body;

    if (!branchId || dayOfWeek === undefined || !shiftStartTime) {
      return NextResponse.json(
        { success: false, error: 'ข้อมูลไม่ครบถ้วน (ต้องการสาขา, วันในสัปดาห์ และ เวลาเริ่มงาน)' },
        { status: 400 }
      );
    }

    const schedule = await prisma.branchSchedule.upsert({
      where: {
        branchId_dayOfWeek: {
          branchId,
          dayOfWeek: parseInt(dayOfWeek, 10),
        },
      },
      update: {
        shiftStartTime,
        shiftEndTime: shiftEndTime || '18:00',
        notes,
      },
      create: {
        branchId,
        dayOfWeek: parseInt(dayOfWeek, 10),
        shiftStartTime,
        shiftEndTime: shiftEndTime || '18:00',
        notes,
      },
    });

    return NextResponse.json({ success: true, schedule });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
