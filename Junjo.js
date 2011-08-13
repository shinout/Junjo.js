/**
 * constructor 
 *
 * @param (Object) options :
 *  (function) defaultCatcher : default catcher (called when errors are thrown in a series of processes)
 *
 **/
const Junjo = function(options) {
  options = options || {};
  var fJunjo = function() {
    var label = (typeof arguments[0] != 'function')
       ? Array.prototype.shift.call(arguments)
       : undefined;

    var jfn = new Junjo.Func(arguments[0], fJunjo);
    if (label !== undefined) jfn.label(label);
    return jfn;
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

  if (typeof options.onEnd == "function") fJunjo.onEnd(options.onEnd);

  if (typeof options.onSuccessEnd == "function") fJunjo.onSuccessEnd(options.onSuccessEnd);

  if (typeof options.onErrorEnd == "function") fJunjo.onErrorEnd(options.onErrorEnd);

  if (typeof options.after == "object" && options.after._successEnds instanceof Array) {
    fJunjo._runnable = false;
    options.after._successEnds.push(function() {
      fJunjo._runnable = true;
      fJunjo.run();
    });
  }
  delete options.onEnd, options.onSuccessEnd, options.onErrorEnd;

  Object.keys(Junjo.prototype).forEach(function(k) {
    if (typeof options[k] == 'function') {
      fJunjo[k] = options[k];
    }
  });

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
  console.error(e.stack || e.message || e);
};

/**
 * set eventListener
 */
Junjo.prototype.on = function(evtname, fn) {
  switch (evtname.toLowerCase()) {
  case 'end': 
    this.onEnd(fn);
    break;

  case 'error': 
  case 'errorend': 
    this.errorEnd(fn);
    break;

  case 'success': 
  case 'successend': 
    this.onSuccessEnd(fn);
    break;
  }
};

Junjo.prototype.onEnd = function(fn) { this._ends.push(fn); };
Junjo.prototype.onErrorEnd = function(fn) { this._errorEnds.push(fn); };
Junjo.prototype.onSuccessEnd = function(fn) { this._successEnds.push(fn); };

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

  var prev_lbl;
  arr.forEach(function(jfn, k) {
    if (!jfn.label()) jfn._label = k;
    fncs[jfn.label()] = jfn;
    if (!jfn._isCatcher) this._funcs_count++; 
    if (jfn._after_prev && prev_lbl) {
      jfn._after_prev = false;
      jfn._afters.push(prev_lbl);
    }
    prev_lbl = jfn._label;
  }, this);

  if (arr.length != Object.keys(fncs).length) {
    throw new Error('there are duplicated label settings.');
  }

  // register dependencies
  arr.forEach(function(jfn, k) {
    jfn._afters.forEach(function(lbl) {
      if (!fncs[lbl]) throw new Error('label "' + lbl  + '" is not defined.');
      fncs[lbl]._callbacks.push(jfn);
    }, this);

    if (jfn._catchAt && fncs[jfn._catchAt]) {
      if (!fncs[jfn._catchAt]._isCatcher) {
        fncs[jfn._catchAt].isCatcher();
        this._funcs_count--;
      }
    }
  }, this);

  this._entries = arr.filter(function(jfn) {
    return (!jfn._afters.length && !jfn._isCatcher);
  }).map(function(jfn) {
    return jfn.label();
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

// callback flag
Junjo.Callback = function(){};
Object.defineProperty(Junjo, 'callback', {
  value : new Junjo.Callback(),
  writable: false
});

// private functions 
Junjo.privates = {};

Junjo.privates.raiseError = function(e, jfn) {
  this._finished++;
  if (jfn._catchAt && this._fncs[jfn._catchAt]) {
    var catcher = this._fncs[jfn._catchAt];
    catcher._params = [e, jfn];
    catcher.execute();
  }
  else {
    this.defaultCatcher(e, jfn);
  }

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

Junjo.Func = function(fn, junjo) {
  var self = this;
  this._callback = function() {
    var args = arguments;
    if (!self._done || self._cb_called) return;
    self._cb_called = true;
    if (self._error) {
      Junjo.privates.raiseError.call(self._junjo, arguments[0], self);
      return;
    }

    Junjo.privates.result.call(self._junjo, self.label(), 
      (self._cb_accessed) ? args : args[0]
    );

    self._callbacks.forEach(function(cb_jfn) {
      cb_jfn.execute.apply(cb_jfn, args);
    });
  };

  this._func        = fn;
  this._afters      = [];
  this._after_prev  = false;
  this._callbacks   = [];
  this._scope       = null;  // "this" scope to execute. if empty, the instance of Junjo.Func is set.
  this._params      = [];    // parameters to be given to the function. if empty, original callback arguments is used.
  this._junjo       = junjo; // instanceof Junjo
  this._counter     = 1;     // until 0, decremented per each call, then execution starts.
  this._catchAt     = null;  // the name of catcher 
  this._isCatcher   = false; // is catcher or not
  this._called      = false; // execution started or not
  this._done        = false; // execution ended or not
  this._error       = false; // error occurred or not
  this._cb_accessed = false; // whether callback is accessed via "this.callback", this means asynchronous.
  this._cb_called   = false; // whether callback is called or not

  Object.defineProperty(this, 'callback', {
    get: function() {
      this._cb_accessed = true;
      return this._callback;
    },
    set: function() { }
  });
};

Junjo.Func.prototype.scope = function(scope) {
	this._scope = scope || this;
	return this;
};

Junjo.Func.prototype.bind = function() {
  this.scope(Array.prototype.shift.call(arguments));
	return this.params.apply(this, arguments);
};

Junjo.Func.prototype.params = function() {
  Array.prototype.forEach.call(arguments, function(v) {
    this._params.push(v);
  }, this);
  return this;
};

Junjo.Func.prototype.after = function() {
  if (arguments.length == 0) {
    this._after_prev = true;
    return this;
  }
  else {
    this._after_prev = false;
  }

  this._counter = 0;
  Array.prototype.forEach.call(arguments, function(v) {
    this._counter++;
    this._afters.push(v);
  }, this);
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
  else {
    if (! isNaN(Number(v))) {
      throw new Error('cannot set number labels, because Junjo.js sets number labels to functions with no custom labels.');
    }
    this._label = v; return this;
  }
};

Junjo.Func.prototype.execute = function() {
  if (this._junjo._error && !this._isCatcher) return;
  if (--this._counter > 0) return;
  if (this._called && !this._isCatcher) return;
  this._called = true;
  var scope = this._scope || this;

	var len = this._params.length;
	if (len && this._params[len-1] === Junjo.callback) {
		this._params[len-1] = this.callback;
	}

  try {
    var ret = this._func.apply(scope, (len) ? this._params : arguments)
    this._done = true;
    if (!this._cb_accessed) { // synchronous
      this._callback(ret);
    }
  }
  catch (e) {
    this._done = true;
    this._error = true;
    this._callback(e); // called when this callback was not called.
  }
};

Object.getOwnPropertyNames(Function.prototype).forEach(function(k) {
  Junjo.prototype[k] = Function.prototype[k];
});

if (typeof exports == 'object' && exports === this) module.exports = Junjo;
