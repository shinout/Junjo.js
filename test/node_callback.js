var node = (typeof exports == 'object' && exports === this);

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

  const J = (node) ? require('../Junjo') : Junjo;
  var jj = new J({
    nodeCallback: true
	});

  jj.register(
    jj('1st', function() {
      asyncMethod(this.label, 10, this.callback);
    }),

    jj('2nd', function() {
      asyncMethod(this.label, 20, this.callback);
    }),

    jj('3rd', function() {
      asyncMethod(this.label, 5, this.callback);
    }).after('1st'),

    jj('4th', function() {
      asyncMethod(this.label, 20, this.callback);
    }).after('2nd'),

    jj('5th', function() {
      asyncMethod(this.label, 20, this.callback);
    }).after('1st', '2nd'),

    jj('6th', function() {
      syncMethod(this.label);
    }).after('4th').params(),

    jj('7th', function() {
      asyncMethod(this.label, 15, this.callback);
    }).after(),

    jj('8th', function() {
      asyncMethod(this.label, 35, this.callback);
    }).after('5th'),

    jj('last', function() {
      consolelog(this.args().join(' + '));
      asyncMethod(this.label, 35, this.callback);
    }).afterAbove(),

    jj('ehandler', function(e, jfn) {
      consolelog(e.message, jfn.label());
			return false;
    }).catchesAbove()
  );

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
