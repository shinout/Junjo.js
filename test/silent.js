if (typeof global != 'undefined') require('./load.test').load(global);
if (node) junjo_test();

// test start
function junjo_test() {

  var $j = new Junjo().silent();

  $j('1st', function() {
    throw new Error(this.label);
  });

  $j('2nd', function() {
    T.ok(true);
  });

  $j.on('end', function(err, out) {
    T.equal(err.message, '1st');
  });

  $j.run();

  var $j2 = $j.clone().silent(true);
  $j2.remove('2nd');

  $j2('2nd', function() {
    T.fail("");
  });

  $j2.run();
}