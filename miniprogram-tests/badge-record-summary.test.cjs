const test = require('node:test'),
  assert = require('node:assert/strict');
const {
  badgeRecordSummary,
} = require('../miniprogram/lib/badge-record-summary');

test('badge summaries normalize airline aliases and count opposite directions separately', () => {
  const records = [
    { date: '2025-02-01', airline: 'CES', from: 'SHA', to: 'PEK' },
    { date: '2024-01-01', airline: 'MU', from: 'PEK', to: 'SHA' },
    { date: '2025-03-01', airline: 'LH', from: 'SHA', to: 'PEK' },
  ];
  const before = JSON.stringify(records);
  assert.deepEqual(badgeRecordSummary(records), {
    total: 3,
    airlines: 2,
    routes: 2,
    firstDate: '2024-01-01',
  });
  assert.equal(JSON.stringify(records), before);
});

test('share summary uses only supplied records and safely handles an empty selection', () => {
  const selected = [
    { date: '2025-03-01', airline: 'MU', from: 'SHA', to: 'PEK' },
  ];
  assert.deepEqual(badgeRecordSummary(selected), {
    total: 1,
    airlines: 1,
    routes: 1,
    firstDate: '2025-03-01',
  });
  assert.deepEqual(badgeRecordSummary([]), {
    total: 0,
    airlines: 0,
    routes: 0,
    firstDate: '',
  });
  assert.deepEqual(badgeRecordSummary([{}]), {
    total: 1,
    airlines: 0,
    routes: 0,
    firstDate: '',
  });
});
