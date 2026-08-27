const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🧹 Clearing all mock employee and transaction data...');

  // Delete dependent transaction records first
  await prisma.bonusPayout.deleteMany();
  await prisma.dailySales.deleteMany();
  await prisma.attendance.deleteMany();
  await prisma.leaveRecord.deleteMany();
  await prisma.monthlyDiligence.deleteMany();
  await prisma.branchSchedule.deleteMany();
  await prisma.employee.deleteMany();

  console.log('✅ Wiped all employee, attendance, sales, bonus, leave, and schedule data!');

  // Ensure 4 core branches exist in database
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

  console.log(`🏬 Ready with 4 Branches: ${b1.name}, ${b2.name}, ${b3.name}, ${b4.name}`);
  console.log('🎉 System is 100% clean and ready for real employee registration!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
