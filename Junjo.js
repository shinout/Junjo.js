var Junjo = (function(isNode) {
  // "use strict"; // commented out because of is_arguments()
 
  /** utility functions, variables **/
  var A            = Array.prototype,
      O            = Object.defineProperty,
      empty        = function() {},
      args2arr     = function(args) { return A.map.call(args, function(v) {return v }) },
      nextTick     = (isNode) ? process.nextTick : function(fn) { setTimeout(fn, 0) },
      is_arguments = function(v) { return v && v.callee },
      getSubFunc   = function($j) { return function() { this.sub = $j } },
      SHIFT        = 'shift';

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
    if ($j.__proto__) $j.__proto__ = Junjo.prototype;
    else Object.keys(Junjo.prototype).forEach(function(k) { $j[k] = Junjo.prototype[k] });

    O($j, 'id', { value : ++current_id, writable : false});

    // private properties
    props[$j.id] = {
      $fns         : [],    // registered functions
      labels       : {},    // {label => position of $fns}
      listeners    : {},    // eventlisteners
      result       : false  // if true and all processes are synchronous, return result at $j.run()
    };
    resetState.call($j);  // set variables

    // properties from options
    ['timeout', 'catcher', 'firstError'].forEach(function(k) { $j[k] = options[k] });
    if (options.result != undefined) _($j).result = !!options.result;
    if (options.after  != undefined) _($j).after  = !!options.after;
    if (options.run) nextTick(function() { $j.run.apply($j, is_arguments(options.run) ? options.run : [options.run]) });
    $j.constructor = Junjo;
    $j.future = new Future($j);
    if (fn) $j(fn);
    return $j;
  };

  /** public properties, defined in Junjo.prototype **/
  Object.defineProperties(Junjo.prototype, {
    current  : { get : function () { return $(this).current }, set: empty },
    runnable : { get : function () { return $(this).runnable && !$(this).running }, set : empty },
    running  : { get : function () { return $(this).running }, set : empty },
    size     : { get : function () { return _(this).$fns.length }, set : empty },
    $        : { get : function () { return this.shared }, set : function(v) { this.shared = v } },
    inputs   : { get : function () { return $(this).inputs }, set : empty },

    timeout : {
      get : function() { return (_(this).timeout != null) ? _(this).timeout : 5 },
      set : function(v) { if (typeof v == 'number') _(this).timeout = v }
    },

    catcher : {
      get : function()  { return _(this).catcher || this.defaultCatcher },
      set : function(v) { if (typeof v == 'function') _(this).catcher = v }
    },

    firstError : {
      get : function() { return _(this).firstError },
      set : function(v) { if (typeof v == 'boolean' || v == SHIFT) _(this).firstError = v }
    },

    defaultCatcher : {
      value : function(e, args) {
        console.log('ERROR in label ' + this.label, e.stack || e.message || e);
        this.err = e;
        this.junjo.terminate();
      },
      writable : false
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
      $j = arguments[0];
      return this.register(label, getSubFunc($j));
    }
    var _this = _(this);
    if (_this.labels[label]) throw new Error('label ' + label + ' is already exists.');
    if (label == undefined) { label = _this.$fns.length; while (_this.labels[label]) { label++ } }

    var $fn = new $Fn(arguments[0], label, this);
    _this.labels[label] = _this.$fns.push($fn) -1;
    return _this.after ? $fn.after() : $fn;
  };

  // get results of each process.
  Junjo.prototype.results = function() {
    return (!arguments.length) ? $(this).results : KeyPath.get($(this).results, arguments, this);
  };

  Junjo.prototype.args = function() { return this.current ? KeyPath.get($(this.current).args, arguments, this.current) : null };

  // terminate whole process
  Junjo.prototype.terminate = function() {
    _(this).$fns.forEach(function($fn) { this.skip($fn.label) }, this);
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
      return nextTick(function() { fn.call(self, self.err, self.out) }); // pseudo onEnd
    }
    if (! (_(this).listeners[evtname] instanceof Array)) _(this).listeners[evtname] = [];
    _(this).listeners[evtname].push(fn);
    return this;
  };

  // get $fn by label
  Junjo.prototype.get = function(lbl) { var _this = _(this); return _this.$fns[_this.labels[lbl]] };

  // remove $fn by label
  Junjo.prototype.remove = function(lbl) {
    var $fn   = this.get(lbl), _this = _(this);
    var num   = _this.labels[lbl];
    _this.$fns.splice(num, 1);
    delete _this.labels[lbl];
    D($fn);
    for (var i=num, l=_this.$fns.length; i<l; i++) {
      _this.labels[_this.$fns[i].label] = i;
    }
    return this;
  };

  // add catcher
  Junjo.prototype.catches = function() {
    var fn = A.pop.call(arguments), _this = _(this);
    if (!arguments.length) {
      if (_this.$fns.length) _(_this.$fns[_this.$fns.length-1]).catcher = fn;
    }
    else {
      A.forEach.call(arguments, function(lbl) { if ($fn = this.get(lbl)) _($fn).catcher = fn }, this);
    }
    return this;
  };

  // add catcher to all the functions registered previously, except those already have a catcher.
  Junjo.prototype.catchesAbove = function(fn) {
    _(this).$fns.forEach(function($fn) { if (!_($fn).catcher) _($fn).catcher = fn });
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

  // copy this and create new Junjo
  Junjo.prototype.clone = function() {
    var $j = new Junjo(), _this = _(this), _that = _($j);
    Object.keys(_this).forEach(function(k) { _that[k] = _this[k] });
    _this.$fns.forEach(function($fn, k) { _that.$fns[k] = $fn.clone($j) });
    return $j;
  };

  // skip the process with a given label, and make it return the passed arguments
  Junjo.prototype.skip = function() {
    var lbl = A.shift.call(arguments), $this = $(this);
    if ($this.skips[lbl] === undefined) $this.skips[lbl] = arguments;
  };

   // run all the registered $fn
  Junjo.prototype.run = function() {
    if ($(this).ended) resetState.call(this);
    var $this = $(this), _this = _(this);
    if (!this.runnable) return this; // checking $this.runnable && !$this.running
    $this.running = true;
    Object.freeze(_this);
    var args = arguments, $fns = _this.$fns;
    $this.inputs = args;
    Object.freeze($this.inputs);
    $fns.forEach(function($fn) {
      _($fn).befores.forEach(function(lbl) {
        var before = this.get(lbl);
        if (!before) throw new Error('label ' + lbl + ' is not registered. in label ' + $fn.label);
        if ( !$this.afters[before.label]) $this.afters[before.label] = [];
        $this.afters[before.label].push($fn);
      }, this);
      $this.counters[$fn.label] = _($fn).befores.length;
    }, this);

    $fns.forEach(function($fn) { jExecute.call($fn, args2arr(args)) });
    finishCheck.call(this);

    return ($(this).ended && _(this).result) ? this.out : this;
  };

  // JSDeferred-like API
  Junjo.prototype.next = function(j, options) {
    if (j.constructor == Junjo) return j.after(this);
    return new Junjo(j, options).after(this);
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
      skips        : {},    // skipped functions (label => bool)
      counters     : {},    // counters (label => number)
      called       : {},    // called functions (label => number)
      afters       : {}     // list of labels of functions executing after the function with label of the key (label => $fn)
    };
    /** reset common properties **/
    this.err    = null;      // error to pass to the "end" event
    this.out    = new empty; // final output to pass to the "end" event
    this.shared = {};        // shared values within $fns
  };

  var setResult = function($fn, result) {
    var $this = $(this);
    $this.finished++;

    $this.results[$fn.label] = result;
    finishCheck.call(this);
  };

  var finishCheck = function() {
    var _this = _(this), $this = $(this);
    if ($this.finished < _this.$fns.length || $this.ended) return;
    $this.ended = true;
    if (this.out instanceof empty && !Object.keys(this.out).length) this.out = $this.results;
    this.emit('end', this.err, this.out);
  };

  /** "this" scope in functions **/
  var $Scope = function($fn) { O(this, '$fn', { value : $fn, writable : false}) };

  // public properties of $Scope
  ['label', 'junjo', 'fn', 'id']
  .forEach(function(p) { O($Scope.prototype, p, { get : function() { return this.$fn[p] }, set: empty }) });

  ['shared', '$', 'err', 'out', 'inputs'].forEach(function(p) {
    O($Scope.prototype, p, { get : function()  { return this.$fn.junjo[p] }, set : function(v) { this.$fn.junjo[p] = v } });
  });

  ['callback', 'cb']
  .forEach(function(p) { O($Scope.prototype, p, { get : function() { return this.callbacks(0) }, set : empty }) });

  O($Scope.prototype, 'sub', {
    get : function() {
      var $this = $(this);
      if (!$this.sub) { this.sub = new Junjo() }
      return $this.sub;
    },
    set : function($j) {
      if ($j.constructor != Junjo) return;
      var $this = $(this), cb = this.callback;
      $this.sub = $j;
      // $this.sub.on('end', function() {cb($this.sub.err, $this.sub.out)});
      this.absorbEnd($this.sub, 'sub', true);
      nextTick(function() { $this.sub.run.apply($this.sub, $this.args) });
    }
  });

  $Scope.prototype.callbacks = function(key) {
    var $this = $(this);
    $this.cb_accessed = true;
    key = getCallbackName(key, $this);
    if ($this.cb_results[key] === undefined) {
      $this.cb_count++;
      $this.cb_results[key] = null;
    }
    return jCallback.bind(this, key);
  };

  var getCallbackName = function(key, $this) {
    if (key != null) return key;
    key = $this.cb_count;
    while ($this.cb_results[key] !== undefined) { key++ }
    return key;
  };

  $Scope.prototype.absorb = function(emitter, evtname, fn, name) {
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

  $Scope.prototype.absorbError = function(emitter, evtname) {
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

  $Scope.prototype.absorbEnd = function(emitter, name, isSub) {
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

  $Scope.prototype.absorbData = function(emitter, evtname, name) {
    var $this = $(this);
    name || (name = $this.emitterCount.toString());
    $this.absorbs[name] = '';
    return this.absorb(emitter, evtname || 'data', function(data) {
      var $fn = A.pop.call(arguments), result = A.pop.call(arguments);
      return result + data.toString();
    }, name);
  };
  $Scope.prototype.gather = $Scope.prototype.absorbData;

  /** $Fn : registered function in Junjo  **/
  var $Fn = function(fn, label, junjo) {
    O(this, 'fn', { value : fn, writable : false});
    O(this, 'label', { value : label, writable : false});
    O(this, 'junjo', { value : junjo, writable: false });
    O(this, 'id', { value : junjo.id + '.' + label, writable : false});

    // private properties
    props[this.id] = {
      befores : [], // labels of functions executed before this function
      params  : []  // parameters to be given to the function. if empty, original callback arguments is used.
    };
  };

  $Fn.prototype.scope = function(scope) {
    if (scope != null && typeof scope == 'object') _(this).scope = scope;
    return this;
  };

  $Fn.prototype.bind = function() {
    this.scope(A.shift.call(arguments));
    return this.params.apply(this, arguments);
  };

  $Fn.prototype.params = function() {
    A.forEach.call(arguments, function(v) { this.push(v) }, _(this).params);
    return this;
  };

  $Fn.prototype.timeout = function(v) { if (typeof v == "number") _(this).timeout = v; return this };
  $Fn.prototype.sync  = function(bool) { _(this).async = (bool === undefined) ? false : !bool; return this };
  $Fn.prototype.async = function(bool) { _(this).async = (bool === undefined) ? true : !!bool; return this };
  $Fn.prototype.pre  = function(fn) { _(this).pre  = fn };
  $Fn.prototype.post = function(fn) { _(this).post = fn };

  $Fn.prototype.firstError = function(val) {
    if (val != SHIFT && val !== false) val = true;
    _(this).firstError = val;
    return this;
  };

  $Fn.prototype.after = function() {
    var _this = _(this), _junjo = _(this.junjo), lbl = this.label;
    if (arguments.length == 0 && this.junjo.size > 1)
      A.push.call(arguments, _junjo.$fns[_junjo.labels[lbl]-1].label);

    A.forEach.call(arguments, function(l) { if (l != lbl) _this.befores.push(l) });
    return this;
  };

  $Fn.prototype.afterAbove = function(bool) {
    return this.after.apply(this, _(this.junjo).$fns.map(function($fn) { return $fn.label }));
  };

  $Fn.prototype.catches = function(fn) { _(this).catcher = fn; return this };
  $Fn.prototype.fail = $Fn.prototype.catches;
  $Fn.prototype.next = function() { return this.junjo.register.apply(this.junjo, arguments).after(this.label) };

  $Fn.prototype.failSafe = function() {
    var args = arguments;
    return this.catches(function() { return args });
  };

  $Fn.prototype.retry = function(n, fn, nextTick) {
    n  = (typeof n  == "number") ? n : 1;
    fn = (typeof fn == "function") ? fn : function(e, args) { return args };
    _(this).retry = { fn: fn, count: n, nextTick: !!nextTick };
    return this;
  };

  $Fn.prototype.loop = function(val, nextTick) {
    var _this = _(this);
    if (typeof val == 'number') _this.loop = function(a, r, c) { return c < val };
    else if (typeof val == 'function') _this.loop = val;
    _this.loop.nextTick = !!nextTick;
    return this;
  };

  $Fn.prototype.clone = function($j) {
    var $fn = new $Fn(this.fn, this.label, $j);
    var _this = _(this), _that = _($fn);
    Object.keys(_this).forEach(function(k) { _that[k] = _this[k] });
    return $fn;
  };

  /** private functions of $Fn **/

  var jResetState = function(prevState) {
    variables[this.id] = {
      args         : [],    // arguments passed to this.execute()
      emitterCount : 0,     // event emitters (name => emitter)
      absorbs      : {},    // absorbed data from emitters (name => absorbed data)
      absorbErr    : null,  // absorbed error from emitters
      done         : false, // execution ended or not
      finished     : false, // whether jNext is normally finished called or not.
      cb_accessed  : false, // whether callback is accessed or not
      cb_count     : 0,
      cb_results   : {},
      $scope       : new $Scope(this) // "this" in the functioin
    };
    if (!prevState) return;
    Object.keys(prevState).forEach(function(k) { variables[this.id][k] = prevState[k] }, this);
  }

  var jExecute = function(args, prevState, force) {
    var _this  = _(this), label = this.label, $junjo = $(this.junjo);
    if ($junjo.counters[label]-- > 0 || ($junjo.called[label] && !force)) return;

    jResetState.call(this, prevState);
    var $this = $(this);
    $junjo.current = $this.$scope, $junjo.called[label] = true;

    if (_this.befores.length) {
      $this.args = _this.befores.reduce(function(arr, lbl) {
        var val = $junjo.results[lbl];
        if (is_arguments(val)) A.forEach.call(val, function(v) { arr.push(v) });
        else arr.push(val);
        return arr;
      }, []);
    }
    else $this.args = args;
    if (_this.params.length) $this.args = _this.params.map(Junjo.present);

    try {
      if ($junjo.skips[label] != null) return jNext.call(this, $junjo.skips[label], true); // ignore firstError

      if (_this.loop) {
        if (!$this.loop) $this.loop = { result: null, count: 0};
        var l = $this.loop;
        l.args = args ? args.map(function(v) {return v}) : null;
        $this.args.push(l.result, l.count);
        l.finished = !_this.loop.call(this, l.result, l.args, l.count);
        if (l.finished) return jNext.call(this, l.result);
      }

      if (typeof _this.pre == 'function') $this.args = _this.pre.apply(_this.scope || $this.$scope, $this.args);
      var ret = this.fn.apply(_this.scope || $this.$scope, $this.args); // execution
      $this.done = true;
      if (_this.async === false || _this.async == null && !$this.cb_accessed) return jNext.call(this, ret);
      if ($this.cb_attempted) return jCallback.apply(this, $this.cb_attempted);
      if (!jInheritValue.call(this, 'timeout')) return;

      var self = this;
      var timeout = jInheritValue.call(this, 'timeout');
      $this.timeout_id = setTimeout(function() {
        if (!$this.finished) {
          $this.done = true;
          jFail.call(self, new Error('callback wasn\'t called within '+ timeout +' [sec] in function ' + self.label + '.' ));
        }
      }, timeout * 1000);
    }
    catch (e) {
      $this.done = true;
      return jFail.call(this, e);
    }
  };

  var jFail = function(e, called) {
    if ($(this).finished) return;
    var $this = $(this), self = this;
    var _retry = _(this).retry;
    if (_retry) {
      if (!$this.trial) $this.trial = 0;
      if ($this.trial++ != _retry.count) {
        var args = _retry.fn.call(this, e, $this.args, $this.trial);
        if (!is_arguments(args)) args = [args];
        return (_retry.nextTick)
          ? nextTick(function() {jExecute.call(self, args, {trial: $this.trial}, true)})
          : jExecute.call(this, args, {trial: $this.trial}, true);
      }
    }

    var result = jInheritValue.call(this, 'catcher').call(this, e, $this.args);
    return jNext.call(this, result, true); // pass the second arg to avoid infinite loop
  };

  var jInheritValue = function(k) { var v = _(this)[k]; return (v == null) ? this.junjo[k] : v };

  var jCallback = function() {
    var $this = $(this);
    if ($this.finished) return;
    if (!$this.done) return $this.cb_attempted = arguments;
    var key = A.shift.call(arguments);
    $this.cb_results[key] = arguments;
    if (--$this.cb_count > 0) return;
    return jNext.call(this, arguments);
  };

  // call next functions
  var jNext = function(result, skipFailCheck) {
    try {
      var _this = _(this), $this = $(this), _junjo = _(this.junjo);
      if ($this.finished) return;

      var fsterr = jInheritValue.call(this, 'firstError');
      if (fsterr && is_arguments(result)) {
        if (result[0]) throw result[0];
        if (fsterr == SHIFT) A.shift.call(result);
      }
      if ($this.timeout_id) clearTimeout($this.timeout_id); // remove tracing callback

      if ($this.loop && !$this.loop.finished) {
        var l = $this.loop, args = l.args;
        l.count++, l.result = result;
        return (_this.loop.nextTick)
          ? nextTick(function() { jExecute.call(self, args, {loop: l}, true) })
          : jExecute.call(this, args, {loop: l}, true);
      }
      if (typeof _this.post == 'function') { result = _this.post.apply($this.$scope, is_arguments(result) ? result : [result]) }
      $this.finished = true;
    }
    catch (e) { if (!skipFailCheck) return jFail.call(this, e) }
    setResult.call(this.junjo, this, result);
    var afters = $(this.junjo).afters[this.label];
    if (afters) afters.forEach(function($fn) { jExecute.call($fn) }, this);
  };

  var Future = function($j) { this.$j = $j };
  Future.get = function(target, args) {
    var kp = new KeyPath(target, args, this);
    return (this.running) ? kp.get() : kp;
  };

  ['callback', 'cb', 'label'].forEach(function(propname) {
    O(Future.prototype, propname, {
      get: function() { return Future.get.call(this.$j, 'current', [propname]) }, set: empty
    });
  });

  ['out', 'err', 'shared', '$', 'args', 'results', 'current'].forEach(function(propname) {
    O(Future.prototype, propname, {
      get: function() { var $j = this.$j;
        return function future() { return Future.get.call($j, propname, arguments) };
      },
      set: empty
    });
  });

  var KeyPath = function(target, args, scope) { this.target = target, this.args = args, this.scope = scope };
  KeyPath.get = function(target, args, scope) {
    if (typeof target == 'function') return target.apply(scope, args);
    return A.reduce.call(args, function(o, k) {
     if (o == null || (typeof o != 'object' && o[k] == null)) return null;
     if (typeof o[k] == 'function' && o[k].name == 'future') return o[k]();
     return o[k];
    }, target);
  };
  KeyPath.prototype.get = function() { return KeyPath.get(this.scope[this.target], this.args, this.scope) };

  /** static functions **/
  Junjo.present = function(v) {
    return (v instanceof KeyPath) ? v.get() : (typeof v == 'function' && v.name == 'future') ? v() : v;
  };

  Junjo.isNode = isNode;
  Junjo.multi = function() { return arguments };
  return Junjo;
})(typeof exports == 'object' && exports === this);

if (Junjo.isNode) module.exports = Junjo;
