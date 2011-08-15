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
  fJunjo._out         = null;
  fJunjo._err         = null;
  fJunjo._terminated  = false;
  fJunjo._funcs_count = 0; // the number of registered functions without catchers.
  fJunjo._finished    = 0;
  fJunjo._succeeded   = 0;
  fJunjo._registered  = false;
  fJunjo._ends        = [];
  fJunjo._successEnds = [];
  fJunjo._errorEnds   = [];
  fJunjo._runnable    = true;
  fJunjo._timeout     = 5;
  fJunjo._node_cb     = false;

  if (typeof options.timeout == "number") fJunjo._timeout = options.timeout;

  if (typeof options.nodeCallback == "boolean") fJunjo._node_cb = options.nodeCallback;

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
Junjo.prototype.terminate = function() {
  this._terminated = true;
};

/**
 * default catcher.
 *
 * you can change it by giving "defaultCatcher" options in constructer like :
 *  new Junjo({defaultCatcher: function(e) {
 *    console.log("custom default catcher");
 *    this.terminate();
 *  });
 */
Junjo.prototype.defaultCatcher = function(e) {
  console.error(e.stack || e.message || e);
  this.terminate();
  return false;
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
    this.onErrorEnd(fn);
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

  var prev_lbl, a_aboves = [], c_aboves = [];
  arr.forEach(function(jfn, k) {
    if (!jfn.label()) jfn._label = k;
    fncs[jfn.label()] = jfn;
    if (!jfn.isCatcher()) this._funcs_count++; 

    if (jfn._after_above) {
      a_aboves.forEach(function(lbl) {
        jfn.after(lbl);
      });
      a_aboves = [];
    }
    else if (jfn._after_prev && prev_lbl != undefined) {
      jfn.after(prev_lbl);
    }

    if (jfn._catch_above) {
      c_aboves.forEach(function(lbl) {
        jfn.catches(lbl);
      });
      c_aboves = [];
    }
    else if (jfn._catch_prev && prev_lbl != undefined) {
      jfn.catches(prev_lbl);
    }

    a_aboves.push(jfn.label());
    c_aboves.push(jfn.label());
    prev_lbl = jfn._label;
  }, this);

  if (arr.length != Object.keys(fncs).length) {
    throw new Error('there are duplicated label settings.');
  }

  // register dependencies
  arr.forEach(function(jfn, k) {
    jfn._afters.forEach(function(lbl) {
      if (!fncs[lbl]) throw new Error('label "' + lbl  + '" is not defined.');
      if (fncs[lbl].isCatcher()) return; // TODO throw an error
      jfn._counter++;
      fncs[lbl]._callbacks.push(jfn);
    });

    jfn._catches.forEach(function(lbl) {
      if (!fncs[lbl]) throw new Error('label "' + lbl  + '" is not defined.');
      if (fncs[lbl].isCatcher()) return; // TODO throw an error
      if (!fncs[lbl]._catcher) fncs[lbl]._catcher = jfn;
    });
  });

  this._entries = arr.filter(function(jfn) {
    return (!jfn._afters.length && !jfn.isCatcher());
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

Junjo.prototype.out = function(v) {
	if (v === undefined) return this._out;
	this._out = v;
	return this;
};

Junjo.prototype.err = function(v) {
	if (v === undefined) return this._err;
	this._err = v;
	return this;
};

// private functions 
Junjo.privates = {};

Junjo.privates.finished = function(jfn) {
  this._finished++;

  if (this._finished == this._funcs_count) {
		var err = this._err || (this._succeeded != this._funcs_count) ? true : null;
    this._ends.forEach(function(fn) {
      fn.call(this, err, this._out);
    }, this);
  }

  if (this._succeeded == this._funcs_count) {
    this._successEnds.forEach(function(fn) {
      fn.call(this, this._out);
    }, this);
  }
};

Junjo.privates.onTerminate = function() {
  var self = this;
  var bool = Object.keys(self._fncs).every(function(lbl) {
    var jfn = self._fncs[lbl];
    return jfn._cb_called || jfn._cb_accessed == jfn._cb_called
  });
  if (!bool) return;

  self._errorEnds.forEach(function(fn) {
    fn.call(self, self._err || true, self._out);
  }, self);
};

Junjo.privates.result = function(lbl, val) {
  this._succeeded++;
  this._results[lbl] = val;
  return true;
};


Junjo.KeyPath = function(arr) {
  if (! (arr instanceof Array)) 
    arr = Array.prototype.map.call(arguments, function(v) { return v;});
  Object.defineProperty(this, 'keypath', { value :arr, writable: false });
};

Junjo.KeyPath.prototype.get = function(obj) {
  return this.keypath.reduce(function(o, k) {
    if (o == null || (typeof o != 'object' && o[k] == null)) return null;
    return o[k];
  }, obj);
};

Object.defineProperty(Junjo, 'callback', {
  value : new Junjo.KeyPath('callback'),
  writable: false
});

Junjo.results = function(lbl) {
  if (!lbl) return;
  var arr = Array.prototype.map.call(arguments, function(v) { return v;});
  arr.unshift('_junjo', '_results');
  return new Junjo.KeyPath(arr);
};

Junjo.args = function(i) {
  var iInt = parseInt(i);
  if (isNaN(iInt) || i == null) return;
  var arr = Array.prototype.map.call(arguments, function(v) { return v;});
  arr.unshift('_args');
  return new Junjo.KeyPath(arr);
};

/***
 * Junjo.Func
 * function wrapper
 **/
Junjo.Func = function(fn, junjo) {
  this._func        = fn;             // registered function
  this._junjo       = junjo;          // instanceof Junjo
  this._callbacks   = [];             // callback functions
  this._args        = [];             // arguments passed from each dependent functions
  this._afters      = [];             // labels of functions executed before this function
  this._after_prev  = false;          // if true, executed after the previously registered function
  this._after_above = false;          // if true, executed after all the registered function above.
  this._params      = [];             // parameters to be given to the function. if empty, original callback arguments is used.
  this._scope       = null;           // "this" scope to execute. if empty, the instance of Junjo.Func is set.
  this._catcher     = null;           // execute when the function throws an error.
  this._catches     = [];             // Array of labels. If the function with the label throws an error, this function will rescue().
  this._catch_prev  = false;          // catches previous function or not.
  this._catch_above = false;          // catches all functions registered before.
  this._timeout_id  = null;           // id of timeout checking function
  this._counter     = 0;              // until 0, decremented per each call, then execution starts.
  this._called      = false;          // execution started or not
  this._done        = false;          // execution ended or not
  this._error       = false;          // error occurred or not
  this._cb_accessed = false;          // whether callback is accessed via "this.callback", this means asynchronous.
  this._cb_called   = false;          // whether callback is called or not
  this._node_cb     = junjo._node_cb; // node-style callback or not

  Object.defineProperty(this, 'callback', {
    get: function() {
      this._cb_accessed = true; // if accessed, then the function is regarded asynchronous.
      return this._callback.bind(this);
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

Junjo.Func.prototype.args = function(k) {
  if (k != null && !isNaN(Number(k))) return this._args[k];
  return this._args;
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

  Array.prototype.forEach.call(arguments, function(v) {
    if (this._afters.indexOf(v) >= 0) return;
    this._afters.push(v);
  }, this);
  return this;
};

Junjo.Func.prototype.afterAbove = function(bool) {
  this._after_above = (bool !== false);
  return this;
};

Junjo.Func.prototype.nodeCallback = function(bool) {
  this._node_cb = (bool !== false);
  return this;
};

Junjo.Func.prototype.timeout = function(v) {
  if (typeof v == "number") this._timeout = v;
  return this;
};

Junjo.Func.prototype.catches = function() {
  if (arguments.length == 0) {
    this._catch_prev = true;
    return this;
  }
  else {
    this._catch_prev = false;
  }
  Array.prototype.forEach.call(arguments, function(v) {
    // if (this._catches.indexOf(v) >= 0) return; // not necessary to be unique.
    this._catches.push(v);
  }, this);
  return this;
};

Junjo.Func.prototype.catchesAbove = function(bool) {
  this._catch_above = (bool !== false);
  return this;
};

Junjo.Func.prototype.isCatcher = function() {
  return this._catch_above || this._catch_prev || this._catches.length;
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

// execute the function and its callback, whatever happens.
Junjo.Func.prototype.execute = function() {
  // filters
  if (this._junjo._terminated) return; // global-terminated filter
  if (this._called) return; // execute-only-one-time filter
  if (this.isCatcher()) return; // catcher filter

  Array.prototype.forEach.call(arguments, function(v) {
    this._args.push(v);
  }, this);
  if (--this._counter > 0) return; // dependency filter


  // preparation
  this._called = true;
  var scope = this._scope || this; // "this" scope
	var len = this._params.length;
	if (len) {
    this._params.forEach(function(v, k) {
      if (v instanceof Junjo.KeyPath) {
        this._params[k] = v.get(this); // translate keypath
      }
    }, this);
	}

  // execution
  try {
    var ret = this._func.apply(scope, (len) ? this._params : this._args);
    this._done = true;
    if (!this._cb_accessed) { // if true, regarded as synchronous function.
      this._callback(ret);
    }
    else { // checking if the callback is called in the function with in timeout[sec]
      if (this._junjo._terminated) return;

      var timeout = this._timeout || this._junjo._timeout;
      if (!timeout) return;

      var self = this;
      this._timeout_id = setTimeout(function() {
        if (!self._cb_called) {
          self._done = true;
          self._error = new Error('callback wasn\'t called within '+timeout+' [sec] in function ' + self.label() + '.' );
          self._callback();
        }
      }, timeout * 1000);
    }
  }
  catch (e) {
    this._done = true;
    this._error = e;
    this._callback(); // called when this callback was not called.
  }
};

Junjo.Func.prototype._callback = function() {
  if (!this._done || this._cb_called) return; // already-called-or-cannot-call filter

  if (this._timeout_id) {
    clearTimeout(this._timeout_id); // remove tracing callback
    this._timeout_id = null;
  }
  this._cb_called = true;

  var args = arguments;
  if (this._node_cb) {
    if (!this._error && this._cb_accessed && args[0]) { // when asynchronous call was succeed
      this._error = args[0];
    }
  }

  var next = (this._error) 
    ? (this._catcher) 
      ? this._catcher.rescue(this._error, this)
      : this._junjo.defaultCatcher(this._error, this)

    : Junjo.privates.result.call(this._junjo, this.label(),
        (this._cb_accessed) ? args : args[0]
      );

  Junjo.privates.finished.call(this._junjo, this); // check if finished or not.

  if (this._junjo._terminated) {
    Junjo.privates.onTerminate.call(this._junjo);
    return;
  }


  if (next) {
    this._callbacks.forEach(function(cb_jfn) {
      cb_jfn.execute.apply(cb_jfn, args);
    });
  }
};

Junjo.Func.prototype.rescue = function(e, jfn) {
  if (!this.isCatcher()) return;
  return this._func(e, jfn);
};


Object.getOwnPropertyNames(Function.prototype).forEach(function(k) {
  Junjo.prototype[k] = Function.prototype[k];
});

if (typeof exports == 'object' && exports === this) module.exports = Junjo;
