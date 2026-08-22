import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const monthYear = searchParams.get('monthYear');
    const employeeId = searchParams.get('employeeId');

    const where: any = {};
    if (employeeId) where.employeeId = employeeId;
    if (monthYear) {
      where.dateStr = { startsWith: monthYear };
    }

    const leaves = await prisma.leaveRecord.findMany({
      where,
      include: {
        employee: {
          include: {
            homeBranch: true,
          },
        },
      },
      orderBy: { dateStr: 'desc' },
    });

    return NextResponse.json({ success: true, leaves });
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
    const { employeeId, dateStr, startDateStr, endDateStr, leaveType, reason, recordedBy } = body;

    if (!employeeId || !leaveType) {
      return NextResponse.json(
        { success: false, error: 'กรุณาระบุพนักงานและประเภทการลางาน' },
        { status: 400 }
      );
    }

    // Determine list of dates to record leave for (supports single date or date range)
    const datesToRecord: string[] = [];

    if (startDateStr && endDateStr) {
      const start = new Date(startDateStr);
      const end = new Date(endDateStr);
      const cur = new Date(start);

      while (cur <= end) {
        datesToRecord.push(cur.toISOString().split('T')[0]);
        cur.setDate(cur.getDate() + 1);
      }
    } else if (dateStr) {
      datesToRecord.push(dateStr);
    }

    if (datesToRecord.length === 0) {
      return NextResponse.json(
        { success: false, error: 'กรุณาระบุวันที่ต้องการลางาน' },
        { status: 400 }
      );
    }

    const createdLeaves = [];

    for (const dStr of datesToRecord) {
      const leave = await prisma.leaveRecord.upsert({
        where: {
          employeeId_dateStr: {
            employeeId,
            dateStr: dStr,
          },
        },
        update: {
          leaveType,
          reason,
          recordedBy: recordedBy || 'ADMIN',
          status: 'APPROVED',
        },
        create: {
          employeeId,
          dateStr: dStr,
          leaveType,
          reason,
          recordedBy: recordedBy || 'ADMIN',
          status: 'APPROVED',
        },
        include: {
          employee: true,
        },
      });
      createdLeaves.push(leave);
    }

    return NextResponse.json({
      success: true,
      message: `บันทึกรายการลางานจำนวน ${createdLeaves.length} วันเรียบร้อยแล้ว`,
      leaves: createdLeaves,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'กรุณาระบุ ID ของรายการที่ต้องการลบ' },
        { status: 400 }
      );
    }

    await prisma.leaveRecord.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: 'ลบรายการลางานเรียบร้อยแล้ว',
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
