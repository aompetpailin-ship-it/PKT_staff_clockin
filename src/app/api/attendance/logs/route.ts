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

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { attendanceId, status, notes, adminUser } = body;

    if (!attendanceId) {
      return NextResponse.json(
        { success: false, error: 'กรุณาระบุรหัสรายการเข้างาน (attendanceId)' },
        { status: 400 }
      );
    }

    const updateData: any = {};

    if (status !== undefined) {
      updateData.status = status;
      if (status === 'ON_TIME') {
        updateData.lateMinutes = 0;
      }
      updateData.verificationMethod = 'MANAGER_OVERRIDE';
    }

    if (notes !== undefined || status !== undefined) {
      let finalNotes = (notes !== undefined && notes !== null) ? notes.trim() : '';
      const tag = adminUser ? `(แก้ไขโดย Admin: ${adminUser})` : '(แก้ไขโดย Admin)';
      
      if (!finalNotes.includes('แก้ไขโดย Admin')) {
        finalNotes = finalNotes ? `${finalNotes} ${tag}` : tag;
      }
      updateData.notes = finalNotes;
    }

    const updated = await prisma.attendance.update({
      where: { id: attendanceId },
      data: updateData,
      include: {
        employee: true,
        branch: true,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'บันทึกการแก้ไขข้อมูลเรียบร้อยแล้ว',
      attendance: updated,
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
    const attendanceId = searchParams.get('attendanceId');

    if (!attendanceId) {
      return NextResponse.json(
        { success: false, error: 'กรุณาระบุรหัสประวัติการเข้างาน (attendanceId)' },
        { status: 400 }
      );
    }

    await prisma.attendance.delete({
      where: { id: attendanceId },
    });

    return NextResponse.json({
      success: true,
      message: 'ลบรายการประวัติการเข้างานเรียบร้อยแล้ว',
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
