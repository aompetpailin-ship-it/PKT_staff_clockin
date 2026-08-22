import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { calculateDailySalesBonus } from '@/lib/bonusEngine';

/**
 * Bulk Sales Import API from CSV data or Google Sheets copy-paste format.
 * Format expected (header optional):
 * date,branchCode,totalSales
 * 2026-08-20,B1,22000
 * 2026-08-20,B2,30000
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { csvText, rowsData } = body;

    let itemsToProcess: Array<{ dateStr: string; branchCodeOrName: string; totalSales: number }> = [];

    if (Array.isArray(rowsData)) {
      itemsToProcess = rowsData;
    } else if (typeof csvText === 'string') {
      // Parse CSV or TSV lines
      const lines = csvText.split(/\r?\n/).filter((line) => line.trim().length > 0);
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        // Skip header line if present
        if (i === 0 && (line.toLowerCase().includes('date') || line.toLowerCase().includes('branch'))) {
          continue;
        }

        // Split by comma or tab
        const parts = line.includes('\t') ? line.split('\t') : line.split(',');
        if (parts.length >= 3) {
          const dateStr = parts[0].trim();
          const branchCodeOrName = parts[1].trim();
          const salesVal = parseFloat(parts[2].trim().replace(/,/g, ''));

          if (dateStr && branchCodeOrName && !isNaN(salesVal)) {
            itemsToProcess.push({
              dateStr,
              branchCodeOrName,
              totalSales: salesVal,
            });
          }
        }
      }
    }

    if (itemsToProcess.length === 0) {
      return NextResponse.json(
        { success: false, error: 'ไม่พบข้อมูลที่ต้องการนำเข้า กรุณาตรวจสอบรูปแบบ CSV / Google Sheets' },
        { status: 400 }
      );
    }

    // Fetch all branches for code / name mapping
    const branches = await prisma.branch.findMany();

    const results = [];
    let successCount = 0;
    let failCount = 0;

    for (const item of itemsToProcess) {
      // Find branch by code or name
      const targetBranch = branches.find(
        (b) =>
          b.code.toLowerCase() === item.branchCodeOrName.toLowerCase() ||
          b.name.toLowerCase().includes(item.branchCodeOrName.toLowerCase())
      );

      if (!targetBranch) {
        results.push({
          dateStr: item.dateStr,
          branchCodeOrName: item.branchCodeOrName,
          status: 'FAIL',
          reason: `ไม่พบสาขารหัส/ชื่อ "${item.branchCodeOrName}" ในระบบ`,
        });
        failCount++;
        continue;
      }

      // Upsert DailySales
      const dailySales = await prisma.dailySales.upsert({
        where: {
          branchId_dateStr: {
            branchId: targetBranch.id,
            dateStr: item.dateStr,
          },
        },
        update: {
          totalSales: item.totalSales,
          recordedBy: 'CSV_IMPORT',
        },
        create: {
          branchId: targetBranch.id,
          dateStr: item.dateStr,
          totalSales: item.totalSales,
          recordedBy: 'CSV_IMPORT',
        },
      });

      // Find staff who clocked in at this branch on this date
      const attendances = await prisma.attendance.findMany({
        where: {
          branchId: targetBranch.id,
          dateStr: item.dateStr,
        },
        include: {
          employee: true,
        },
      });

      const empMap = new Map();
      for (const att of attendances) {
        if (!empMap.has(att.employeeId)) {
          empMap.set(att.employeeId, att.employee);
        }
      }
      const workingStaff = Array.from(empMap.values());
      const workingCount = workingStaff.length;

      // Calculate Bonus
      const bonusResult = calculateDailySalesBonus(item.totalSales, workingCount);

      // Clear previous payouts
      await prisma.bonusPayout.deleteMany({
        where: { dailySalesId: dailySales.id },
      });

      const payouts = [];
      if (bonusResult.isQualified && bonusResult.bonusPerPerson > 0) {
        for (const emp of workingStaff) {
          const p = await prisma.bonusPayout.create({
            data: {
              dailySalesId: dailySales.id,
              employeeId: emp.id,
              branchId: targetBranch.id,
              dateStr: item.dateStr,
              amount: bonusResult.bonusPerPerson,
              reason: bonusResult.reason,
            },
            include: { employee: true },
          });
          payouts.push(p);
        }
      }

      results.push({
        dateStr: item.dateStr,
        branchName: targetBranch.name,
        totalSales: item.totalSales,
        workingStaffCount: workingCount,
        bonusPerPerson: bonusResult.bonusPerPerson,
        totalBonusPool: bonusResult.totalBonusPool,
        reason: bonusResult.reason,
        status: 'SUCCESS',
        payoutsCount: payouts.length,
      });
      successCount++;
    }

    return NextResponse.json({
      success: true,
      message: `นำเข้าข้อมูลยอดขายเรียบร้อยแล้ว (สำเร็จ ${successCount} รายการ, ล้มเหลว ${failCount} รายการ)`,
      summary: {
        total: itemsToProcess.length,
        successCount,
        failCount,
      },
      results,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
