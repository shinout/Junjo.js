const Junjo = (function() {

  // preparation for private properties
  var props = {};
  var current_id = 0;
  function _(obj) { return props[obj.id]; }

  /**
   * constructor 
   *
   * @param (Object) options :
   *  (function) defaultCatcher : default catcher (called when errors are thrown in a series of processes)
   *
   **/
  const Junjo = function(options) {
    options = options || {};

    // this function is returned in this constructor.
    // It behaviors as a object .
    var fJunjo = function() {
      var label = (typeof arguments[0] != 'function')
         ? Array.prototype.shift.call(arguments)
         : undefined;

      var jfn = new JFunc(arguments[0], fJunjo);
      if (label !== undefined) jfn.label(label);
      _(fJunjo).jfncs.push(jfn);
      return jfn;
    };

    // fJunjo extends Junjo.prototype
    if(fJunjo.__proto__)
      fJunjo.__proto__ = Junjo.prototype;
    else 
      Object.keys(Junjo.prototype).forEach(function(k) { _[k] = Junjo.prototype[k]; });

    // properties of fJunjo
    Object.defineProperty(fJunjo, 'id', { value : ++current_id, writable : false});

    // private properties
    props[fJunjo.id] = {
      jfncs       : [],
      results     : {},
      out         : null,
      err         : null,
      terminated  : false,
      funcs_count : 0, // the number of registered functions without catchers.
      finished    : 0,
      succeeded   : 0,
      ends        : [],
      successEnds : [],
      errorEnds   : [],
      runnable    : true,
      timeout     : 5,
      node_cb     : false,
      scope       : new Scope(fJunjo),
      current     : null
    };

    if (typeof options.timeout == "number") _(fJunjo).timeout = options.timeout;

    if (typeof options.nodeCallback == "boolean") _(fJunjo).node_cb = options.nodeCallback;

    if (typeof options.onEnd == "function") fJunjo.onEnd(options.onEnd);

    if (typeof options.onSuccessEnd == "function") fJunjo.onSuccessEnd(options.onSuccessEnd);

    if (typeof options.onErrorEnd == "function") fJunjo.onErrorEnd(options.onErrorEnd);

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
    _(this).terminated = true;
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

  Junjo.prototype.onEnd = function(fn) { _(this).ends.push(fn); };
  Junjo.prototype.onErrorEnd = function(fn) { _(this).errorEnds.push(fn); };
  Junjo.prototype.onSuccessEnd = function(fn) { _(this).successEnds.push(fn); };

  Object.defineProperty(Junjo.prototype, 'scope', {
    get: function() {
      return _(this).scope;
    },
    set: function() {},
    enumerable: true
  });

  /**
   * get result of each process. 
   * 
   * @param lbl : label of processes, if it is not given, an object which contains all results is returned.
   */
  Junjo.prototype.results = function(lbl) {
    if (lbl == undefined) return _(this).results;
    return _(this).results[lbl];
  };

  Junjo.prototype.register = function() {};

  Junjo.prototype.run = function() {
    if (!_(this).runnable) return this;
    var self = this;

    //setTimeout(function() {
      var fncs = {};

      var prev_lbl, a_aboves = [], c_aboves = [];

      _(self).jfncs.forEach(function(jfn, k) {
        var is_catcher = jfn.isCatcher();
        if (!jfn.label()) jfn._label = k;
        fncs[jfn.label()] = jfn;
        if (!is_catcher) this._funcs_count++; 

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

        if (!is_catcher) {
          a_aboves.push(jfn.label());
          c_aboves.push(jfn.label());
          prev_lbl = jfn._label;
        }
      }, self);

      if (_(self).jfncs.length != Object.keys(fncs).length) {
        throw new Error('there are duplicated label settings.');
      }

      // register dependencies
      _(self).jfncs.forEach(function(jfn, k) {
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
      }, self);

      _(self).jfncs.forEach(function(jfn) {
        if (!jfn._afters.length && !jfn.isCatcher()) 
          jfn.execute();
      }, self);
    //}, 0);

    return this;
  };

  Junjo.prototype.out = function(v) {
    if (v === undefined) return _(this).out;
    _(this).out = v;
    return this;
  };

  Junjo.prototype.err = function(v) {
    if (v === undefined) return _(this).err;
    _(this).err = v;
    return this;
  };

  // private functions 

  var setFinished = function(jfn) {
    _(this).finished++;

    if (_(this).finished == _(this).funcs_count) {
      var err = _(this).err || (_(this).succeeded != _(this).funcs_count) ? true : null;
      _(this).ends.forEach(function(fn) {
        fn.call(this, err, _(this).out);
      }, this);
    }

    if (_(this).succeeded == _(this).funcs_count) {
      _(this).successEnds.forEach(function(fn) {
        fn.call(this, _(this).out);
      }, this);
    }
  };

  var onTerminate = function() {
    var self = this;
    var bool = _(self).jfncs.every(function(jfn) {
      return jfn._cb_called || jfn._cb_accessed == jfn._cb_called
    });
    if (!bool) return;

    _(self).errorEnds.forEach(function(fn) {
      fn.call(self, _(self).err || true, _(self).out);
    }, self);
  };

  var setResult = function(lbl, val) {
    _(this).succeeded++;
    _(this).results[lbl] = val;
    return true;
  };

  Scope = function(junjo) {
    Object.defineProperty(this, 'junjo', {value: junjo, writable: false});

    // TODO set this function in prototype
    Object.defineProperty(this, 'callback', {
      get : function() {
        var current = _(this.junjo).current;
        if (!current) return function(){};
        current._cb_accessed = true; // if accessed, then the function is regarded asynchronous.
        return current._callback.bind(current);
      },
      set : function() {},
      enumerable: true
    });

    Object.defineProperty(this, 'label', {
      get : function() {
        var current = _(this.junjo).current;
        if (!current) return null;
        return current.label();
      },
      set : function() {},
      enumerable: true
    });

  };

  /***
   * JFunc
   * function wrapper
   **/
  JFunc = function(fn, junjo, id) {
    this._func        = fn;             // registered function
    this._junjo       = junjo;          // instanceof Junjo
    this._callbacks   = [];             // callback functions
    this._args        = [];             // arguments passed from each dependent functions
    this._afters      = [];             // labels of functions executed before this function
    this._after_prev  = false;          // if true, executed after the previously registered function
    this._after_above = false;          // if true, executed after all the registered function above.
    this._params      = [];             // parameters to be given to the function. if empty, original callback arguments is used.
    this._scope       = _(junjo).scope; // "this" scope to execute.
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

  };

  JFunc.prototype.scope = function(scope) {
    if (scope != null && typeof scope == 'object') this._scope = scope;
    return this;
  };

  JFunc.prototype.bind = function() {
    this.scope(Array.prototype.shift.call(arguments));
    return this.params.apply(this, arguments);
  };

  JFunc.prototype.args = function(k) {
    if (k != null && !isNaN(Number(k))) return this._args[k];
    return this._args;
  };

  JFunc.prototype.params = function() {
    Array.prototype.forEach.call(arguments, function(v) {
      this._params.push(v);
    }, this);
    return this;
  };

  JFunc.prototype.after = function() {
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

  JFunc.prototype.afterAbove = function(bool) {
    this._after_above = (bool !== false);
    return this;
  };

  JFunc.prototype.nodeCallback = function(bool) {
    this._node_cb = (bool !== false);
    return this;
  };

  JFunc.prototype.timeout = function(v) {
    if (typeof v == "number") this._timeout = v;
    return this;
  };

  JFunc.prototype.catches = function() {
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

  JFunc.prototype.catchesAbove = function(bool) {
    this._catch_above = (bool !== false);
    return this;
  };

  JFunc.prototype.isCatcher = function() {
    return this._catch_above || this._catch_prev || this._catches.length;
  };

  JFunc.prototype.scope = function(v) {
    if (v === undefined) return this._scope;
    else this._scope = v; return this;
  };

  JFunc.prototype.label = function(v) {
    if (v === undefined) return this._label;
    else {
      if (! isNaN(Number(v))) {
        throw new Error('cannot set number labels, because Junjo.js sets number labels to functions with no custom labels.');
      }
      this._label = v; return this;
    }
  };


  // execute the function and its callback, whatever happens.
  JFunc.prototype.execute = function() {
    // filters
    if (_(this._junjo).terminated) return; // global-terminated filter
    if (this._called) return; // execute-only-one-time filter
    if (this.isCatcher()) return; // catcher filter

    Array.prototype.forEach.call(arguments, function(v) {
      this._args.push(v);
    }, this);
    if (--this._counter > 0) return; // dependency filter


    // preparation
    this._called = true;
    _(this._junjo).current = this;

    var len = this._params.length;

    // execution
    try {
      var ret = this._func.apply(this._scope, (len) ? this._params : this._args);
      this._done = true;
      if (!this._cb_accessed) { // if true, regarded as synchronous function.
        this._callback(ret);
      }
      else { // checking if the callback is called in the function with in timeout[sec]
        if (_(this._junjo).terminated) return;

        var timeout = this._timeout || _(this._junjo).timeout;
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

  JFunc.prototype._callback = function() {
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

      : setResult.call(this._junjo, this.label(),
          (this._cb_accessed) ? args : args[0]
        );

    setFinished.call(this._junjo, this); // check if finished or not.

    if (_(this._junjo).terminated) {
      onTerminate.call(this._junjo);
      return;
    }

    if (next) {
      this._callbacks.forEach(function(cb_jfn) {
        cb_jfn.execute.apply(cb_jfn, args);
      });
    }
  };

  JFunc.prototype.rescue = function(e, jfn) {
    if (!this.isCatcher()) return;
    return this._func(e, jfn);
  };


  Object.getOwnPropertyNames(Function.prototype).forEach(function(k) {
    Junjo.prototype[k] = Function.prototype[k];
  });

  return Junjo;
})();

if (typeof exports == 'object' && exports === this) module.exports = Junjo;
