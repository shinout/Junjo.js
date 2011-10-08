var Junjo = (function(isNode) {
  // "use strict"; // commented out because of is_arguments()
 
  /** utility functions, variables **/
  var A            = Array.prototype,
      O            = Object.defineProperty,
      E            = function() {},
      args2arr     = function(args) { return A.map.call(args, function(v) {return v }) },
      nextTick     = (isNode) ? process.nextTick : function(fn) { setTimeout(fn, 0) },
      is_arguments = function(v) { return !!(v && v.callee) },
      getSubFunc   = function($j) { return function() { this.sub = $j } },
      SHIFT        = 'shift';

  /** preparation for private properties **/

  var props = {}, variables = {}, current_id = 0;
  function _(obj) { return props[obj.id] }        // configurable properties before running
  function $(obj) { return variables[obj.id] || {} }    // configurable properties after  running
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
      $ops         : [],    // registered operations
      labels       : {},    // {label => position of $ops}
      afters       : {},    // list of labels of functions executing after the function with label of the key (label => [op])
      befores      : {},    // list of labels of functions executing after the function with label of the key (label => [label])
      listeners    : {},    // eventlisteners
      replaces     : {},    // replace info
      result       : false  // if true and all processes are synchronous, return result at $j.run()
    };

    // properties from options
    ['timeout', 'catcher', 'firstError'].forEach(function(k) { $j[k] = options[k] });
    if (options.result != undefined) _($j).result = !!options.result;
    if (options.after  != undefined) _($j).after  = !!options.after;
    if (options.run) nextTick(function() { $j.run.apply($j, is_arguments(options.run) ? options.run : [options.run]) });
    $j.constructor = Junjo;
    if (fn) $j(fn);
    return $j;
  };

  /** public properties, defined in Junjo.prototype **/
  ['out', 'err', 'shared'].forEach(function(p) {
    O(Junjo.prototype, p, {
      get: function() { var $this = $(this); return $this.running ? $this[p] : null}, 
      set: function(v) { var $this = $(this); if ($this.running) $this[p] = v }
    });
  });
  O(Junjo.prototype, '$', { get: function() { return this.shared }, set: function(v) { this.shared = v }});

  Object.defineProperties(Junjo.prototype, {
    running  : { get : function () { return $(this).running }, set : E },
    ended    : { get : function () { return $(this).ended }, set : E },
    size     : { get : function () { return _(this).$ops.length }, set : E },

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
        if (!_(this.junjo).silent) console.log('ERROR in label ' + this.label, e.stack || e.message || e);
        e.args = args;
        this.err = e;
        this.terminate();
      },
      writable : false
    }
  });

  // Junjo extends Function prototype
  Object.getOwnPropertyNames(Function.prototype).forEach(function(k) { Junjo.prototype[k] = Function.prototype[k] });

  /** public functions **/
  Junjo.preps = {}; // methods callable before run

  // register a function
  Junjo.preps.register = function() {
    var label = (arguments.length > 1) ? A.shift.call(arguments) : undefined;
    if (Junjo.isJunjo(arguments[0])) return this.register(label, getSubFunc(arguments[0]));

    var _this = _(this);
    if (_this.labels[label]) throw new Error('label ' + label + ' already exists.');
    if (label == undefined) { label = _this.$ops.length; while (_this.labels[label]) { label++ } }

    var $op = new Operation(arguments[0], label, this);
    _this.labels[label] = _this.$ops.push($op) -1;
    _this.befores[label] = [], _this.afters[label] = [];
    return _this.after ? $op.after() : $op;
  };

  // set names to arguments of $j.run()
  Junjo.preps.inputs = function() {
    if (arguments.length == 1 && typeof arguments[0] == 'object') {
      var obj = arguments[0];
      if (Array.isArray(obj)) {
        obj.forEach(function(name, k) { this.inputs.apply(this, [name, k]) }, this);
        return this;
      }
      Object.keys(obj).forEach(function(k) {
        var v = Array.isArray(obj[k]) ? obj[k] : [obj[k]];
        v.unshift(k);
        this.inputs.apply(this, v);
      }, this);
      return this;
    }
    var label = A.shift.call(arguments), nums = A.filter.call(arguments, function(v) {return !isNaN(Number(v)) });
    return this.register(label, function() {
      var args = nums.map(function(n) { return this.inputs[n] }, this);
      args.unshift(this.label);
      this.skip.apply(this, args);
    });
  };

  var Future = function(n) {
    return this.inputs[n];
  };

  // get $op by label. this is just getting, so this can be called after run().
  Junjo.prototype.get = function(lbl) {
    var _this = _(this), ret = _this.$ops[_this.labels[lbl]]
    if (!ret) throw new Error(lbl + ' : no such label.');
    return ret;
  };

  // remove $op by label
  Junjo.preps.remove = function(lbl) {
    var $op = this.get(lbl), _this = _(this), num = _this.labels[lbl];
    _this.$ops.splice(num, 1);
    delete _this.labels[lbl], D($op);
    for (var i=num, l=_this.$ops.length; i<l; i++) { _this.labels[_this.$ops[i].label] = i }
    return this;
  };

  // add catcher
  Junjo.preps.catches = function() {
    var fn = A.pop.call(arguments), _this = _(this);
    if (!arguments.length)
      if (_this.$ops.length) _(_this.$ops[_this.$ops.length-1]).catcher = fn;
    else
      A.forEach.call(arguments, function(lbl) { if ($op = this.get(lbl)) _($op).catcher = fn }, this);
    return this;
  };

  // add catcher to all the functions registered previously, except those already have a catcher.
  Junjo.preps.catchesAbove = function(fn) {
    _(this).$ops.forEach(function($op) { if (!_($op).catcher) _($op).catcher = fn });
    return this;
  };

  // inherit settings of given Junjo instance
  Junjo.preps.inherit = function($j) {
    ['timeout', 'catcher', 'firstError'].forEach(function(k) { this[k] = $j[k] }, this);
    return this;
  };

  // no error report to stdout in defaultCatcher
  Junjo.preps.silent = function() { _(this).silent = arguments.length ? !!arguments[0] : true; return this };

  // register a function executed on run()
  Junjo.preps.start = function(fn) { if (typeof fn == 'function') _(this).start = fn };

  // set no timeout
  Junjo.preps.noTimeout = function(bool) { _(this).notimeout = (bool === undefined || !!bool); return this };

  // register informatino of skipping operations before running
  Junjo.preps.replace  = function() { _(this).replaces[A.shift.call(arguments)] = arguments; return this };
  Junjo.preps.shortcut = Junjo.preps.replace;

  Object.keys(Junjo.preps).forEach(function(p) {
    Junjo.prototype[p] = function() {
      if (this.running) throw new Error('method "' + p + '" while running.');
      return Junjo.preps[p].apply(this, arguments);
    };
  });

  // copy this and create new Junjo #FIXME ( after() is not working, and so on...)
  Junjo.prototype.clone = function() {
    var $j = new Junjo(), _this = _(this), _that = _($j);
    Object.keys(_this).forEach(function(k) { _that[k] = _this[k] });
    _that.entries = [], _that.$ops = [], _that.labels = {}, _that.listeners = [];
    _that.afters = {}, _that.befores = {};
    _this.$ops.forEach(function($op, k) { $op.clone($j) });
    Object.keys(_this.befores).forEach(function(k) { _that.befores[k] = _this.befores[k].map(function(v) { return v}) });

    return $j;
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
    if (evtname == 'end' && this.ended) {
        var self = this, $this = $(this);
        return nextTick(function() { fn.call(self, $this.err, $this.out) }); // pseudo onEnd
    }
    if (! (_(this).listeners[evtname] instanceof Array)) _(this).listeners[evtname] = [];
    _(this).listeners[evtname].push(fn);
    return this;
  };

  // set another Junjo object which executes after this
  Junjo.prototype.next = function(jn, options) {
    if (!Junjo.isJunjo(jn)) jn = new Junjo(jn, options);
    this.on('end', function(err, out) { jn.run(err, out) });
    return jn;
  };

  // run all the registered operations
  Junjo.prototype.run = function() {
    if (this.ended) return this;
    var  _this = _(this), $ops = _this.$ops, visited = {}, args = arguments;

    _this.entries = $ops.filter(function($op) {
      var befores = _this.befores[$op.label];
      befores.forEach(function(lbl) {
        var before = this.get(lbl);
        if (!before) throw new Error('label ' + lbl + ' is not registered. in label ' + $op.label);
        _this.afters[before.label].push($op);
      }, this);
      return befores.length == 0;
    }, this);

    // topological sort to operations
    $ops.forEach(function visit($op, ancestors) {
      if (visited[$op.label]) return;
      if (!Array.isArray(ancestors)) ancestors = [];
      ancestors.push($op.label);
      visited[$op.label] = true;
      _this.afters[$op.label].forEach(function($ch) {
        if (ancestors.indexOf($ch.label) >= 0) throw new Error('closed chain:' +  $ch.label + ' is in ' + $op.label);
        visit($ch, args2arr(ancestors));
      });
    });

    var $this = resetState.call(this);
    $this.running = true;

    if (!$this.inputs) $this.inputs = arguments;
    Object.keys(_this.replaces).forEach(function(lbl) { $this.skips[lbl] = _this.replaces[lbl] });

    if (_this.start)  _this.start.apply(this, arguments);
    if (_this.result) {
      _this.entries.forEach(function($op) { jExecute.call($op, args2arr(args)) });
      finishCheck.call(this);
      return ($this.ended) ? $this.out : this;
    }
    _this.entries.forEach(function($op) { nextTick(jExecute.bind($op, args2arr(args))) });
    return this;
  };

  // run with callback
  Junjo.prototype.exec = function() {
    var fn = A.pop.call(arguments);
    this.on('end', fn);
    return this.run.apply(this, arguments);
  };

  Junjo.prototype.reset = function() { if (this.ended) resetState.call(this); return this };

  /** private functions **/

  var resetState = function() {
    var _this = _(this);
    var $this = variables[this.id] = {
      running      : false, // registered processes are running or not
      results      : {},    // results of each functions
      ended        : false, // emited end event or not
      finished     : 0,     // the number of finished functions
      skips        : {},    // skipped functions (label => arguments)
      counters     : {},    // counters (label => number)
      called       : {},    // called functions (label => number)
      err          : null,  // error to pass to the "end" event
      out          : new E, // final output to pass to the "end" event
      shared       : {}     // shared values within $ops
    };

    _this.$ops.forEach(function($op) { $this.counters[$op.label] = _this.befores[$op.label].length - 1 || 0 });
    return $this;
  };

  // set result and run next operations
  var runNext = function($op, result) {

    var $this = $(this), _this = _(this);
    $($op).finished = true;
    $this.finished++;
    $this.results[$op.label] = result;
    finishCheck.call(this);
    _this.afters[$op.label].forEach(function($c) { 
      if (!_this.result) { nextTick(jExecute.bind($c)) }
      else  { jExecute.call($c) }
    });
  };

  var finishCheck = function() {
    var _this = _(this), $this = $(this);
    if ($this.finished < _this.$ops.length || $this.ended) return;
    $this.ended = true;
    if ($this.out instanceof E && !Object.keys($this.out).length) $this.out = $this.results;
    this.emit('end', $this.err, $this.out);
  };

  /** "this" scope in functions **/
  var $Scope = function($op) { O(this, '$op', { value : $op, writable : false}) };
  $Scope.proto = {};

  ['label', 'junjo', 'val', 'id']
  .forEach(function(p) { O($Scope.prototype, p, { get : function() { return this.$op[p] }, set: E }) });

  ['shared', 'err', 'out', 'inputs'].forEach(function(p) {
    O($Scope.prototype, p, { get : function() { return $(this.$op.junjo)[p] }, set : function(v) { $(this.$op.junjo)[p] = v } });
  });
  O($Scope.prototype, '$', { get : function() { return $(this.$op.junjo).shared }, set : function(v) { $(this.$op.junjo).shared = v }});

  ['callback', 'cb']
  .forEach(function(p) { O($Scope.prototype, p, { get : function() { return this.callbacks(0) }, set : E }) });
  O($Scope.prototype, 'fail', { get : function() { return jFail.bind(this) }, set : E });

  O($Scope.prototype, 'sub', {
    get : function() {
      var $this = $(this);
      if ($this.mask) return null;
      if (!$this.sub) { this.sub = new Junjo().inherit(this.junjo) }
      return $this.sub;
    },
    set : function($j) {
      if (!Junjo.isJunjo($j)) return;
      var $this = $(this);
      if ($this.mask) return;
      $this.sub = $j;
      this.absorbEnd($this.sub, 'sub', true);
      nextTick(function() { $this.sub.run.apply($this.sub, $this.args) });
    }
  });

  $Scope.proto.callbacks = function(key, isSub) {
    var $this = $(this);
    $this.cb_accessed = true;
    key = getCallbackName(key, $this, isSub);
    if ($this.cb_keys[key] === undefined) {
      $this.cb_count++;
      $this.cb_keys[key] = 1;
    }
    return jCallback.bind(this, key, $this.trial);
  };

  var getCallbackName = function(key, $this, isSub) {
    if (key == 'sub' && !isSub) throw new Error("callback key must not be 'sub'.");
    if (key != null) return key;
    key = $this.cb_count;
    while ($this.cb_keys[key] !== undefined) { key++ }
    return key;
  };

  $Scope.proto.absorb = function(emitter, evtname, fn, name) {
    var self = this, $this = $(this);
    name = getCallbackName(name, $this);
    emitter.on(evtname, function() {
      try {
        A.push.call(arguments, $this.absorbs[name], self);
        var ret = fn.apply(emitter, arguments);
        if (ret !== undefined) $this.absorbs[name] = ret;
      }
      catch (e) {
        $this.absorbErrs[name] = e;
      }
    });
    return this.absorbEnd(emitter, name);
  };

  $Scope.proto.absorbEnd = function(emitter, name, isSub) {
    var self = this, $this = $(this);
    name = getCallbackName(name, $this, isSub);
    emitter.on('error', jFail.bind(this));
    var cb = this.callbacks(name, isSub);
    emitter.on('end', function(err, out) {
      if (Junjo.isJunjo(emitter) && !$this.absorbs[name]) $this.absorbErrs[name] = err, $this.absorbs[name] = out;
      cb($this.absorbErrs[name], $this.absorbs[name]);
    });
    return this;
  };

  $Scope.proto.absorbData = function(emitter, name, evtname) {
    var $this = $(this);
    name = getCallbackName(name, $this);
    $this.absorbs[name] = '';
    return this.absorb(emitter, evtname || 'data', function(data) {
      var $op = A.pop.call(arguments), result = A.pop.call(arguments);
      return result + data.toString();
    }, name);
  };
  $Scope.proto.gather = $Scope.proto.absorbData;

  Object.keys($Scope.proto)
  .forEach(function(k) { $Scope.prototype[k] = function() { return (!$(this).mask) ? $Scope.proto[k].apply(this, arguments) : null } });

  // get results of operations.
  $Scope.prototype.results = function(lbl) { return (lbl) ? $(this.junjo).results[lbl] : $(this.junjo).results };

  // terminate operations
  $Scope.prototype.terminate = function() {
   _(this.junjo).$ops.forEach(function($op) { this.skip($op.label) }, this);
   this.junjo.emit('terminate', this.label);
  };

  // skip the operation with a given label, and make it return the passed arguments
  $Scope.prototype.skip = function() {
    var lbl = arguments.length ? A.shift.call(arguments) : this.label, $junjo = $(this.junjo);
    if ($junjo.skips[lbl] === undefined) $junjo.skips[lbl] = arguments;
    if (this.label == lbl) nextTick(jResultFilter.bind(this, arguments));
  };

  /** Operation : registered operation in Junjo  **/
  var Operation = function(val, label, junjo) {
    O(this, 'val', { value : val, writable : false});
    O(this, 'label', { value : label, writable : false });
    O(this, 'junjo', { value : junjo, writable : false });
    O(this, 'id', { value : junjo.id + '.' + label, writable : false});

    // private properties
    props[this.id] = {};
  };

  Operation.prototype.timeout = function(v) { if (typeof v == "number") { _(this).timeout = v } return this };
  Operation.prototype.sync  = function(bool) { _(this).async = (bool === undefined) ? false : !bool; return this };
  Operation.prototype.async = function(bool) { _(this).async = (bool === undefined) ? true : !!bool; return this };
  ['pre', 'post']
  .forEach(function(p) { Operation.prototype[p] = function(fn) { if (typeof fn == 'function') { _(this)[p] = mask(fn) } return this } });

  ['err', 'out']
  .forEach(function(p) { Operation.prototype[p] = function(n) { _(this)[p + 'num'] = (!isNaN(Number(n))) ? n : 0; return this } });
  Operation.prototype.errout = function() { this.err(0); return this.out(1) };

  Operation.prototype.reduce = function(fn, prime) {
    if (typeof fn == 'function') { _(this).reduce = fn = mask(fn), fn.prime = prime } return this;
  };

  Operation.prototype.firstError = function(val) {
    if (val != SHIFT && val !== false) val = true;
    _(this).firstError = val;
    return this;
  };
  Operation.prototype.eshift = function(val) { return this.firstError(SHIFT) };

  Operation.prototype.after = function() {
    var _this = _(this), _junjo = _(this.junjo), lbl = this.label;
    if (arguments.length == 0 && this.junjo.size > 1)
      A.push.call(arguments, _junjo.$ops[_junjo.labels[lbl]-1].label);

    var befores = _junjo.befores[lbl];
    A.forEach.call(arguments, function(l) { if (l != lbl && befores.indexOf(l) < 0) befores.push(l) });
    return this;
  };
  Operation.prototype.using = Operation.prototype.after;

  Operation.prototype.afterAbove = function(bool) {
    return this.after.apply(this, _(this.junjo).$ops.map(function($op) { return $op.label }));
  };

  Operation.prototype.catches = function(fn) { _(this).catcher = fn; return this };
  Operation.prototype.fail = Operation.prototype.catches;
  Operation.prototype.next = function() { return this.junjo.register.apply(this.junjo, arguments).after(this.label) };

  Operation.prototype.failSafe = function() {
    var args = arguments;
    return this.catches(function() { return args });
  };

  Operation.prototype.retry = function(val, nextTick) {
    var _this = _(this);
    if (typeof val == 'number') _this.retry = function(e, args, c) { return c < val };
    else if (typeof val == 'function') _this.retry = mask(val);
    _this.retry.nextTick = !!nextTick;
    return this;
  };

  Operation.prototype.loop = function(val, nextTick) {
    var _this = _(this);
    if (typeof val == 'number') _this.loop = function(a, r, c) { return c < val };
    else if (typeof val == 'function') _this.loop = mask(val);
    _this.loop.nextTick = !!nextTick;
    return this;
  };

  Operation.prototype.clone = function($j) {
    var _this = _(this), $op = $j.register(this.label, this.val), _$op = _($op);
    Object.keys(_this).forEach(function(k) { _$op[k] = _this[k] });
    return $op;
  };

  /** private functions of Operation **/

  var jResetState = function(prevState) {
    variables[this.id] = {
      args         : [],    // arguments passed to this.execute()
      absorbs      : {},    // absorbed data from emitters (name => absorbed data)
      absorbErrs   : {},    // absorbed error from emitters (name => absorbed error)
      done         : false, // execution ended or not
      finished     : false, // whether jResultFilter is normally finished called or not.
      cb_accessed  : false, // whether callback is accessed or not
      trial        : 0,
      cb_count     : 0,
      cb_keys      : {},    // key => 1
      result       : null,
      mask         : false,
      $scope       : new $Scope(this) // "this" in the function
    };
    if (!prevState) return;
    Object.keys(prevState).forEach(function(k) { variables[this.id][k] = prevState[k] }, this);
  }

  var mask = function(fn) { return function() { $(this).mask = true; var r = fn.apply(this, arguments); $(this).mask = false; return r } }

  var jExecute = function(args, prevState, force) {
    var _this  = _(this), label = this.label, $junjo = $(this.junjo);
    if ($junjo.counters[label]-- > 0 || ($junjo.called[label] && !force)) return;
    if (typeof this.val != 'function') return jNext.call(this, this.val);

    jResetState.call(this, prevState);
    var $this = $(this);
    $junjo.called[label] = true;
    var befores = _(this.junjo).befores[label];

    if (befores.length) {
      $this.args = befores.reduce(function(arr, lbl) {
        var val = $junjo.results[lbl];
        if (is_arguments(val)) A.forEach.call(val, function(v) { arr.push(v) });
        else arr.push(val);
        return arr;
      }, []);
    }
    else $this.args = args;

    try {
      if ($junjo.skips[label] != null) return jResultFilter.call(this, $junjo.skips[label]);

      if (_this.loop) {
        if (!$this.loop) $this.loop = { result: null, count: 0};
        var l = $this.loop;
        l.args = args ? args.map(function(v) {return v}) : null;
        $this.args.push(l.result, l.count);
        l.finished = !_this.loop.call($this.$scope, l.result, l.args, l.count);
        if (l.finished) return jResultFilter.call(this, l.result);
      }

      if (_this.pre) {
        var preResult = _this.pre.apply($this.$scope, $this.args);
        if (preResult !== undefined) $this.args = (is_arguments(preResult)) ? preResult : [preResult];
      }
      var ret = this.val.apply($this.$scope, $this.args); // execution
      $this.done = true;
      if (_this.async === false || _this.async == null && !$this.cb_accessed) return jResultFilter.call(this, ret);
      if ($this.cb_attempted) return jCallback.apply(this, $this.cb_attempted, $this.trial);

      var timeout = jInheritValue.call(this, 'timeout');
      if (_(this.junjo).notimeout || !timeout ) return;

      var self = this;
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

  var jInheritValue = function(k) { var v = _(this)[k]; return (v == null) ? this.junjo[k] : v };

  var jFail = function(e) {
    if ($(this).finished) return;
    var $this = $(this), self = this;
    var _retry = _(this).retry;
    if (_retry && _retry.call($this.$scope, e, $this.args, ++$this.trial)){
      return (_retry.nextTick)
        ? nextTick(function() {jExecute.call(self, null, {trial: $this.trial}, true)})
        : jExecute.call(this, null, {trial: $this.trial}, true);
    }

    var result = mask(jInheritValue.call(this, 'catcher')).call($this.$scope, e, $this.args);
    return jResultFilter.call(this, result, true); // pass the second arg to avoid infinite loop
  };

  var jCallback = function() {
    var $this = $(this), reduce = _(this).reduce;
    if ($this.finished) return;
    if (!$this.done) return $this.cb_attempted = arguments;
    var key = A.shift.call(arguments);
    var trial = A.shift.call(arguments);
    if (trial < $this.trial) return;
    if (reduce) {
      var v = _(this).reduce.call($this.$scope, $this.result || reduce.prime, arguments, key)
      $this.result =  (v !== undefined) ? v : $this.result;
    }
    else $this.result = arguments;
    if (--$this.cb_count > 0) return;
    return jResultFilter.call(this, $this.result);
  };

  // modify result
  var jResultFilter = function(result, skipFailCheck) {
    try {
      var _this = _(this), $this = $(this), self = this, is_arg = is_arguments(result);
      if ($this.finished) return;

      if ($(this.junjo).skips[this.label] != null)  // if skip flag is on, omit following processes
        return jNext.call(this, $(this.junjo).skips[this.label]);

      var fsterr = jInheritValue.call(this, 'firstError'); // checking firstError
      if (fsterr && is_arg) {
        if (result[0]) throw result[0];
        if (fsterr == SHIFT) A.shift.call(result);
      }

      if ($this.loop && !$this.loop.finished) { // if loop, this operation is executed again.
        var l = $this.loop, args = l.args;
        l.count++, l.result = result;
        return (_this.loop.nextTick)
          ? nextTick(function() { jExecute.call(self, args, {loop: l}, true) })
          : jExecute.call(this, args, {loop: l}, true);
      }
      if (_this.post) { // post executing process
        var postResult = _this.post.apply($this.$scope, is_arg ? result : [result]);
        if (postResult !== undefined) result = postResult;
      }
    }
    catch (e) { if (!skipFailCheck) return jFail.call(this, e) }
    jNext.call(this, result);
  };

  // execute next operations
  var jNext = function(result) {
    var _this = _(this), is_arg = is_arguments(result), timeout_id;
    ['out', 'err'].forEach(function(p) { // setting err, out information
      var n = _this[p + 'num'];
      if ( n !== undefined && (is_arg || n == 0)) this.junjo[p] = is_arg ? result[n] : result;
    }, this);

    if (timeout_id = $(this).timeout_id) clearTimeout(timeout_id); // remove tracing callback
    runNext.call(this.junjo, this, result);
  };

  Junjo.isNode  = isNode;
  Junjo.multi   = Junjo.args = function() { return arguments };
  Junjo.isJunjo = function($j) { return $j.constructor == Junjo };
  return Junjo;
})(typeof exports == 'object' && exports === this);

if (Junjo.isNode) module.exports = Junjo;
