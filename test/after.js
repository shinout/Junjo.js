if (typeof global != 'undefined') require('./load.test').load(global);
if (node) junjo_test();

// test start
function junjo_test() {

  var j1 = new Junjo();

  j1('1st', function() {
    asyncMethod(this.label(), 10, this.callback);
    this.shared.hoge = "HogeHoge";
  });

  j1('2nd', function(err, val) {
    this.out = 'val=' + val + '&hoge=' + this.shared.hoge + '&val2=' + this.label();
  }).after();

  var j2 = new Junjo().after(j1);
  
  j2('3rd', function(err, val) {
    return val + ' (from j1), ' + this.label();
  });

  j2('4th', function(val) {
    this.out = val + ' and ' + this.label();
  }).after();

  j2.on('end', function(err, val) {
    console.log(err, val);
  });

  j1.run(); // j2 runs too.
}
