"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.prefixedDateFieldForBasis = exports.prefixedDateField = exports.dateFieldForBasis = exports.normalizeDateBasis = exports.WRITTEN_DATE_FIELD = exports.ITEM_DATE_FIELD = exports.SAFE_FINANCE_BALANCE = exports.SAFE_FINANCE_FEE = exports.SAFE_TOTAL_FINANCE_AMT = exports.SAFE_PROFIT = exports.SAFE_GRAND_TOTAL = void 0;
exports.SAFE_GRAND_TOTAL = `
  CASE
    WHEN grand_total IS NULL OR grand_total <> grand_total THEN 0
    ELSE grand_total
  END
`;
exports.SAFE_PROFIT = `
  CASE
    WHEN profit IS NULL OR profit <> profit THEN 0
    ELSE profit
  END
`;
exports.SAFE_TOTAL_FINANCE_AMT = `
  CASE
    WHEN total_finance_amt IS NULL OR total_finance_amt <> total_finance_amt THEN 0
    ELSE total_finance_amt
  END
`;
exports.SAFE_FINANCE_FEE = `
  CASE
    WHEN finance_fee IS NULL OR finance_fee <> finance_fee THEN 0
    ELSE finance_fee
  END
`;
exports.SAFE_FINANCE_BALANCE = `
  CASE
    WHEN finance_balance IS NULL OR finance_balance <> finance_balance THEN 0
    ELSE finance_balance
  END
`;
exports.ITEM_DATE_FIELD = "delivery_confirmed_date";
exports.WRITTEN_DATE_FIELD = "sale_date";
const normalizeDateBasis = (value) => {
    return typeof value === "string" && value.trim().toLowerCase() === "written" ? "written" : "delivered";
};
exports.normalizeDateBasis = normalizeDateBasis;
const dateFieldForBasis = (value) => {
    return (0, exports.normalizeDateBasis)(value) === "written" ? exports.WRITTEN_DATE_FIELD : exports.ITEM_DATE_FIELD;
};
exports.dateFieldForBasis = dateFieldForBasis;
const prefixedDateField = (p) => `${p}.${exports.ITEM_DATE_FIELD}`;
exports.prefixedDateField = prefixedDateField;
const prefixedDateFieldForBasis = (value, p) => `${p}.${(0, exports.dateFieldForBasis)(value)}`;
exports.prefixedDateFieldForBasis = prefixedDateFieldForBasis;
//# sourceMappingURL=sqlFields.js.map