if (typeof global != 'undefined') require('./load.test').load(global);
if (node) junjo_test();

// test start
function junjo_test() {

  var $j = new Junjo({firstError: 'shift', after: true});

  $j('1st', function() {
    asyncMethod(this.label(), 50, this.callback);
    this.shared.hoge = "HogeHoge";
  });

  $j('2nd', function() {
    console.log(arguments);
    asyncMethod(this.label(), 10, this.callback);
  }).firstError();

  $j('3rd', function() {
    console.log(arguments);
    asyncMethod(this.label(), 20, this.callback, this.label());
  })
  .fail(function(e) {
    console.log("error", e);
    return Junjo.multi(e, this.label() + " with Error");
  });

  $j('4th', function() {
    console.log(arguments);
    asyncMethod(this.label(), 10, this.callback, this.label());
  })
  .fail(function(e) {
    return this.label() + " with Error";
  });

  $j('5th', function() {
    console.log(arguments);
    asyncMethod(this.label(), 10, this.callback);
  }).after();

  $j('6th', function() {
    asyncMethod(this.label(), 10, this.callback);
  }).after();

  $j('7th', function() {
    asyncMethod(this.label(), 10, this.callback);
  }).after('2nd', '3rd');

  $j.run();
}
