const { airlineIdentity } = require('../../lib/airline-identity');
Component({
  options: { virtualHost: true },
  properties: {
    code: { type: String, value: '' },
    flight: { type: String, value: '' },
  },
  observers: {
    'code, flight': function (code, flight) {
      this.setData({ identity: airlineIdentity({ airline: code, flight }) });
    },
  },
  data: { identity: airlineIdentity() },
});
