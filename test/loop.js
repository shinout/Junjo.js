if (typeof global != 'undefined') require('./load.test').load(global);
if (node) junjo_test();

// test start
function junjo_test() {

  var $j = new Junjo({run: true});

  $j('1st', function() {
    console.green(arguments);
    asyncMethod(this.label(), 200, this.callback);
  })
  .loop(5)
  .next(function() {
    console.yellow(arguments);
    return 1;
  })
  .next('2nd', function(n, result,count) {
    console.cyan(arguments);
    asyncMethod(this.label(), 200, this.callback);
  })
  .loop(function(args, result, count) {
    return count < 10;
  });
}
