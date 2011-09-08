if (typeof global != 'undefined') require('./load.test').load(global);
if (node) junjo_test();

// test start
function junjo_test() {
  function asyncMethod(name, n, cb) {
    consolelog(name);
    setTimeout(function() {
      consolelog('\t' + name + ' + ' + n + ' [sec]');
			var err = (name == "2nd") ? new Error(name + ": error...") : null;
      cb(err, name);
    }, n);
  }

  var J = (node) ? require('../Junjo') : Junjo;
  var jj = new J({
    firstError : true
	});

  jj('1st', function() {
    asyncMethod(this.label(), 10, this.callback);
  });

  jj('2nd', function() {
    asyncMethod(this.label(), 20, this.callback);
  });

  jj('3rd', function() {
    asyncMethod(this.label(), 5, this.callback);
  }).after('1st');

  jj('4th', function() {
    asyncMethod(this.label(), 20, this.callback);
  }).after('2nd');

  jj('5th', function() {
    asyncMethod(this.label(), 20, this.callback);
  }).after('1st', '2nd');

  jj('6th', function() {
    syncMethod(this.label());
  }).after('4th').params();

  jj('7th', function() {
    asyncMethod(this.label(), 15, this.callback);
  }).after();

  jj('8th', function() {
    asyncMethod(this.label(), 35, this.callback);
  }).after('5th');

  jj('last', function() {
    var args = Array.prototype.map.call(arguments, function(v) {
      switch (v) {
        case undefined: return 'undefined';
        case null: return 'null';
        default: return v;
      }
    });

    consolelog(args.join(' + '));
    asyncMethod(this.label(), 35, this.callback);
  }).afterAbove();

  jj.catchesAbove(function(e, args) {
    consolelog("catch!" + e.message, this.label());
		return false;
  });

  jj.on('end', function() {
    consolelog("END");
  });

  jj.on('success', function() {
    consolelog("success");
  });

  jj.on('error', function() {
    consolelog("error end");
  });

  jj.run();
}

if (node) { junjo_test();}
