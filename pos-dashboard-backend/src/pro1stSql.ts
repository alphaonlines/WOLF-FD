const PRO1ST_PATTERNS = ["%pro1st%", "%pro 1st%", "%pro-1st%"];
const PRO1ST_EXCLUDED_PATTERNS = [
  "%mattress%",
  "%box spring%",
  "%box springs%",
  "%boxspring%",
  "%boxsprings%",
];

const buildQualifiedColumn = (columnPrefix: string, columnName: string) => `${columnPrefix}${columnName}`;

const buildLikeClauses = (column: string, patterns: string[]) =>
  patterns.map((pattern) => `COALESCE(${column}, '') ILIKE '${pattern}'`);

export function buildPro1stMatchSql(columnPrefix = ""): string {
  const columns = ["item_description", "category", "item_no", "manufacturer"];
  const clauses = [
    `COALESCE(${buildQualifiedColumn(columnPrefix, "is_pro1st")}, FALSE) = TRUE`,
    ...columns.flatMap((column) =>
      buildLikeClauses(buildQualifiedColumn(columnPrefix, column), PRO1ST_PATTERNS)
    ),
  ];

  return clauses.join("\n          OR ");
}

export function buildPro1stExcludedSql(columnPrefix = ""): string {
  const columns = ["item_description", "category", "item_no", "manufacturer"];
  return columns
    .flatMap((column) =>
      buildLikeClauses(buildQualifiedColumn(columnPrefix, column), PRO1ST_EXCLUDED_PATTERNS)
    )
    .join("\n          OR ");
}

export function buildQualifiedPro1stSql(columnPrefix = ""): string {
  return `(
          ${buildPro1stMatchSql(columnPrefix)}
        )
        AND NOT (
          ${buildPro1stExcludedSql(columnPrefix)}
        )`;
}
