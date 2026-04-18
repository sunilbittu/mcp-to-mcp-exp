/**
 * New Relic instrumentation helpers.
 *
 * Wraps async operations in a custom segment + records optional custom events.
 * Falls back to a no-op recorder if New Relic is disabled or not configured,
 * so the app stays runnable without a license key in development.
 */

import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

let newrelic = null;
try {
  // The agent only initializes when started with `-r newrelic` and a license
  // key is present. Requiring here is safe either way; if the agent is in stub
  // mode the API methods are still defined and become no-ops.
  newrelic = require('newrelic');
} catch (err) {
  console.warn('[telemetry] newrelic module not loaded:', err.message);
}

function makeRecorder(segment) {
  return {
    addAttributes(attrs) {
      if (!newrelic) return;
      try {
        newrelic.addCustomAttributes(attrs);
      } catch {
        /* ignore */
      }
    },
    recordEvent(eventType, attrs) {
      if (!newrelic) return;
      try {
        newrelic.recordCustomEvent(eventType, attrs);
      } catch {
        /* ignore */
      }
    },
    recordMetric(name, value) {
      if (!newrelic) return;
      try {
        newrelic.recordMetric(name, value);
      } catch {
        /* ignore */
      }
    },
    segment,
  };
}

/**
 * Run `fn` inside a custom New Relic segment named `name`.
 * The wrapped function receives a recorder for adding attributes/events.
 */
export async function instrument(name, fn) {
  if (!newrelic || typeof newrelic.startSegment !== 'function') {
    return fn(makeRecorder(null));
  }

  return newrelic.startSegment(name, true, async () => {
    const segment = newrelic.agent?.tracer?.getSegment?.() ?? null;
    return fn(makeRecorder(segment));
  });
}

export function noticeError(err, attrs = {}) {
  if (!newrelic) return;
  try {
    newrelic.noticeError(err, attrs);
  } catch {
    /* ignore */
  }
}

export function setTransactionName(name) {
  if (!newrelic) return;
  try {
    newrelic.setTransactionName(name);
  } catch {
    /* ignore */
  }
}

export function recordCustomEvent(eventType, attrs) {
  if (!newrelic) return;
  try {
    newrelic.recordCustomEvent(eventType, attrs);
  } catch {
    /* ignore */
  }
}
