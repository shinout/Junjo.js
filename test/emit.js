if (typeof global != 'undefined') require('./load.test').load(global);
if (node) junjo_test();

// test start
function junjo_test() {
  if (!node) return;
  var spawn = require('child_process').spawn;

  var jj = new Junjo();
  var grep = spawn('grep', ['consolelog', "unkO"]);

  jj('1st', function() {
    this.shared.data = '';
    this.shared.err  = '';
    this.emitOn(grep.stdout, 'data', '1stdata');
    this.emitOn(grep.stderr, 'data', '1sterr');
  });

  jj.on('1stdata', function(data) {
    console.log(data.toString() + ' <-- GREPRESULT\n');
    this.shared.data += data.toString();
  });

  jj.on('1sterr', function(data) {
    console.log(data.toString() + ' <-- GREPERROR\n');
    this.shared.err += data.toString();
  });

  jj(function() {
    console.log(this.shared.data + ' <==== DATA');
    console.log(this.shared.err  + ' <==== ERR');
    console.log(jj.shared('err')  + ' <==== ERR (shared func)');
    console.log("grepresult end");
  }).after('1st');

  jj.run();
}
