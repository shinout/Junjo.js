if (typeof global != 'undefined') require('./load.test').load(global);
if (node) junjo_test();

// test start
function junjo_test() {
  var $j = new Junjo();

  var report = function() {
    console.log(this.label);
    if (!Array.isArray(this.out)) this.out = [];
    this.out.push(this.label);
  };

  var terminate = function() {
    this.terminate();
  };

  $j('L1', report);
  $j('L2', terminate).after();
  $j('L3', report);
  $j('L4', report).after('L1', 'L7');
  $j('L5', report).after();
  $j('L6', report).after('L3');
  $j('L7', report).after();
  $j('L8', report).after('L5');

  $j.on('end', function(err, out) {
    T.equal(out.length, 1, "length of out");
    T.equal(out[0], 'L1', "value of out");
  });
  $j.run();
}
