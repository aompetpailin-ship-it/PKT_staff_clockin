import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const branchId = searchParams.get('branchId');
    const employeeId = searchParams.get('employeeId');
    const dateStr = searchParams.get('dateStr');
    const monthYear = searchParams.get('monthYear'); // e.g. "2026-08"

    const where: any = {};
    if (branchId) where.branchId = branchId;
    if (employeeId) where.employeeId = employeeId;
    if (dateStr) {
      where.dateStr = dateStr;
    } else if (monthYear) {
      where.dateStr = { startsWith: monthYear };
    }

    const logs = await prisma.attendance.findMany({
      where,
      include: {
        employee: true,
        branch: true,
      },
      orderBy: { clockInAt: 'desc' },
    });

    return NextResponse.json({ success: true, logs });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
