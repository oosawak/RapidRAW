#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

function usage(code = 1) {
  console.log([
    'Usage:',
    '  node scripts/patch-file.mjs <patch.json> [--dry-run] [--backup]',
    '',
    'Patch JSON format:',
    '{',
    '  "file": "docs/specs/index.md",',
    '  "operations": [',
    '    { "op": "replace", "find": "old", "replace": "new", "count": 1 },',
    '    { "op": "insertAfter", "anchor": "needle", "content": "text" },',
    '    { "op": "insertBefore", "anchor": "needle", "content": "text" },',
    '    { "op": "append", "content": "text" }',
    '  ]',
    '}',
  ].join('\n'));
  process.exit(code);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function requireString(value, name) {
  if (typeof value !== 'string') {
    throw new Error(name + ' must be a string');
  }
  return value;
}

function preview(value) {
  const text = String(value).replace(/\n/g, '\\n');
  return text.length > 80 ? text.slice(0, 77) + '...' : text;
}

function applyReplace(source, op) {
  const find = requireString(op.find, 'find');
  const replace = requireString(op.replace, 'replace');
  const count = op.count == null ? 0 : Number(op.count);
  if (!Number.isInteger(count) || count < 0) {
    throw new Error('replace.count must be a non-negative integer');
  }
  if (count === 1) {
    const index = source.indexOf(find);
    if (index < 0) {
      throw new Error('replace target not found: ' + preview(find));
    }
    return source.slice(0, index) + replace + source.slice(index + find.length);
  }

  let remaining = count === 0 ? Infinity : count;
  let cursor = 0;
  let result = '';
  let matched = 0;
  while (true) {
    const index = source.indexOf(find, cursor);
    if (index < 0 || matched >= remaining) {
      break;
    }
    result += source.slice(cursor, index) + replace;
    cursor = index + find.length;
    matched += 1;
  }
  if (matched === 0) {
    throw new Error('replace target not found: ' + preview(find));
  }
  return result + source.slice(cursor);
}

function insertRelative(source, op, before) {
  const anchor = requireString(op.anchor, 'anchor');
  const content = requireString(op.content, 'content');
  const index = source.indexOf(anchor);
  if (index < 0) {
    throw new Error('anchor not found: ' + preview(anchor));
  }
  return before
    ? source.slice(0, index) + content + source.slice(index)
    : source.slice(0, index + anchor.length) + content + source.slice(index + anchor.length);
}

function applyAppend(source, op) {
  return source + requireString(op.content, 'content');
}

function writeFileAtomic(filePath, content, backup) {
  if (backup && fs.existsSync(filePath)) {
    fs.copyFileSync(filePath, filePath + '.bak');
  }
  const tmpPath = filePath + '.tmp-' + process.pid;
  fs.writeFileSync(tmpPath, content, 'utf8');
  fs.renameSync(tmpPath, filePath);
}

function main() {
  const args = process.argv.slice(2);
  if (!args.length || args.includes('-h') || args.includes('--help')) {
    usage(0);
  }

  const patchPath = args[0];
  const dryRun = args.includes('--dry-run');
  const backup = args.includes('--backup');
  const patch = readJson(patchPath);

  if (!patch || typeof patch !== 'object') {
    throw new Error('patch file must contain an object');
  }

  const targetPath = requireString(patch.file, 'file');
  const operations = Array.isArray(patch.operations) ? patch.operations : null;
  if (!operations || !operations.length) {
    throw new Error('patch.operations must be a non-empty array');
  }

  const absolutePatch = path.resolve(patchPath);
  const absoluteTarget = path.resolve(path.dirname(absolutePatch), targetPath);
  let source = fs.readFileSync(absoluteTarget, 'utf8');
  const original = source;

  for (const op of operations) {
    if (!op || typeof op !== 'object') {
      throw new Error('each operation must be an object');
    }

    if (op.op === 'replace') {
      source = applyReplace(source, op);
    } else if (op.op === 'insertBefore') {
      source = insertRelative(source, op, true);
    } else if (op.op === 'insertAfter') {
      source = insertRelative(source, op, false);
    } else if (op.op === 'append') {
      source = applyAppend(source, op);
    } else {
      throw new Error('unknown operation: ' + String(op.op));
    }
  }

  if (dryRun) {
    console.log(
      source === original
        ? 'no changes for ' + targetPath + ' (dry-run)'
        : 'patched ' + targetPath + ' (dry-run)',
    );
    return;
  }

  if (source === original) {
    console.log('no changes for ' + targetPath);
    return;
  }

  writeFileAtomic(absoluteTarget, source, backup);
  console.log('patched ' + targetPath);
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
