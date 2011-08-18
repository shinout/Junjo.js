var Junjo = (function() {
  "use strict";

  /** utility functions **/

  var args2arr = function(args) {
    return Array.prototype.map.call(args, function(v) {return v;});
  };

  var is_arguments = function(v) {
    return typeof v == 'object' && v.toString() == '[object Arguments]'; // FIXME there would be more elegant ways...
  };

  /** preparation for private properties **/

  var props = {};
  var current_id = 0;
  function _(obj) { return props[obj.id]; }
  function _d(obj) { delete props[obj.id]; }

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
      var label   = (typeof arguments[0] != 'function') ? Array.prototype.shift.call(arguments) : undefined;
      var jfn     = new JFunc(arguments[0], fJunjo);
      var _fJunjo = _(fJunjo);
      var num     = _fJunjo.jfncs.push(jfn) -1;
      if (label == undefined) label = num;
      _(jfn).label = label;
      _fJunjo.labels[label] = num;
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
      jfncs        : [],                // registered functions
      labels       : {},                // {label => position of jfncs}
      timeout      : 5,                 // timeout [sec]
      catcher      : null,              // default catcher
      nodeCallback : false,             // use node-style callback or not
      results      : {},                // results of each functions
      terminated   : false,             // terminated or not
      ended        : false,             // emited end event or not
      finished     : 0,                 // the number of finished functions
      listeners    : {},                // eventlisteners
      runnable     : true,              // allowable to run or not
      scope        : new Scope(fJunjo), // default "this" of each function
      current      : null               // pointer to current function
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

  // terminate whole process
  Junjo.prototype.terminate = function() {
    _(this).terminated = true;
  };

  // emitting event asynchronously. The similar way as EventEmitter in Node.js
  Junjo.prototype.emit = function() {
    var evtname = Array.prototype.shift.call(arguments);
    var listeners = _(this).listeners[evtname] || [];
    var self = this, args = arguments;
    listeners.forEach(function(listener) {
      setTimeout(function() { listener.apply(self, args);}, 0);
    });
  };

  // set eventListener
  Junjo.prototype.on = function(evtname, fn) {
    if (! (_(this).listeners[evtname] instanceof Array)) _(this).listeners[evtname] = [];
    _(this).listeners[evtname].push(fn);
  };

  // get jfunc by label
  Junjo.prototype.get = function(lbl) {
    var _this = _(this);
    return _this.jfncs[_this.labels[lbl]];
  };

  // remove jfunc by label
  Junjo.prototype.remove = function(lbl) {
    var _this = _(this);
    var jfunc = this.get(lbl);
    _this.jfncs.splice(_this.labels[lbl], 1);
    delete _this.labels[lbl];
    _d(jfunc);
    return this;
  };

  // add catcher
  Junjo.prototype.catches = function() {
    var fn = Array.prototype.pop.call(arguments);
    var _this = _(this);
    if (!arguments.length) {
      if (_this.jfncs.length) _(_this.jfncs[_this.jfncs.length-1]).catcher = fn;
    }
    else {
      Array.prototype.forEach.call(arguments, function(lbl) {
        var jfunc = this.get(lbl);
        if (jfunc) _(jfunc).catcher = fn;
      }, this);
    }
    return this;
  };

  // add catcher to all the functions registered previously, except those already have a catcher.
  Junjo.prototype.catchesAbove = function(fn) {
    _(this).jfncs.forEach(function(jfnc) {
      if (!_(jfnc).catcher) _(jfnc).catcher = fn;
    });
    return this;
  };

  // set synchronous jfunc
  Junjo.prototype.sync = function() {
    return this.apply(null, arguments).sync();
  };

  // set asynchronous jfunc
  Junjo.prototype.async = function() {
    return this.apply(null, arguments).async();
  };

  // get result of each process.
  Junjo.prototype.results = function(lbl) {
    if (lbl == undefined) return _(this).results;
    return _(this).results[lbl];
  };

  // set another Junjo object which executes before this.
  Junjo.prototype.after = function(jn) {
    var self = this;
    jn.on('end', function(err, out) {
      _(self).runnable = true;
      self.run(err, out);
    });
    _(self).runnable = false;
    return this;
  };

   // run all the registered jfunc
  Junjo.prototype.run = function() {
    var _this = _(this);
    if (!_this.runnable) return this;
    _this.runnable = true;

    var fncs = {};
    var args = arguments;
    _this.jfncs.forEach(function(jfn) {
      jfn.execute.apply(jfn, args);
    });

    return this;
  };

  // deprecated.
  Junjo.prototype.register = function() {console.error('Junjo.prototype.register is deprecated.')};

  /** private functions **/

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

    if (_this.finished == _this.jfncs.length && !_this.ended) {
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


  /** private class KeyPath **/
  var KeyPath = function() {
    this.keypath = args2arr(arguments);
  }

  KeyPath.prototype.get = function(obj) {
   return this.keypath.reduce(function(o, k) {
    if (o == null || (typeof o != 'object' && o[k] == null)) return null;
     return o[k];
   }, obj);
  };

  /** private class Scope **/
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
  var JFunc = function(fn, junjo) {
    Object.defineProperty(this, 'id', { value : ++current_id, writable : false});
    // private properties
    props[this.id] = new JFuncProto({
      func         : fn,                   // registered function
      junjo        : junjo,                // instanceof Junjo
      callbacks    : [],                   // callback functions
      afters       : [],                   // labels of functions executed before this function
      params       : [],                   // parameters to be given to the function. if empty, original callback arguments is used.
      async        : null,                 // asynchronous or not.
      timeout_id   : null,                 // id of timeout checking function
      counter      : 0,                    // until 0, decremented per each call, then execution starts.
      called       : false,                // execution started or not
      done         : false,                // execution ended or not
      cb_accessed  : false,                // whether callback is accessed via "this.callback", this means asynchronous.
      cb_called    : false                 // whether callback is called or not.
      // catcher      : null,                 // execute when the function throws an error.
      // scope        : _(junjo).scope,       // "this" scope to execute.
      // nodeCallback : _(junjo).nodeCallback // node-style callback or not
    });
  };

  function JFuncProto(obj) {
    Object.keys(obj).forEach(function(k) {
      this[k] = obj[k];
    }, this);
  }

  ['catcher', 'timeout', 'scope', 'nodeCallback'].forEach(function(propname) {
    Object.defineProperty(JFuncProto.prototype, propname, {
      get: function() {
        if (this['_'+propname] != undefined) return this['_'+propname];
        return _(this.junjo)[propname];
      },
      set: function(v) {this['_'+propname] = v; }
    });
  });

  JFunc.prototype.scope = function(scope) {
    if (scope != null && typeof scope == 'object') _(this).scope = scope;
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

  JFunc.prototype.bind = function() {
    this.scope(Array.prototype.shift.call(arguments));
    return this.params.apply(this, arguments);
  };

  JFunc.prototype.params = function() {
    Array.prototype.forEach.call(arguments, function(v) {
      _(this).params.push(v);
    }, this);
    return this;
  };

  JFunc.prototype.sync = function(bool) {
    _(this).async = (bool === undefined) ? false : !bool;
    return this;
  };

  JFunc.prototype.async = function(bool) {
    _(this).async = (bool === undefined) ? true : !!bool;
    return this;
  };

  JFunc.prototype.after = function() {
    var _this = _(this), _junjo = _(_this.junjo), lbl = _this.label;
    if (arguments.length == 0 && _junjo.labels[lbl] > 0)
      Array.prototype.push.call(arguments, _junjo.jfncs[_junjo.labels[lbl]-1].label());

    Array.prototype.forEach.call(arguments, function(lbl) {
      var before = _junjo.jfncs[_junjo.labels[lbl]];
      if (!before || before === this || _this.afters.indexOf(lbl) >= 0) return;
      _this.afters.push(lbl);
      _this.counter++;
      _(before).callbacks.push(this);
    }, this);

    return this;
  };

  JFunc.prototype.afterAbove = function(bool) {
    return this.after.apply(this, _(_(this).junjo).jfncs.map(function(jfn) {
      return jfn.label();
    }));
  };

  JFunc.prototype.catches = function() {
    var junjo = _(this).junjo;
    Array.prototype.push.call(arguments, _(this).func);
    junjo.remove(this.label()); // delete this object
    return junjo.catches.apply(junjo, arguments);
  };

  JFunc.prototype.catchesAbove = function() {
    var junjo = _(this).junjo;
    var func  = _(this).func;
    junjo.remove(this.label()); // delete this object
    return junjo.catchesAbove.call(junjo, func);
  };

  JFunc.prototype.scope = function(v) {
    if (v === undefined) return _(this).scope;
    else _(this).scope = v; return this;
  };

  JFunc.prototype.label = function(v) {
    if (arguments.length == 0) return _(this).label;
    else {
      if (v === undefined) return this;
      if (typeof v != 'string') throw new Error('cannot set a non-string label.');

      _(this).label = v;
      var _this = _(this), _junjo = _(_this.junjo); 
      var num = _junjo.labels[_this.label];
      delete _junjo.labels[_this.label];
      _junjo.labels[v] = num;
      return this;
    }
  };

  // execute the function and its callback, whatever happens.
  JFunc.prototype.execute = function() {
    var _this  = _(this), junjo  = _this.junjo, _junjo = _(junjo);

    // filters
    if (_junjo.terminated) return; // global-terminated filter
    if (_this.called) return; // execute-only-one-time filter
    if (_this.counter-- > 0) return; // dependency filter

    // preparation
    _this.called = true;
    _junjo.current = this;

    if (_this.params.length) {
      _this.params.forEach(function(param, k) {
        if (param instanceof KeyPath) _this.params[k] = param.get(_junjo.scope);
      });
    }
    else if (_this.afters.length) {
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
    else {
      _this.params = arguments;
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

        if (_this.timeout) return;

        var self = this;
        _this.timeout_id = setTimeout(function() {
          if (!_this.cb_called) {
            _this.done = true;
            jFail.call(self, new Error('callback wasn\'t called within '+ _time.timeout +' [sec] in function ' + self.label() + '.' ));
          }
        }, _this.timeout * 1000);
      }
    }
    catch (e) {
      _this.done = true;
      jFail.call(this, e);
    }
  };

  /** private functions of JFunc **/

  var isSync = function(_this) {
      return (_this.async === false || _this.async === null && !_this.cb_accessed);
  };
  var isAsync = function(_this) { return !isSync(_this); };

  var jFail = function(e) {
    var _this = _(this), _junjo = _(_this.junjo);

    if (jCallbackFilter(_this)) return;

    var args = (_this.catcher)
      ? _this.catcher.call(_junjo.scope, e, this)
      : defaultCatcher.call(_junjo.scope, e, this);

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
