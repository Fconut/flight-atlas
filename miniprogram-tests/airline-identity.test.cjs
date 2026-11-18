const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'),
  path = require('node:path'),
  vm = require('node:vm');
const crypto = require('node:crypto');
const identity = require('../miniprogram/lib/airline-identity');
const colors = require('../miniprogram/lib/airline-brand-colors');
const root = path.resolve(__dirname, '..');

test('plain code marks split only matching prefixes, preserve suffixes and handle missing data', () => {
  for (const [row, code, number] of [
    [{ airline: 'mu', flight: 'MU5357' }, 'MU', '5357'],
    [{ airline: 'CES', flight: 'CES5357A' }, 'MU', '5357A'],
    [{ airline: 'CES', flight: 'MU5357' }, 'MU', '5357'],
    [{ airline: '9C', flight: '9C8525' }, '9C', '8525'],
    [{ airline: 'ca', flight: 'CA 954' }, 'CA', '954'],
    [{ airline: 'LH', flight: '728' }, 'LH', '728'],
    [{ airline: 'CA', flight: 'MU5357' }, 'CA', 'MU5357'],
    [{ airline: 'CA', flight: 'CAT123' }, 'CA', 'CAT123'],
    [{ airline: 'ZZ', flight: 'ZZ12' }, 'ZZ', '12'],
    [{ flight: 'CA123' }, '', 'CA123'],
    [{ airline: 'CA' }, 'CA', '未填写航班号'],
    [{ airline: 'CA', flight: 'CA' }, 'CA', '未填写航班号'],
    [{}, '', '未填写航班号'],
  ]) {
    const result = identity.airlineIdentity(row);
    assert.equal(result.code, code);
    assert.equal(result.number, number);
  }
});

test('every reviewed airline color remains readable; unknown airlines share a neutral theme', () => {
  for (const code of Object.keys(colors)) {
    const mark = identity.airlineIdentity({ airline: code });
    assert(identity.contrast(mark.color, mark.background) >= 4.5);
  }
  assert.equal(identity.airlineIdentity({ airline: 'MU' }).color, colors.MU.ink);
  assert.notEqual(
    identity.airlineIdentity({ airline: 'MU' }).background,
    identity.airlineIdentity({ airline: 'LH' }).background,
  );
  assert.equal(
    identity.airlineIdentity({ airline: 'ZZ' }).background,
    identity.airlineIdentity({ airline: 'XXX' }).background,
  );
});

test('the shared component updates code and flight together without an image dependency', () => {
  let config;
  const component = path.join(
    root,
    'miniprogram/components/airline-identity/index',
  );
  vm.runInNewContext(fs.readFileSync(component + '.js', 'utf8'), {
    require: () => identity,
    Component: (value) => (config = value),
  });
  const host = {
    setData(value) {
      Object.assign(this, value);
    },
  };
  const update = config.observers['code, flight'];
  update.call(host, 'CA', 'CA954');
  assert.equal(host.identity.code, 'CA');
  assert.equal(host.identity.number, '954');
  update.call(host, 'LH', 'LH728');
  assert.equal(host.identity.code, 'LH');
  assert.equal(host.identity.number, '728');
  assert(!fs.readFileSync(component + '.wxml', 'utf8').includes('<image'));
});

test('canvas marks match UI parsing and fit inside their right-aligned region', () => {
  const draws = [],
    ctx = new Proxy(
      {
        measureText: (value) => ({ width: String(value).length * 13 }),
        fillText: (value, x, y) => draws.push({ value, x, y }),
      },
      { get: (obj, key) => (key in obj ? obj[key] : () => {}) },
    );
  const mark = identity.drawAirlineIdentity(
    ctx,
    { airline: 'MU', flight: 'MU5357' },
    1140,
    920,
    { align: 'right', maxWidth: 430 },
  );
  assert.equal(mark.number, '5357');
  assert.deepEqual(
    draws.map((value) => value.value),
    ['MU', '5357'],
  );
  assert(draws.every((value) => value.x >= 710 && value.x <= 1140));
});

test('all previous airline images retain provenance while no official symbols ship in the mini-program', () => {
  const inventory = JSON.parse(
    fs.readFileSync(path.join(root, 'docs/legal/airline-logos/inventory.json')),
  );
  assert.equal(inventory.entries.length, 81);
  for (const row of inventory.entries) {
    const original = fs.readFileSync(
      path.join(root, 'dist/assets/airline-logos', row.code + '.png'),
    );
    assert.equal(
      crypto.createHash('sha256').update(original).digest('hex'),
      row.originalSha256,
    );
  }
  const folder = path.join(root, 'miniprogram/airline-art/logos');
  assert(!fs.existsSync(folder) || fs.readdirSync(folder).length === 0);
});
