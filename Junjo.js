var Junjo = (function() {
  "use strict";

  /** utility functions, variables **/
  var A = Array.prototype;

  var empty = function() {};

  var args2arr = function(args) {
    return A.map.call(args, function(v) {return v;});
  };

  var nextTick = (typeof process == 'object' && typeof process.nextTick == 'function')
    ? process.nextTick
    : function(fn) { setTimeout(fn, 0) };

  var is_arguments = function(v) {
    return typeof v == 'object' && v.toString() == '[object Arguments]'; // FIXME there would be more elegant ways...
  };

  /** preparation for private properties **/

  var props = {}, variables = {}, current_id = 0;
  function _(obj) { return props[obj.id] }        // configurable properties before running
  function $(obj) { return variables[obj.id] }    // configurable properties after  running
  function D(obj) { delete props[obj.id], variables[obj.id]} // deletion

  /** constructor **/
  var Junjo = function() {
    var fn      = (typeof arguments[0] == 'function') ? A.shift.call(arguments) : undefined;
    var options = (typeof arguments[0] == 'object') ? arguments[0] : {};

    // this function $j is returned in Junjo().
    var $j = function() { return $j.register.apply($j, arguments) };

    // $j extends Junjo.prototype
    if($j.__proto__)
      $j.__proto__ = Junjo.prototype;
    else 
      Object.keys(Junjo.prototype).forEach(function(k) { $j[k] = Junjo.prototype[k]; });

    Object.defineProperty($j, 'id', { value : ++current_id, writable : false});
    Object.defineProperty($j, 'commons', {value : {err: null, out: {}, shared: {}}, writable : false});
    // Object.seal($j.commons);

    // private properties
    props[$j.id] = {
      $fns         : [],    // registered functions
      labels       : {},    // {label => position of $fns}
      listeners    : {},    // eventlisteners
      result       : false  // if true and all processes are synchronous, return result at $j.run() (experimental)
    };
    resetState.call($j);  // set variables

    // properties from options
    ['timeout', 'catcher', 'nodeCallback'].forEach(function(k) { $j[k] = options[k] });
    if (options.result != undefined) _($j).result = !!options.result;
    if (options.after != undefined) _($j).after = !!options.after;
    if (fn) {
			$j(fn)
			.next(function() { this.out = (arguments.length == 1) ? arguments[0] : args2arr(arguments) })
			.fail(function(e) { this.err = e });
		}
    if (options.run) { nextTick($j.run.bind($j, options.run)) }
    $j.constructor = Junjo;
    return $j;
  };

  /** public properties, defined in Junjo.prototype **/
  Object.defineProperties(Junjo.prototype, {
    current  : { get : function () { return $(this).current }, set: empty },
    runnable : { get : function () { return $(this).runnable && !$(this).running }, set : empty },
    running  : { get : function () { return $(this).running }, set : empty },
    length   : { get : function () { return _(this).$fns.length }, set : empty },

    timeout : {
      get : function() { return (_(this).timeout != null) ? _(this).timeout : 5 },
      set : function(v) { if (typeof v == 'number') _(this).timeout = v }
    },

    catcher : {
      get : function()  { return _(this).catcher || this.defaultCatcher },
      set : function(v) { if (typeof v == 'function') _(this).catcher = v }
    },

    defaultCatcher : {
      value : function(e, $fn) {
        console.error(e.stack || e.message || e);
        this.err = e;
        $fn.junjo.terminate();
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

    cb : {
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
    if (arguments[0].constructor == Junjo) {
      var $j2 = arguments[0];
      return this.register(label, function() { this.sub = $j2 });
    }
    var $fn   = new $Fn(arguments[0], this);
    var _this = _(this);
    var num   = _this.$fns.push($fn) -1;
    if (label == undefined) label = num;
    _($fn).label = label;
    _this.labels[label] = num;
    return _this.after ? $fn.after() : $fn;
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
      nextTick(function() { listener.apply(commons, args) });
    });
  };

  // set eventListener
  Junjo.prototype.on = function(evtname, fn) {
    if (! (_(this).listeners[evtname] instanceof Array)) _(this).listeners[evtname] = [];
    _(this).listeners[evtname].push(fn);
    return this;
  };

  // get $fn by label
  Junjo.prototype.get = function(lbl) {
    return _(this).$fns[_(this).labels[lbl]];
  };

  // remove $fn by label
  Junjo.prototype.remove = function(lbl) {
    var _this = _(this)
    var $fn   = this.get(lbl);
    var num   = _this.labels[lbl];
    _this.$fns.splice(num, 1);
    delete _this.labels[lbl];
    D($fn);
    for (var i=num, l=_this.$fns.length; i<l; i++) {
      _this.labels[_this.$fns[i].label()] = i;
    }
    return this;
  };

  // add catcher
  Junjo.prototype.catches = function() {
    var fn = A.pop.call(arguments);
    var _this = _(this);
    if (!arguments.length) {
      if (_this.$fns.length) _(_this.$fns[_this.$fns.length-1]).catcher = fn;
    }
    else {
      A.forEach.call(arguments, function(lbl) {
        var $fn = this.get(lbl);
        if ($fn) _($fn).catcher = fn;
      }, this);
    }
    return this;
  };

  // add catcher to all the functions registered previously, except those already have a catcher.
  Junjo.prototype.catchesAbove = function(fn) {
    _(this).$fns.forEach(function($fn) {
      if (!_($fn).catcher) _($fn).catcher = fn;
    });
    return this;
  };

  // set synchronous/asynchronous $fn
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
    var lbl = A.shift.call(arguments), $fn = this.get(lbl), $$fn = $($fn);
    if ($$fn.called) return;
    $$fn.skipped = arguments;
  };

   // run all the registered $fn
  Junjo.prototype.run = function() {
    if ($(this).ended) resetState.call(this);
    if (!this.runnable) return this; // checking $this.runnable && !$this.running
    $(this).running = true;
    Object.freeze(_(this));

    var args = arguments, $fns = _(this).$fns;
    $fns.forEach(function($fn) {
      Object.freeze(_($fn));
      jResetState.call($fn);
    });
    $fns.forEach(function($fn) { jExecute.apply($fn, args) });
    if (!$fns.length) finishCheck.call(this);

    return ($(this).ended && _(this).result) ? this.commons.out : this;
    return this;
  };

  // JSDeferred-like API
  Junjo.prototype.next = function(fn, options) {
    return new Junjo(fn, options).after(this);
  };

  Junjo.prototype.fail = function(fn) {
    var $j = new Junjo();
    $j(function(e, o) { if (e) fn.call(this, e, o) });
    return $j.after(this);
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
    this.commons.shared = {};   // shared values within $fns 
  };

  var setResult = function($fn, result) {
    var $this = $(this);
    $this.finished++;

    $this.results[$fn.label()] = result;
    finishCheck.call(this);
  };

  var finishCheck = function() {
    var _this = _(this), $this = $(this);
    if ($this.finished == _this.$fns.length && !$this.ended) {
      $this.ended = true;
      this.emit('end', this.commons.err, this.commons.out);
    }

    if ($this.terminated) {
      var bool = _this.$fns.every(function($fn) {
        var $$fn = $($fn);
        return $$fn.cb_called || !$$fn.called;
      });
      if (!bool) return;

      this.emit('terminate', this.commons.err, this.commons.out);
      if (!$this.ended) {
        $this.ended = true;
        this.emit('end', this.commons.err, this.commons.out);
      }
    }
  }

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

  /** private class $Fn **/
  var $Fn = function(fn, junjo) {
    Object.defineProperty(this, 'id', { value : ++current_id, writable : false});
    Object.defineProperty(this, 'junjo',{ value : junjo, writable: false });

    // private properties
    props[this.id] = {
      func         : fn,                  // registered function
      callbacks    : [],                  // callback functions called in jCallback
      afters       : [],                  // labels of functions executed before this function
      params       : []                   // parameters to be given to the function. if empty, original callback arguments is used.
    };
  };

  // public properties
  // proxy to properties in Junjo, for enumerablity, not set to $Fn.prototype.
  ['shared', 'err', 'out'].forEach(function(propname) {
    Object.defineProperty($Fn.prototype, propname, {
      get : function()  { return this.junjo.commons[propname] },
      set : function(v) { this.junjo.commons[propname] = v }
    });
  });

  ['callback', 'cb'].forEach(function(propname) {
    Object.defineProperty($Fn.prototype, propname, {
      get : function() {
        $(this).cb_accessed = true;
        return jSuccess.bind(this);
      },
      set : empty
    });
  });

  Object.defineProperty($Fn.prototype, 'sub', {
    get : function() {
      var $this = $(this);
      if (!$this.sub) { this.sub = new Junjo() }
      return $this.sub;
    },
    set : function($j) {
      if ($j.constructor == Junjo) {
        var $this = $(this), cb = this.callback;
        $this.sub = $j;
        $this.sub.on('end', function() { cb(this.err, this.out) });
        nextTick(function() { $this.sub.run.apply($this.sub, $this.args) });
      }
    }
  });

  $Fn.prototype.scope = function(scope) {
    if (scope != null && typeof scope == 'object') _(this).scope = scope;
    return this;
  };

  $Fn.prototype.nodeCallback = function(bool) {
    _(this).nodeCallback = (bool !== false);
    return this;
  };

  $Fn.prototype.timeout = function(v) {
    if (typeof v == "number") _(this).timeout = v;
    return this;
  };

  $Fn.prototype.bind = function() {
    this.scope(A.shift.call(arguments));
    return this.params.apply(this, arguments);
  };

  $Fn.prototype.params = function() {
    A.forEach.call(arguments, function(v) {
      this.params.push(v);
    }, _(this));
    return this;
  };

  $Fn.prototype.sync = function(bool) {
    _(this).async = (bool === undefined) ? false : !bool;
    return this;
  };

  $Fn.prototype.async = function(bool) {
    _(this).async = (bool === undefined) ? true : !!bool;
    return this;
  };

  $Fn.prototype.after = function() {
    if (this.junjo.running) throw new Error("Cannot call after() while during execution.");
    var _this = _(this), _junjo = _(this.junjo), lbl = _this.label;
    if (arguments.length == 0 && _junjo.labels[lbl] > 0)
      A.push.call(arguments, _junjo.$fns[_junjo.labels[lbl]-1].label());

    A.forEach.call(arguments, function(lbl) {
      var before = _junjo.$fns[_junjo.labels[lbl]];
      if (!before || before === this || _this.afters.indexOf(lbl) >= 0) return;
      _this.afters.push(lbl);
      _(before).callbacks.push(this);
    }, this);

    return this;
  };

  $Fn.prototype.afterAbove = function(bool) {
    if (this.junjo.running) throw new Error("Cannot call afterAbove() while during execution.");
    return this.after.apply(this, _(this.junjo).$fns.map(function($fn) {
      return $fn.label();
    }));
  };

  $Fn.prototype.catches = function(fn) { _(this).catcher = fn; return this };

  // JSDeferred-like API
  $Fn.prototype.fail = $Fn.prototype.catches;
  $Fn.prototype.next = function() {
    return this.junjo.register.apply(this.junjo, arguments).after(this.label());
  };

  $Fn.prototype.catchesAbove = function() {
    if (this.junjo.running) throw new Error("Cannot call catchesAbove() during execution.");
    var func  = _(this).func;
    this.junjo.remove(this.label()); // delete this object
    return this.junjo.catchesAbove.call(this.junjo, func);
  };

  $Fn.prototype.scope = function(v) {
    if (v === undefined) return _(this).scope;
    else _(this).scope = v; return this;
  };

  $Fn.prototype.label = function(v) {
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

  $Fn.prototype.emitOn = function(emitter, evtname, newname) {
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

  /** private functions of $Fn **/

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
        return jSuccess.call(this, ret);
      }
      else {
        if ($this.cb_attempted) return jSuccess.apply(this, $this.cb_attempted);
        if ($junjo.terminated || !jInheritValue.call(this, 'timeout')) return;

        var self = this;
        var timeout = jInheritValue.call(this, 'timeout');
        $this.timeout_id = setTimeout(function() {
          if (!$this.cb_called) {
            $this.done = true;
            jFail.call(self, new Error('callback wasn\'t called within '+ timeout +' [sec] in function ' + self.label() + '.' ));
          }
        }, timeout * 1000);
      }
    }
    catch (e) {
      $this.done = true;
      return jFail.call(this, e);
    }
  };

  var isSync = function($fn) { return (_($fn).async === false || _($fn).async == null && !$($fn).cb_accessed) };

  var jFail = function(e) {
    if ($(this).cb_called) return;

    var args = jInheritValue.call(this, 'catcher').call(this.junjo.commons, e, this);

    if (! (args instanceof Array)) 
      args = (args) ? [true, args] : [false];
    else
      args.unshift(true);

    return jCallback.apply(this, args);
  };

  var jInheritValue = function(keyname) {
    var v = _(this)[keyname];
    return (v == null) ? this.junjo[keyname] : v;
  };

  var jSuccess = function() {
    var $this = $(this);
    if ($this.cb_called) return;
    if (!$this.done) return $this.cb_attempted = arguments;

    if (jInheritValue.call(this, 'nodeCallback') && !isSync(this) && arguments[0])
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

    if (succeeded) _this.callbacks.forEach(function($fn) { jExecute.apply($fn) });
  };

  /** static functions **/
  Junjo.args = function(args, obj) {
    return A.map.call(args, function(v) { return (v instanceof KeyPath) ? v.get(obj) : v });
  };

  // Object.freeze(Junjo);
  return Junjo;
})();

if (typeof exports == 'object' && exports === this) module.exports = Junjo;
