const Junjo = function(options) {
  var _ = function(fn) {
    return new Junjo.Func(fn, _);
  };

  if(_.__proto__) {
    _.__proto__ = Junjo.prototype;
  }
  else {
    Object.keys(Junjo.prototype).forEach(function(k) {
      _[k] = Junjo.prototype[k];
    });
  }
  _.fncs = {};
  _.results = {};
  _._error = false;

  Object.keys(Junjo.prototype).forEach(function(k) {
    if (typeof options[k] == 'function') {
      _[k] = options[k];
    }
  });


  return _;
};

Junjo.prototype.hasError = function() {
  return this._error;
};

Junjo.prototype.setError = function(v) {
  this._error = (v === undefined || v) ? true : false;
};

Junjo.prototype.defaultCatcher = function(e) {
  this.setError();
  console.error(e);
};

Junjo.prototype.result = function(lbl, val) {
  this.results[lbl] = val;
};

Junjo.prototype.run = function(arr) {

  var fncs = this.fncs;

  // register functions
  arr.forEach(function(wfn, k) {
    if (!wfn instanceof Junjo.Func) return;
    if (!wfn.label()) wfn.label(k);
    fncs[wfn.label()] = wfn;
  });

  // register dependencies
  arr.forEach(function(wfn, k) {
    wfn.afters.forEach(function(lbl) {
      if (!fncs[lbl]) throw new Error('label "' + lbl  + '" is not defined.');
      fncs[lbl].callbacks.push(wfn);
    }, this);

    if (wfn._catchAt && fncs[wfn._catchAt]) {
      fncs[wfn._catchAt]._isCatcher = true;
      wfn.catcher = fncs[wfn._catchAt];
    }
  });

  // execute
  arr.forEach(function(wfn, k) {
    if (!wfn.afters.length && !wfn._isCatcher) {
      wfn.execute();
    }
  }, this);
  return this;
};

Junjo.Func = function(fn, wf) {
  this.func = fn;
  this.afters = [];
  this.callbacks = [];
  this._params = [];
  this.workflow = wf;
  this.counter = 1;
  this._sync = false;
  this._catchAt = null;
  this.catcher = null;
  this._isCatcher = false;
  this.done = false;
}

Junjo.Func.prototype.async = function(v) {
  if (v === undefined) v = false;
  else v = !v;
  this._sync = v;
  return this;
};

Junjo.Func.prototype.sync = function(v) {
  if (v === undefined) v = true;
  else v = !!v;
  this._sync = v;
  return this;
};

Junjo.Func.prototype.catchAt = function(v) {
  this._catchAt = v;
  return this;
};

Junjo.Func.prototype.isCatcher = function() {
  this._isCatcher = true;
  return this;
};

Junjo.Func.prototype.scope = function(v) {
  if (v === undefined) return this._scope;
  else this._scope = v; return this;
};

Junjo.Func.prototype.label = function(v) {
  if (v === undefined) return this._label;
  else this._label = v; return this;
};

Junjo.Func.prototype.execute = function() {
  if (this.workflow.hasError() && !this._isCatcher) return;
  if (--this.counter > 0) return;
  if (this.done && !this._isCatcher) return;

  this.done = true;
  var wfn = this;

  if (wfn._sync) {
    try {
      wfn.workflow.result(wfn.label(), wfn._execute());
    }
    catch (e) {
      if (wfn.catcher) 
        wfn.catcher.params(e).execute();
      else
        wfn.workflow.defaultCatcher(e);
    }
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
    try {
      wfn._execute();
    }
    catch (e) {
      if (wfn.catcher)
        wfn.catcher.params(e).execute();
      else
        wfn.workflow.defaultCatcher(e);
    }
  }
};

Junjo.Func.prototype._execute = function() {
  return this.func.apply(this.scope(), this._params)
};


Junjo.Func.prototype.params = function() {
  Array.prototype.forEach.call(arguments, function(v) {
    this._params.push(v);
  }, this);
  return this;
};

Junjo.Func.prototype.after = function(arr) {
  this.counter = 0;
  Array.prototype.forEach.call(arguments, function(v) {
    this.counter++;
    this.afters.push(v);
  }, this);
  return this;
};

Object.getOwnPropertyNames(Function.prototype).forEach(function(k) {
  Junjo.prototype[k] = Function.prototype[k];
});

if (typeof exports == 'object' && exports === this) module.exports = Junjo;
