if (typeof global != 'undefined') require('./load.test').load(global);
if (node) junjo_test();

// test start
function junjo_test() {
  var counter1 = 0; counter2 = 0;

  var $j = new Junjo({run: Junjo.multi("hoge", "fuga")});

  $j('1st', function() {
    counter1++;
    console.green(arguments);
    asyncMethod(this.label, 200, this.callback);
  })
  .loop(5)
  .next(function() {
    console.yellow(arguments);
    return 1;
  })
  .next('2nd', function(n, result,count) {
    counter2++;
    console.cyan(arguments);
    asyncMethod(this.label, 200, this.callback);
  })
  .loop(function(result, args, count) {
    return count < 10;
  });

  $j.on('end', function() {
    T.equal(counter1, 5);
    T.equal(counter2, 10);
  });
}
