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
  var jj = new J({
    timeout: 2
  });

  jj('1st', function() {
    throw new Error(this.label + " Error.");
    asyncMethod(this.label, 10, this.callback);
  });

  jj('2nd', function() {
    throw new Error(this.label + " Error.");
    asyncMethod(this.label, 20, this.callback);
  });

  jj.catchesAbove(function(e, jfn) {
    console.log(e.message + " (catchesAbove)");
    return true;
  });

  jj('3rd', function() {
    throw new Error(this.label + " Error.");
  }).after('1st', '2nd');

  jj.catches('3rd', function(e) {
    console.log(e.message + ' (with label)');
    return true;
  });

  jj('4th', function() {
    throw new Error(this.label + " Error.");
  }).after('2nd', '3rd');

  jj.catches(function(e) {
    console.log(e.message + ' (with no label)');
    return true;
  });

  jj('5th', function() {
    asyncMethod(this.label, 20, this.callback);
    jj.terminate();
  }).after('4th');

  jj('6th', function() {
    syncMethod(this.label);
  }).after('4th').params();

  jj('7th', function() {
    asyncMethod(this.label, 15, this.callback);
  }).after();

  jj('8th', function() {
    asyncMethod(this.label, 35, this.callback);
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
    asyncMethod(this.label, 35, this.callback);
  }).afterAbove();

  jj.on('end', function(e, r) {
    consolelog("END", e, r);
  });

  jj.on('terminate', function(e, r) {
    consolelog("terminated!!!!", e, r);
  });

  jj.run();
}

if (node) { junjo_test();}
