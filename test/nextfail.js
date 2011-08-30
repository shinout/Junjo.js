if (typeof global != 'undefined') require('./load.test').load(global);
if (node) junjo_test();

// test start
function junjo_test() {

  var $j = new Junjo();

  $j('1st', function() {
    asyncMethod(this.label(), 10, this.callback);
    this.shared.hoge = "HogeHoge";
  });

  $j.next(function() {
    console.log(arguments);
    this.out = 'hoge';
    asyncMethod(this.label(), 10, this.callback);
  })
  .next(function(err, out) {
    console.log(arguments);
    this.out = 'fuga';
  })
  .next(function(err, out) {
    console.log(arguments);
  })
  .fail(function(e, o) {
    console.log("failure");
  });

  $j.run();
}
