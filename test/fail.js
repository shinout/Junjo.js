if (typeof global != 'undefined') require('./load.test').load(global);
if (node) junjo_test();

// test start
function junjo_test() {
  var $j = new Junjo();
  var u2r = require('../lib/url2request');
  var http = require('http');

  $j('request', function(url) {
    var options = u2r(url);
    console.log(options)
    var req = http.request(url, this.cb);
    req.end();
    req.on("error", this.fail);
  })
  .fail(function(e) {
    console.log(e.message)
    T.equal(e.message, "EAFNOSUPPORT, Address family not supported by protocol family", "error message");
    this.terminate();
  });

  $j('response', function(res) {
    this.absorbData(res);
  })
  .firstError('shift')
  .after();

  $j.exec("localhost", function(err, out) {
    T.equal(out.request.length, 0, 'result of response');
    T.equal(out.response.length, 0, 'result of response');
  });
}
