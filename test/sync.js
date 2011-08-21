var node = (typeof exports == 'object' && exports === this);

// test start
function junjo_test() {
  function asyncMethod(name, n, cb) {
    consolelog(name);
    setTimeout(function() {
      consolelog('\t' + name + ' + ' + n + ' [sec]');
      cb(null, name);
    }, n);
  }

  function syncMethod(name) {
    consolelog(name);
    consolelog('\t' + name + ' (sync)');
  }
 
  function consolelog() {
    if (node) {
      console.log.apply(this, arguments);
    }
    else {
      Array.prototype.forEach.call(arguments, function(v) {
        console.log(v);
        var el = document.createElement('li');
        el.innerHTML = v.toString();
        document.getElementById('test').appendChild(el);
      });
    }
  }

  var J = (node) ? require('../Junjo') : Junjo;
  var jj = new J({ timeout: 2 });

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

if (node) { junjo_test();}
