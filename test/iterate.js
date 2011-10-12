if (typeof global != 'undefined') require('./load.test').load(global);
if (node) junjo_test();

// test start
function junjo_test() {

  var $j = new Junjo();

  $j("array", function() {
    var ret = [];
    for (var i=0; i<100; i++) {
      ret.push(Math.random());
    }
    return ret;
  });

  $j('iterate', function(arr) {
    this.iterate(arr, function(v, k) {
      showAsync(v, this.callbacks(k));
    });
  })
  .after("array");

  $j.run();
}

function showAsync(v, cb) {
  asyncMethod(v, 10, function() {
    cb(v);
  });
}
