const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function calculateDailySalesBonus(salesAmount, actualStaffCount) {
  if (actualStaffCount <= 0 || salesAmount <= 0) {
    return { isQualified: false, bonusPerPerson: 0, reason: 'ไม่มีพนักงานเข้างานหรือยอดขาย' };
  }

  let requiredTarget = 42000;
  let requiredStaffTier = 6;

  if (actualStaffCount >= 6) {
    requiredTarget = 42000;
    requiredStaffTier = 6;
  } else if (actualStaffCount === 5) {
    requiredTarget = 35000;
    requiredStaffTier = 5;
  } else if (actualStaffCount === 4) {
    requiredTarget = 28000;
    requiredStaffTier = 4;
  } else if (actualStaffCount === 3) {
    requiredTarget = 21000;
    requiredStaffTier = 3;
  } else if (actualStaffCount === 2) {
    if (salesAmount > 21000) {
      return {
        isQualified: true,
        actualStaffCount,
        salesAmount,
        bonusPerPerson: 200,
        totalBonusPool: 200 * actualStaffCount,
        reason: `ยอดขาย ${salesAmount.toLocaleString()} บาท (> 21,000 บาท) พนักงานน้อยกว่าเกณฑ์ (มี 2 คน จากเป้าเกณฑ์ 3 คน) ได้รับโบนัสพิเศษ 200 บาท/คน`,
      };
    } else {
      return { isQualified: false, bonusPerPerson: 0, reason: 'ยอดขายไม่ถึงเกณฑ์' };
    }
  } else {
    return { isQualified: false, bonusPerPerson: 0, reason: 'จำนวนพนักงานไม่ถึงเกณฑ์' };
  }

  const higherTierTarget =
    requiredTarget === 42000
      ? 999999999
      : requiredTarget === 35000
      ? 42000
      : requiredTarget === 28000
      ? 35000
      : 28000;

  if (salesAmount > higherTierTarget) {
    return {
      isQualified: true,
      actualStaffCount,
      salesAmount,
      bonusPerPerson: 200,
      totalBonusPool: 200 * actualStaffCount,
      reason: `ยอดขาย ${salesAmount.toLocaleString()} บาท (> ${higherTierTarget.toLocaleString()} บาท) พนักงานน้อยกว่าเกณฑ์ 1 คน (มี ${actualStaffCount} คน จากเป้าเกณฑ์ ${requiredStaffTier + 1} คน) ได้รับโบนัสพิเศษ 200 บาท/คน`,
    };
  }

  if (salesAmount > requiredTarget) {
    return {
      isQualified: true,
      actualStaffCount,
      salesAmount,
      bonusPerPerson: 100,
      totalBonusPool: 100 * actualStaffCount,
      reason: `ยอดขาย ${salesAmount.toLocaleString()} บาท (> ${requiredTarget.toLocaleString()} บาท) มีพนักงาน ${actualStaffCount} คน ได้รับโบนัสมาตรฐาน 100 บาท/คน`,
    };
  }

  return { isQualified: false, bonusPerPerson: 0, reason: 'ยอดขายไม่ถึงเกณฑ์เป้าหมาย' };
}

async function recalculate() {
  const salesList = await prisma.dailySales.findMany({
    include: { branch: true },
  });

  console.log(`Found ${salesList.length} daily sales records. Recalculating bonus payouts...`);

  for (const s of salesList) {
    const attendances = await prisma.attendance.findMany({
      where: {
        branchId: s.branchId,
        dateStr: s.dateStr,
      },
      include: { employee: true },
    });

    const empMap = new Map();
    attendances.forEach((att) => {
      if (!empMap.has(att.employeeId)) {
        empMap.set(att.employeeId, att.employee);
      }
    });

    const workingEmps = Array.from(empMap.values());
    const fullTimeEmps = workingEmps.filter((e) => e.employmentType !== 'PART_TIME');

    const bonusResult = calculateDailySalesBonus(s.totalSales, fullTimeEmps.length);

    await prisma.bonusPayout.deleteMany({
      where: { dailySalesId: s.id },
    });

    if (bonusResult.isQualified && bonusResult.bonusPerPerson > 0) {
      for (const emp of fullTimeEmps) {
        await prisma.bonusPayout.create({
          data: {
            dailySalesId: s.id,
            employeeId: emp.id,
            branchId: s.branchId,
            dateStr: s.dateStr,
            amount: bonusResult.bonusPerPerson,
            reason: bonusResult.reason,
          },
        });
      }
    }
  }

  console.log('✅ Recalculation complete!');
}

recalculate().finally(() => prisma.$disconnect());
