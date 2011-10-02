if (typeof global != 'undefined') require('./load.test').load(global);
if (node) junjo_test();

// test start
function junjo_test() {
  var $j = new Junjo();
  var u2r = require('../lib/url2request');
  var http = require('http');

  $j('request', function(url) {
    var options = u2r(url);
    var req = http.request(options, this.cb);
    req.end();
    req.on("error", this.fail);
  })
  .fail(function(e) {
    T.equal(e.message, "ENOTFOUND, Domain name not found");
    this.terminate();
  });

  $j('response', function(res) {
    this.absorbData(res);
  })
  .firstError('shift')
  .after();

  $j.exec("localll", function(err, out) {
    T.equal(out.request.length, 0, 'result of response');
    T.equal(out.response.length, 0, 'result of response');
  });
}
