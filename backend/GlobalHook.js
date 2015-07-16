/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow
 */
'use strict';

module.exports = function globalHook(window: Object) {
  Object.defineProperty(window, '__REACT_DEVTOOLS_GLOBAL_HOOK__', {
    value: {
      _renderers: {},
      helpers: {},
      inject: function(renderer) {
        var id = Math.random().toString(15).slice(10, 20);
        this._renderers[id] = renderer;
        this.emit('renderer', {id, renderer});
      },
      _listeners: {},
      sub: function (evt, fn) {
        this.on(evt, fn);
        return function () {this.off(evt, fn)}.bind(this);
      },
      on: function (evt, fn) {
        if (!this._listeners[evt]) {
          this._listeners[evt] = [];
        }
        this._listeners[evt].push(fn);
      },
      off: function (evt, fn) {
        if (!this._listeners[evt]) {
          return;
        }
        var ix = this._listeners[evt].indexOf(fn);
        if (ix !== -1) {
          this._listeners[evt].splice(ix, 1);
        }
        if (!this._listeners[evt].length) {
          this._listeners[evt] = null;
        }
      },
      emit: function (evt, data) {
        if (this._listeners[evt]) {
          this._listeners[evt].map(function (fn) {fn(data)});
        }
      },
    }
  });
}
window.globalHook = module.exports;