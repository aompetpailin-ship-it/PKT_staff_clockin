export interface DiligenceEvaluationResult {
  employeeId: string;
  monthYear: string;
  lateCount: number;
  leaveCount: number;
  absentCount: number;
  isEligible: boolean;
  allowanceAmount: number;
  reason: string;
}

export const DILIGENCE_ALLOWANCE_AMOUNT = 500.0;
export const MAX_ALLOWED_LATE_COUNT = 3; // Up to 3 times allowed (4th time cuts allowance)

/**
 * Evaluates monthly diligence allowance qualification for an employee.
 */
export function evaluateMonthlyDiligence(
  employeeId: string,
  monthYear: string,
  lateCount: number,
  leaveCount: number,
  absentCount: number,
  employmentType?: string,
  role?: string
): DiligenceEvaluationResult {
  const isManager = role === 'MANAGER' || role === 'ADMIN';
  const targetAllowance = isManager ? 1000.0 : 500.0;

  if (employmentType === 'PART_TIME') {
    return {
      employeeId,
      monthYear,
      lateCount,
      leaveCount,
      absentCount,
      isEligible: false,
      allowanceAmount: 0,
      reason: 'พนักงาน Part-Time ไม่มีสิทธิ์รับเบี้ยขยัน (เฉพาะ Full-Time)',
    };
  }

  if (absentCount > 0) {
    return {
      employeeId,
      monthYear,
      lateCount,
      leaveCount,
      absentCount,
      isEligible: false,
      allowanceAmount: 0,
      reason: `ขาดงาน ${absentCount} วัน (ตัดสิทธิ์เบี้ยขยัน)`,
    };
  }

  if (leaveCount > 0) {
    return {
      employeeId,
      monthYear,
      lateCount,
      leaveCount,
      absentCount,
      isEligible: false,
      allowanceAmount: 0,
      reason: `มีการลางาน ${leaveCount} วัน (ตัดสิทธิ์เบี้ยขยัน)`,
    };
  }

  if (lateCount >= 4) {
    return {
      employeeId,
      monthYear,
      lateCount,
      leaveCount,
      absentCount,
      isEligible: false,
      allowanceAmount: 0,
      reason: `มาสาย ${lateCount} ครั้ง (อนุญาตสายได้ไม่เกิน 3 ครั้ง/เดือน)`,
    };
  }

  return {
    employeeId,
    monthYear,
    lateCount,
    leaveCount,
    absentCount,
    isEligible: true,
    allowanceAmount: targetAllowance,
    reason: `ผ่านเกณฑ์เบี้ยขยันประจำเดือน (${isManager ? 'Manager +1,000฿' : '+500฿'}, มาสาย ${lateCount} ครั้ง, ไม่ขาด ไม่ลา)`,
  };
}
