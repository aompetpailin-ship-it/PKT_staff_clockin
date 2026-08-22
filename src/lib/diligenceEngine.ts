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
export const MAX_ALLOWED_LATE_COUNT = 2; // < 3 times means max 2 allowed

/**
 * Evaluates monthly diligence allowance qualification for an employee.
 */
export function evaluateMonthlyDiligence(
  employeeId: string,
  monthYear: string,
  lateCount: number,
  leaveCount: number,
  absentCount: number
): DiligenceEvaluationResult {
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

  if (lateCount >= 3) {
    return {
      employeeId,
      monthYear,
      lateCount,
      leaveCount,
      absentCount,
      isEligible: false,
      allowanceAmount: 0,
      reason: `มาสาย ${lateCount} ครั้ง (เกินกำหนดน้อยกว่า 3 ครั้งต่อเดือน)`,
    };
  }

  return {
    employeeId,
    monthYear,
    lateCount,
    leaveCount,
    absentCount,
    isEligible: true,
    allowanceAmount: DILIGENCE_ALLOWANCE_AMOUNT,
    reason: `ผ่านเกณฑ์เบี้ยขยันประจำเดือน (มาสาย ${lateCount} ครั้ง, ไม่ขาด ไม่ลา)`,
  };
}
