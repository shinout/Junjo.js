if (typeof global != 'undefined') require('./load.test').load(global);
if (node) junjo_test();

// test start
function junjo_test() {
  if (!node) return;
  var spawn = require('child_process').spawn;

  var $j = new Junjo();
  $j(function() {
    var grep = spawn('grep', ['child', __filename]);
    this.gather(grep.stdout);
  });

  $j(function(val) {
    console.log(val);
  }).after();

  $j.run();
}