const WorkFlow = function() {
  var _ = function(fn) {
    return new WorkFlow.Func(fn, _);
  };

  _.__proto__ = WorkFlow.prototype;
  _.fncs = {};
  _.results = {};

  return _;
};

WorkFlow.prototype.result = function(lbl, val) {
  this.results[lbl] = val;
};

WorkFlow.prototype.run = function(arr) {

  var fncs = _.fncs;
  arr.forEach(function(wfn, k) {
    if (!wfn instanceof WorkFlow.Func) return;
    if (!wfn.label()) wfn.label(k);
    fncs[wfn.label()] = wfn;

    wfn.afters.forEach(function(lbl) {
      if (!fncs[lbl]) throw new Error('label "' + lbl  + '" is not defined.');
      fncs[lbl].callbacks.push(wfn);
    }, this);
  });

  arr.forEach(function(wfn, k) {
    if (!wfn.afters.length) {
      wfn.execute();
    }
  }, this);
  return this;
};

WorkFlow.Func = function(fn, wf) {
  this.func = fn;
  this.afters = [];
  this.callbacks = [];
  this._params = [];
  this.workflow = wf;
  this.counter = 1;
  this._sync = false;
  this.done = false;
}

WorkFlow.Func.prototype.async = function(v) {
  if (v === undefined) v = false;
  else v = !v;
  this._sync = v;
  return this;
};

WorkFlow.Func.prototype.sync = function(v) {
  if (v === undefined) v = true;
  else v = !!v;
  this._sync = v;
  return this;
};

WorkFlow.Func.prototype.scope = function(v) {
  if (v === undefined) return this._scope;
  else this._scope = v; return this;
};

WorkFlow.Func.prototype.label = function(v) {
  if (v === undefined) return this._label;
  else this._label = v; return this;
};

WorkFlow.Func.prototype.execute = function() {
  if (--this.counter > 0) return;
  if (this.done) return;
  this.done = true;
  var wfn = this;
  if (wfn._sync) {
    wfn.workflow.result(wfn.label(), wfn._execute());
    wfn.callbacks.forEach(function(cb_wfn) {
      cb_wfn.execute();
    });
  }
  else {
    wfn._params.push(function() {
      wfn.workflow.result(wfn.label(), arguments);
      wfn.callbacks.forEach(function(cb_wfn) {
        cb_wfn.execute();
      });
    });
    wfn._execute();
  }

};

WorkFlow.Func.prototype._execute = function() {
  return this.func.apply(this.scope(), this._params)
};


WorkFlow.Func.prototype.params = function() {
  Array.prototype.forEach.call(arguments, function(v) {
    this._params.push(v);
  }, this);
  return this;
};

WorkFlow.Func.prototype.after = function(arr) {
  this.counter = 0;
  Array.prototype.forEach.call(arguments, function(v) {
    this.counter++;
    this.afters.push(v);
  }, this);
  return this;
};

Object.getOwnPropertyNames(Function.prototype).forEach(function(k) {
  WorkFlow.prototype[k] = Function.prototype[k];
});

if (typeof exports == 'object' && exports === this) module.exports = WorkFlow;
