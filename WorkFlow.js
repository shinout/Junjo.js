const WorkFlow = function(obj) {

  var scope = new WorkFlow.Scope();
  var tx = function() {
    return new WorkFlow.resultParam(tx, arguments);
  };

  tx.__proto__ = scope;
  return tx;
};

WorkFlow.resultParam = function(tx, args) {
  this.tx   = tx;
  this.args = args;
};

WorkFlow.resultParam.prototype.get = function() {
  var ret = this.tx;
  Array.prototype.every.call(this.args, function(v) {
    ret = ret[v];
    return (typeof ret == 'object');
  });
  return ret;
};


WorkFlow.Scope = function() {};
WorkFlow.Scope.prototype.run = function(obj) {
  var fns  = {};
  var self = this;
  Object.keys(obj).forEach(function(k) {
    var fn = self.buildFunction(obj[k], k);
    fns[k] = fn;
  });

  Object.keys(fns).forEach(function(k) {
    switch (fns[k].afters.length) {
    case 0: break;
    case 1: 
      fns[fns[k].afters[0]].callbacks.push(fns[k]);
    default:
      var f = WorkFlow.Utils.afterNTimes(fns[k].afters.length);
      fns[k].afters.forEach(function(v) {
        fns[v].callbacks.push(f);
      });
      break;
    }

    fns[k].execute();
  });
  return tx;
};

WorkFlow.Scope.prototype.buildFunction = function(arr, key) {
  var self = this;
  var fn, afters = [], params = [];
  for(var i = 0, l = arr.length; i < l; i++) {
    if (!fn) {
      if (typeof arr[i] == 'function') {
        fn = arr[i].bind(null); // copy the function
      }
      else {
        afters.push(arr[i]);
      }
    }
    else {
      params.push(arr[i]);
    }
  }
  if (!fn) throw new Error("no function given");
  params.push(function() {
    self[key] = arguments;
    fn.callbacks.forEach(function(cb) {
      cb.execute();
    });
  });
  fn.execute = WorkFlow.Utils.execute;
  fn.params = params;
  fn.afters = afters;
  fn.callbacks = [];
  return fn;
};

WorkFlow.Utils = {
  afterNTimes: function(fn, n) {
    var count = 0;
    return function() {
      count++;
      if (count == n) fn();
    };
  },

  execute: function() {
    this.params.forEach(function(v, k) {
      if (v instanceof WorkFlow.resultParam) {
        this.params[k] = v.get();
      }
    }, this);
    return this.apply(null, this.params);
  }

};

if (typeof exports == 'object' && exports === this) module.exports = WorkFlow;
