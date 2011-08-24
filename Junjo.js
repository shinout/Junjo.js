var Junjo = (function() {
  "use strict";

  /** utility functions, variables **/
  var A = Array.prototype;

  var empty = function() {};

  var args2arr = function(args) {
    return A.map.call(args, function(v) {return v;});
  };

  var is_arguments = function(v) {
    return typeof v == 'object' && v.toString() == '[object Arguments]'; // FIXME there would be more elegant ways...
  };

  /** preparation for private properties **/

  var props = {}, variables = {}, current_id = 0;
  function _(obj) { return props[obj.id] }        // configurable properties before running
  function $(obj) { return variables[obj.id] }    // configurable properties after  running
  function D(obj) { delete props[obj.id], variables[obj.id]} // deletion

  /** constructor **/
  var Junjo = function(options) {
    options = options || {};

    // this function is returned in Junjo().
    var fJunjo = function() { return fJunjo.register.apply(fJunjo, arguments) };

    // fJunjo extends Junjo.prototype
    if(fJunjo.__proto__)
      fJunjo.__proto__ = Junjo.prototype;
    else 
      Object.keys(Junjo.prototype).forEach(function(k) { fJunjo[k] = Junjo.prototype[k]; });

    Object.defineProperty(fJunjo, 'id', { value : ++current_id, writable : false});
    Object.defineProperty(fJunjo, 'commons', {value : {err: null, out: {}, shared: {}}, writable : false});
    Object.seal(fJunjo.commons);

    // private properties
    props[fJunjo.id] = {
      jfncs        : [],    // registered functions
      labels       : {},    // {label => position of jfncs}
      listeners    : {}     // eventlisteners
    };
    resetState.call(fJunjo);  // set variables

    // properties from options
    ['timeout', 'catcher', 'nodeCallback'].forEach(function(k) { fJunjo[k] = options[k] });
    return fJunjo;
  };

  /** public properties, defined in Junjo.prototype **/
  Object.defineProperties(Junjo.prototype, {
    current  : { get : function () { return $(this).current }, set: empty },
    runnable : { get : function () { return $(this).runnable && !$(this).running }, set : empty },
    running  : { get : function () { return $(this).running }, set : empty },

    timeout : {
      get : function() { return (_(this).timeout != null) ? _(this).timeout : 5 },
      set : function(v) { if (typeof v == 'number') _(this).timeout = v }
    },

    catcher : {
      get : function()  { return _(this).catcher || this.defaultCatcher },
      set : function(v) { if (typeof v == 'function') _(this).catcher = v }
    },

    defaultCatcher : {
      value : function(e, jfunc) {
        console.error(e.stack || e.message || e);
        this.err = e;
        this.terminate();
        return false;
      },
      writable : false
    },

    nodeCallback : {
      get : function() { return !!_(this).nodeCallback },
      set : function(v) { if (typeof v == 'boolean') _(this).nodeCallback = v }
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
    }
  });

  // Junjo extends Function prototype
  Object.getOwnPropertyNames(Function.prototype).forEach(function(k) {
    Junjo.prototype[k] = Function.prototype[k];
  });

  /** public functions **/

  // register a function
  Junjo.prototype.register = function() {
    var label = (typeof arguments[0] != 'function') ? A.shift.call(arguments) : undefined;
    var jfn   = new JFunc(arguments[0], this);
    var _this = _(this);
    var num   = _this.jfncs.push(jfn) -1;
    if (label == undefined) label = num;
    _(jfn).label = label;
    _this.labels[label] = num;
    return jfn;
  };

  ['err', 'out', 'shared'].forEach(function(name) {
    Junjo.prototype[name] = function() {
      var kp = new KeyPath(args2arr(arguments), null, this.commons[name]);
      return (this.running) ? kp.get() : kp;
    };
  });

  // get result of each process.
  Junjo.prototype.results = function(lbl) {
    var $this = $(this);
    if (this.running) return (lbl == undefined) ? $this.results : $this.results[lbl];
     
    return new KeyPath(args2arr(arguments), null, $this.results);
  };

  Junjo.prototype.args = function() {
    var $this = $(this);
    if ($this.running) return $($this.current).args;

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
    var evtname   = A.shift.call(arguments);
    var listeners = _(this).listeners[evtname] || [];
    var args = arguments, commons = this.commons;
    listeners.forEach(function(listener) {
      setTimeout(function() { listener.apply(commons, args);}, 0);
    });
  };

  // set eventListener
  Junjo.prototype.on = function(evtname, fn) {
    if (! (_(this).listeners[evtname] instanceof Array)) _(this).listeners[evtname] = [];
    _(this).listeners[evtname].push(fn);
  };

  // get jfunc by label
  Junjo.prototype.get = function(lbl) {
    return _(this).jfncs[_(this).labels[lbl]];
  };

  // remove jfunc by label
  Junjo.prototype.remove = function(lbl) {
    var _this = _(this)
    var jfunc = this.get(lbl);
    var num   = _this.labels[lbl];
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
    var fn = A.pop.call(arguments);
    var _this = _(this);
    if (!arguments.length) {
      if (_this.jfncs.length) _(_this.jfncs[_this.jfncs.length-1]).catcher = fn;
    }
    else {
      A.forEach.call(arguments, function(lbl) {
        var jfunc = this.get(lbl);
        if (jfunc) _(jfunc).catcher = fn;
      }, this);
    }
    return this;
  };

  // add catcher to all the functions registered previously, except those already have a catcher.
  Junjo.prototype.catchesAbove = function(fn) {
    _(this).jfncs.forEach(function(jfnc) {
      if (!_(jfnc)._catcher) _(jfnc).catcher = fn;
    });
    return this;
  };

  // set synchronous/asynchronous jfunc
  Junjo.prototype.sync  = function() { return this.register.apply(this, arguments).sync() };
  Junjo.prototype.async = function() { return this.register.apply(this, arguments).async() };

  // set another Junjo object which executes before this.
  Junjo.prototype.after = function(jn) {
    var self = this, $this = $(this);
    jn.on('end', function(err, out) {
      $this.runnable = true;
      self.run(err, out);
    });
    $this.runnable = false;
    return this;
  };

  // skip the process with a given label, and make it return the passed arguments
  Junjo.prototype.skip = function() {
    var lbl = A.shift.call(arguments), jfn = this.get(lbl), $jfn = $(jfn);
    if ($jfn.called) return;
    $(jfn).skipped = arguments;
  };

   // run all the registered jfunc
  Junjo.prototype.run = function() {
    if ($(this).ended) resetState.call(this);
    if (!this.runnable) return this; // checking $this.runnable && !$this.running
    $(this).running = true;
    Object.freeze(_(this));

    var args = arguments, jfuncs = _(this).jfncs;
    jfuncs.forEach(function(jfn) { 
      Object.freeze(_(jfn));
      jResetState.call(jfn);
    });
    jfuncs.forEach(function(jfn) { jExecute.apply(jfn, args) });
    return this;
  };

  /** private functions **/

  var resetState = function() {
    variables[this.id] = {
      runnable     : true,  // allowable to run or not
      running      : false, // registered processes are running or not
      results      : {},    // results of each functions
      terminated   : false, // terminated or not
      ended        : false, // emited end event or not
      finished     : 0,     // the number of finished functions
      current      : null,  // pointer to current function
    };
    /** reset common properties **/
    this.commons.err    = null; // error to pass to the "end" event
    this.commons.out    = {};   // final output to pass to the "end" event
    this.commons.shared = {};   // shared values within jfuncs
  };

  var setResult = function(jfn, result) {
    var _this = _(this), $this = $(this);
    $this.finished++;

    $this.results[jfn.label()] = result;

    if ($this.finished == _this.jfncs.length && !$this.ended) {
      $this.ended = true;
      this.emit('end', this.commons.err, this.commons.out);
    }

    if ($this.terminated) {
      var bool = _this.jfncs.every(function(f) {
        var $jfn = $(f);
        return $jfn.cb_called || !$jfn.called;
      });
      if (!bool) return;

      this.emit('terminate', this.commons.err, this.commons.out);
      if (!$this.ended) {
        $this.ended = true;
        this.emit('end', this.commons.err, this.commons.out);
      }
    }
  };

  /** private class KeyPath **/
  var KeyPath = function(arr, type, obj) {
    this.keypath = arr, this.type = type, this.obj = obj;
  };

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

  /** private class JFunc **/
  var JFunc = function(fn, junjo) {
    Object.defineProperty(this, 'id', { value : ++current_id, writable : false});

    // private properties
    props[this.id] = {
      func         : fn,                  // registered function
      callback     : jSuccess.bind(this), // callback function
      label        : null,                // label
      callbacks    : [],                  // callback functions called in jCallback
      afters       : [],                  // labels of functions executed before this function
      params       : [],                  // parameters to be given to the function. if empty, original callback arguments is used.
      async        : null                 // asynchronous or not.
    };

    ['catcher', 'timeout', 'nodeCallback'].forEach(function(k) {
      Object.defineProperty(this, k, {
        get: function()  { return (this['_' + k] != null) ? this['_' + k] : junjo[k] },
        set: function(v) { this['_' + k] = v }
      });
    }, _(this));

    // public properties
    Object.defineProperties(this, {
      junjo  : { value : junjo, writable: false },

      callback : {
        get : function() {
          $(this).cb_accessed = true;
          return _(this).callback;
        },
        set : empty,
        enumerable: true
      },
    });

    // proxy to properties in Junjo, for enumerablity, not set to JFunc.prototype.
    ['shared', 'err', 'out'].forEach(function(propname) {
      Object.defineProperty(this, propname, {
        get : function()  { return this.junjo.commons[propname] },
        set : function(v) { this.junjo.commons[propname] = v },
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
    this.scope(A.shift.call(arguments));
    return this.params.apply(this, arguments);
  };

  JFunc.prototype.params = function() {
    A.forEach.call(arguments, function(v) {
      this.params.push(v);
    }, _(this));
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
    if (this.junjo.running) throw new Error("Cannot call after() while during execution.");
    var _this = _(this), _junjo = _(this.junjo), lbl = _this.label;
    if (arguments.length == 0 && _junjo.labels[lbl] > 0)
      A.push.call(arguments, _junjo.jfncs[_junjo.labels[lbl]-1].label());

    A.forEach.call(arguments, function(lbl) {
      var before = _junjo.jfncs[_junjo.labels[lbl]];
      if (!before || before === this || _this.afters.indexOf(lbl) >= 0) return;
      _this.afters.push(lbl);
      _(before).callbacks.push(this);
    }, this);

    return this;
  };

  JFunc.prototype.afterAbove = function(bool) {
    if (this.junjo.running) throw new Error("Cannot call afterAbove() while during execution.");
    return this.after.apply(this, _(this.junjo).jfncs.map(function(jfn) {
      return jfn.label();
    }));
  };

  JFunc.prototype.catches = function() {
    if (this.junjo.running) throw new Error("Cannot call catches() while during execution.");
    A.push.call(arguments, _(this).func);
    this.junjo.remove(this.label()); // delete this object
    return this.junjo.catches.apply(this.junjo, arguments);
  };

  // JSDeferred-like API
  JFunc.prototype.fail = function(fn) { _(this).catcher = fn; return this };
  JFunc.prototype.next = function() {
    return this.junjo.register.apply(this.junjo, arguments).after(this.label());
  };

  JFunc.prototype.catchesAbove = function() {
    if (this.junjo.running) throw new Error("Cannot call catchesAbove() during execution.");
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

      var _this = _(this), _junjo = _(this.junjo); 
      var num = _junjo.labels[_this.label];
      delete _junjo.labels[_this.label];
      _this.label = v;
      _junjo.labels[v] = num;
      return this;
    }
  };

  JFunc.prototype.emitOn = function(emitter, evtname, newname) {
    if (!this.junjo.running) throw new Error("Cannot call emitOn() before execution.");
    var self = this, $this = $(this);
    emitter.on(evtname, function() {
      A.unshift.call(arguments, newname || evtname);
      self.junjo.emit.apply(self.junjo, arguments);
    });

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

  /** private functions of JFunc **/

  var jResetState = function() {
    variables[this.id] = {
      args         : [],                    // arguments passed to this.execute()
      counter      : _(this).afters.length, // until 0, decremented per each call, then execution starts.
      emitters     : [],                    // event emitters
      called       : false,                 // execution started or not
      done         : false,                 // execution ended or not
      cb_accessed  : false,                 // whether callback is accessed via "this.callback", this means asynchronous.
      cb_called    : false                  // whether callback is called or not.
    };
  }

  var jExecute = function() {
    var _this  = _(this), $this = $(this), _junjo = _(this.junjo), $junjo = $(this.junjo);

    // filters
    if ($junjo.terminated || $this.called || $this.counter-- > 0) return; // execute filter

    // preparation
    $this.called = true;
    $junjo.current = this;

    if (_this.afters.length) {
      $this.args = _this.afters.reduce(function(arr, lbl) {
        var val = $junjo.results[lbl];
        if (is_arguments(val))
          A.forEach.call(val, function(v) { arr.push(v) });
        else
          arr.push(val);

        return arr;
      }, []);
    }
    else {
      $this.args = args2arr(arguments);
    }
    if (_this.params.length) $this.args = Junjo.args(_this.params, this);

    try {
      var ret = ($this.skipped != null)
        ? $this.skipped
        : _this.func.apply(_this.scope || this, $this.args); // execution
      $this.done = true;
      if (isSync(this)) {
        _this.callback(ret);
      }
      else {
        if ($this.cb_attempted) return jSuccess.apply(this, $this.cb_attempted);
        if ($junjo.terminated || !_this.timeout) return;

        var self = this;
        $this.timeout_id = setTimeout(function() {
          if (!$this.cb_called) {
            $this.done = true;
            jFail.call(self, new Error('callback wasn\'t called within '+ _this.timeout +' [sec] in function ' + self.label() + '.' ));
          }
        }, _this.timeout * 1000);
      }
    }
    catch (e) {
      $this.done = true;
      jFail.call(this, e);
    }
  };

  var isSync = function(jfn) { return (_(jfn).async === false || _(jfn).async === null && !$(jfn).cb_accessed) };

  var jFail = function(e) {
    if ($(this).cb_called) return;

    var args = _(this).catcher.call(this.junjo.commons, e, this);


    if (! (args instanceof Array)) 
      args = (args) ? [true, args] : [false];
    else
      args.unshift(true);

    return jCallback.apply(this, args);
  };

  var jSuccess = function() {
    var $this = $(this);
    if ($this.cb_called) return;
    if (!$this.done) return $this.cb_attempted = arguments;

    if (_(this).nodeCallback && !isSync(this) && arguments[0])
      return jFail.call(this, arguments[0]);

    A.unshift.call(arguments, true);
    return jCallback.apply(this, arguments);
  };

  // call next functions
  var jCallback = function() {
    var _this = _(this), $this = $(this), _junjo = _(this.junjo);
    $this.cb_called = true;

    if ($this.timeout_id) clearTimeout($this.timeout_id); // remove tracing callback

    var succeeded = A.shift.call(arguments);
    setResult.call(this.junjo, this, ($this.skipped != null || isSync(this)) ? arguments[0] : arguments);

    if (succeeded) _this.callbacks.forEach(function(cb_jfn) { jExecute.apply(cb_jfn) });
  };

  /** static functions **/
  Junjo.args = function(args, obj) {
    return A.map.call(args, function(v) { return (v instanceof KeyPath) ? v.get(obj) : v });
  };

  Object.freeze(Junjo);
  return Junjo;
})();

if (typeof exports == 'object' && exports === this) module.exports = Junjo;
