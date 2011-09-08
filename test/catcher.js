if (typeof global != 'undefined') require('./load.test').load(global);
if (node) junjo_test();

function junjo_test() {
  var jj = new Junjo({
    timeout: 2
  });
	jj.run(

  jj('1st', function() {
    throw new Error(this.label() + " Error.");
    asyncMethod(this.label(), 10, this.callback);
  }),

  jj('2nd', function() {
    throw new Error(this.label() + " Error.");
    asyncMethod(this.label(), 20, this.callback);
  }),

  jj('c1', function(e, args) {
    console.log("CATCHING", this.label());
    return true;
  }).catchesAbove(),

  jj('3rd', function() {
    asyncMethod(this.label(), 5, this.callback);
  }).after('1st'),

  jj('4th', function() {
    asyncMethod(this.label(), 20, this.callback);
  }).after('2nd'),

  jj('5th', function() {
    asyncMethod(this.label(), 20, this.callback);
    jj.terminate();
  }).after('1st', '2nd'),

  jj('6th', function() {
    syncMethod(this.label());
  }).after('4th').params(),

  jj('7th', function() {
    asyncMethod(this.label(), 15, this.callback);
  }).after(),

  jj('8th', function() {
    asyncMethod(this.label(), 35, this.callback);
  }).after('5th'),

  jj('last', function() {
    var args = Array.prototype.map.call(arguments, function(v) {
      switch (v) {
        case undefined: return 'undefined';
        case null: return 'null';
        default: return v;
      }
    });
    consolelog(args.join(' + '));

  }).afterAbove(),

  jj.on('end', function(e, r) {
    consolelog("END", e, r);
  })
	);
}
