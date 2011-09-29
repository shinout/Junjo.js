if (typeof global != 'undefined') require('./load.test').load(global);
if (node) junjo_test();

// test start
function junjo_test() {

  var $j = new Junjo();

  $j.start(function(a,b,c) {
    this.shared.A = "A";
  });

  $j('A', function() {
    T.equal(this.$.A, 'A');
  });

  $j.run('A', 'B', 'C');
}
