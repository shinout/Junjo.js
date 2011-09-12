var Junjo = (function() {
  // "use strict"; // commented out because of is_arguments()

  /** utility functions, variables **/
  var A = Array.prototype;

  var empty = function() {};

  var args2arr = function(args) {
    return A.map.call(args, function(v) {return v });
  };

  var nextTick = (typeof process == 'object' && typeof process.nextTick == 'function')
    ? process.nextTick
    : function(fn) { setTimeout(fn, 0) };

  var is_arguments = function(v) { return v && v.callee };
  var SHIFT = 'shift';

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

    // private properties
    props[$j.id] = {
      $fns         : [],    // registered functions
      labels       : {},    // {label => position of $fns}
      listeners    : {},    // eventlisteners
      result       : false  // if true and all processes are synchronous, return result at $j.run() (experimental)
    };
    resetState.call($j);  // set variables

    // properties from options
    ['timeout', 'catcher', 'firstError'].forEach(function(k) { $j[k] = options[k] });
    if (options.result != undefined) _($j).result = !!options.result;
    if (options.after != undefined) _($j).after = !!options.after;
    if (fn) {
			$j(fn)
			.next(function() { this.out = (arguments.length == 1) ? arguments[0] : args2arr(arguments) }) // aa
			.fail(function(e) { this.err = e });
		}
    if (options.run) { nextTick($j.run.bind($j, options.run)) }
    $j.constructor = Junjo;
    $j.future = new Future($j);
    return $j;
  };

  /** public properties, defined in Junjo.prototype **/
  Object.defineProperties(Junjo.prototype, {
    current  : { get : function () { return $(this).current }, set: empty },
    runnable : { get : function () { return $(this).runnable && !$(this).running }, set : empty },
    running  : { get : function () { return $(this).running }, set : empty },
    size     : { get : function () { return _(this).$fns.length }, set : empty },
    $        : { get : function()  { return this.shared }, set : function(v) { this.shared = v } },

    timeout : {
      get : function() { return (_(this).timeout != null) ? _(this).timeout : 5 },
      set : function(v) { if (typeof v == 'number') _(this).timeout = v }
    },

    catcher : {
      get : function()  { return _(this).catcher || this.defaultCatcher },
      set : function(v) { if (typeof v == 'function') _(this).catcher = v }
    },

    defaultCatcher : {
      value : function(e, args) {
        console.log(e.stack || e.message || e);
        this.err = e;
        this.junjo.terminate();
      },
      writable : false
    },

    firstError : {
      get : function() { return _(this).firstError },
      set : function(v) { if (typeof v == 'boolean' || v == SHIFT) _(this).firstError = v }
    },

    callback : { get : function() { return this.future.callback }, set : empty },
    cb       : { get : function() { return this.future.callback }, set : empty },
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

  // get results of each process.
  Junjo.prototype.results = function() {
    return (!arguments.length) ? $(this).results : KeyPath.get($(this).results, arguments, this);
  };
  Junjo.prototype.args = function() { return this.current ? KeyPath.get($(this.current).args, arguments, this.current) : null };

  // terminate whole process
  Junjo.prototype.terminate = function() {
    _(this).$fns.forEach(function($fn) { this.skip($fn.label()) }, this);
  };

  // emitting event asynchronously. The similar way as EventEmitter in Node.js
  Junjo.prototype.emit = function() {
    var evtname   = A.shift.call(arguments);
    var listeners = _(this).listeners[evtname] || [];
    var args = arguments, self = this;
    listeners.forEach(function(listener) {
      nextTick(function() { listener.apply(self, args) });
    });
  };

  // set eventListener
  Junjo.prototype.on = function(evtname, fn) {
    if (evtname == 'end' && $(this).ended) {
      var self = this;
      nextTick(function() {
        // pseudo onEnd
        fn.call(self, self.err, self.out);
      });
      return;
    }
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
    if ($$fn.called || $$fn.skipped) return;
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
    finishCheck.call(this);

    return ($(this).ended && _(this).result) ? this.out : this;
  };

  // JSDeferred-like API
  Junjo.prototype.next = function(j, options) {
    if (j.constructor == Junjo) return j.after(this);
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
      ended        : false, // emited end event or not
      finished     : 0,     // the number of finished functions
      current      : null,  // pointer to current function
    };
    /** reset common properties **/
    this.err    = null; // error to pass to the "end" event
    this.out    = {};   // final output to pass to the "end" event
    this.shared = {};   // shared values within $fns 
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
      this.emit('end', this.err, this.out);
    }

  }

  function Future($j) { this.$j = $j }

  Future.get = function(target, args) {
    var kp = new KeyPath(target, args, this);
    return (this.running) ? kp.get() : kp;
  };

  ['callback', 'cb', 'label'].forEach(function(propname) {
    Object.defineProperty(Future.prototype, propname, {
      get: function() { return Future.get.call(this.$j, 'current', [propname]) }, set: empty
    });
  });

  ['out', 'err', 'shared', '$', 'args', 'results', 'current'].forEach(function(propname) {
    Object.defineProperty(Future.prototype, propname, {
      get: function() { var $j = this.$j;
        return function future() { return Future.get.call($j, propname, arguments) };
      },
      set: empty
    });
  });

  function KeyPath(target, args, scope) { this.target = target, this.args = args, this.scope = scope }
  KeyPath.get = function(target, args, scope) {
    if (typeof target == 'function') return target.apply(scope, args);
    return A.reduce.call(args, function(o, k) {
     if (o == null || (typeof o != 'object' && o[k] == null)) return null;
     if (typeof o[k] == 'function' && o[k].name == 'future') return o[k]();
     return o[k];
    }, target);
  };
  KeyPath.prototype.get = function() { return KeyPath.get(this.scope[this.target], this.args, this.scope) };

  /** private class $Fn **/
  var $Fn = function(fn, junjo) {
    Object.defineProperty(this, 'id', { value : ++current_id, writable : false});
    Object.defineProperty(this, 'junjo', { value : junjo, writable: false });

    // private properties
    props[this.id] = {
      func         : fn, // registered function
      callbacks    : [], // callback functions called in jNext
      afters       : [], // labels of functions executed before this function
      params       : []  // parameters to be given to the function. if empty, original callback arguments is used.
    };
  };

  // public properties
  // proxy to properties in Junjo, for enumerablity, not set to $Fn.prototype.
  ['shared', '$', 'err', 'out'].forEach(function(propname) {
    Object.defineProperty($Fn.prototype, propname, {
      get : function()  { return this.junjo[propname] },
      set : function(v) { this.junjo[propname] = v }
    });
  });

  ['callback', 'cb'].forEach(function(propname) {
    Object.defineProperty($Fn.prototype, propname, {
      get : function() {
        $(this).cb_accessed = true;
        return jCallback.bind(this);
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
        // $this.sub.on('end', function() {cb($this.sub.err, $this.sub.out)});
        this.absorbEnd($this.sub, 'sub', true);
        nextTick(function() { $this.sub.run.apply($this.sub, $this.args) });
      }
    }
  });

  $Fn.prototype.scope = function(scope) {
    if (scope != null && typeof scope == 'object') _(this).scope = scope;
    return this;
  };

  $Fn.prototype.firstError = function(val) {
    if (val != SHIFT && val !== false) val = true;
    _(this).firstError = val;
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

  $Fn.prototype.failSafe = function() {
    var args = arguments;
    return this.catches(function() { return args });
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

  $Fn.prototype.label = function future(v) {
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

  $Fn.prototype.absorb = function(emitter, evtname, fn, name) {
    if (!this.junjo.running) throw new Error("Cannot call absorb() before execution.");
    var self = this, $this = $(this);
    name || (name = $this.emitterCount.toString());
    emitter.on(evtname, function() {
      try {
        A.push.call(arguments, $this.absorbs[name], self);
        var ret = fn.apply(emitter, arguments);
        if (ret) $this.absorbs[name] = ret;
      }
      catch (e) {
        $this.absorbErr = e;
      }
    });
    return this.absorbEnd(emitter, name);
  };

  $Fn.prototype.absorbError = function(emitter, evtname) {
    if (!this.junjo.running) throw new Error("Cannot call absorbError() before execution.");
    var self = this, $this = $(this);
    var err = '';
    var fn = (typeof arguments[2] == 'function') ? A.splice.call(arguments, 2, 1): function(e) {
      if (toStr) err += e.toString();
      else err = e;
    }
    var name =  arguments[2] || ($this.emitterCount.toString());
    var toStr = (evtname == 'data' && arguments[3] === undefined) ? true : !! arguments[3];

    emitter.on(evtname || 'error', function() {
      try {
        A.push.call(arguments, err, self);
        fn.apply(emitter, arguments);
      }
      catch (e) {
        err = e;
      }
    });

    emitter.on('end', function() {if (err) $this.absorbErr = (typeof err == 'string') ? new Error(err) : err });
    return this.absorbEnd(emitter, name);
  };

  $Fn.prototype.absorbEnd = function(emitter, name, isSub) {
    if (!this.junjo.running) throw new Error("Cannot call absorbEnd() before execution.");
    if (name == 'sub' && !isSub) throw new Error("name must not be 'sub'.");
    var $this = $(this);
    name || (name = $this.emitterCount.toString());
    $this.emitterCount++;
    var cb = this.callback;
    emitter.on('end', function() {
      if (emitter.constructor == Junjo) {
        $this.absorbs[name] = arguments[1];
        if (arguments[0]) $this.absorbErr = arguments[0];
      }
      if (--$this.emitterCount > 0) return;
      var out = (Object.keys($this.absorbs).length == 1) ? $this.absorbs[Object.keys($this.absorbs)[0]] : $this.absorbs;
      nextTick(function() { cb($this.absorbErr, out) });
    });
    return this;
  };

  $Fn.prototype.absorbData = function(emitter, evtname, name) {
    if (!this.junjo.running) throw new Error("Cannot call absorbData() before execution.");
    var $this = $(this);
    name || (name = $this.emitterCount.toString());
    $this.absorbs[name] = '';
    return this.absorb(emitter, evtname || 'data', function(data) {
      var $fn = A.pop.call(arguments), result = A.pop.call(arguments);
      return result + data.toString();
    }, name);
  };
  $Fn.prototype.gather = $Fn.prototype.absorbData;

  /** private functions of $Fn **/

  var jResetState = function() {
    variables[this.id] = {
      args         : [],                    // arguments passed to this.execute()
      counter      : _(this).afters.length, // until 0, decremented per each call, then execution starts.
      emitterCount : 0,                     // event emitters (name => emitter)
      absorbs      : {},                    // absorbed data from emitters (name => absorbed data)
      absorbErr    : null,                  // absorbed error from emitters
      called       : false,                 // execution started or not
      done         : false,                 // execution ended or not
      cb_accessed  : false,                 // whether callback is accessed via "this.callback", this means asynchronous.
      cb_called    : false                  // whether callback is called or not.
    };
  }

  var jExecute = function() {
    var _this  = _(this), $this = $(this), _junjo = _(this.junjo), $junjo = $(this.junjo);

    // filters
    if ($this.called || $this.counter-- > 0) return; // execute filter

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
      if ($this.skipped != null) return jNext.call(this, $this.skipped, true); // ignore firstError

      var ret = _this.func.apply(_this.scope || this, $this.args); // execution
      $this.done = true;
      if (isSync(this)) {
        return jNext.call(this, ret);
      }
      else {
        if ($this.cb_attempted) return jCallback.apply(this, $this.cb_attempted);
        if (!jInheritValue.call(this, 'timeout')) return;

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

  var jFail = function(e, called) {
    if ($(this).cb_called) return;

    var result = jInheritValue.call(this, 'catcher').call(this, e, $(this).args);
    return jNext.call(this, result, true); // pass the second arg to avoid infinite loop
  };

  var jInheritValue = function(keyname) {
    var v = _(this)[keyname];
    return (v == null) ? this.junjo[keyname] : v;
  };

  var jCallback = function() {
    var $this = $(this);
    if ($this.cb_called) return;
    if (!$this.done) return $this.cb_attempted = arguments;

    return jNext.call(this, arguments);
  };

  // call next functions
  var jNext = function(result, skipFailCheck) {
    var _this = _(this), $this = $(this), _junjo = _(this.junjo);
    if ($this.cb_called) return;

    var fsterr = jInheritValue.call(this, 'firstError');
    if (fsterr && is_arguments(result)) {
      if (result[0] && !skipFailCheck) return jFail.call(this, result[0]);
      if (fsterr == SHIFT) A.shift.call(result);
    }

    $this.cb_called = true;
    if ($this.timeout_id) clearTimeout($this.timeout_id); // remove tracing callback

    setResult.call(this.junjo, this, result);
    _this.callbacks.forEach(function($fn) { jExecute.apply($fn) });
  };

  /** static functions **/
  Junjo.args = function(args, obj) {
    return A.map.call(args, function(v) {
      return (v instanceof KeyPath) ? v.get(obj) : (typeof v == 'function' && v.name == 'future') ? v() : v;
    });
  };

  Junjo.multi = function() { return arguments };
  return Junjo;
})();

if (typeof exports == 'object' && exports === this) module.exports = Junjo;
