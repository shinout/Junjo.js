if (typeof global != 'undefined') require('./load.test').load(global);
if (node) junjo_test();

// test start
function junjo_test() {

  var $j = new Junjo(), counter = 0;
  $j.start(function(n) {
    this.out = n || 1;
  });

  $j.on('end', function(err, out) {
    T.equal(out, ++counter);
    if (out < 4) $j.reset().run(out + 1);
  });
  $j.run();
}
