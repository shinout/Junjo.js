const Junjo = function(options) {
  options = options || {};
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
  _.fncs        = {};
  _.results     = {};
  _._error      = false;
  _.funcs_count = 0; // the number of registered functions without catchers.
  _.finished    = 0;
  _.succeeded   = 0;
  _.registered  = false;
  _.arr         = [];
  _.ends        = [];
  _.successEnds = [];
  _.errorEnds   = [];
  _.runnable    = true;

  Object.keys(Junjo.prototype).forEach(function(k) {
    if (typeof options[k] == 'function') {
      _[k] = options[k];
    }
  });

  if (typeof options.onEnd == "function") {
    _.ends.push(options.onEnd);
  }

  if (typeof options.onSuccessEnd == "function") {
    _.successEnds.push(options.onSuccessEnd);
  }

  if (typeof options.onErrorEnd == "function") {
    _.errorEnds.push(options.onErrorEnd);
  }

  if (typeof options.after == "object" && options.after.successEnds instanceof Array) {
    _.runnable = false;
    options.after.successEnds.push(function() {
      _.runnable = true;
      _.run();
    });
  }

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

Junjo.prototype.raiseError = function(e, catcher) {
  this.finished++;
  if (catcher) 
    catcher.params(e).execute();
  else
    this.defaultCatcher(e);

  this.endIfFinished();
  if (this.hasError()) {
    this.errorEnds.forEach(function(fn) {
      fn.call(this);
    }, this);
  }
};

Junjo.prototype.result = function(lbl, val) {
  this.finished++;
  this.succeeded++;
  console.log(this.succeeded);
  this.results[lbl] = val;

  this.endIfFinished();
  if (this.succeeded == this.funcs_count) {
    this.successEnds.forEach(function(fn) {
      fn.call(this);
    }, this);
  }
};

Junjo.prototype.endIfFinished = function() {
  if (this.finished == this.funcs_count) {
    this.ends.forEach(function(fn) {
      fn.call(this);
    }, this);
  }
};

Junjo.prototype.register = function(arr) {
  if (! (arr instanceof Array)) {
    arr = Array.prototype.map.call(arguments, function(v) { return v; });
  }

  var fncs = this.fncs;

  // register functions
  arr.forEach(function(wfn, k) {
    if (!wfn instanceof Junjo.Func) return;
    if (!wfn.label()) wfn.label(k);
    fncs[wfn.label()] = wfn;
    if (!wfn._isCatcher) this.funcs_count++; 
  }, this);

  // register dependencies
  arr.forEach(function(wfn, k) {
    wfn.afters.forEach(function(lbl) {
      if (!fncs[lbl]) throw new Error('label "' + lbl  + '" is not defined.');
      fncs[lbl].callbacks.push(wfn);
    }, this);

    if (wfn._catchAt && fncs[wfn._catchAt]) {
      if (!fncs[wfn._catchAt]._isCatcher) {
        fncs[wfn._catchAt].isCatcher();
        this.funcs_count--;
      }
      wfn.catcher = fncs[wfn._catchAt];
    }
  }, this);
  this.arr = arr;
  this.registered = true;
  return this;
};

Junjo.prototype.run = function() {
  if (!this.registered) {
    this.register.apply(this, arguments);
  }

  if (!this.runnable) return this;

  // execute
  this.arr.forEach(function(wfn, k) {
    if (!wfn.afters.length && !wfn._isCatcher) {
      wfn.execute();
    }
  }, this);
  return this;
};

Junjo.Func = function(fn, wf) {
  this.func       = fn;
  this.afters     = [];
  this.callbacks  = [];
  this._params    = [];
  this.workflow   = wf;
  this.counter    = 1;
  this._sync      = false;
  this._catchAt   = null;
  this.catcher    = null;
  this._isCatcher = false;
  this.done       = false;
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
  this._sync = true; // catcher must always be synchronous.
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
      wfn.workflow.raiseError(e, wfn.catcher);
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
      wfn.workflow.raiseError(e, wfn.catcher);
      wfn.callbacks.forEach(function(cb_wfn) {
        cb_wfn.execute();
      });
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
