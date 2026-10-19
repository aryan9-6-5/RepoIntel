// Whole seconds elapsed since startedAtMs (a Date.now() timestamp).
function elapsed(startedAtMs, nowMs = Date.now()) {
  return Math.floor((nowMs - startedAtMs) / 1000);
}

module.exports = { elapsed };
