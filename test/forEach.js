if (typeof global != 'undefined') require('./load.test').load(global);
if (node) junjo_test();

// test start
function junjo_test() {

  var $j = new Junjo();

  $j("array", function() {
    var ret = [];
    for (var i=0; i<1000; i++) {
      ret.push(Math.random());
    }
    return ret;
  });

  $j('foreach', function(arr) {
    this.forEach(arr, function(v, k) {
      showAsync(v, this.callbacks());
    });
  })
  .reduce(function(result, v, k) {
    if (k == 0) {
      T.equal(v.length, 0);
    }
    return result + k;
  }, 0)
  .after("array");

  $j('afterIterate', function(v) {
    T.equal(v, 500500);
  })
  .after("foreach");

  $j.run();
}

function showAsync(v, cb) {
  setTimeout(function() {
    cb(v);
  }, 5);
}
