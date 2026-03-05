export const SAFE_GRAND_TOTAL = `
  CASE
    WHEN grand_total IS NULL OR grand_total <> grand_total THEN 0
    ELSE grand_total
  END
`;

export const SAFE_PROFIT = `
  CASE
    WHEN profit IS NULL OR profit <> profit THEN 0
    ELSE profit
  END
`;

export const SAFE_TOTAL_FINANCE_AMT = `
  CASE
    WHEN total_finance_amt IS NULL OR total_finance_amt <> total_finance_amt THEN 0
    ELSE total_finance_amt
  END
`;

export const SAFE_FINANCE_FEE = `
  CASE
    WHEN finance_fee IS NULL OR finance_fee <> finance_fee THEN 0
    ELSE finance_fee
  END
`;

export const SAFE_FINANCE_BALANCE = `
  CASE
    WHEN finance_balance IS NULL OR finance_balance <> finance_balance THEN 0
    ELSE finance_balance
  END
`;

// Sales analytics should be booked on delivery date (when revenue is realized),
// not original sale date.
export const ITEM_DATE_FIELD = "delivery_confirmed_date";
export const prefixedDateField = (p: string) => `${p}.delivery_confirmed_date`;
