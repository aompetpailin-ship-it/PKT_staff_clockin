const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Tier structure defined in bonusEngine.ts
const BONUS_TIERS = [
  { reqStaff: 6, targetSales: 42000, standardBonus: 100, understaffedBonus: 200 },
  { reqStaff: 5, targetSales: 35000, standardBonus: 100, understaffedBonus: 200 },
  { reqStaff: 4, targetSales: 28000, standardBonus: 100, understaffedBonus: 200 },
  { reqStaff: 3, targetSales: 21000, standardBonus: 100, understaffedBonus: 200 },
];

function calculateDailySalesBonus(salesAmount, actualStaffCount) {
  if (actualStaffCount <= 0 || salesAmount <= 0) {
    return { isQualified: false, bonusPerPerson: 0, reason: 'ไม่มีพนักงานเข้างานหรือยอดขายเป็น 0' };
  }

  for (const tier of BONUS_TIERS) {
    if (salesAmount > tier.targetSales) {
      if (actualStaffCount >= tier.reqStaff) {
        return {
          isQualified: true,
          bonusPerPerson: tier.standardBonus,
          reason: `ยอดขาย > ${tier.targetSales.toLocaleString()} บาท (เกณฑ์ ${tier.reqStaff} คน, มาทำงาน ${actualStaffCount} คน) ได้รับโบนัสมาตรฐาน ${tier.standardBonus} บาท/คน`,
        };
      } else if (actualStaffCount === tier.reqStaff - 1) {
        return {
          isQualified: true,
          bonusPerPerson: tier.understaffedBonus,
          reason: `ยอดขาย > ${tier.targetSales.toLocaleString()} บาท (เป้าเกณฑ์ ${tier.reqStaff} คน แต่มีพนักงาน ${actualStaffCount} คน) ได้รับโบนัสพิเศษพนักงานน้อยกว่าเกณฑ์ ${tier.understaffedBonus} บาท/คน`,
        };
      }
    }
  }

  return {
    isQualified: false,
    bonusPerPerson: 0,
    reason: `ยอดขาย ${salesAmount.toLocaleString()} บาท ไม่ถึงเกณฑ์ (> 21,000 บาท)`,
  };
}

