if (typeof global != 'undefined') require('./load.test').load(global);
if (node) junjo_test();

// test start
function junjo_test() {

  new Junjo(function() {
    setTimeout(this.callback, 1000);
  }, {run: true})
  .next(function() {
    console.log("timeout end");
  })
  .next(function() {
    console.log("syncnext");
  })
  .next(function() {
    console.log("syncnext");
  })
}
