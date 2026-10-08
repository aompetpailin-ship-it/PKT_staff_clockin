import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { calculateDailySalesBonus } from '@/lib/bonusEngine';
import { sendLineUnderstaffedAlert } from '@/lib/line';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const branchId = searchParams.get('branchId');
    const dateStr = searchParams.get('dateStr');
    const monthYear = searchParams.get('monthYear'); // e.g. "2026-08"

    const where: any = {};
    if (branchId) where.branchId = branchId;
    if (dateStr) {
      where.dateStr = dateStr;
    } else if (monthYear) {
      where.dateStr = { startsWith: monthYear };
    }

    const dailySales = await prisma.dailySales.findMany({
      where,
      include: {
        branch: true,
        bonusPayouts: {
          include: {
            employee: true,
          },
        },
      },
      orderBy: { dateStr: 'desc' },
    });

    return NextResponse.json({ success: true, dailySales });
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
    const { branchId, dateStr, totalSales, recordedBy, staffCountOverride } = body;

    if (!branchId || !dateStr || totalSales === undefined) {
      return NextResponse.json(
        { success: false, error: 'ข้อมูลไม่ครบถ้วน (ต้องการสาขา, วันที่ และ ยอดขายรวม)' },
        { status: 400 }
      );
    }

    const salesAmount = parseFloat(totalSales);

    // Upsert DailySales record
    const dailySales = await prisma.dailySales.upsert({
      where: {
        branchId_dateStr: {
          branchId,
          dateStr,
        },
      },
      update: {
        totalSales: salesAmount,
        recordedBy: recordedBy || 'ADMIN',
        ...(staffCountOverride !== undefined ? { staffCountOverride: staffCountOverride !== null ? Number(staffCountOverride) : null } : {}),
      },
      create: {
        branchId,
        dateStr,
        totalSales: salesAmount,
        recordedBy: recordedBy || 'ADMIN',
        staffCountOverride: staffCountOverride !== undefined && staffCountOverride !== null ? Number(staffCountOverride) : null,
      },
    });

    // Fetch working staff who clocked in at this branch on this date
    const attendances = await prisma.attendance.findMany({
      where: {
        branchId,
        dateStr,
      },
      include: {
        employee: true,
      },
    });

    // Unique employees who worked today
    const employeeMap = new Map();
    for (const att of attendances) {
      if (!employeeMap.has(att.employeeId)) {
        employeeMap.set(att.employeeId, att.employee);
      }
    }
    const workingEmployees = Array.from(employeeMap.values());
    const fullTimeEmployees = workingEmployees.filter(
      (emp) => emp.employmentType !== 'PART_TIME'
    );
    const autoFullTimeStaffCount = fullTimeEmployees.length;
    const fullTimeStaffCount =
      dailySales.staffCountOverride !== null && dailySales.staffCountOverride !== undefined
        ? dailySales.staffCountOverride
        : autoFullTimeStaffCount;

    // Calculate Bonus using Bonus Engine based strictly on Full Time staff count
    const bonusResult = calculateDailySalesBonus(salesAmount, fullTimeStaffCount);

    // Clear previous bonus payouts for this dailySales record
    await prisma.bonusPayout.deleteMany({
      where: { dailySalesId: dailySales.id },
    });

    // If qualified and bonus > 0, generate payout records ONLY for FULL TIME staff
    const createdPayouts = [];
    if (bonusResult.isQualified && bonusResult.bonusPerPerson > 0) {
      for (const emp of fullTimeEmployees) {
        const payout = await prisma.bonusPayout.create({
          data: {
            dailySalesId: dailySales.id,
            employeeId: emp.id,
            branchId,
            dateStr,
            amount: bonusResult.bonusPerPerson,
            reason: bonusResult.reason,
          },
          include: {
            employee: true,
          },
        });
        createdPayouts.push(payout);
      }
    }

    // Trigger LINE Alert if understaffed (actual staff less than tier threshold)
    if (bonusResult.matchedTierReqStaff && fullTimeStaffCount < bonusResult.matchedTierReqStaff) {
      const branchObj = await prisma.branch.findUnique({ where: { id: branchId } });
      sendLineUnderstaffedAlert({
        branchName: branchObj?.name || 'ไม่ทราบสาขา',
        dateStr,
        actualStaffCount: fullTimeStaffCount,
        minRequiredStaff: bonusResult.matchedTierReqStaff,
        salesAmount,
        reason: bonusResult.reason,
      }).catch((err) => console.error('[LINE Alert Error]', err));
    }

    return NextResponse.json({
      success: true,
      message: 'บันทึกยอดขายและประมวลผลโบนัสประจำวันเรียบร้อยแล้ว',
      dailySales,
      bonusResult,
      workingStaffCount: workingEmployees.length,
      fullTimeStaffCount,
      payouts: createdPayouts,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
