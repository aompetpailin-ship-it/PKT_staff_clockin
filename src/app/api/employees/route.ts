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

    let employees = await prisma.employee.findMany({
      include: { homeBranch: true },
      orderBy: { fullName: 'asc' },
    });

    // Auto-seed default sample employees if DB is empty
    if (employees.length === 0) {
      const branches = await prisma.branch.findMany();
      if (branches.length > 0) {
        const homeB = branches[0];
        const defaultEmps = [
          {
            lineUserId: 'LINE_EMP_001',
            fullName: 'สมชาย ใจดี',
            nickname: 'ชาย',
            pinCode: '1234',
            phone: '0812345678',
            role: 'STAFF',
            employmentType: 'FULL_TIME',
            homeBranchId: homeB.id,
            canRoam: true,
          },
          {
            lineUserId: 'LINE_EMP_002',
            fullName: 'สมหญิง รักงาน',
            nickname: 'หญิง',
            pinCode: '1234',
            phone: '0823456789',
            role: 'STAFF',
            employmentType: 'FULL_TIME',
            homeBranchId: homeB.id,
            canRoam: true,
          },
        ];

        for (const emp of defaultEmps) {
          await prisma.employee.upsert({
            where: { lineUserId: emp.lineUserId },
            update: {},
            create: emp,
          });
        }

        employees = await prisma.employee.findMany({
          include: { homeBranch: true },
          orderBy: { fullName: 'asc' },
        });
      }
    }

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
