if (typeof global != 'undefined') require('./load.test').load(global);
if (node) junjo_test();

// test start
function junjo_test() {
  if (!node) return;
  var spawn = require('child_process').spawn;

  var $j = new Junjo();

  $j('1st', function() {
    T.equal(arguments.length, 0, "no args");
    var grep = spawn('grep', ['consolelog', "unkO"]);
    this.absorbData(grep.stdout, 'data', '1stdata');
    this.absorbError(grep.stderr, 'data', '1sterr');
  })
  .firstError('shift')
  .fail(function(e) {console.log("grepError", e.message)});

  $j('2nd',function() {
    T.strictEqual(arguments[0], undefined, "result is undefined");
    var grep = spawn('grep', ['consolelog', __filename]);
    this.absorbData(grep.stdout, 'data', '1stdata');
    this.absorbError(grep.stderr, 'data', '1sterr');
  }).after('1st');

  $j(function(err, out) {
    console.log("grepResult", out);
    T.strictEqual(err, null, "no err");
    T.ok(out, "out");
  }).after('2nd');

  var $j2 = new Junjo();

  $j2(function() {
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
    $j2.terminate();
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
    T.strictEqual(err, null, "no err");
    T.strictEqual(typeof out, 'object', "typeof out");
    T.strictEqual(typeof out["1stdata"], 'string', "typeof out.1stdata");
    T.strictEqual(out["sub"], 'Yeah!', "out.sub");
  });

  $j.next($j2);
  $j.run();
}
