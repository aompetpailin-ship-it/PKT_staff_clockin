const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Updating branch names and codes...');

  // Update B1 - Ladphrao (Radius 5m as requested earlier)
  const b1 = await prisma.branch.upsert({
    where: { code: 'B1' },
    update: {
      name: 'B1 - Ladphrao',
      allowedRadiusMeters: 5.0,
    },
    create: {
      code: 'B1',
      name: 'B1 - Ladphrao',
      latitude: 13.814321,
      longitude: 100.561234,
      allowedRadiusMeters: 5.0,
      shiftStartTime: '09:00',
    },
  });

  // Update B2 - Theprak (Radius 100m)
  const b2 = await prisma.branch.upsert({
    where: { code: 'B2' },
    update: {
      name: 'B2 - Theprak',
      allowedRadiusMeters: 100.0,
    },
    create: {
      code: 'B2',
      name: 'B2 - Theprak',
      latitude: 13.886123,
      longitude: 100.612345,
      allowedRadiusMeters: 100.0,
      shiftStartTime: '09:00',
    },
  });

  // Update B3 - Muangthong (Radius 100m)
  const b3 = await prisma.branch.upsert({
    where: { code: 'B3' },
    update: {
      name: 'B3 - Muangthong',
      allowedRadiusMeters: 100.0,
    },
    create: {
      code: 'B3',
      name: 'B3 - Muangthong',
      latitude: 13.912345,
      longitude: 100.551234,
      allowedRadiusMeters: 100.0,
      shiftStartTime: '09:00',
    },
  });

  // Update B4 - Pinklao (Radius 100m)
  const b4 = await prisma.branch.upsert({
    where: { code: 'B4' },
    update: {
      name: 'B4 - Pinklao',
      allowedRadiusMeters: 100.0,
    },
    create: {
      code: 'B4',
      name: 'B4 - Pinklao',
      latitude: 13.771234,
      longitude: 100.478910,
      allowedRadiusMeters: 100.0,
      shiftStartTime: '09:00',
    },
  });

  console.log('✅ Updated Branch Names successfully:', [b1.name, b2.name, b3.name, b4.name]);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
