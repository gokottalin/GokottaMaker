#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { formulaRevisionId } = require("../../lib/content");
const { validateFormulaCatalogPackage } = require("../../lib/validators");
const { validateBookFile } = require("./validator");

const ROOT = path.resolve(__dirname, "../..");
const SCHEMA = path.join(ROOT, "schemas/calculation-book-master.schema.json");
const DEFAULT_BOOKS = [
  path.join(ROOT, "content/calculation-books/ccm-flyback-reference/calculation-book.json"),
  path.join(ROOT, "content/calculation-books/four-switch-buck-boost-reva/calculation-book.json")
];

function optionsFrom(argv) {
  const options = { book: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      options[key] = true;
      continue;
    }
    if (key === "book") options.book.push(next);
    else options[key] = next;
    index += 1;
  }
  return options;
}

function latexText(value) {
  return String(value || "")
    .replaceAll("\\", "\\textbackslash ")
    .replaceAll("{", "\\{")
    .replaceAll("}", "\\}")
    .replaceAll("_", "\\_");
}

function latexSymbol(symbol) {
  const greek = {
    "ΔI": "\\Delta I",
    dI: "\\Delta I",
    eta: "\\eta",
    "η": "\\eta",
    mu: "\\mu",
    "μ": "\\mu"
  };
  const [base, ...subscripts] = String(symbol || "").split(".");
  const baseLatex = greek[base] || (/^[A-Za-z]$/.test(base) ? base : `\\mathrm{${latexText(base)}}`);
  if (!subscripts.length) return baseLatex;
  const subscript = subscripts.map((entry) => `\\mathrm{${latexText(entry)}}`).join(",");
  return `${baseLatex}_{${subscript}}`;
}

function astPrecedence(node) {
  if (!node || typeof node !== "object") return 9;
  if (["add", "subtract"].includes(node.op)) return 1;
  if (["multiply", "divide"].includes(node.op)) return 2;
  if (["power", "negate"].includes(node.op)) return 3;
  return 4;
}

function wrapLatex(node, parentPrecedence) {
  const rendered = astToLatex(node);
  return astPrecedence(node) < parentPrecedence ? `\\left(${rendered}\\right)` : rendered;
}

function astToLatex(node) {
  if (!node || typeof node !== "object") throw new Error("Formula AST node must be an object");
  const args = node.args || [];
  if (node.op === "literal") return Number(node.value).toString();
  if (node.op === "ref") return latexSymbol(node.symbol);
  if (node.op === "add") return args.map((entry) => wrapLatex(entry, 1)).join(" + ");
  if (node.op === "subtract") return args.map((entry, index) => `${index ? "- " : ""}${wrapLatex(entry, 1)}`).join(" ");
  if (node.op === "multiply") return args.map((entry) => wrapLatex(entry, 2)).join(" \\cdot ");
  if (node.op === "divide") {
    if (args.length !== 2) throw new Error("Formula divide AST requires two arguments");
    return `\\frac{${astToLatex(args[0])}}{${astToLatex(args[1])}}`;
  }
  if (node.op === "power") {
    if (args.length !== 2) throw new Error("Formula power AST requires two arguments");
    return `${wrapLatex(args[0], 3)}^{${astToLatex(args[1])}}`;
  }
  if (node.op === "sqrt") {
    if (args.length !== 1) throw new Error("Formula sqrt AST requires one argument");
    return `\\sqrt{${astToLatex(args[0])}}`;
  }
  if (node.op === "negate") {
    if (args.length !== 1) throw new Error("Formula negate AST requires one argument");
    return `-${wrapLatex(args[0], 3)}`;
  }
  if (["min", "max"].includes(node.op)) {
    return `\\${node.op}\\left(${args.map(astToLatex).join(", ")}\\right)`;
  }
  throw new Error(`Unsupported formula AST operator: ${node.op}`);
}

function equationLatex(equation) {
  return `${latexSymbol(equation.symbol)} = ${astToLatex(equation.expression)}`;
}

function formulaIdFor(book, equation) {
  return `formula.${book.slug}.${equation.id}`;
}

