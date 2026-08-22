const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const b1 = await prisma.branch.update({
    where: { code: 'B1' },
    data: {
      allowedRadiusMeters: 5.0,
    },
  });

  console.log(`✅ Successfully updated ${b1.name} (B1) allowedRadiusMeters to ${b1.allowedRadiusMeters} meters!`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
