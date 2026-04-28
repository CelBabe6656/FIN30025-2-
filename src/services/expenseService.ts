/**
 * Expense calculation logic for Australian Tax Context
 */

export const GST_RATE = 0.1;

export function calculateGst(total: number, includesGst: boolean = true) {
  if (includesGst) {
    return total / 11;
  }
  return total * GST_RATE;
}

export function shouldFlagForDepreciation(amount: number) {
  return amount >= 300;
}

export function calculateTaxBuffer(soleTraderProfit: number, paygEarnings: number) {
  // Simplified ATO individual tax rates for 2024-25 (estimation)
  // 0 - 18,200: Nil
  // 18,201 - 45,000: 16%
  // 45,001 - 135,000: 30%
  // 135,001 - 190,000: 37%
  // 190,001+: 45%
  
  const totalIncome = soleTraderProfit + paygEarnings;
  let estimatedTax = 0;

  if (totalIncome > 190000) {
    estimatedTax += (totalIncome - 190000) * 0.45 + 51638;
  } else if (totalIncome > 135000) {
    estimatedTax += (totalIncome - 135000) * 0.37 + 31288;
  } else if (totalIncome > 45000) {
    estimatedTax += (totalIncome - 45000) * 0.30 + 4288;
  } else if (totalIncome > 18200) {
    estimatedTax += (totalIncome - 18200) * 0.16;
  }

  // Adding 2% Medicare Levy
  estimatedTax += totalIncome * 0.02;

  return estimatedTax;
}
