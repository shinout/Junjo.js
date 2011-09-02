if (typeof global != 'undefined') require('./load.test').load(global);
if (node) junjo_test();

// test start
function junjo_test() {

  var $j = new Junjo({after: true});

  $j('1st', function() {
    asyncMethod(this.label(), 50, this.callback);
    this.shared.hoge = "HogeHoge";
  });

  $j('2nd', function() {
    asyncMethod(this.label(), 10, this.callback);
  });

  $j('3rd', function() {
    asyncMethod(this.label(), 20, this.callback);
  });

  $j('4th', function() {
    asyncMethod(this.label(), 10, this.callback);
  });

  $j('5th', function() {
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
