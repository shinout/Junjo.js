var node = (typeof exports == 'object' && exports === this);

var spawn = require('child_process').spawn;

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
    return name + ' (sync)';
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
  var jj = new J();
  var grep = spawn('grep', ['consolelog', "unkO"]);

  jj('1st', function() {
    this.shared.data = '';
    this.shared.err  = '';
    this.emitOn(grep.stdout, 'data', '1stdata');
    this.emitOn(grep.stderr, 'data', '1sterr');
  });

  jj.on('1stdata', function(data) {
    console.log(data.toString() + ' <-- GREPRESULT\n');
    jj.shared.data += data.toString();
  });

  jj.on('1sterr', function(data) {
    console.log(data.toString() + ' <-- GREPERROR\n');
    jj.shared.err += data.toString();
  });

  jj(function() {
    console.log(this.shared.data + ' <==== DATA');
    console.log(this.shared.err  + ' <==== ERR');
    console.log("grepresult end");
  }).after('1st');

  jj.run();
}

if (node) { junjo_test();}
