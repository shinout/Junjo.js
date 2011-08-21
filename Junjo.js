var Junjo = (function() {
  "use strict";

  /** utility functions **/

  var args2arr = function(args) {
    return Array.prototype.map.call(args, function(v) {return v;});
  };

  var is_arguments = function(v) {
    return typeof v == 'object' && v.toString() == '[object Arguments]'; // FIXME there would be more elegant ways...
  };
  var empty = function() {};

  /** preparation for private properties **/

  var props = {}, variables = {}, current_id = 0;
  function _(obj) { return props[obj.id]; }     // unconfigurable properties after running
  function $(obj) { return variables[obj.id]; } // configurable properties after running
  function D(obj) { delete props[obj.id], variables[obj.id]} // deletion

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
      return Junjo.prototype.register.apply(fJunjo, arguments);
    };

    // fJunjo extends Junjo.prototype
    if(fJunjo.__proto__)
      fJunjo.__proto__ = Junjo.prototype;
    else 
      Object.keys(Junjo.prototype).forEach(function(k) { fJunjo[k] = Junjo.prototype[k]; });

    Object.defineProperty(fJunjo, 'id', { value : ++current_id, writable : false});

    // private properties
    props[fJunjo.id] = {
      jfncs        : [],    // registered functions
      labels       : {},    // {label => position of jfncs}
      listeners    : {},    // eventlisteners
      timeout      : 5,     // timeout [sec]
      catcher      : null,  // default catcher
      nodeCallback : false, // use node-style callback or not
      runnable     : true   // allowable to run or not
    };

    variables[fJunjo.id] = {
      running      : false, // running or not
      results      : {},    // results of each functions
      terminated   : false, // terminated or not
      ended        : false, // emited end event or not
      finished     : 0,     // the number of finished functions
      current      : null   // pointer to current function
    };

    // properties from options
    [ ['timeout'     , 'number'],
      ['catcher'     , 'function'],
      ['nodeCallback', 'boolean']
    ].forEach(function(v) {
      var propname = v[0], type = v[1];
      if (typeof options[propname] == type) _(fJunjo)[propname] = options[propname];
    });

    /** public properties **/
    fJunjo.shared = {};   // shared values within jfuncs
    fJunjo.err    = null; // error to pass to the "end" event
    fJunjo.out    = {};   // final output to pass to the "end" event

    Object.seal(fJunjo);
    return fJunjo;
  };


  /** public properties, defined in Junjo.prototype **/
  Object.defineProperties(Junjo.prototype, {
    current : {
      get: function() { return $(this).current; },
      set: empty
    },

    callback : {
      get: function() {
        if (this.current) return this.current.callback; // cb_accessed.
        return new KeyPath(['callback']);
      },
      set: empty
    },

    label : {
      get : function () {
        if (this.current) return _(this.current).label;
        return new KeyPath(['label'], '_');
      },
      set : empty
    },

    runnable : {
      get : function () { return _(this).runnable && !$(this).running },
      set : empty
    }
  });

  // Junjo extends Function prototype
  Object.getOwnPropertyNames(Function.prototype).forEach(function(k) {
    Junjo.prototype[k] = Function.prototype[k];
  });


  /** public functions **/

  // register a function
  Junjo.prototype.register = function() {
    var label   = (typeof arguments[0] != 'function') ? Array.prototype.shift.call(arguments) : undefined;
    var jfn     = new JFunc(arguments[0], this);
    var _this= _(this);
    var num     = _this.jfncs.push(jfn) -1;
    if (label == undefined) label = num;
    _(jfn).label = label;
    _this.labels[label] = num;
    return jfn;
  };

  // get result of each process.
  Junjo.prototype.results = function(lbl) {
    var $this = $(this);
    if ($this.current) {
      if (lbl == undefined) return $this.results;
      return $this.results[lbl];
    }
    return new KeyPath(args2arr(arguments), null, $this.results);
  };

  Junjo.prototype.args = function() {
    var $this = $(this);
    if ($this.current) {
      return $($this.current).args;
    }
    var arr = args2arr(arguments);
    arr.unshift('args');
    return new KeyPath(arr, '$');
  };

  // terminate whole process
  Junjo.prototype.terminate = function() {
    $(this).terminated = true;
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
    var num = _this.labels[lbl];
    _this.jfncs.splice(num, 1);
    delete _this.labels[lbl];
    D(jfunc);
    for (var i=num, l=_this.jfncs.length; i<l; i++) {
      _this.labels[_this.jfncs[i].label()] = i;
    }
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
    if (!this.runnable) return this; // checking _this.runnable && !_this.running
    $(this).running = true;

    Object.freeze(_this);

    var fncs = {};
    var args = arguments;
    _this.jfncs.forEach(function(jfn) {
      var _jfn = _(jfn);
      $(jfn).counter = _jfn.afters.length;
      Object.freeze(_jfn);
    });

    _this.jfncs.forEach(function(jfn) {
      jExecute.apply(jfn, args);
    });

    return this;
  };


  /** private functions **/

  var defaultCatcher = function(e, jfunc) {
    console.error(e.stack || e.message || e);
    this.err = e;
    this.terminate();
    return false;
  };

  var setResult = function(jfn, args_result, use_one) {
    var _this = _(this), $this = $(this);
    $this.finished++;

    $this.results[jfn.label()] = (use_one) ? args_result[0] : args_result;

    if ($this.finished == _this.jfncs.length && !$this.ended) {
      $this.ended = true;
      this.emit('end', this.err, this.out);
    }

    if ($this.terminated) {
      var bool  = _this.jfncs.every(function(f) {
        var $jfn = $(f);
        return $jfn.cb_called || !$jfn.called;
      });
      if (!bool) return;

      this.emit('terminate', this.err, this.out);
      if (!$this.ended) {
        $this.ended = true;
        this.emit('end', this.err, this.out);
      }
    }
  };


  /** private class KeyPath **/
  var KeyPath = function(arr, type, obj) {
    this.keypath = arr;
    this.type = type;
    this.obj = obj;
  }

  KeyPath.prototype.get = function(obj) {
    obj = this.obj || obj;
    switch (this.type) {
      default  : break;
      case '_' : obj = _(obj); break;
      case '$' : obj = $(obj); break;
    }
    return this.keypath.reduce(function(o, k) {
     if (o == null || (typeof o != 'object' && o[k] == null)) return null;
      return o[k];
    }, obj);
  };

  /***
   * private class JFunc
   * function wrapper
   **/
  var JFunc = function(fn, junjo) {
    Object.defineProperty(this, 'id', { value : ++current_id, writable : false});

    // private properties
    props[this.id] = {
      func         : fn,                     // registered function
      callback     : jCallback.bind(this),   // callback function
      label        : null,                   // label
      callbacks    : [],                     // callback functions called in jCallback
      afters       : [],                     // labels of functions executed before this function
      params       : [],                     // parameters to be given to the function. if empty, original callback arguments is used.
      async        : null                    // asynchronous or not.
    };

    variables[this.id] = {
      args         : [],                     // arguments passed to this.execute()
      timeout_id   : null,                   // id of timeout checking function
      counter      : 0,                      // until 0, decremented per each call, then execution starts.
      emitters     : [],                     // event emitters
      called       : false,                  // execution started or not
      done         : false,                  // execution ended or not
      cb_accessed  : false,                  // whether callback is accessed via "this.callback", this means asynchronous.
      cb_called    : false                   // whether callback is called or not.
    };

    ['catcher', 'timeout', 'nodeCallback'].forEach(function(propname) {
      Object.defineProperty(props[this.id], propname, {
        get: function() {
          if (this['_' + propname] != undefined) return this['_' + propname];
          return _(junjo)[propname];
        },
        set: function(v) {this['_' + propname] = v; }
      });
    }, this);

    // public properties
    Object.defineProperties(this, {
      junjo : {value: junjo, writable: false},

      callback : {
        get : function() {
          $(this).cb_accessed = true;
          return _(this).callback;
        },
        set : empty,
        enumerable: true
      }
    });

    // proxy to properties in Junjo, for enumerablity, not set to JFunc.prototype.
    ['shared', 'err', 'out'].forEach(function(propname) {
      Object.defineProperty(this, propname, {
        get : function()  { return this.junjo[propname]},
        set : function(v) { this.junjo[propname] = v},
        enumerable: true
      });
    }, this);
  };

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

  JFunc.prototype.emitOn = function(emitter, evtname, newname) {
    var self = this;
    emitter.on(evtname, function() {
      Array.prototype.unshift.call(arguments, newname || evtname);
      self.junjo.emit.apply(self.junjo, arguments);
    });
    this.emitEnd(emitter);
    return self;
  };

  JFunc.prototype.emitEnd = function(emitter) {
    var self = this, $this = $(this);
    if ($this.emitters.indexOf(emitter) < 0) {
      var cb = this.callback;
      emitter.on('end', function(){
        var n = $this.emitters.indexOf(emitter);
        if (n < 0) return;
        $this.emitters.splice(n, 1);
        if ($this.emitters.length == 0) cb(); 
      });
      emitter[(typeof emitter.once == 'function') ? 'once' : 'on']('error', function(e) {
        var n = $this.emitters.indexOf(emitter);
        if (n < 0) return;
        $this.emitters.splice(n, 1);
        if ($this.emitters.length == 0) jFail.bind(self);
      });
      $this.emitters.push(emitter);
    }
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
    if ($(this.junjo).running) throw new Error("Cannot call after() while during execution.");
    var _this = _(this), _junjo = _(this.junjo), lbl = _this.label;
    if (arguments.length == 0 && _junjo.labels[lbl] > 0)
      Array.prototype.push.call(arguments, _junjo.jfncs[_junjo.labels[lbl]-1].label());

    Array.prototype.forEach.call(arguments, function(lbl) {
      var before = _junjo.jfncs[_junjo.labels[lbl]];
      if (!before || before === this || _this.afters.indexOf(lbl) >= 0) return;
      _this.afters.push(lbl);
      _(before).callbacks.push(this);
    }, this);

    return this;
  };

  JFunc.prototype.afterAbove = function(bool) {
    if ($(this.junjo).running) throw new Error("Cannot call afterAbove() while during execution.");
    return this.after.apply(this, _(this.junjo).jfncs.map(function(jfn) {
      return jfn.label();
    }));
  };

  JFunc.prototype.catches = function() {
    if ($(this.junjo).running) throw new Error("Cannot call catches() while during execution.");
    Array.prototype.push.call(arguments, _(this).func);
    this.junjo.remove(this.label()); // delete this object
    return this.junjo.catches.apply(this.junjo, arguments);
  };

  JFunc.prototype.catchesAbove = function() {
    if ($(this.junjo).running) throw new Error("Cannot call catchesAbove() during execution.");
    var func  = _(this).func;
    this.junjo.remove(this.label()); // delete this object
    return this.junjo.catchesAbove.call(this.junjo, func);
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
      var _this = _(this), _junjo = _(this.junjo); 
      var num = _junjo.labels[_this.label];
      delete _junjo.labels[_this.label];
      _junjo.labels[v] = num;
      return this;
    }
  };

  /** private functions of JFunc **/

  var jExecute = function() {
    var _this  = _(this), $this = $(this), _junjo = _(this.junjo), $junjo = $(this.junjo);

    // filters
    if ($junjo.terminated) return; // global-terminated filter
    if ($this.called) return; // execute-only-one-time filter
    if ($this.counter-- > 0) return; // dependency filter

    // preparation
    $this.called = true;
    $junjo.current = this;

    if (_this.afters.length) {
      $this.args = _this.afters.reduce(function(arr, lbl) {
        var val = $junjo.results[lbl];
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
      $this.args = args2arr(arguments);
    }

    if (_this.params.length) {
      _this.params.forEach(function(param, k) {
        if (param instanceof KeyPath) _this.params[k] = param.get(this);
      }, this);
      $this.args = _this.params;
    }

    // execution
    try {
      var ret = _this.func.apply(_this.scope || this, $this.args);
      $this.done = true;
      if (isSync(this)) { // synchronous
        _this.callback(ret);
      }
      else { // checking if the callback is called in the function with in timeout[sec]
        if ($junjo.terminated) return;

        if (_this.timeout) return;

        var self = this;
        $this.timeout_id = setTimeout(function() {
          if (!$this.cb_called) {
            $this.done = true;
            jFail.call(self, new Error('callback wasn\'t called within '+ _time.timeout +' [sec] in function ' + self.label() + '.' ));
          }
        }, _this.timeout * 1000);
      }
    }
    catch (e) {
      $this.done = true;
      jFail.call(this, e);
    }
  };

  var isSync = function(jfn) {
    return (_(jfn).async === false || _(jfn).async === null && !$(jfn).cb_accessed);
  };
  var isAsync = function(jfn) { return !isSync(jfn); };

  var jFail = function(e) {
    var _this = _(this), $this = $(this),  _junjo = _(this.junjo);

    if (jCallbackFilter($this)) return;

    var args = (_this.catcher)
      ? _this.catcher.call(this.junjo, e, this)
      : defaultCatcher.call(this.junjo, e, this);

    if (! (args instanceof Array)) 
      args = (args) ? [true, args] : [false];
    else
      args.unshift(true);

    return jCallbackNext.apply(this, args);
  };

  var jCallbackFilter = function($this) {
    return (!$this.done || $this.cb_called); // already-called-or-cannot-call filter
  };

  var jCallback = function() {
    var _this = _(this), $this = $(this);
    if (_this.nodeCallback && isAsync(this) && arguments[0]) { // checking node-style callback error
      return jFail.call(this, arguments[0]);
    }
    if (jCallbackFilter($this)) return;

    Array.prototype.unshift.call(arguments, true);
    return jCallbackNext.apply(this, arguments);
  };

  // private in private function
  var jCallbackNext = function() {
    var _this = _(this), $this = $(this), _junjo = _(this.junjo);
    $this.cb_called = true;

    if ($this.timeout_id) {
      clearTimeout($this.timeout_id); // remove tracing callback
      $this.timeout_id = null;
    }

    var succeeded = Array.prototype.shift.call(arguments);

    setResult.call(this.junjo, this, arguments, isSync(this));

    if (succeeded) {
      _this.callbacks.forEach(function(cb_jfn) {
        jExecute.apply(cb_jfn);
      });
    }
  };

  return Junjo;
})();

if (typeof exports == 'object' && exports === this) module.exports = Junjo;
