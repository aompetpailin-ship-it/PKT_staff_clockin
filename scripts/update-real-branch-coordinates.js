const { PrismaClient } = require('@prisma/client');

process.env.DATABASE_URL = "postgresql://postgres.eweupmemcmwipdwjuxyr:PKTCrewmember2024@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres";

const prisma = new PrismaClient();

async function main() {
  console.log('📍 Updating exact real-world GPS coordinates for 4 branches on Supabase...');

  const branches = [
    {
      code: 'B1',
      name: 'B1_Ladphrao',
      latitude: 13.8238903,
      longitude: 100.6115799,
      allowedRadiusMeters: 100.0,
      shiftStartTime: '09:00',
    },
    {
      code: 'B2',
      name: 'B2_Theprak',
      latitude: 13.8774621,
      longitude: 100.6461618,
      allowedRadiusMeters: 100.0,
      shiftStartTime: '09:00',
    },
    {
      code: 'B3',
      name: 'B3_Muangthong',
      latitude: 13.912945,
      longitude: 100.5428759,
      allowedRadiusMeters: 100.0,
      shiftStartTime: '09:00',
    },
    {
      code: 'B4',
      name: 'B4_Pinklao',
      latitude: 13.778585468534606,
      longitude: 100.4863382529881,
      allowedRadiusMeters: 100.0,
      shiftStartTime: '09:00',
    },
  ];

  for (const b of branches) {
    const updated = await prisma.branch.upsert({
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
    console.log(`✅ Updated ${updated.name} (${updated.code}) -> Lat: ${updated.latitude}, Lng: ${updated.longitude}`);
  }

  console.log('🎉 Successfully updated all 4 real branch GPS coordinates on Supabase!');
}

main()
  .catch((e) => {
    console.error('❌ Error updating branch coordinates:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
