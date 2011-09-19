if (typeof global != 'undefined') require('./load.test').load(global);
if (node) junjo_test();

function junjo_test() {
  var $j = new Junjo();
  $j.shared.p = 'preset';

  $j('1st', function(v) {
    console.log(v);
    T.deepEqual(this.$.p, v, "shared value");
  })
  .params($j.future.shared('p'));

  $j(function() {
    return Junjo.multi("a", "b", "c");
  })
  .next('2nd', function(v) {
    T.deepEqual(v, $j.results(1));
    return this.label;
  })
  .params($j.future.results(1))
  .after();

  $j('3rd', function(v, a, b) {
    T.equal(v.length, 4, "arguments length");
    T.equal(a, "a");
    T.equal(b, "b");
  })
  .params($j.future.args, $j.future.args(0), $j.future.args(1))
  .after(1, '2nd');

  $j('4th', function(lbl, n, cb) {
    T.equal(lbl, this.label);
    T.equal(n, 10);
    asyncMethod.apply(null, arguments);
  })
  .params($j.future.label, 10, $j.future.cb)
  .after('3rd');

  $j.run();
}
