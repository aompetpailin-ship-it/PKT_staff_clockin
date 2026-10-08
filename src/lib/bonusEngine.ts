export interface BonusTier {
  reqStaff: number;
  targetSales: number;
  standardBonus: number;
  understaffedBonus: number;
}

export const BONUS_TIERS: BonusTier[] = [
  { reqStaff: 6, targetSales: 42000, standardBonus: 100, understaffedBonus: 200 },
  { reqStaff: 5, targetSales: 35000, standardBonus: 100, understaffedBonus: 200 },
  { reqStaff: 4, targetSales: 28000, standardBonus: 100, understaffedBonus: 200 },
  { reqStaff: 3, targetSales: 21000, standardBonus: 100, understaffedBonus: 200 },
];

export interface BonusCalculationResult {
  isQualified: boolean;
  actualStaffCount: number;
  salesAmount: number;
  matchedTierReqStaff: number | null;
  matchedTargetSales: number | null;
  bonusPerPerson: number;
  totalBonusPool: number;
  reason: string;
}

/**
 * Calculates daily sales bonus per branch based on:
 * - Sales Amount
 * - Actual Staff Count worked on that day
 */
export function calculateDailySalesBonus(
  salesAmount: number,
  actualStaffCount: number
): BonusCalculationResult {
  if (actualStaffCount <= 0 || salesAmount <= 0) {
    return {
      isQualified: false,
      actualStaffCount,
      salesAmount,
      matchedTierReqStaff: null,
      matchedTargetSales: null,
      bonusPerPerson: 0,
      totalBonusPool: 0,
      reason: 'ไม่มีพนักงานเข้างานหรือไม่มีการบันทึกยอดขาย',
    };
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
        matchedTierReqStaff: 3,
        matchedTargetSales: 21000,
        bonusPerPerson: 200,
        totalBonusPool: 200 * actualStaffCount,
        reason: `ยอดขาย ${salesAmount.toLocaleString()} บาท (> 21,000 บาท) พนักงานน้อยกว่าเกณฑ์ (มี 2 คน จากเป้าเกณฑ์ 3 คน) ได้รับโบนัสพิเศษ 200 บาท/คน`,
      };
    } else {
      return {
        isQualified: false,
        actualStaffCount,
        salesAmount,
        matchedTierReqStaff: null,
        matchedTargetSales: null,
        bonusPerPerson: 0,
        totalBonusPool: 0,
        reason: `ยอดขาย ${salesAmount.toLocaleString()} บาท ไม่ผ่านเกณฑ์เป้าหมายโบนัส (> 21,000 บาท)`,
      };
    }
  } else {
    return {
      isQualified: false,
      actualStaffCount,
      salesAmount,
      matchedTierReqStaff: null,
      matchedTargetSales: null,
      bonusPerPerson: 0,
      totalBonusPool: 0,
      reason: `จำนวนพนักงาน ${actualStaffCount} คน ไม่ผ่านเกณฑ์โบนัส`,
    };
  }

  // Check if sales exceeds higher tier for Understaffed Bonus (+200 THB/person)
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
      matchedTierReqStaff: requiredStaffTier + 1,
      matchedTargetSales: higherTierTarget,
      bonusPerPerson: 200,
      totalBonusPool: 200 * actualStaffCount,
      reason: `ยอดขาย ${salesAmount.toLocaleString()} บาท (> ${higherTierTarget.toLocaleString()} บาท) พนักงานน้อยกว่าเกณฑ์ 1 คน (มี ${actualStaffCount} คน จากเป้าเกณฑ์ ${requiredStaffTier + 1} คน) ได้รับโบนัสพิเศษ 200 บาท/คน`,
    };
  }

  // Standard bonus check for requiredTarget (+100 THB/person)
  if (salesAmount > requiredTarget) {
    return {
      isQualified: true,
      actualStaffCount,
      salesAmount,
      matchedTierReqStaff: requiredStaffTier,
      matchedTargetSales: requiredTarget,
      bonusPerPerson: 100,
      totalBonusPool: 100 * actualStaffCount,
      reason: `ยอดขาย ${salesAmount.toLocaleString()} บาท (> ${requiredTarget.toLocaleString()} บาท) มีพนักงาน ${actualStaffCount} คน ได้รับโบนัสมาตรฐาน 100 บาท/คน`,
    };
  }

  return {
    isQualified: false,
    actualStaffCount,
    salesAmount,
    matchedTierReqStaff: null,
    matchedTargetSales: null,
    bonusPerPerson: 0,
    totalBonusPool: 0,
    reason: `ยอดขาย ${salesAmount.toLocaleString()} บาท ไม่ผ่านเกณฑ์เป้าหมาย ${requiredTarget.toLocaleString()} บาท สำหรับพนักงาน ${actualStaffCount} คน`,
  };
}
