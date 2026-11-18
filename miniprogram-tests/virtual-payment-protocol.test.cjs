const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const protocol = require('../design/virtual-payment/protocol.cjs');
const input = { offerId: 'test-offer', productId: 'test-product', priceInFen: 100,
  outTradeNo: 'T123456789', attach: 'test-order' };
test('virtual payment uses two distinct server secrets over exact serialized bytes', () => {
  const result = protocol.signOrder(input, 'test-app-key', 'test-session-key');
  const expected = '{"offerId":"test-offer","buyQuantity":1,"env":0,"currencyType":"CNY","productId":"test-product","goodsPrice":100,"outTradeNo":"T123456789","attach":"test-order"}';
  assert.equal(result.signData, expected);
  for (const [field, key, message] of [['paySig', 'test-app-key', 'requestVirtualPayment&' + expected], ['signature', 'test-session-key', expected]])
    assert.equal(result[field], crypto.createHmac('sha256', key).update(message).digest('hex'));
  assert.equal(result.mode, 'short_series_goods');
  assert(!JSON.stringify(result).includes('test-session-key'));
});
test('virtual payment rejects absent configuration, fractional fees and reused format errors', () => {
  for (const change of [{priceInFen:1.5},{quantity:0},{outTradeNo:'_12345678'},{outTradeNo:'short'},{attach:''}])
    assert.throws(() => protocol.signOrder({...input,...change},'a','b'));
  assert.throws(() => protocol.signOrder(input,'','b'));
  const ids = new Set(Array.from({length:1000},protocol.orderNumber));
  assert.equal(ids.size,1000);
  assert([...ids].every(x=>x.length>=8&&x.length<=32&&!x.startsWith('_')));
});
test('query signature covers the exact API path and request body', () => {
  const r=protocol.queryRequest('test-openid','test-order','test-key');
  assert.equal(r.body,'{"openid":"test-openid","env":0,"order_id":"test-order"}');
  assert.equal(r.paySig,crypto.createHmac('sha256','test-key').update('/xpay/query_order&'+r.body).digest('hex'));
});
