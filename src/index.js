/**
 * SnipLog SDK - Universal Entry Point
 * Auto-detects environment and exports appropriate SDK
 */

// Detect if running in Node.js environment
const isNode = typeof process !== 'undefined' &&
  process.versions != null &&
  process.versions.node != null;

if (isNode) {
  // Export Node.js version for backend/Express use
  module.exports = require('./node');
} else {
  // Browser environment - this should not be reached in normal Node usage
  // For browser, users should include browser.js directly via <script> tag
  throw new Error('SnipLog: Use browser.js for frontend integration via <script> tag');
}
