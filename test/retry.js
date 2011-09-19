if (typeof global != 'undefined') require('./load.test').load(global);
if (node) junjo_test();

// test start
function junjo_test() {
  var counter = 0;

  var $j = new Junjo({run: 1});

  $j('1st', function(N) {
    if (!this.$.N) this.$.N = 1;
    var n = Math.random() * N;
    console[n < 30 ? 'red' : 'green'](N, n);
    if (n < 30) throw new Error("smalllllllll!");
    return n;
  })
  .retry(60, function(e, args, count) {
    T.deepEqual(this.sub, null, "sub in retry");
    T.deepEqual(this.callback, null, "callback in retry");
    T.deepEqual(this.callbacks(), null, "callbacks in retry");
    T.deepEqual(this.absorb(), null, "absorb in retry");
    T.deepEqual(this.absorbData(), null, "absorbData in retry");
    T.deepEqual(this.absorbEnd(), null, "absorbEnd in retry");
    T.equal(args[0], this.$.N, "args");
    T.equal(count, ++counter, "count");
    return ++this.$.N;
  })
  .next(function(N) {
    console.log(N);
  })
}
