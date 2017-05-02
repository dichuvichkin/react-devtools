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

import type {Hook} from './types';

/**
 * NOTE: This file cannot `require` any other modules. We `.toString()` the
 *       function in some places and inject the source into the page.
 */
function installGlobalHook(window: Object) {
  if (window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
    return;
  }
  function detectReactBuildType(renderer) {
    try {
      var toString = Function.prototype.toString;
      if (typeof renderer.version === 'string') {
        // React DOM Fiber (16+)
        if (renderer.bundleType > 0) {
          // This is not a production build.
          // We are currently only using 0 (PROD) and 1 (DEV)
          // but might add 2 (PROFILE) in the future.
          return 'development';
        }
        // The above should cover envification, but we should still make sure
        // that the bundle code has been uglified.
        var findFiberCode = toString.call(renderer.findFiberByHostInstance);
        // Filter out bad results (if that is even possible):
        if (findFiberCode.indexOf('function') !== 0) {
          // Hope for the best if we're not sure.
          return 'production';
        }
        // By now we know that it's envified--but what if it's not minified?
        // This can be bad too, as it means DEV code is still there.
        // Let's check the first argument. It should be a single letter.
        if (!(/function[\s\w]*\(\w[,\)]/.test(findFiberCode))) {
          return 'development';
        }
        // We're good.
        return 'production';
      }
      if (renderer.Mount && renderer.Mount._renderNewRootComponent) {
        // React DOM Stack
        var renderRootCode = toString.call(renderer.Mount._renderNewRootComponent);
        // Filter out bad results (if that is even possible):
        if (renderRootCode.indexOf('function') !== 0) {
          // Hope for the best if we're not sure.
          return 'production';
        }
        // React DOM Stack < 15.1.0
        // If it contains "storedMeasure" call, it's wrapped in ReactPerf (DEV only).
        // This would be true even if it's minified, as method name still matches.
        if (renderRootCode.indexOf('storedMeasure') !== -1) {
          return 'development';
        }
        // React DOM Stack >= 15.1.0, < 16
        // If it contains a warning message, it's a DEV build.
        // This would be true even if it's minified, as the message would stay.
        if (renderRootCode.indexOf('should be a pure function') !== -1) {
          return 'development';
        }
        // By now we know that it's envified--but what if it's not minified?
        // This can be bad too, as it means DEV code is still there.
        // Let's check the first argument. It should be a single letter.
        // We know this function gets more than one argument in all supported
        // versions, and if it doesn't have arguments, it's wrapped in ReactPerf
        // (which also indicates a DEV build, although we should've filtered
        // that out earlier).
        if (!(/function\s*\(\w\,/.test(renderRootCode))) {
          return 'development';
        }
        // Seems like we're using the production version.
        // Now let's check if we're still on 0.14 or lower:
        if (renderRootCode.indexOf('._registerComponent') !== -1) {
          // TODO: we can remove the condition above once 16
          // is older than a year. Since this branch only runs
          // for Stack, we can flip it completely when Stack
          // is old enough. The branch for Fiber is above,
          // and it can check renderer.version directly.
          return 'outdated';
        }
        // We're all good.
        return 'production';
      }
    } catch (err) {
      // Weird environments may exist.
      // This code needs a higher fault tolerance
      // because it runs even with closed DevTools.
      // TODO: should we catch errors in all injected code, and not just this part?
    }
    return 'production';
  }
  const hook = ({
    // Shared between Stack and Fiber:
    _renderers: {},
    helpers: {},
    inject: function(renderer) {
      var id = Math.random().toString(16).slice(2);
      hook._renderers[id] = renderer;
      var reactBuildType = detectReactBuildType(renderer);
      hook.emit('renderer', {id, renderer, reactBuildType});
      return id;
    },
    _listeners: {},
    sub: function(evt, fn) {
      hook.on(evt, fn);
      return () => hook.off(evt, fn);
    },
    on: function(evt, fn) {
      if (!hook._listeners[evt]) {
        hook._listeners[evt] = [];
      }
      hook._listeners[evt].push(fn);
    },
    off: function(evt, fn) {
      if (!hook._listeners[evt]) {
        return;
      }
      var ix = hook._listeners[evt].indexOf(fn);
      if (ix !== -1) {
        hook._listeners[evt].splice(ix, 1);
      }
      if (!hook._listeners[evt].length) {
        hook._listeners[evt] = null;
      }
    },
    emit: function(evt, data) {
      if (hook._listeners[evt]) {
        hook._listeners[evt].map(fn => fn(data));
      }
    },
    // Fiber-only:
    supportsFiber: true,
    _fiberRoots: {},
    getFiberRoots(rendererID) {
      const roots = hook._fiberRoots;
      if (!roots[rendererID]) {
        roots[rendererID] = new Set();
      }
      return roots[rendererID];
    },
    onCommitFiberUnmount: function(rendererID, fiber) {
      // TODO: can we use hook for roots too?
      if (hook.helpers[rendererID]) {
        hook.helpers[rendererID].handleCommitFiberUnmount(fiber);
      }
    },
    onCommitFiberRoot: function(rendererID, root) {
      const mountedRoots = hook.getFiberRoots(rendererID);
      const current = root.current;
      const isKnownRoot = mountedRoots.has(root);
      const isUnmounting = current.memoizedState == null || current.memoizedState.element == null;
      // Keep track of mounted roots so we can hydrate when DevTools connect.
      if (!isKnownRoot && !isUnmounting) {
        mountedRoots.add(root);
      } else if (isKnownRoot && isUnmounting) {
        mountedRoots.delete(root);
      }
      if (hook.helpers[rendererID]) {
        hook.helpers[rendererID].handleCommitFiberRoot(root);
      }
    },
  });
  Object.defineProperty(window, '__REACT_DEVTOOLS_GLOBAL_HOOK__', {
    value: (hook : Hook),
  });
}

module.exports = installGlobalHook;
