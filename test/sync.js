if (typeof global != 'undefined') require('./load.test').load(global);
if (node) junjo_test();

function junjo_test() {
  var jj = new Junjo({ result : true });

  jj('1st', function() {
    return syncMethod(this.label);
  });

	jj.catches('1st', function(e) {
		console.log(e.message);
    this.out = "output1";
		return ["hey", "this is what I want to pass!"];
	});

  jj('2nd', function() {
		console.log("aaa", arguments);
    this.out = "output2";
	}).after('1st');

	jj.on('end', function(e, r) {
		console.log(e, r);
	});

	var result = jj.run();
  console.log("RESULT", result);
}
