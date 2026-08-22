const { calculateDailySalesBonus } = require('../src/lib/bonusEngine');
const { evaluateMonthlyDiligence } = require('../src/lib/diligenceEngine');

console.log('=== RUNNING AUTOMATED UNIT TESTS ===\n');

let failedTests = 0;

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    failedTests++;
  } else {
    console.log(`✅ PASS: ${message}`);
  }
}

// 1. Daily Bonus Tests
console.log('--- 1. Testing Daily Sales Bonus Engine ---');

const test1 = calculateDailySalesBonus(22000, 3);
assert(test1.isQualified && test1.bonusPerPerson === 100, '3 staff, sales 22,000 => 100 THB/person');

const test2 = calculateDailySalesBonus(22000, 2);
assert(test2.isQualified && test2.bonusPerPerson === 200, '2 staff, sales 22,000 (Understaffed by 1) => 200 THB/person');

const test3 = calculateDailySalesBonus(30000, 4);
assert(test3.isQualified && test3.bonusPerPerson === 100, '4 staff, sales 30,000 => 100 THB/person');

const test4 = calculateDailySalesBonus(30000, 3);
assert(test4.isQualified && test4.bonusPerPerson === 200, '3 staff, sales 30,000 (Understaffed for 28k tier) => 200 THB/person');

const test5 = calculateDailySalesBonus(15000, 3);
assert(!test5.isQualified && test5.bonusPerPerson === 0, 'Sales 15,000 => Not qualified (0 THB)');


// 2. Diligence Allowance Tests
console.log('\n--- 2. Testing Monthly Diligence Evaluation Engine ---');

const d1 = evaluateMonthlyDiligence('emp-1', '2026-08', 0, 0, 0);
assert(d1.isEligible && d1.allowanceAmount === 500, '0 late, 0 leave, 0 absent => Eligible 500 THB');

const d2 = evaluateMonthlyDiligence('emp-1', '2026-08', 2, 0, 0);
assert(d2.isEligible && d2.allowanceAmount === 500, '2 late (<3), 0 leave, 0 absent => Eligible 500 THB');

const d3 = evaluateMonthlyDiligence('emp-1', '2026-08', 3, 0, 0);
assert(!d3.isEligible && d3.allowanceAmount === 0, '3 late (>=3), 0 leave, 0 absent => Disqualified (0 THB)');

const d4 = evaluateMonthlyDiligence('emp-1', '2026-08', 0, 1, 0);
assert(!d4.isEligible && d4.allowanceAmount === 0, '0 late, 1 leave, 0 absent => Disqualified (0 THB)');

const d5 = evaluateMonthlyDiligence('emp-1', '2026-08', 0, 0, 1);
assert(!d5.isEligible && d5.allowanceAmount === 0, '0 late, 0 leave, 1 absent => Disqualified (0 THB)');

console.log(`\n===================================`);
if (failedTests === 0) {
  console.log('✨ ALL VERIFICATION TESTS PASSED SUCCESSFULLY! ✨');
} else {
  console.error(`💥 ${failedTests} TESTS FAILED! 💥`);
  process.exit(1);
}
