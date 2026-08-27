const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

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
  console.log('🚀 Seeding 20 Employees (5+5+5+3 fixed + 2 roaming) and 3 Months Mock Up Data...');

  // Clear existing mock data first
  await prisma.bonusPayout.deleteMany();
  await prisma.dailySales.deleteMany();
  await prisma.attendance.deleteMany();
  await prisma.leaveRecord.deleteMany();
  await prisma.monthlyDiligence.deleteMany();
  await prisma.branchSchedule.deleteMany();
  await prisma.employee.deleteMany();

  // 1. Ensure 4 Branches
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

  // 2. Create EXACT 20 Employees Breakdown
  const employeesConfig = [
    // Branch 1 (5 Fixed)
    { lineUserId: 'EMP_B1_01', fullName: 'สมชาย ใจดี', nickname: 'ชาย', phone: '0810000001', pinCode: '1001', role: 'STAFF', employmentType: 'FULL_TIME', homeBranchId: b1.id, canRoam: false },
    { lineUserId: 'EMP_B1_02', fullName: 'สมหญิง รักงาน', nickname: 'หญิง', phone: '0810000002', pinCode: '1002', role: 'STAFF', employmentType: 'FULL_TIME', homeBranchId: b1.id, canRoam: false },
    { lineUserId: 'EMP_B1_03', fullName: 'อนันต์ สุขสบาย', nickname: 'อนันต์', phone: '0810000003', pinCode: '1003', role: 'STAFF', employmentType: 'FULL_TIME', homeBranchId: b1.id, canRoam: false },
    { lineUserId: 'EMP_B1_04', fullName: 'บุญชู ขยันยิ่ง', nickname: 'ชู', phone: '0810000004', pinCode: '1004', role: 'STAFF', employmentType: 'PART_TIME', homeBranchId: b1.id, canRoam: false },
    { lineUserId: 'EMP_B1_05', fullName: 'เฉลา พรหมสุวรรณ', nickname: 'เฉลา', phone: '0810000005', pinCode: '1005', role: 'STAFF', employmentType: 'FULL_TIME', homeBranchId: b1.id, canRoam: false },

    // Branch 2 (5 Fixed)
    { lineUserId: 'EMP_B2_01', fullName: 'กิตติศักดิ์ มีสุข', nickname: 'กิต', phone: '0820000001', pinCode: '2001', role: 'STAFF', employmentType: 'FULL_TIME', homeBranchId: b2.id, canRoam: false },
    { lineUserId: 'EMP_B2_02', fullName: 'ดวงใจ ไพรัช', nickname: 'ดวง', phone: '0820000002', pinCode: '2002', role: 'STAFF', employmentType: 'FULL_TIME', homeBranchId: b2.id, canRoam: false },
    { lineUserId: 'EMP_B2_03', fullName: 'เอกชัย ทองดี', nickname: 'เอก', phone: '0820000003', pinCode: '2003', role: 'STAFF', employmentType: 'FULL_TIME', homeBranchId: b2.id, canRoam: false },
    { lineUserId: 'EMP_B2_04', fullName: 'ฟ้าใส สว่างจิตต์', nickname: 'ฟ้า', phone: '0820000004', pinCode: '2004', role: 'STAFF', employmentType: 'PART_TIME', homeBranchId: b2.id, canRoam: false },
    { lineUserId: 'EMP_B2_05', fullName: 'กอล์ฟ ชาญณรงค์', nickname: 'กอล์ฟ', phone: '0820000005', pinCode: '2005', role: 'STAFF', employmentType: 'FULL_TIME', homeBranchId: b2.id, canRoam: false },

    // Branch 3 (5 Fixed)
    { lineUserId: 'EMP_B3_01', fullName: 'นภา ขยันยิ่ง', nickname: 'นภา', phone: '0830000001', pinCode: '3001', role: 'STAFF', employmentType: 'FULL_TIME', homeBranchId: b3.id, canRoam: false },
    { lineUserId: 'EMP_B3_02', fullName: 'อรพรรณ ดียิ่ง', nickname: 'อร', phone: '0830000002', pinCode: '3002', role: 'STAFF', employmentType: 'FULL_TIME', homeBranchId: b3.id, canRoam: false },
    { lineUserId: 'EMP_B3_03', fullName: 'ภูมิ พัฒนา', nickname: 'ภูมิ', phone: '0830000003', pinCode: '3003', role: 'STAFF', employmentType: 'FULL_TIME', homeBranchId: b3.id, canRoam: false },
    { lineUserId: 'EMP_B3_04', fullName: 'รุ่งเรือง เกียรติ', nickname: 'รุ่ง', phone: '0830000004', pinCode: '3004', role: 'STAFF', employmentType: 'PART_TIME', homeBranchId: b3.id, canRoam: false },
    { lineUserId: 'EMP_B3_05', fullName: 'สมศักดิ์ ว่องไว', nickname: 'ศักดิ์', phone: '0830000005', pinCode: '3005', role: 'STAFF', employmentType: 'FULL_TIME', homeBranchId: b3.id, canRoam: false },

    // Branch 4 (3 Fixed)
    { lineUserId: 'EMP_B4_01', fullName: 'ธนวัฒน์ มงคล', nickname: 'ธน', phone: '0840000001', pinCode: '4001', role: 'STAFF', employmentType: 'FULL_TIME', homeBranchId: b4.id, canRoam: false },
    { lineUserId: 'EMP_B4_02', fullName: 'อุไร วันเพ็ญ', nickname: 'อุไร', phone: '0840000002', pinCode: '4002', role: 'STAFF', employmentType: 'FULL_TIME', homeBranchId: b4.id, canRoam: false },
    { lineUserId: 'EMP_B4_03', fullName: 'วีระ สุจริต', nickname: 'วีระ', phone: '0840000003', pinCode: '4003', role: 'STAFF', employmentType: 'FULL_TIME', homeBranchId: b4.id, canRoam: false },

    // Roamable / Rotatable Staff (ONLY 2 People!)
    { lineUserId: 'EMP_ROAM_01', fullName: 'วิชัย ผู้จัดการหมุนเวียน', nickname: 'ชัย (หมุนเวียน)', phone: '0890000001', pinCode: '9001', role: 'MANAGER', employmentType: 'FULL_TIME', homeBranchId: b1.id, canRoam: true },
    { lineUserId: 'EMP_ROAM_02', fullName: 'พลอย ซัพพอร์ตหมุนเวียน', nickname: 'พลอย (หมุนเวียน)', phone: '0890000002', pinCode: '9002', role: 'STAFF', employmentType: 'FULL_TIME', homeBranchId: b2.id, canRoam: true },
  ];

  const createdEmployees = [];
  for (const empData of employeesConfig) {
    const emp = await prisma.employee.create({ data: empData });
    createdEmployees.push(emp);
  }

  const fixedB1 = createdEmployees.filter((e) => e.homeBranchId === b1.id && !e.canRoam);
  const fixedB2 = createdEmployees.filter((e) => e.homeBranchId === b2.id && !e.canRoam);
  const fixedB3 = createdEmployees.filter((e) => e.homeBranchId === b3.id && !e.canRoam);
  const fixedB4 = createdEmployees.filter((e) => e.homeBranchId === b4.id && !e.canRoam);
  const roamingStaff = createdEmployees.filter((e) => e.canRoam);

  console.log(`- Fixed B1: ${fixedB1.length} staff`);
  console.log(`- Fixed B2: ${fixedB2.length} staff`);
  console.log(`- Fixed B3: ${fixedB3.length} staff`);
  console.log(`- Fixed B4: ${fixedB4.length} staff`);
  console.log(`- Roaming Staff: ${roamingStaff.length} staff`);

  // 3. Generate 3 Months Attendance & Daily Sales Data
  const monthList = ['2026-06', '2026-07', '2026-08'];

  for (const monthStr of monthList) {
    const [year, month] = monthStr.split('-').map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

      // Process each branch
      const branchStaffMap = [
        { branch: b1, fixedList: fixedB1, salesTargets: [29000, 36000, 43000] },
        { branch: b2, fixedList: fixedB2, salesTargets: [29000, 36000, 43000] },
        { branch: b3, fixedList: fixedB3, salesTargets: [22000, 29000, 36000] },
        { branch: b4, fixedList: fixedB4, salesTargets: [22000, 29000] },
      ];

      for (const { branch, fixedList, salesTargets } of branchStaffMap) {
        const salesAmount = salesTargets[Math.floor(Math.random() * salesTargets.length)];

        // Daily working staff = fixed staff who are on shift today
        const workingEmps = fixedList.filter((_, idx) => (day + idx) % 5 !== 0);

        // Assign 1 of the 2 roaming staff to branch 4 or branch 1 dynamically on rotation
        if (branch.code === 'B4' || (day % 3 === 0 && branch.code === 'B1')) {
          const roamingEmp = roamingStaff[day % 2];
          if (!workingEmps.includes(roamingEmp)) {
            workingEmps.push(roamingEmp);
          }
        }

        // Attendance records
        for (const emp of workingEmps) {
          const isLate = Math.random() < 0.08; // 8% late rate
          const lateMins = isLate ? Math.floor(Math.random() * 8) + 3 : 0;
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
              distanceMeters: Math.floor(Math.random() * 3) + 1,
              lateMinutes: lateMins,
              status: isLate ? 'LATE' : 'ON_TIME',
              notes: isLate ? `เข้างานกะ 09:00 น. (สาย ${lateMins} นาที)` : 'เข้างานตรงเวลา',
            },
          });
        }

        // Save Daily Sales
        const salesRecord = await prisma.dailySales.create({
          data: {
            branchId: branch.id,
            dateStr,
            totalSales: salesAmount,
            recordedBy: 'ADMIN',
          },
        });

        // Calculate Daily Sales Bonus based on FULL TIME staff count only
        const fullTimeWorkingEmps = workingEmps.filter((e) => e.employmentType !== 'PART_TIME');
        const bonusResult = calculateDailySalesBonus(salesAmount, fullTimeWorkingEmps.length);

        if (bonusResult.isQualified && bonusResult.bonusPerPerson > 0) {
          for (const emp of fullTimeWorkingEmps) {
            await prisma.bonusPayout.create({
              data: {
                dailySalesId: salesRecord.id,
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

  console.log('✅ Successfully seeded 20 Employees and 3 Months Mock Up Data!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
