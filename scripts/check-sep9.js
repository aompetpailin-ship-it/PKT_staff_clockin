const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const dateStr = '2026-09-09';
  const branch = await prisma.branch.findFirst({ where: { code: 'B1' } });
  if (!branch) {
    console.log('No B1 branch');
    return;
  }

  const logs = await prisma.attendance.findMany({
    where: { dateStr, branchId: branch.id },
    include: { employee: true },
  });

  console.log('=== Attendance Logs on 2026-09-09 at B1 ===');
  logs.forEach((l) => {
    console.log(
      `- Name: ${l.employee.fullName} (${l.employee.nickname || 'N/A'}), Role: ${l.employee.role}, EmploymentType: ${l.employee.employmentType}`
    );
  });

  const bonusPayouts = await prisma.bonusPayout.findMany({
    where: { dateStr, dailySales: { branchId: branch.id } },
    include: { employee: true },
  });

  console.log('\n=== Bonus Payouts Created on 2026-09-09 ===');
  bonusPayouts.forEach((p) => {
    console.log(`- ${p.employee.fullName}: +${p.amount} THB (Reason: ${p.reason})`);
  });
}

main().finally(() => prisma.$disconnect());
