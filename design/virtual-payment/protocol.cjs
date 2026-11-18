const crypto = require('node:crypto');

function hmac(key, message) {
  if (typeof key !== 'string' || !key) throw Error('Missing server secret');
  return crypto.createHmac('sha256', key).update(message, 'utf8').digest('hex');
}

function orderNumber() {
  return 'T' + crypto.randomBytes(15).toString('hex');
}

// Server-only protocol primitive. No deployed handler or client-controlled price.
function signOrder({ offerId, productId, priceInFen, quantity = 1, outTradeNo, attach }, appKey, sessionKey) {
  if (!offerId || !productId || typeof attach !== 'string' || !attach)
    throw Error('Missing product configuration');
  if (!Number.isSafeInteger(priceInFen) || priceInFen <= 0 ||
      !Number.isSafeInteger(quantity) || quantity <= 0 || !Number.isSafeInteger(priceInFen * quantity))
    throw Error('Invalid integer price or quantity');
  if (typeof outTradeNo !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_-]{7,31}$/.test(outTradeNo))
    throw Error('Invalid order number');
  const signData = JSON.stringify({ offerId, buyQuantity: quantity, env: 0,
    currencyType: 'CNY', productId, goodsPrice: priceInFen, outTradeNo, attach });
  return { mode: 'short_series_goods', signData,
    paySig: hmac(appKey, 'requestVirtualPayment&' + signData),
    signature: hmac(sessionKey, signData) };
}

function queryRequest(openid, orderId, appKey) {
  if (!openid || !orderId) throw Error('Missing order owner');
  const body = JSON.stringify({ openid, env: 0, order_id: orderId });
  return { body, paySig: hmac(appKey, '/xpay/query_order&' + body) };
}

module.exports = { signOrder, queryRequest, orderNumber };
