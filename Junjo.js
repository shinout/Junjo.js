/**
 * constructor 
 *
 * @param (Object) options :
 *  (function) defaultCatcher : default catcher (called when errors are thrown in a series of processes)
 *
 **/
const Junjo = function(options) {
  options = options || {};
  var fJunjo = function(fn) {
    return new Junjo.Func(fn, fJunjo);
  };

  if(fJunjo.__proto__) {
    fJunjo.__proto__ = Junjo.prototype;
  }
  else {
    Object.keys(Junjo.prototype).forEach(function(k) {
      _[k] = Junjo.prototype[k];
    });
  }

  /** private values **/
  fJunjo._fncs        = {};
  fJunjo._entries     = {};
  fJunjo._results     = {};
  fJunjo._error       = false;
  fJunjo._funcs_count = 0; // the number of registered functions without catchers.
  fJunjo._finished    = 0;
  fJunjo._succeeded   = 0;
  fJunjo._registered  = false;
  fJunjo._ends        = [];
  fJunjo._successEnds = [];
  fJunjo._errorEnds   = [];
  fJunjo._runnable    = true;

  Object.keys(Junjo.prototype).forEach(function(k) {
    if (typeof options[k] == 'function') {
      fJunjo[k] = options[k];
    }
  });

  if (typeof options.onEnd == "function") {
    fJunjo._ends.push(options.onEnd);
  }

  if (typeof options.onSuccessEnd == "function") {
    fJunjo._successEnds.push(options.onSuccessEnd);
  }

  if (typeof options.onErrorEnd == "function") {
    fJunjo._errorEnds.push(options.onErrorEnd);
  }

  if (typeof options.after == "object" && options.after._successEnds instanceof Array) {
    fJunjo._runnable = false;
    options.after._successEnds.push(function() {
      fJunjo._runnable = true;
      fJunjo.run();
    });
  }

  Object.seal(fJunjo);

  return fJunjo;
};

/** public functions **/

/**
 * finish a series of processes, and onErrorEnd hooks will be executed.
 *
 * call it in catcher functions
 */
Junjo.prototype.terminate = function(v) {
  this._error = (v === undefined || v) ? true : false;
};

/**
 * default catcher.
 *
 * you can change it by giving "defaultCatcher" options in constructer like :
 *  new Junjo({defaultCatcher: function(e) {
 *    console.log("custom default catcher");
 *    this.terminte();
 *  });
 */
Junjo.prototype.defaultCatcher = function(e) {
  this.terminate();
  console.error(e);
};

/**
 * get result of each process. 
 * 
 * @param lbl : label of processes, if it is not given, an object which contains all results is returned.
 */
Junjo.prototype.results = function(lbl) {
  if (lbl == undefined) return this._results;
  return this._results[lbl];
};

/**
 * register a series of processes.
 *
 * @param (Array<Junjo.Func>) arr 
 *  or you can give arguments like
 *  var junjo = new Junjo();
 *  junjo.register(a, b, c);
 *  instead of junjo.register([a, b, c]);
 *
 */
Junjo.prototype.register = function(arr) {
  if (! (arr instanceof Array)) {
    arr = Array.prototype.map.call(arguments, function(v) { return v; });
  }

  var fncs = this._fncs;

  // register functions
  arr = arr.filter(function(v) {
    return (v instanceof Junjo.Func);
  });

  arr.forEach(function(wfn, k) {
    if (!wfn.label()) wfn._label = k;
    fncs[wfn.label()] = wfn;
    if (!wfn._isCatcher) this._funcs_count++; 
  }, this);

  if (arr.length != Object.keys(fncs).length) {
    throw new Error('there are duplicated label settings.');
  }

  // register dependencies
  arr.forEach(function(wfn, k) {
    wfn.afters.forEach(function(lbl) {
      if (!fncs[lbl]) throw new Error('label "' + lbl  + '" is not defined.');
      fncs[lbl].callbacks.push(wfn);
    }, this);

    if (wfn._catchAt && fncs[wfn._catchAt]) {
      if (!fncs[wfn._catchAt]._isCatcher) {
        fncs[wfn._catchAt].isCatcher();
        this._funcs_count--;
      }
      wfn.catcher = fncs[wfn._catchAt];
    }
  }, this);

  this._entries = arr.filter(function(wfn) {
    return (!wfn.afters.length && !wfn._isCatcher);
  }).map(function(wfn) {
    return wfn.label();
  });

  this._registered = true;
  return this;
};

Junjo.prototype.run = function() {
  if (!this._registered) {
    this.register.apply(this, arguments);
  }

  if (!this._runnable) return this;

  // execute
  this._entries.forEach(function(lbl) {
    this._fncs[lbl].execute();
  }, this);
  return this;
};



// private functions 
Junjo.privates = {};

Junjo.privates.raiseError = function(e, catcher) {
  this._finished++;
  if (catcher) 
    catcher.params(e).execute();
  else
    this.defaultCatcher(e);

  Junjo.privates.endIfFinished.call(this);
  if (this._error) {
    this._errorEnds.forEach(function(fn) {
      fn.call(this);
    }, this);
  }
};


Junjo.privates.result = function(lbl, val) {
  this._finished++;
  this._succeeded++;
  this._results[lbl] = val;

  Junjo.privates.endIfFinished.call(this);
  if (this._succeeded == this._funcs_count) {
    this._successEnds.forEach(function(fn) {
      fn.call(this);
    }, this);
  }
};

Junjo.privates.endIfFinished = function() {
  if (this._finished == this._funcs_count) {
    this._ends.forEach(function(fn) {
      fn.call(this);
    }, this);
  }
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
  else {
    if (! isNaN(Number(v))) {
      throw new Error('cannot set number labels, because Junjo.js sets number labels to functions with no custom labels.');
    }
    this._label = v; return this;
  }
};

Junjo.Func.prototype.execute = function() {
  if (this.workflow._error && !this._isCatcher) return;
  if (--this.counter > 0) return;
  if (this.done && !this._isCatcher) return;

  this.done = true;
  var wfn = this;

  if (wfn._sync) {
    try {
      Junjo.privates.result.call(wfn.workflow, wfn.label(), wfn._execute());
    }
    catch (e) {
      Junjo.privates.raiseError.call(wfn.workflow, e, wfn.catcher);
    }
    wfn.callbacks.forEach(function(cb_wfn) {
      cb_wfn.execute();
    });
  }
  else {
    wfn._params.push(function() {
      Junjo.privates.result.call(wfn.workflow, wfn.label(), arguments);
      wfn.callbacks.forEach(function(cb_wfn) {
        cb_wfn.execute();
      });
    });
    try {
      wfn._execute();
    }
    catch (e) {
      Junjo.privates.raiseError.call(wfn.workflow, e, wfn.catcher);
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
