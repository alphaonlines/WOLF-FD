"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildPro1stMatchSql = buildPro1stMatchSql;
exports.buildPro1stExcludedSql = buildPro1stExcludedSql;
exports.buildQualifiedPro1stSql = buildQualifiedPro1stSql;
const PRO1ST_PATTERNS = [
    "%pro1st%",
    "%pro 1st%",
    "%pro-1st%",
    "%protection 1st%",
    "%protection first%",
    "%protection programs%",
    "%max_elite%",
];
const PRO1ST_EXCLUDED_PATTERNS = [
    "%mattress%",
    "%box spring%",
    "%box springs%",
    "%boxspring%",
    "%boxsprings%",
    "%foundation%",
    "%foundations%",
    "%adjustable base%",
    "%adjustable bases%",
    "%power base%",
    "%power bases%",
    "%bunkie board%",
    "%bunkie boards%",
];
const buildQualifiedColumn = (columnPrefix, columnName) => `${columnPrefix}${columnName}`;
const buildLikeClauses = (column, patterns) => patterns.map((pattern) => `COALESCE(${column}, '') ILIKE '${pattern}'`);
function buildPro1stMatchSql(columnPrefix = "") {
    const columns = ["item_description", "category", "item_no", "manufacturer"];
    const clauses = [
        `COALESCE(${buildQualifiedColumn(columnPrefix, "is_pro1st")}, FALSE) = TRUE`,
        ...columns.flatMap((column) => buildLikeClauses(buildQualifiedColumn(columnPrefix, column), PRO1ST_PATTERNS)),
    ];
    return clauses.join("\n          OR ");
}
function buildPro1stExcludedSql(columnPrefix = "") {
    const columns = ["item_description", "category", "item_no", "manufacturer"];
    return columns
        .flatMap((column) => buildLikeClauses(buildQualifiedColumn(columnPrefix, column), PRO1ST_EXCLUDED_PATTERNS))
        .join("\n          OR ");
}
function buildQualifiedPro1stSql(columnPrefix = "") {
    return `(
          ${buildPro1stMatchSql(columnPrefix)}
        )
        AND NOT (
          ${buildPro1stExcludedSql(columnPrefix)}
        )`;
}
//# sourceMappingURL=pro1stSql.js.map