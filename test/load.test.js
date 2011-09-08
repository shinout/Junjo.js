var node = (typeof exports == 'object' && exports === this);

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
    }
  };
}
else {
  var require = function() { return {load: function() {}}};
}

