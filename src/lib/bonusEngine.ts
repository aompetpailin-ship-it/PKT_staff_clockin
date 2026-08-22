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
      reason: 'ไม่มีพนักงานเข้างานหรือไม่มียอดขายในวันดังกล่าว',
    };
  }

  // Find the highest qualified tier that salesAmount strictly exceeds (> targetSales)
  // Check tiers from highest (6 staff / 42k) down to lowest (3 staff / 21k)
  for (const tier of BONUS_TIERS) {
    if (salesAmount > tier.targetSales) {
      // Check if actual staff matched or exceeded required staff
      if (actualStaffCount >= tier.reqStaff) {
        return {
          isQualified: true,
          actualStaffCount,
          salesAmount,
          matchedTierReqStaff: tier.reqStaff,
          matchedTargetSales: tier.targetSales,
          bonusPerPerson: tier.standardBonus,
          totalBonusPool: tier.standardBonus * actualStaffCount,
          reason: `ยอดขาย > ${tier.targetSales.toLocaleString()} บาท (เกณฑ์พนักงาน ${tier.reqStaff} คน, มาทำงาน ${actualStaffCount} คน) ได้รับโบนัสมาตรฐาน ${tier.standardBonus} บาท/คน`,
        };
      } else if (actualStaffCount === tier.reqStaff - 1) {
        // Understaffed by 1 person rule
        return {
          isQualified: true,
          actualStaffCount,
          salesAmount,
          matchedTierReqStaff: tier.reqStaff,
          matchedTargetSales: tier.targetSales,
          bonusPerPerson: tier.understaffedBonus,
          totalBonusPool: tier.understaffedBonus * actualStaffCount,
          reason: `ยอดขาย > ${tier.targetSales.toLocaleString()} บาท (เป้าเกณฑ์ ${tier.reqStaff} คน แต่มีพนักงาน ${actualStaffCount} คน) ได้รับโบนัสพิเศษพนักงานน้อยกว่าเกณฑ์ ${tier.understaffedBonus} บาท/คน`,
        };
      }
    }
  }

  return {
    isQualified: false,
    actualStaffCount,
    salesAmount,
    matchedTierReqStaff: null,
    matchedTargetSales: null,
    bonusPerPerson: 0,
    totalBonusPool: 0,
    reason: `ยอดขาย ${salesAmount.toLocaleString()} บาท ไม่ถึงเป้าหมายขั้นต่ำ (> 21,000 บาท) หรือจำนวนพนักงานไม่ตรงตามเงื่อนไข`,
  };
}
