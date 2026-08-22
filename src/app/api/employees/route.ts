import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

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

    return NextResponse.json({ success: true, employees });
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
          ...(resetDeviceBinding ? { boundDeviceId: null } : {}),
        },
      });
    } else {
      // Upsert / Create Employee
      employee = await prisma.employee.upsert({
        where: { lineUserId },
        update: {
          fullName,
          nickname,
          phone,
          ...(pinCode ? { pinCode: pinCode.trim() } : {}),
          role: role || 'STAFF',
          employmentType: employmentType || 'FULL_TIME',
          homeBranchId,
          canRoam: canRoam !== undefined ? Boolean(canRoam) : true,
          ...(resetDeviceBinding ? { boundDeviceId: null } : {}),
        },
        create: {
          lineUserId,
          fullName,
          nickname,
          phone,
          pinCode: pinCode ? pinCode.trim() : '1234',
          role: role || 'STAFF',
          employmentType: employmentType || 'FULL_TIME',
          homeBranchId,
          canRoam: canRoam !== undefined ? Boolean(canRoam) : true,
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
