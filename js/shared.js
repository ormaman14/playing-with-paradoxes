/* Shared helpers for all paradox pages. */
'use strict';

/**
 * Format a number for display as HTML.
 * Uses scientific notation (m × 10^e) for very small/large magnitudes,
 * otherwise a plain decimal trimmed of trailing zeros.
 */
function fmtNum(x, sigDigits = 6) {
  if (!isFinite(x)) return x > 0 ? '&infin;' : (x < 0 ? '-&infin;' : 'NaN');
  if (x === 0) return '0';
  const ax = Math.abs(x);
  if (ax >= 1e6 || ax < 1e-3) {
    const e = Math.floor(Math.log10(ax));
    const m = x / Math.pow(10, e);
    return `${m.toFixed(2)}&thinsp;&times;&thinsp;10<sup>${e}</sup>`;
  }
  return String(parseFloat(x.toPrecision(sigDigits)));
}

/** Pick a "nice" tick step (1, 2 or 5 times a power of ten) near `raw`. */
function niceStep(raw) {
  const p = Math.pow(10, Math.floor(Math.log10(raw)));
  const m = raw / p;
  if (m <= 1.5) return p;
  if (m <= 3.5) return 2 * p;
  if (m <= 7.5) return 5 * p;
  return 10 * p;
}
