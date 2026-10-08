const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkSep1() {
  const dateStr = '2026-09-01';
  const branch = await prisma.branch.findFirst({ where: { code: 'B1' } });
  if (!branch) return;

  const sales = await prisma.dailySales.findFirst({
    where: { dateStr, branchId: branch.id },
    include: { bonusPayouts: { include: { employee: true } } },
  });

  console.log(`Sep 1 B1 Sales: ${sales ? sales.totalSales : 0} THB`);
  console.log(`Bonus Payouts count: ${sales ? sales.bonusPayouts.length : 0}`);
  if (sales && sales.bonusPayouts.length > 0) {
    sales.bonusPayouts.forEach((p) => {
      console.log(`- ${p.employee.fullName}: +${p.amount}`);
    });
  } else {
    console.log('✅ ไม่ผ่านเกณฑ์โบนัส (0 คนได้โบนัส)');
  }
}

checkSep1().finally(() => prisma.$disconnect());
