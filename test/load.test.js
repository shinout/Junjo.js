var node = (typeof exports == 'object' && exports === this);
if (node) { require('../lib/termcolor').define() }

var assert = (node) ? require('assert') : {};
var T = {};

[ 'equal', 'ok', 'fail', 'notEqual', 'deepEqual', 'notDeepEqual', 'strictEqual', 'notStrictEqual']
.forEach(function(fname) {
  T[fname] = (function(n) {
    return function() {
      try {
        var name = Array.prototype.pop.call(arguments);
        assert[n].apply(assert, arguments);
        console.green('[OK]', n, name);
      }
      catch (e) {
        console.red('[NG]', n, name);
        console.blue(e.stack);
      }
    }
  })(fname);
});

function asyncMethod(name, n, cb, e) {
  consolelog(name);
  setTimeout(function() {
    consolelog('\t' + name + ' + ' + n + ' [sec]');
    cb(e || null, name);
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

if (node) {
  module.exports = {
    load: function(that) {
      that.asyncMethod = asyncMethod;
      that.node = true;
      that.syncMethod = syncMethod;
      that.consolelog = consolelog;
      that.Junjo = require('../Junjo');
      that.T = T;
    }
  };
}
else {
  var require = function() { return {load: function() {}}};
}

