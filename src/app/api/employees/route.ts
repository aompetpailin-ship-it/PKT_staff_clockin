import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const lineUserId = searchParams.get('lineUserId');

    if (lineUserId) {
      const employee = await prisma.employee.findUnique({
        where: { lineUserId },
        include: { homeBranch: true },
      });
      return NextResponse.json({ success: true, employee });
    }

    const employees = await prisma.employee.findMany({
      include: { homeBranch: true },
      orderBy: { fullName: 'asc' },
    });

    return NextResponse.json(
      { success: true, employees },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } }
    );
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
      id,
      lineUserId,
      fullName,
      nickname,
      phone,
      pinCode,
      role,
      employmentType,
      homeBranchId,
      canRoam,
      avatarUrl,
      resetDeviceBinding,
    } = body;

    let employee;

    if (id) {
      // Update existing employee
      employee = await prisma.employee.update({
        where: { id },
        data: {
          ...(fullName ? { fullName } : {}),
          ...(nickname !== undefined ? { nickname } : {}),
          ...(phone !== undefined ? { phone } : {}),
          ...(pinCode ? { pinCode: pinCode.trim() } : {}),
          ...(role ? { role } : {}),
          ...(employmentType ? { employmentType } : {}),
          ...(homeBranchId ? { homeBranchId } : {}),
          ...(canRoam !== undefined ? { canRoam: Boolean(canRoam) } : {}),
          ...(avatarUrl !== undefined ? { avatarUrl } : {}),
          ...(resetDeviceBinding ? { boundDeviceId: null } : {}),
        },
      });
    } else {
      // Create / Upsert Employee
      let bId = homeBranchId;
      if (!bId) {
        const firstBranch = await prisma.branch.findFirst();
        if (firstBranch) bId = firstBranch.id;
      }

      const generatedLineId = lineUserId || `LINE_EMP_${Date.now()}`;

      employee = await prisma.employee.upsert({
        where: { lineUserId: generatedLineId },
        update: {
          fullName,
          nickname,
          phone,
          ...(pinCode ? { pinCode: pinCode.trim() } : {}),
          role: role || 'STAFF',
          employmentType: employmentType || 'FULL_TIME',
          homeBranchId: bId,
          canRoam: canRoam !== undefined ? Boolean(canRoam) : true,
          ...(avatarUrl !== undefined ? { avatarUrl } : {}),
          ...(resetDeviceBinding ? { boundDeviceId: null } : {}),
        },
        create: {
          lineUserId: generatedLineId,
          fullName,
          nickname,
          phone,
          pinCode: pinCode ? pinCode.trim() : '1234',
          role: role || 'STAFF',
          employmentType: employmentType || 'FULL_TIME',
          homeBranchId: bId,
          canRoam: canRoam !== undefined ? Boolean(canRoam) : true,
          avatarUrl: avatarUrl || null,
        },
      });
    }

    return NextResponse.json({ success: true, employee });
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
        { success: false, error: 'กรุณาระบุ ID พนักงานที่ต้องการลบ' },
        { status: 400 }
      );
    }

    // Delete dependent records first to maintain data integrity
    await prisma.bonusPayout.deleteMany({ where: { employeeId: id } });
    await prisma.attendance.deleteMany({ where: { employeeId: id } });
    await prisma.leaveRecord.deleteMany({ where: { employeeId: id } });
    await prisma.monthlyDiligence.deleteMany({ where: { employeeId: id } });

    await prisma.employee.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: 'ลบข้อมูลพนักงานเรียบร้อยแล้ว',
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
