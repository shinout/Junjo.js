if (typeof global != 'undefined') require('./load.test').load(global);
if (node) junjo_test();

// test start
function junjo_test() {

  var $j = new Junjo();
  $j.enterTimeout = 0.001;

  $j('B', function() {
    this.out += this.label;
  });

  $j('AC', function() {
    this.out = this.label;
  });

  $j.enter('AC');
  $j.on('end', function(err, out) {
    T.equal(out, 'ACB');
  });
}
