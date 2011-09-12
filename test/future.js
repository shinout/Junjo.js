if (typeof global != 'undefined') require('./load.test').load(global);
if (node) junjo_test();

function junjo_test() {
  var $j = new Junjo();
  $j.shared.p = 'preset';

  $j('1st', console.green)
  .params($j.future.shared('p'));

  $j(function() {
    return Junjo.multi("a", "b", "c");
  })
  .next('2nd', console.cyan)
  .params($j.future.results(1))
  .after();

  $j('3rd', console.green)
  .params($j.future.args, $j.future.args(0), $j.future.args(1))
  .after(1, '2nd');

  $j('4th', asyncMethod)
  .params($j.future.label, 10, $j.future.cb)
  .after('3rd');

  $j.run();
}
