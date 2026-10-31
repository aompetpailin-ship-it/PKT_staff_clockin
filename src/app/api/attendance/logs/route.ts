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

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      employeeId,
      branchId,
      dateStr,
      clockInTime = '09:30',
      clockOutTime = '21:00',
      status = 'ON_TIME',
      lateMinutes = 0,
      notes = '',
      adminUser,
    } = body;

    // Permission check: allow authenticated admin accounts
    const normalizedAdmin = (adminUser || '').trim().toLowerCase();
    if (!['aommyisme', 'pon'].includes(normalizedAdmin)) {
      return NextResponse.json(
        { success: false, error: 'สิทธิ์ไม่เพียงพอ: การเพิ่มการเข้างานด้วยตนเองอนุญาตเฉพาะผู้จัดการ (Admin) เท่านั้น' },
        { status: 403 }
      );
    }

    if (!employeeId || !branchId || !dateStr) {
      return NextResponse.json(
        { success: false, error: 'กรุณาระบุพนักงาน, สาขา และวันที่เข้างานให้ครบถ้วน' },
        { status: 400 }
      );
    }

    // Normalize dateStr to YYYY-MM-DD
    let normalizedDate = dateStr.trim().replace(/\//g, '-');
    const parts = normalizedDate.split('-');
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        normalizedDate = `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
      } else if (parts[2].length === 4) {
        const p0 = parseInt(parts[0], 10);
        const p1 = parseInt(parts[1], 10);
        if (p0 > 12) {
          normalizedDate = `${parts[2]}-${String(p1).padStart(2, '0')}-${String(p0).padStart(2, '0')}`;
        } else {
          normalizedDate = `${parts[2]}-${String(p0).padStart(2, '0')}-${String(p1).padStart(2, '0')}`;
        }
      }
    }

    const branch = await prisma.branch.findUnique({ where: { id: branchId } });
    if (!branch) {
      return NextResponse.json({ success: false, error: 'ไม่พบสาขาที่ระบุ' }, { status: 404 });
    }

    const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
    if (!employee) {
      return NextResponse.json({ success: false, error: 'ไม่พบพนักงานที่ระบุ' }, { status: 404 });
    }

    // Build timestamps in Bangkok timezone (UTC+7)
    const [inH, inM] = (clockInTime || '09:30').split(':').map((v: string) => parseInt(v, 10));
    const clockInAt = new Date(`${normalizedDate}T${String(inH).padStart(2, '0')}:${String(inM).padStart(2, '0')}:00+07:00`);

    let clockOutAt: Date | null = null;
    if (clockOutTime) {
      const [outH, outM] = clockOutTime.split(':').map((v: string) => parseInt(v, 10));
      clockOutAt = new Date(`${normalizedDate}T${String(outH).padStart(2, '0')}:${String(outM).padStart(2, '0')}:00+07:00`);
    }

    let calculatedLate = parseInt(String(lateMinutes), 10) || 0;
    if (status === 'ON_TIME' || status === 'COVER_SHIFT' || status === 'HALF_DAY') {
      calculatedLate = 0;
    }

    let finalNotes = notes ? notes.trim() : 'บันทึกเวลาเข้างานด้วยตนเอง';
    if (!finalNotes.includes('Admin')) {
      finalNotes = `${finalNotes} (บันทึกโดย Admin: ${adminUser})`;
    }

    const attendance = await prisma.attendance.create({
      data: {
        employeeId,
        branchId,
        dateStr: normalizedDate,
        clockInAt,
        clockOutAt,
        clockInPhotoUrl: null,
        verificationMethod: 'MANAGER_OVERRIDE',
        deviceId: employee.boundDeviceId || 'DEV_ADMIN_MANUAL',
        clockInLat: branch.latitude,
        clockInLng: branch.longitude,
        distanceMeters: 0,
        lateMinutes: calculatedLate,
        status,
        notes: finalNotes,
      },
      include: {
        employee: true,
        branch: true,
      },
    });

    return NextResponse.json({
      success: true,
      message: `บันทึกเวลาเข้างานของ ${employee.fullName} (${normalizedDate}) เรียบร้อยแล้ว`,
      attendance,
    });
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
