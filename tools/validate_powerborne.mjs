#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename, extname, join, relative } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const ignoredDirs = new Set(['.git']);
const errors = [];

function rel(path) {
  return relative(root, path).replaceAll('\\', '/');
}

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (ignoredDirs.has(entry.name)) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walk(path));
    } else {
      out.push(path);
    }
  }
  return out;
}

const files = walk(root);

const jsonLikeFiles = files.filter(file => extname(file) === '.json' || basename(file) === 'pack.mcmeta');
for (const file of jsonLikeFiles) {
  try {
    JSON.parse(readFileSync(file, 'utf8'));
  } catch (error) {
    errors.push(`JSON parse failed: ${rel(file)}: ${error.message}`);
  }
}

const jsFiles = files.filter(file => {
  if (extname(file) !== '.js') return false;
  const path = rel(file);
  return path.startsWith('addon/') || path.startsWith('assets/') || path.startsWith('data/');
});

for (const file of jsFiles) {
  const result = spawnSync(process.execPath, ['--check', file], {
    cwd: root,
    encoding: 'utf8'
  });
  if (result.status !== 0) {
    const message = (result.stderr || result.stdout || '').trim();
    errors.push(`JS syntax failed: ${rel(file)}${message ? `\n${message}` : ''}`);
  }
}

const requiredFiles = [
  'data/powerborne/palladium/powers/homelander.json',
  'data/powerborne/palladium/powers/iron_man.json',
  'data/powerborne/palladium/item_powers/homelander_suit.json',
  'data/powerborne/palladium/item_powers/iron_man_suit.json',
  'data/powerborne/kubejs_scripts/homelander/blood_v_energy.js',
  'data/powerborne/kubejs_scripts/iron_man/iron_man_energy.js',
  'data/powerborne/tags/damage_type/homelander_immune_to.json',
  'data/powerborne/tags/damage_type/iron_man_immune_to.json',
  'addon/powerborne/items/homelander_suit.json',
  'addon/powerborne/items/iron_man_suit.json',
  'addon/powerborne/items/iron_man_reactor.json',
  'assets/powerborne/palladium/render_layers/homelander.json',
  'assets/powerborne/palladium/render_layers/iron_man.json',
  'assets/powerborne/palladium/energy_beams/iron_man_repulsor.json',
  'assets/powerborne/palladium/energy_beams/iron_man_unibeam.json',
  'assets/powerborne/textures/item/blood_v.png',
  'assets/powerborne/textures/item/homelander_suit.png',
  'assets/powerborne/textures/item/iron_man_suit.png',
  'assets/powerborne/textures/item/iron_man_reactor.png'
];

for (const path of requiredFiles) {
  if (!existsSync(join(root, path))) {
    errors.push(`Missing required file: ${path}`);
  }
}

const noTreeGatePowerFiles = [
  'data/powerborne/palladium/powers/sentry.json',
  'data/powerborne/palladium/powers/superman.json',
  'data/powerborne/palladium/powers/homelander.json',
  'data/powerborne/palladium/powers/iron_man.json',
  'data/powerborne/palladium/powers/god_of_thunder.json',
  'data/powerborne/palladium/powers/captain_america.json'
];

for (const path of noTreeGatePowerFiles) {
  const fullPath = join(root, path);
  if (!existsSync(fullPath)) {
    errors.push(`Missing hero power file: ${path}`);
    continue;
  }
  const text = readFileSync(fullPath, 'utf8');
  if (text.includes('palladium:property_buyable') || text.includes('palladium:ability_unlocked')) {
    errors.push(`Skill-tree gate still present in always-max hero power: ${path}`);
  }
}

if (errors.length) {
  console.error(`PowerBorne validation failed with ${errors.length} error(s):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`PowerBorne validation passed: ${jsonLikeFiles.length} JSON files, ${jsFiles.length} JS files checked.`);