function formulaSlugFor(book, equation) {
  return `${book.slug}-${equation.id}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function formulaCardsFromCalculationBook(book, options = {}) {
  if (book.bookKind !== "instance") return [];
  const moduleKey = String(options.moduleKey || "power-electronics");
  return book.equations.map((equation) => {
    const formulaId = formulaIdFor(book, equation);
    const latex = equationLatex(equation);
    const source = {
      formulaId,
      latex,
      sourceBookId: book.bookId,
      sourceBookRevision: book.revision,
      sourceFormulaId: equation.id
    };
    const revisionId = formulaRevisionId(source);
    return {
      formulaId,
      slug: formulaSlugFor(book, equation),
      displayName: equation.title,
      moduleKey,
      categoryPath: `${book.slug}/${equation.section}`,
      purpose: equation.applicability || "",
      tags: [
        `book:${book.slug}`,
        `depth:l1-design`,
        `module:${moduleKey}`,
        `section:${equation.section}`,
        `topology:${book.design.topology}`,
        `unit:${equation.unit}`
      ].sort((left, right) => left.localeCompare(right, "zh-CN")),
      archiveState: "active",
      currentRevisionId: revisionId,
      revisions: [
        {
          revisionId,
          sequence: 1,
          latex,
          revisionReason: "calculation-book-import",
          sourceBookId: book.bookId,
          sourceBookRevision: book.revision,
          sourceFormulaId: equation.id
        }
      ]
    };
  });
}

function catalogPackageFromBooks(bookPaths = DEFAULT_BOOKS) {
  const cards = [];
  for (const filename of bookPaths) {
    const validated = validateBookFile(path.resolve(filename), SCHEMA);
    if (!validated.report.ok) {
      throw new Error(`${filename}: ${validated.report.errors.join("; ")}`);
    }
    cards.push(...formulaCardsFromCalculationBook(validated.book));
  }
  return validateFormulaCatalogPackage({
    schemaVersion: "larkix.formula-catalog.v1",
    cards
  });
}

function isInside(parent, child) {
  const relative = path.relative(path.resolve(parent), path.resolve(child));
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function assertExternalPath(filename, root = ROOT) {
  const resolved = path.resolve(filename);
  if (isInside(root, resolved)) {
    const error = new Error("公式目录快照必须写在源码树之外");
    error.status = 400;
    throw error;
  }
  if (path.extname(resolved).toLowerCase() !== ".json") {
    const error = new Error("公式目录快照必须使用 .json 扩展名");
    error.status = 400;
    throw error;
  }
  return resolved;
}

function writeSnapshotFile(pkg, filename, options = {}) {
  const resolved = assertExternalPath(filename, options.root || ROOT);
  if (fs.existsSync(resolved)) {
    const error = new Error(`公式目录快照已存在，拒绝覆盖：${path.basename(resolved)}`);
    error.status = 409;
    throw error;
  }
  const normalized = validateFormulaCatalogPackage(pkg);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  fs.writeFileSync(resolved, `${JSON.stringify(normalized, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
  return resolved;
}

function assertExternalDataDir(dataDir, options = {}) {
  const resolved = path.resolve(dataDir);
  if (isInside(options.root || ROOT, resolved)) {
    throw new Error("公式目录命令拒绝在源码树或默认当前数据目录中运行");
  }
  const protectedRoots = [path.parse(resolved).root, os.homedir()].map((entry) => path.resolve(entry));
  if (protectedRoots.includes(resolved)) throw new Error("公式目录命令拒绝使用过宽的数据目录");
  return resolved;
}

function openCatalog(dataDir) {
  const { createDatabase } = require("../../lib/db");
  const { createContentStore } = require("../../lib/content");
  const resolved = assertExternalDataDir(dataDir);
  const dbDir = path.join(resolved, "database");
  const dbPath = path.join(dbDir, "gokottamaker.sqlite");
  const uploadDir = path.join(resolved, "uploads");
  const db = createDatabase({ root: ROOT, dataDir: resolved, dbDir, dbPath, uploadDir });
  return { db, store: createContentStore(db), dataDir: resolved, dbPath };
}

function commandMain() {
  const [command = "package-books", ...argv] = process.argv.slice(2);
  const options = optionsFrom(argv);
  const books = options.book.length ? options.book.map((entry) => path.resolve(entry)) : DEFAULT_BOOKS;

  if (command === "package-books") {
    const pkg = catalogPackageFromBooks(books);
    process.stdout.write(`${JSON.stringify(pkg, null, 2)}\n`);
    return;
  }

  if (command === "snapshot") {
    if (!options["data-dir"] || !options.output) throw new Error("snapshot requires --data-dir and --output");
    const opened = openCatalog(options["data-dir"]);
    try {
      const output = writeSnapshotFile(opened.store.exportFormulaCatalog(), options.output);
      console.log(JSON.stringify({ ok: true, output, cards: opened.store.exportFormulaCatalog().cards.length }, null, 2));
    } finally {
      opened.db.close();
    }
    return;
  }

  if (command === "import-books") {
    if (!options["data-dir"] || !options.snapshot) throw new Error("import-books requires --data-dir and --snapshot");
    const dataDir = assertExternalDataDir(options["data-dir"]);
    const dbPath = path.join(dataDir, "database", "gokottamaker.sqlite");
    if (fs.existsSync(dbPath)) throw new Error("import-books only accepts a new isolated DATA_DIR");
    const opened = openCatalog(dataDir);
    try {
      const pkg = catalogPackageFromBooks(books);
      const snapshot = writeSnapshotFile(opened.store.exportFormulaCatalog(), options.snapshot);
      const result = opened.store.importFormulaCatalog(pkg, {
        actor: { username: "formula-catalog-cli" }
      });
      console.log(JSON.stringify({ ok: true, snapshot, ...result }, null, 2));
    } finally {
      opened.db.close();
    }
    return;
  }

  throw new Error(`Unknown formula catalog command: ${command}`);
}

if (require.main === module) {
  try {
    commandMain();
  } catch (error) {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  }
}

module.exports = {
  ROOT,
  astToLatex,
  catalogPackageFromBooks,
  equationLatex,
  formulaCardsFromCalculationBook,
  formulaIdFor,
  formulaSlugFor,
  latexSymbol,
  writeSnapshotFile
};
