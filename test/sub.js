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

  $j('last', function(err, out) {
    console.log(out);
  }).after();

  $j.run();
}
