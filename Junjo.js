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
        if (!jfn.label()) _(jfn).label = k;
        fncs[jfn.label()] = jfn;
        if (!is_catcher) this._funcs_count++; 

        if (_(jfn).after_above) {
          a_aboves.forEach(function(lbl) {
            jfn.after(lbl);
          });
          a_aboves = [];
        }
        else if (_(jfn).after_prev && prev_lbl != undefined) {
          jfn.after(prev_lbl);
        }

        if (_(jfn).catch_above) {
          c_aboves.forEach(function(lbl) {
            jfn.catches(lbl);
          });
          c_aboves = [];
        }
        else if (_(jfn).catch_prev && prev_lbl != undefined) {
          jfn.catches(prev_lbl);
        }

        if (!is_catcher) {
          a_aboves.push(jfn.label());
          c_aboves.push(jfn.label());
          prev_lbl = _(jfn).label;
        }
      }, self);

      if (_(self).jfncs.length != Object.keys(fncs).length) {
        throw new Error('there are duplicated label settings.');
      }

      // register dependencies
      _(self).jfncs.forEach(function(jfn, k) {
        _(jfn).afters.forEach(function(lbl) {
          var before = fncs[lbl];
          if (!before) throw new Error('label "' + lbl  + '" is not defined.');
          if (before.isCatcher()) return; // TODO throw an error
          _(jfn).counter++;
          _(before).callbacks.push(jfn);
        });

        _(jfn).catches.forEach(function(lbl) {
          var from = fncs[lbl];
          if (!from) throw new Error('label "' + lbl  + '" is not defined.');
          if (from.isCatcher()) return; // TODO throw an error
          if (!_(from).catcher) _(from).catcher = jfn;
        });
      }, self);

      _(self).jfncs.forEach(function(jfn) {
        if (!_(jfn).afters.length && !jfn.isCatcher()) 
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

  const setFinished = function(jfn) {
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

  const onTerminate = function() {
    var self = this;
    var bool = _(self).jfncs.every(function(jfn) {
      return _(jfn).cb_called || _(jfn).cb_accessed == _(jfn).cb_called
    });
    if (!bool) return;

    _(self).errorEnds.forEach(function(fn) {
      fn.call(self, _(self).err || true, _(self).out);
    }, self);
  };

  const setResult = function(lbl, val) {
    _(this).succeeded++;
    _(this).results[lbl] = val;
    return true;
  };

  const Scope = function(junjo) {
    Object.defineProperty(this, 'junjo', {value: junjo, writable: false});

    // TODO set this function in prototype
    Object.defineProperty(this, 'callback', {
      get : function() {
        var current = _(this.junjo).current;
        if (!current) return function(){};
        _(current).cb_accessed = true; // if accessed, then the function is regarded asynchronous.
        return current.callback.bind(current);
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
  const JFunc = function(fn, junjo, id) {
    Object.defineProperty(this, 'id', { value : ++current_id, writable : false});
    // private properties
    props[this.id] = {
      func        : fn,              // registered function
      junjo       : junjo,           // instanceof Junjo
      callbacks   : [],              // callback functions
      args        : [],              // arguments passed from each dependent functions
      afters      : [],              // labels of functions executed before this function
      after_prev  : false,           // if true, executed after the previously registered function
      after_above : false,           // if true, executed after all the registered function above.
      params      : [],              // parameters to be given to the function. if empty, original callback arguments is used.
      scope       : _(junjo).scope,  // "this" scope to execute.
      catcher     : null,            // execute when the function throws an error.
      catches     : [],              // Array of labels. If the function with the label throws an error, this function will rescue().
      catch_prev  : false,           // catches previous function or not.
      catch_above : false,           // catches all functions registered before.
      timeout_id  : null,            // id of timeout checking function
      counter     : 0,               // until 0, decremented per each call, then execution starts.
      called      : false,           // execution started or not
      done        : false,           // execution ended or not
      error       : false,           // error occurred or not
      cb_accessed : false,           // whether callback is accessed via "this.callback", this means asynchronous.
      cb_called   : false,           // whether callback is called or not
      node_cb     : _(junjo).node_cb // node-style callback or not
    };
  };

  JFunc.prototype.scope = function(scope) {
    if (scope != null && typeof scope == 'object') _(this).scope = scope;
    return this;
  };

  JFunc.prototype.bind = function() {
    this.scope(Array.prototype.shift.call(arguments));
    return this.params.apply(this, arguments);
  };

  JFunc.prototype.args = function(k) {
    if (k != null && !isNaN(Number(k))) return _(this).args[k];
    return _(this).args;
  };

  JFunc.prototype.params = function() {
    Array.prototype.forEach.call(arguments, function(v) {
      _(this).params.push(v);
    }, this);
    return this;
  };

  JFunc.prototype.after = function() {
    if (arguments.length == 0) {
      _(this).after_prev = true;
      return this;
    }
    else {
      _(this).after_prev = false;
    }

    Array.prototype.forEach.call(arguments, function(v) {
      if (_(this).afters.indexOf(v) >= 0) return;
      _(this).afters.push(v);
    }, this);
    return this;
  };

  JFunc.prototype.afterAbove = function(bool) {
    _(this).after_above = (bool !== false);
    return this;
  };

  JFunc.prototype.nodeCallback = function(bool) {
    _(this).node_cb = (bool !== false);
    return this;
  };

  JFunc.prototype.timeout = function(v) {
    if (typeof v == "number") _(this).timeout = v;
    return this;
  };

  JFunc.prototype.catches = function() {
    if (arguments.length == 0) {
      _(this).catch_prev = true;
      return this;
    }
    else {
      _(this).catch_prev = false;
    }
    Array.prototype.forEach.call(arguments, function(v) {
      // if (_(this).catches.indexOf(v) >= 0) return; // not necessary to be unique.
      _(this).catches.push(v);
    }, this);
    return this;
  };

  JFunc.prototype.catchesAbove = function(bool) {
    _(this).catch_above = (bool !== false);
    return this;
  };

  JFunc.prototype.isCatcher = function() {
    return _(this).catch_above || _(this).catch_prev || _(this).catches.length;
  };

  JFunc.prototype.scope = function(v) {
    if (v === undefined) return _(this).scope;
    else _(this).scope = v; return this;
  };

  JFunc.prototype.label = function(v) {
    if (v === undefined) return _(this).label;
    else {
      if (! isNaN(Number(v))) {
        throw new Error('cannot set number labels, because Junjo.js sets number labels to functions with no custom labels.');
      }
      _(this).label = v; return this;
    }
  };


  // execute the function and its callback, whatever happens.
  JFunc.prototype.execute = function() {
    var junjo = _(this).junjo;
    // filters
    if (_(junjo).terminated) return; // global-terminated filter
    if (_(this).called) return; // execute-only-one-time filter
    if (this.isCatcher()) return; // catcher filter

    Array.prototype.forEach.call(arguments, function(v) {
      _(this).args.push(v);
    }, this);
    if (--_(this).counter > 0) return; // dependency filter


    // preparation
    _(this).called = true;
    _(junjo).current = this;

    var len = _(this).params.length;

    // execution
    try {
      var ret = _(this).func.apply(_(this).scope, (len) ? _(this).params : _(this).args);
      _(this).done = true;
      if (!_(this).cb_accessed) { // if true, regarded as synchronous function.
        this.callback(ret);
      }
      else { // checking if the callback is called in the function with in timeout[sec]
        if (_(junjo).terminated) return;

        var timeout = _(this).timeout || _(junjo).timeout;
        if (!timeout) return;

        var self = this;
        _(this).timeout_id = setTimeout(function() {
          if (!_(self).cb_called) {
            _(self).done = true;
            _(self).error = new Error('callback wasn\'t called within '+timeout+' [sec] in function ' + self.label() + '.' );
            self.callback();
          }
        }, timeout * 1000);
      }
    }
    catch (e) {
      _(this).done = true;
      _(this).error = e;
      this.callback(); // called when this callback was not called.
    }
  };

  JFunc.prototype.callback = function() {
    var junjo = _(this).junjo;
    if (!_(this).done || _(this).cb_called) return; // already-called-or-cannot-call filter

    if (_(this).timeout_id) {
      clearTimeout(_(this).timeout_id); // remove tracing callback
      _(this).timeout_id = null;
    }
    _(this).cb_called = true;

    var args = arguments;
    if (_(this).node_cb) {
      if (!_(this).error && _(this).cb_accessed && args[0]) { // when asynchronous call was succeed
        _(this).error = args[0];
      }
    }

    var next = (_(this).error) 
      ? (_(this).catcher) 
        ? _(this).catcher.rescue(_(this).error, this)
        : _(this).junjo.defaultCatcher(_(this).error, this)

      : setResult.call(_(this).junjo, this.label(),
          (_(this).cb_accessed) ? args : args[0]
        );

    setFinished.call(junjo, this); // check if finished or not.

    if (_(junjo).terminated) {
      onTerminate.call(junjo);
      return;
    }

    if (next) {
      _(this).callbacks.forEach(function(cb_jfn) {
        cb_jfn.execute.apply(cb_jfn, args);
      });
    }
  };

  JFunc.prototype.rescue = function(e, jfn) {
    if (!this.isCatcher()) return;
    return _(this).func(e, jfn);
  };


  Object.getOwnPropertyNames(Function.prototype).forEach(function(k) {
    Junjo.prototype[k] = Function.prototype[k];
  });

  return Junjo;
})();

if (typeof exports == 'object' && exports === this) module.exports = Junjo;
