const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
const textExtensions = new Set([".html", ".css", ".js", ".json", ".xml", ".md", ".txt"]);
const skippedDirectories = new Set([".git", "node_modules", "dist", "build", ".vercel"]);

const genericPatterns = [
  /\u00C3./u,
  /\u00C2./u,
  /\u00E2\u20AC[\u0098-\u2122]/u,
  /\uFFFD/u,
  /\u00EF\u00BB\u00BF/u
];

const repoSpecificFragments = [
  "Contr\u003fle",
  "r\u003fglementaire",
  "R\u003fglementation",
  "R\u003falisations",
  "R\u003falisation",
  "Actualit\u003fs",
  "d\u003ftail",
  "d\u003fdi\u003fe",
  "\u003fquipements",
  "p\u003friodique",
  "r\u003fception",
  "v\u003frification",
  "P\u003frim\u003ftre",
  "Pr\u003fsentation",
  "D\u003froul\u003f",
  "cl\u003fs",
  "all\u003fe",
  "Agr\u003fment",
  "L\u003fgifrance",
  "R\u003ff\u003frence",
  "Rep\u003fre",
  "aper\u003fu",
  "acc\u003fdez",
  "contr\u003fles",
  "contr\u003fl\u003fs",
  "a\u003fration",
  "\u003ftape"
];

function shouldInspect(filePath) {
  return textExtensions.has(path.extname(filePath).toLowerCase());
}

function inspectFile(filePath, problems) {
  const content = fs.readFileSync(filePath, "utf8");
  const lines = content.split(/\r?\n/u);
  const relativePath = path.relative(repoRoot, filePath);

  lines.forEach((line, index) => {
    const hasGenericIssue = genericPatterns.some((pattern) => pattern.test(line));
    const matchingFragment = repoSpecificFragments.find((fragment) => line.includes(fragment));

    if (hasGenericIssue || matchingFragment) {
      problems.push({
        file: relativePath,
        line: index + 1,
        text: line.trim(),
        reason: matchingFragment ? `fragment suspect: ${matchingFragment}` : "motif d'encodage suspect"
      });
    }
  });
}

function walk(directory, problems) {
  const entries = fs.readdirSync(directory, { withFileTypes: true });

  entries.forEach((entry) => {
    if (skippedDirectories.has(entry.name)) {
      return;
    }

    const fullPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      walk(fullPath, problems);
      return;
    }

    if (shouldInspect(fullPath)) {
      inspectFile(fullPath, problems);
    }
  });
}

const problems = [];
walk(repoRoot, problems);

if (problems.length) {
  console.error("Mojibake detecte:");
  problems.forEach((problem) => {
    console.error(`${problem.file}:${problem.line} [${problem.reason}] ${problem.text}`);
  });
  process.exit(1);
}

console.log("Aucun motif de mojibake detecte.");
