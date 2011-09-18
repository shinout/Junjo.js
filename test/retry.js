if (typeof global != 'undefined') require('./load.test').load(global);
if (node) junjo_test();

// test start
function junjo_test() {

  var $j = new Junjo({run: 1});

  $j('1st', function(N) {
    if (!this.$.N) this.$.N = 1;
    var n = Math.random() * N;
    console[n < 30 ? 'red' : 'green'](N, n);
    if (n < 30) throw new Error("smalllllllll!");
    return n;
  })
  .retry(-1, null, true)
  .retry(60, function(args, e, count) {
    console.log(count);
    return ++this.$.N;
  })
  .next(function(N) {
    console.log(N);
  })
}
