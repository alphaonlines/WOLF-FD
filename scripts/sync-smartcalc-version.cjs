const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const packageJsonPath = path.join(root, "package.json");
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
const version = String(packageJson.displayVersion || packageJson.version || "").trim();

if (!version) {
  throw new Error("Missing package.json displayVersion/version for Smart Calc sync.");
}

const files = [
  {
    path: path.join(root, "public/tools/smart-pricing-calculator.html"),
    replacements: [
      {
        pattern: /data-smart-calc-version="[^"]*"/,
        value: `data-smart-calc-version="${version}"`,
      },
      {
        pattern: /Smart Calc v[0-9][^<]*/,
        value: `Smart Calc v${version}`,
      },
    ],
  },
  {
    path: path.join(root, "public/smartcalc/index.html"),
    replacements: [
      {
        pattern: /Furniture Distributors pricing tool(?: · v[0-9][^<]*)?/,
        value: `Furniture Distributors pricing tool · v${version}`,
      },
      {
        pattern: /smart-pricing-calculator\.html(?:\?v=[^"]*)?/,
        value: `smart-pricing-calculator.html?v=${version}`,
      },
    ],
  },
];

for (const file of files) {
  let content = fs.readFileSync(file.path, "utf8");
  for (const replacement of file.replacements) {
    if (!replacement.pattern.test(content)) {
      throw new Error(`Could not sync ${path.relative(root, file.path)}: pattern ${replacement.pattern} not found.`);
    }
    content = content.replace(replacement.pattern, replacement.value);
  }
  fs.writeFileSync(file.path, content);
}

const manifest = {
  version,
  displayVersion: version,
  source: "package.json displayVersion",
};
fs.writeFileSync(path.join(root, "public/smartcalc/version.json"), `${JSON.stringify(manifest, null, 2)}
`);

console.log(`Smart Calc version synced to ${version}`);
