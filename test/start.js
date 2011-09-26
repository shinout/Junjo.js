if (typeof global != 'undefined') require('./load.test').load(global);
if (node) junjo_test();

// test start
function junjo_test() {

  var $j = new Junjo();

  $j.start(function(a,b,c) {
    this.shared.A = "A";
    this.enter('AC',a,c);
    this.enter('CB',c,b);
  });

  $j('AC', function() {
    T.equal(this.$.A, 'A');
    T.equal(arguments.length, 2);
    T.equal(arguments[0], 'A');
    T.equal(arguments[1], 'C');
  });

  $j('CB', function() {
    T.equal(arguments.length, 2);
    T.equal(arguments[0], 'C');
    T.equal(arguments[1], 'B');
  });
  $j.run('A', 'B', 'C');
}
