const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Restoring 4 branches formatted as B1_Ladphrao, B2_Theprak, B3_Muangthong, B4_Pinklao...');

  const branches = [
    {
      code: 'B1',
      name: 'B1_Ladphrao',
      latitude: 13.814321,
      longitude: 100.561234,
      allowedRadiusMeters: 5.0,
      shiftStartTime: '09:00',
    },
    {
      code: 'B2',
      name: 'B2_Theprak',
      latitude: 13.886123,
      longitude: 100.612345,
      allowedRadiusMeters: 100.0,
      shiftStartTime: '09:00',
    },
    {
      code: 'B3',
      name: 'B3_Muangthong',
      latitude: 13.912345,
      longitude: 100.551234,
      allowedRadiusMeters: 100.0,
      shiftStartTime: '09:00',
    },
    {
      code: 'B4',
      name: 'B4_Pinklao',
      latitude: 13.771234,
      longitude: 100.478910,
      allowedRadiusMeters: 100.0,
      shiftStartTime: '09:00',
    },
  ];

  for (const b of branches) {
    await prisma.branch.upsert({
      where: { code: b.code },
      update: {
        name: b.name,
        latitude: b.latitude,
        longitude: b.longitude,
        allowedRadiusMeters: b.allowedRadiusMeters,
      },
      create: b,
    });
  }

  console.log('✅ Successfully restored 4 branches!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
