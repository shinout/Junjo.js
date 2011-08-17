var Junjo = (function() {

  var args2arr = function(args) {
    return Array.prototype.map.call(args, function(v) {return v;});
  };

  var is_arguments = function(v) {
    return typeof v == 'object' && v.toString() == '[object Arguments]'; // FIXME there would be more elegant ways...
  };

  var get_label = function(args) {
    return (typeof args[0] != 'function') ? Array.prototype.shift.call(args) : undefined;
  };

  // preparation for private properties
  var props = {};
  var current_id = 0;
  function _(obj) { return props[obj.id]; }

  /**
   * constructor 
   *
   * @param (Object) options :
   *  (function) catcher      : default catcher (called when errors are thrown in a series of processes)
   *  (boolean)  nodeCallback : if true, if the first argument in the callback is not null (it means an error happened), throw the error.
   *  (number) timeout        : time to timeout [sec]
   **/
  var Junjo = function(options) {
    options = options || {};

    // this function is returned in this constructor.
    // It behaviors as a object .
    var fJunjo = function() {
      var label = get_label(arguments);
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

    Object.defineProperty(fJunjo, 'id', { value : ++current_id, writable : false});

    // private properties
    props[fJunjo.id] = {
      jfncs        : [],
      timeout      : 5,
      catcher      : null,
      nodeCallback : false,
      results      : {},
      terminated   : false,
      ended        : false,
      funcs_count  : 0, // the number of registered functions without catchers.
      finished     : 0,
      listeners    : {},
      runnable     : true,
      scope        : new Scope(fJunjo),
      current      : null
    };

    [ ['timeout'     , 'number'],
      ['catcher'     , 'function'],
      ['nodeCallback', 'boolean']
    ].forEach(function(v) {
      var propname = v[0], type = v[1];
      if (typeof options[propname] == type) _(fJunjo)[propname] = options[propname];
    });

    Object.seal(fJunjo);
    return fJunjo;
  };

  /** public properties **/

  Object.defineProperty(Junjo.prototype, 'scope', {
    get: function() {
      return _(this).scope;
    },
    set: function() {},
    enumerable: true
  });

  // proxy to the scope object.
  ['callback', 'label', 'err', 'out'].forEach(function(propname) {
    Object.defineProperty(Junjo.prototype, propname, {
      get: function() {
        if (_(this).current) return this.scope[propname];
        return new KeyPath(propname);
      },
      set: function() {},
      enumerable: true
    });
  });

  // Junjo extends Function prototype
  Object.getOwnPropertyNames(Function.prototype).forEach(function(k) {
    Junjo.prototype[k] = Function.prototype[k];
  });


  /** public functions **/

  /**
   * terminate whole process
   */
  Junjo.prototype.terminate = function() {
    _(this).terminated = true;
  };

  /**
   * emitting event asynchronously.
   * the similar way as EventEmitter in Node.js
   */
  Junjo.prototype.emit = function() {
    var evtname = Array.prototype.shift.call(arguments);
    var listeners = _(this).listeners[evtname] || [];
    var self = this, args = arguments;
    listeners.forEach(function(listener) {
      setTimeout(function() { listener.apply(self, args);}, 0);
    });
  };

  /**
   * set eventListener
   */
  Junjo.prototype.on = function(evtname, fn) {
    if (! (_(this).listeners[evtname] instanceof Array)) _(this).listeners[evtname] = [];
    _(this).listeners[evtname].push(fn);
  };

  /**
   * add catcher
   */
  Junjo.prototype.catches = function() {
    var label = get_label(arguments);
    if (label) return this(arguments[0]).catches(label);
    else return this(arguments[0]).catches();
  };

  /**
   * add catcher to all the function registered previously
   */
  Junjo.prototype.catchesAbove = function(fn) {
    return this(fn).catchesAbove();
  };

  Junjo.prototype.sync = function() {
    var label = get_label(arguments);
    return this(arguments[0]).label(label).sync();
  };

  Junjo.prototype.async = function() {
    var label = get_label(arguments);
    return this(arguments[0]).label(label).async();
  };

  /**
   * get result of each process. 
   * 
   * @param lbl : label of processes, if it is not given, an object which contains all results is returned.
   */
  Junjo.prototype.results = function(lbl) {
    if (lbl == undefined) return _(this).results;
    return _(this).results[lbl];
  };

  Junjo.prototype.after = function(jn) {
    var self = this;
    jn.on('end', function(err, out) {
      _(self).runnable = true;
      self.run(err, out);
    });
    _(self).runnable = false;
    return this;
  };

  /**
   * run all the registered functions
   */
  Junjo.prototype.run = function() {
    var _this = _(this);
    var self  = this;
    if (!_this.runnable) return this;
    _this.runnable = true;

    //setTimeout(function() {
      var fncs = {};

      var prev_lbl, a_aboves = [], c_aboves = [];

      _this.jfncs.forEach(function(jfn, k) {
        var _jfn = _(jfn);
        var is_catcher = jfn.isCatcher();
        if (!jfn.label()) _jfn.label = k;
        fncs[jfn.label()] = jfn;
        if (!is_catcher) _this.funcs_count++;

        if (_jfn.after_above) {
          a_aboves.forEach(function(lbl) {
            jfn.after(lbl);
          });
          a_aboves = [];
        }
        else if (_jfn.after_prev && prev_lbl != undefined) {
          jfn.after(prev_lbl);
        }

        if (_jfn.catch_above) {
          c_aboves.forEach(function(lbl) {
            jfn.catches(lbl);
          });
          c_aboves = [];
        }
        else if (_jfn.catch_prev && prev_lbl != undefined) {
          jfn.catches(prev_lbl);
        }

        if (!is_catcher) {
          a_aboves.push(jfn.label());
          c_aboves.push(jfn.label());
          prev_lbl = _jfn.label;
        }
      }, self);

      if (_this.jfncs.length != Object.keys(fncs).length) {
        throw new Error('there are duplicated label settings.');
      }

      // register dependencies
      _this.jfncs.forEach(function(jfn, k) {
        var _jfn = _(jfn);
        _jfn.afters.forEach(function(lbl) {
          var before = fncs[lbl];
          if (!before) throw new Error('label "' + lbl  + '" is not defined.');
          if (before.isCatcher()) return; // TODO throw an error
          _jfn.counter++;
          _(before).callbacks.push(jfn);
        });

        _jfn.catches.forEach(function(lbl) {
          var from = fncs[lbl];
          if (!from) throw new Error('label "' + lbl  + '" is not defined.');
          if (from.isCatcher()) return; // TODO throw an error
          if (!_(from).catcher) _(from).catcher = jfn;
        });
      }, self);

      var args = arguments;
      _this.jfncs.forEach(function(jfn) {
        if (!_(jfn).afters.length && !jfn.isCatcher()) {
          _(jfn).params = args2arr(args);
          jfn.execute();
        }
      }, self);
    //}, 0);

    return this;
  };

  // deprecated.
  Junjo.prototype.register = function() {console.error('Junjo.prototype.register is deprecated.')};

  // private functions 

  var defaultCatcher = function(e) {
    console.error(e.stack || e.message || e);
    this.err = e;
    this.junjo.terminate();
    return false;
  };

  var setResult = function(jfn, args_result, use_one) {
    var _this = _(this);
    _this.finished++;

    _(this).results[jfn.label()] = (use_one) ? args_result[0] : args_result;

    if (_this.finished == _this.funcs_count && !_this.ended) {
      _this.ended = true;
      this.emit('end', _this.scope.err, _this.scope.out);
    }

    if (_this.terminated) {
      var bool  = _this.jfncs.every(function(f) {
        var _jfn = _(f);
        return _jfn.cb_called || !_jfn.called; // FIXME
      });
      if (!bool) return;

      this.emit('terminate', _this.scope.err, _this.scope.out);
      if (!_this.ended) {
        _this.ended = true;
        this.emit('end', _this.scope.err, _this.scope.out);
      }
    }
  };


  /** 
   * private class KeyPath
   */
  var KeyPath = function() {
    this.keypath = args2arr(arguments);
  }

  KeyPath.prototype.get = function(obj) {
   return this.keypath.reduce(function(o, k) {
    if (o == null || (typeof o != 'object' && o[k] == null)) return null;
     return o[k];
   }, obj);
  };

  /** 
   * private class Scope
   */
  var Scope = function(junjo) {
    Object.defineProperties(this, {
      junjo : {value: junjo, writable: false},
      err : { value: null, writable: true, enumerable: true},
      out : { value: {},   writable: true, enumerable: true},

      callback : {
        get : function() {
          var current = _(this.junjo).current;
          if (!current) return function(){};
          _(current).cb_accessed = true; // if accessed, then the function is regarded asynchronous.
          return jCallback.bind(current);
        },
        set : function() {},
        enumerable: true
      },

      label : {
        get : function() {
          var current = _(this.junjo).current;
          if (!current) return null;
          return current.label();
        },
        set : function() {},
        enumerable: true
      }
    });
  };

  /***
   * private class JFunc
   * function wrapper
   **/
  var JFunc = function(fn, junjo, id) {
    Object.defineProperty(this, 'id', { value : ++current_id, writable : false});
    // private properties
    props[this.id] = {
      func         : fn,                   // registered function
      junjo        : junjo,                // instanceof Junjo
      callbacks    : [],                   // callback functions
      afters       : [],                   // labels of functions executed before this function
      after_prev   : false,                // if true, executed after the previously registered function
      after_above  : false,                // if true, executed after all the registered function above.
      params       : [],                   // parameters to be given to the function. if empty, original callback arguments is used.
      scope        : _(junjo).scope,       // "this" scope to execute.
      catcher      : null,                 // execute when the function throws an error.
      catches      : [],                   // Array of labels. If the function with the label throws an error, this function will rescue().
      catch_prev   : false,                // catches previous function or not.
      catch_above  : false,                // catches all functions registered before.
      timeout_id   : null,                 // id of timeout checking function
      counter      : 0,                    // until 0, decremented per each call, then execution starts.
      called       : false,                // execution started or not
      done         : false,                // execution ended or not
      async        : null,                 // asynchronous or not.
      cb_accessed  : false,                // whether callback is accessed via "this.callback", this means asynchronous.
      cb_called    : false,                // whether callback is called or not.
      nodeCallback : _(junjo).nodeCallback // node-style callback or not
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

  JFunc.prototype.sync = function(bool) {
    _(this).async = (bool === undefined) ? false : !bool;
    return this;
  };

  JFunc.prototype.async = function(bool) {
    _(this).async = (bool === undefined) ? true : !!bool;
    return this;
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
    _(this).nodeCallback = (bool !== false);
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
    var _this = _(this);
    return _this.catch_above || _this.catch_prev || _this.catches.length;
  };

  JFunc.prototype.scope = function(v) {
    if (v === undefined) return _(this).scope;
    else _(this).scope = v; return this;
  };

  JFunc.prototype.label = function(v) {
    if (arguments.length == 0) return _(this).label;
    else {
      if (v === undefined) return this;

      if (! isNaN(Number(v))) {
        throw new Error('cannot set number labels, because Junjo.js sets number labels to functions with no custom labels.');
      }
      _(this).label = v; return this;
    }
  };


  // execute the function and its callback, whatever happens.
  JFunc.prototype.execute = function() {
    var _this  = _(this);
    var junjo  = _this.junjo;
    var _junjo = _(junjo);

    // filters
    if (_junjo.terminated) return; // global-terminated filter
    if (_this.called) return; // execute-only-one-time filter
    if (this.isCatcher()) return; // catcher filter

    if (--_this.counter > 0) return; // dependency filter


    // preparation
    _this.called = true;
    _junjo.current = this;

    if (_this.params.length) {
      _this.params.forEach(function(param, k) {
        if (param instanceof KeyPath) _this.params[k] = param.get(_this.scope);
      });
    }
    else {
      _this.params = _this.afters.reduce(function(arr, lbl) {
        var val = _junjo.results[lbl];
        if (is_arguments(val)) {
          Array.prototype.forEach.call(val, function(v) {
            arr.push(v);
          });
        }
        else {
          arr.push(val);
        }
        return arr;
      }, []);
    }

    // execution
    try {
      var ret = _this.func.apply(_this.scope, _this.params);
      _this.done = true;
      if (isSync(_this)) { // synchronous
        jCallback.call(this, ret);
      }
      else { // checking if the callback is called in the function with in timeout[sec]
        if (_junjo.terminated) return;

        var timeout = _this.timeout || _junjo.timeout;
        if (!timeout) return;

        var self = this;
        _this.timeout_id = setTimeout(function() {
          if (!_this.cb_called) {
            _this.done = true;
            jFail.call(self, new Error('callback wasn\'t called within '+timeout+' [sec] in function ' + self.label() + '.' ));
          }
        }, timeout * 1000);
      }
    }
    catch (e) {
      _this.done = true;
      jFail.call(this, e);
    }
  };

  JFunc.prototype.rescue = function(e, jfn) {
    if (!this.isCatcher()) return;
    return _(this).func.call(_(this).scope, e, jfn);
  };

  // private functions of JFunc

  var isSync = function(_this) {
      return (_this.async === false || _this.async === null && !_this.cb_accessed);
  };
  var isAsync = function(_this) { return !isSync(_this); };

  var jFail = function(e) {
    var _this = _(this), _junjo = _(_this.junjo);

    if (jCallbackFilter(_this)) return;

    var args = (_this.catcher)
      ? _this.catcher.rescue(e, this)
      : (_junjo.catcher)
        ? _junjo.catcher.call(_this.scope, e, this)
        : defaultCatcher.call(_this.scope, e, this)

    if (! (args instanceof Array)) 
      args = (args) ? [true, args] : [false];
    else
      args.unshift(true);

    return jCallbackNext.apply(this, args);
  };

  var jCallbackFilter = function(_this) {
    return (!_this.done || _this.cb_called); // already-called-or-cannot-call filter
  };

  var jCallback = function() {
    var _this = _(this);
    if (_this.nodeCallback && isAsync(_this) && arguments[0]) { // checking node-style callback error
      return jFail.call(this, arguments[0]);
    }
    if (jCallbackFilter(_this)) return;

    Array.prototype.unshift.call(arguments, true);
    return jCallbackNext.apply(this, arguments);
  };

  // private in private function
  var jCallbackNext = function() {
    var _this = _(this), _junjo = _(_this.junjo);
    _this.cb_called = true;

    if (_this.timeout_id) {
      clearTimeout(_this.timeout_id); // remove tracing callback
      _this.timeout_id = null;
    }

    var succeeded = Array.prototype.shift.call(arguments);

    setResult.call(_this.junjo, this, arguments, isSync(_this));

    if (succeeded) {
      _this.callbacks.forEach(function(cb_jfn) {
        // cb_jfn.execute.apply(cb_jfn, args);
        cb_jfn.execute.apply(cb_jfn);
      });
    }
  };

  return Junjo;
})();

if (typeof exports == 'object' && exports === this) module.exports = Junjo;
