if (typeof global != 'undefined') require('./load.test').load(global);
if (node) junjo_test();

function asy(color, name, n, cb, e) {
  console.color(color, name);
  setTimeout(function() {
    console.color(color, '\t' + name + ' + ' + n + ' [sec]');
    cb(e || null, name);
  }, n);
}

// test start
function junjo_test() {

    var $j = new Junjo();
  $j.noTimeout();

  var $k = new Junjo();
  $k.timeout = 1;

  $k(function() {
    setTimeout(this.cb, 2000);
  })
  .fail(function(e) {
    T.fail(e, "notimeout");
  });

  $j($k);

  $j.run();
}
