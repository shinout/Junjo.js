if (typeof global != 'undefined') require('./load.test').load(global);
if (node) junjo_test();

function junjo_test() {
  var jj = new Junjo({ timeout: 2 });

  jj('1st', function() {
    return syncMethod(this.label(), 10, this.callback);
  });

	jj.catches('1st', function(e) {
		console.log(e.message);
		return ["hey", "this is what I want to pass!"];
	});

  jj('2nd', function() {
		console.log("aaa", arguments);
	}).after('1st');

	jj.on('end', function(e, r) {
		console.log(e, r);
	});

	jj.run();
}
