if (typeof global != 'undefined') require('./load.test').load(global);
if (node) junjo_test();

// test start
function junjo_test() {
  if (!node) return;
  var spawn = require('child_process').spawn;

  var jj = new Junjo();

  jj('1st', function() {
    var grep = spawn('grep', ['consolelog', "unkO"]);
    this.absorbData(grep.stdout, 'data', '1stdata');
    this.absorbError(grep.stderr, 'data', '1sterr');
  })
  .firstError('shift')
  .fail(function(e) {console.log("grepError", e.message)});

  jj('2nd',function() {
    var grep = spawn('grep', ['consolelog', __filename]);
    this.absorbData(grep.stdout, 'data', '1stdata');
    this.absorbError(grep.stderr, 'data', '1sterr');
  }).after('1st');

  jj(function(err, out) {
    console.log("grepResult", out);
  }).after('2nd');

  var $j = new Junjo();

  $j(function() {
    var http = require('http');
    var req = http.request({
      method: 'GET',
      host: 'localhost',
      port: 80,
      path: '/',
      protocol: 'http' }, this.cb);
    req.end();
  })
  .fail(function(e) {
    console.log("request Error", e.message);
    $j.terminate();
  })

  .next(function(res) {
    this.sub(function() { this.out = 'Yeah!' });
    var grep = spawn('grep', ['consolelog', __filename]);
    this.absorbData(grep.stdout, 'data', '1stdata');
    this.absorbError(grep.stderr, 'data', '1sterr');
    this.absorbData(res,'data', 'response');
    this.absorbError(res,'error', 'resError');
  })

  .next(function(err, out) {
    console.log(err, out);
  });

  $j.after(jj);
  jj.run();
}
