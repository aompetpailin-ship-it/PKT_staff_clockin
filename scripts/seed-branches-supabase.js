const { PrismaClient } = require('@prisma/client');

process.env.DATABASE_URL = "postgresql://postgres.eweupmemcmwipdwjuxyr:PKTCrewmember2024@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true";

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Seeding 4 core branches on Supabase PostgreSQL...');

  const branchesData = [
    {
      code: 'B1',
      name: 'B1_Ladphrao',
      latitude: 13.814321,
      longitude: 100.561234,
      allowedRadiusMeters: 100.0,
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

  for (const b of branchesData) {
    const branch = await prisma.branch.upsert({
      where: { code: b.code },
      update: {
        name: b.name,
        latitude: b.latitude,
        longitude: b.longitude,
        allowedRadiusMeters: b.allowedRadiusMeters,
        shiftStartTime: b.shiftStartTime,
      },
      create: b,
    });
    console.log(`✅ Branch seeded: ${branch.name} (${branch.code})`);
  }

  console.log('🎉 Successfully seeded 4 branches to Supabase!');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding Supabase:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
