if (typeof global != 'undefined') require('./load.test').load(global);
if (node) junjo_test();

// test start
function junjo_test() {
  var $j = new Junjo();

  $j('1st', function() {
    syncMethod(this.label());
    this.sub('2nd', function() {
      asyncMethod(this.label(), 20, this.cb);
      this.out[this.label()] = "hoge";
    });

    this.sub('3rd', function() {
      asyncMethod(this.label(), 20, this.cb);
      this.out[this.label()] = "fuga";
    }).after();
  });

  $j('4th', function(err, out) {
    console.log(out);
  }).after('1st');



  var $j2 = new Junjo();

  $j2('BB', function() {
    syncMethod(this.label());
    this.out[this.label()] = "piyo";
  });

  $j('AA', function() {
    syncMethod(this.label());
    this.sub = $j2;
  }).next(function(err, out) {
    console.log(out);
  });

  $j.run();
}