async function main() {
  console.log('🚀 Regenerating 3 Months Mock Up Data with EXACT Tier Bonus Conditions (June, July, August 2026)...');

  // Clear existing mock data first
  await prisma.bonusPayout.deleteMany();
  await prisma.dailySales.deleteMany();
  await prisma.attendance.deleteMany();

  // 1. Ensure 4 Branches exist
  const b1 = await prisma.branch.upsert({
    where: { code: 'B1' },
    update: { name: 'B1_Ladphrao', allowedRadiusMeters: 5.0 },
    create: {
      code: 'B1',
      name: 'B1_Ladphrao',
      latitude: 13.814321,
      longitude: 100.561234,
      allowedRadiusMeters: 5.0,
      shiftStartTime: '09:00',
    },
  });

  const b2 = await prisma.branch.upsert({
    where: { code: 'B2' },
    update: { name: 'B2_Theprak', allowedRadiusMeters: 100.0 },
    create: {
      code: 'B2',
      name: 'B2_Theprak',
      latitude: 13.886123,
      longitude: 100.612345,
      allowedRadiusMeters: 100.0,
      shiftStartTime: '09:00',
    },
  });

  const b3 = await prisma.branch.upsert({
    where: { code: 'B3' },
    update: { name: 'B3_Muangthong', allowedRadiusMeters: 100.0 },
    create: {
      code: 'B3',
      name: 'B3_Muangthong',
      latitude: 13.912345,
      longitude: 100.551234,
      allowedRadiusMeters: 100.0,
      shiftStartTime: '09:00',
    },
  });

  const b4 = await prisma.branch.upsert({
    where: { code: 'B4' },
    update: { name: 'B4_Pinklao', allowedRadiusMeters: 100.0 },
    create: {
      code: 'B4',
      name: 'B4_Pinklao',
      latitude: 13.771234,
      longitude: 100.478910,
      allowedRadiusMeters: 100.0,
      shiftStartTime: '09:00',
    },
  });

  const branches = [b1, b2, b3, b4];

  // 2. Ensure Sample Employees exist
  const employeesData = [
    {
      lineUserId: 'LINE_EMP_001',
      fullName: 'สมชาย ใจดี',
      nickname: 'ชาย',
      phone: '0812345678',
      pinCode: '1234',
      role: 'STAFF',
      employmentType: 'FULL_TIME',
      homeBranchId: b1.id,
      canRoam: true,
    },
    {
      lineUserId: 'LINE_EMP_002',
      fullName: 'สมหญิง รักงาน',
      nickname: 'หญิง',
      phone: '0823456789',
      pinCode: '1234',
      role: 'STAFF',
      employmentType: 'FULL_TIME',
      homeBranchId: b1.id,
      canRoam: true,
    },
    {
      lineUserId: 'LINE_EMP_003',
      fullName: 'กิตติศักดิ์ มีสุข',
      nickname: 'กิต',
      phone: '0834567890',
      pinCode: '5678',
      role: 'STAFF',
      employmentType: 'PART_TIME',
      homeBranchId: b2.id,
      canRoam: true,
    },
    {
      lineUserId: 'LINE_EMP_004',
      fullName: 'นภา ขยันยิ่ง',
      nickname: 'นภา',
      phone: '0845678901',
      pinCode: '1234',
      role: 'STAFF',
      employmentType: 'FULL_TIME',
      homeBranchId: b3.id,
      canRoam: true,
    },
    {
      lineUserId: 'LINE_EMP_005',
      fullName: 'วิชัย ผู้จัดการร้าน',
      nickname: 'ชัย',
      phone: '0856789012',
      pinCode: '9999',
      role: 'MANAGER',
      employmentType: 'FULL_TIME',
      homeBranchId: b1.id,
      canRoam: true,
    },
  ];

  const employees = [];
  for (const emp of employeesData) {
    const created = await prisma.employee.upsert({
      where: { lineUserId: emp.lineUserId },
      update: { fullName: emp.fullName, nickname: emp.nickname, pinCode: emp.pinCode },
      create: emp,
    });
    employees.push(created);
  }

  // 3. Generate Mock Data for 3 Months (June, July, August 2026)
  const monthList = ['2026-06', '2026-07', '2026-08'];

  for (const monthStr of monthList) {
    const [year, month] = monthStr.split('-').map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

      // Generate Daily Sales & Attendance per Branch
      for (const branch of branches) {
        // Random sales matching target tiers: 22k, 29k, 36k, 43k THB
        const tierTargets = [22000, 29000, 36000, 44000];
        const randomSales = tierTargets[Math.floor(Math.random() * tierTargets.length)];

        // Assign 2 to 6 working staff
        const reqStaffForSales = randomSales > 42000 ? 6 : randomSales > 35000 ? 5 : randomSales > 28000 ? 4 : 3;
        
        // Sometimes understaffed by 1 to demonstrate Understaffed Bonus (+200 บาท)
        const isUnderstaffedToday = Math.random() < 0.25;
        const actualStaffCount = isUnderstaffedToday ? Math.max(1, reqStaffForSales - 1) : reqStaffForSales;

        // Pick staff members
        const workingEmps = [];
        for (let i = 0; i < actualStaffCount; i++) {
          workingEmps.push(employees[i % employees.length]);
        }

        // Save Attendance for working staff
        for (const emp of workingEmps) {
          const isLate = Math.random() < 0.1; // 10% late chance
          const lateMins = isLate ? Math.floor(Math.random() * 10) + 3 : 0;
          const clockInTime = new Date(`${dateStr}T09:${String(lateMins).padStart(2, '0')}:00Z`);

          await prisma.attendance.create({
            data: {
              employeeId: emp.id,
              branchId: branch.id,
              dateStr,
              clockInAt: clockInTime,
              clockOutAt: new Date(`${dateStr}T18:00:00Z`),
              clockInPhotoUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80',
              verificationMethod: isLate ? 'PIN_CODE' : 'PHOTO_SELFIE',
              clockInLat: branch.latitude,
              clockInLng: branch.longitude,
              distanceMeters: Math.floor(Math.random() * 4) + 1,
              lateMinutes: lateMins,
              status: isLate ? 'LATE' : 'ON_TIME',
              notes: isLate ? `เข้างานกะ 09:00 น. (สาย ${lateMins} นาที)` : 'เข้างานตรงเวลา',
            },
          });
        }

        // Calculate Daily Sales Bonus using EXACT condition logic
        const bonusResult = calculateDailySalesBonus(randomSales, workingEmps.length);

        const sales = await prisma.dailySales.create({
          data: {
            branchId: branch.id,
            dateStr,
            totalSales: randomSales,
            recordedBy: 'ADMIN',
          },
        });

        // Create Bonus Payouts if qualified
        if (bonusResult.isQualified && bonusResult.bonusPerPerson > 0) {
          for (const emp of workingEmps) {
            await prisma.bonusPayout.create({
              data: {
                dailySalesId: sales.id,
                employeeId: emp.id,
                branchId: branch.id,
                dateStr,
                amount: bonusResult.bonusPerPerson,
                reason: bonusResult.reason,
              },
            });
          }
        }
      }
    }
  }

  console.log('✅ 3 Months Mock Data REGENERATED with EXACT TIER BONUS CONDITIONS (100 บาท / 200 บาท)!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
