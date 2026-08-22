const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Seeding initial branches and employees...');

  // Create/Update 4 Branches for ร้านผมขอทอด
  const b1 = await prisma.branch.upsert({
    where: { code: 'B1' },
    update: { name: 'B1 - Ladphrao', allowedRadiusMeters: 5.0 },
    create: {
      code: 'B1',
      name: 'B1 - Ladphrao',
      latitude: 13.814321,
      longitude: 100.561234,
      allowedRadiusMeters: 5.0,
      shiftStartTime: '09:00',
    },
  });

  const b2 = await prisma.branch.upsert({
    where: { code: 'B2' },
    update: { name: 'B2 - Theprak', allowedRadiusMeters: 100.0 },
    create: {
      code: 'B2',
      name: 'B2 - Theprak',
      latitude: 13.886123,
      longitude: 100.612345,
      allowedRadiusMeters: 100.0,
      shiftStartTime: '09:00',
    },
  });

  const b3 = await prisma.branch.upsert({
    where: { code: 'B3' },
    update: { name: 'B3 - Muangthong', allowedRadiusMeters: 100.0 },
    create: {
      code: 'B3',
      name: 'B3 - Muangthong',
      latitude: 13.912345,
      longitude: 100.551234,
      allowedRadiusMeters: 100.0,
      shiftStartTime: '09:00',
    },
  });

  const b4 = await prisma.branch.upsert({
    where: { code: 'B4' },
    update: { name: 'B4 - Pinklao', allowedRadiusMeters: 100.0 },
    create: {
      code: 'B4',
      name: 'B4 - Pinklao',
      latitude: 13.771234,
      longitude: 100.478910,
      allowedRadiusMeters: 100.0,
      shiftStartTime: '09:00',
    },
  });

  console.log('Branches updated:', [b1.name, b2.name, b3.name, b4.name]);

  // Seed sample employees
  const employees = [
    {
      lineUserId: 'LINE_EMP_001',
      fullName: 'สมชาย ใจดี',
      nickname: 'ชาย',
      phone: '0812345678',
      role: 'STAFF',
      homeBranchId: b1.id,
      canRoam: true,
    },
    {
      lineUserId: 'LINE_EMP_002',
      fullName: 'สมหญิง รักงาน',
      nickname: 'หญิง',
      phone: '0823456789',
      role: 'STAFF',
      homeBranchId: b1.id,
      canRoam: true,
    },
    {
      lineUserId: 'LINE_EMP_003',
      fullName: 'กิตติศักดิ์ มีสุข',
      nickname: 'กิต',
      phone: '0834567890',
      role: 'STAFF',
      homeBranchId: b2.id,
      canRoam: true,
    },
    {
      lineUserId: 'LINE_EMP_004',
      fullName: 'นภา ขยันยิ่ง',
      nickname: 'นภา',
      phone: '0845678901',
      role: 'STAFF',
      homeBranchId: b3.id,
      canRoam: true,
    },
    {
      lineUserId: 'LINE_EMP_005',
      fullName: 'วิชัย ผู้จัดการร้าน',
      nickname: 'ชัย',
      phone: '0856789012',
      role: 'MANAGER',
      homeBranchId: b1.id,
      canRoam: true,
    },
  ];

  for (const emp of employees) {
    await prisma.employee.upsert({
      where: { lineUserId: emp.lineUserId },
      update: {},
      create: emp,
    });
  }

  console.log('Sample employees created!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
