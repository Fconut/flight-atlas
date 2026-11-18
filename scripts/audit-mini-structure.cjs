// Read-only inventory. Run with Node from any directory.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '../miniprogram');
function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(file) : [file];
  });
}
const files = walk(root), known = new Set(files), missing = [], hashes = new Map();
const relative = file => path.relative(root, file).replaceAll('\\', '/');
function resolveLocal(file, reference) {
  return reference.startsWith('/') ? path.join(root, reference.slice(1)) : path.resolve(path.dirname(file), reference);
}
for (const file of files) {
  const content = fs.readFileSync(file);
  const hash = crypto.createHash('sha256').update(content).digest('hex');
  if (!hashes.has(hash)) hashes.set(hash, []);
  hashes.get(hash).push(relative(file));
  const extension = path.extname(file);
  if (!['.json', '.wxml', '.wxss', '.js'].includes(extension)) continue;
  const text = content.toString();
  if (extension === '.json') {
    const config = JSON.parse(text);
    for (const reference of Object.values(config.usingComponents || {})) {
      if (reference.startsWith('plugin://')) continue;
      const component = resolveLocal(file, reference);
      for (const ext of ['.js', '.json', '.wxml'])
        if (!known.has(component + ext)) missing.push({ file: relative(file), reference: reference + ext });
    }
  }
  if (extension === '.wxml' || extension === '.wxss') {
    const pattern = extension === '.wxml' ? /<(?:include|import)\b[^>]*\bsrc=['"]([^'"]+)['"]/g : /@import\s+['"]([^'"]+)['"]/g;
    for (const match of text.matchAll(pattern))
      if (!known.has(resolveLocal(file, match[1]))) missing.push({ file: relative(file), reference: match[1] });
  }
  if (path.extname(file) !== '.js') continue;
  for (const match of text.matchAll(/require\(\s*['"](\.[^'"]+)['"]\s*\)/g)) {
    const target = path.resolve(path.dirname(file), match[1]);
    if (![target, target + '.js', target + '.json', path.join(target, 'index.js')].some(p => known.has(p)))
      missing.push({ file: relative(file), reference: match[1] });
  }
}
const app = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8'));
for (const tab of app.tabBar?.list || []) for (const key of ['iconPath', 'selectedIconPath'])
  if (tab[key] && !known.has(path.join(root, tab[key]))) missing.push({ tab: tab.pagePath, reference: tab[key] });
const badges = require(path.join(root, 'lib/badge-assets.js'));
for (const badge of badges) if (badge.badge && !known.has(path.join(root, badge.badge.replace(/^\//, ''))))
  missing.push({ badge: badge.id, reference: badge.badge });
const pages = [...app.pages, ...(app.subPackages || []).flatMap(pack => pack.pages.map(page => pack.root + '/' + page))];
for (const page of pages) for (const ext of ['.js', '.json', '.wxml']) {
  if (!known.has(path.join(root, page + ext))) missing.push({ page, missing: ext });
}
console.log(JSON.stringify({
  files: files.length,
  pages: pages.length,
  missing,
  identicalFiles: [...hashes.values()].filter(group => group.length > 1),
  note: 'Identical files are candidates for review, not safe deletion: page stubs and subpackage entry files may be required. Dynamic asset references are not classified as unused.',
}, null, 2));
if (missing.length) process.exitCode = 1;
