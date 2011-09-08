if (typeof global != 'undefined') require('./load.test').load(global);
if (node) junjo_test();

// test start
function junjo_test() {

  var $j = new Junjo({after: true});

  $j('1st', function() {
    console.log(this.label());
    return Junjo.multi(1,22,333,4444);
  });

  $j('2nd', function() {
    console.log(this.label());
    console.log(arguments);
    throw "";
  })
  .fail(function() {
    return Junjo.multi(55,66,777);
  })
  .next('3rd', function() {
    console.log(this.label());
    console.log(arguments);
  })
  .next('4th', function() {
    console.log(this.label());
    $j.skip('4th2', 88,999);
  })
  .next('4th2', function() {
    console.log(this.label());
  })
  .next('5th', function() {
    console.log(arguments);
    return Junjo.multi(1,2,3,4);
  })
  .firstError(true)
  .fail(function(e, args) {
    return Junjo.multi(5,6,7,8);
  })
  .next('6th', function() {
    console.log(arguments);
  })

  $j.run();
}
