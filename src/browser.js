/*
	SnipLog SDK (minimal, zero-dependency)
	Usage:
		<script src="/path/to/snipsdk.js"></script>
		<script>
			SnipLog.init({ endpoint: 'http://localhost:3000/api/errors', projectKey: 'dev-project-key' });
		</script>

	The SDK captures: window.onerror, unhandledrejection, and console.error (best-effort)
*/

; (function (global) {
	const DEFAULT_ENDPOINT = 'http://localhost:3001/api/errors';

	function uuidv4() {
		// simple UUID (RFC4122 v4-like)
		return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
			const r = (Math.random() * 16) | 0;
			const v = c === 'x' ? r : (r & 0x3) | 0x8;
			return v.toString(16);
		});
	}

	function safeStringify(obj) {
		try {
			return JSON.stringify(obj);
		} catch (e) {
			return String(obj);
		}
	}

	function detectDevice() {
		const ua = navigator.userAgent || '';
		if (/Mobi|Android/i.test(ua)) return 'mobile';
		if (/Tablet|iPad/i.test(ua)) return 'tablet';
		return 'desktop';
	}

	/**
	 * Sanitize sensitive data from objects before sending to backend
	 * @param {any} data - Data to sanitize
	 * @param {number} depth - Current recursion depth
	 * @returns {any} Sanitized data
	 */
	function sanitizeData(data, depth) {
		depth = depth || 0;
		var MAX_DEPTH = 10;
		var SENSITIVE_KEYS = /^(password|passwd|pwd|secret|token|apikey|api_key|api-key|authorization|auth|credential|credit.?card|card.?number|cvv|cvc|ssn|social.?security|private.?key|access.?token|refresh.?token|bearer|session.?id|cookie)$/i;

		// Prevent infinite recursion
		if (depth > MAX_DEPTH) return '[MAX_DEPTH_EXCEEDED]';

		// Handle null/undefined
		if (data == null) return data;

		// Handle primitives
		if (typeof data !== 'object') return data;

		// Handle arrays
		if (Array.isArray(data)) {
			return data.map(function (item) { return sanitizeData(item, depth + 1); });
		}

		// Handle objects
		var sanitized = {};
		var keys = Object.keys(data);
		for (var i = 0; i < keys.length; i++) {
			var key = keys[i];
			if (SENSITIVE_KEYS.test(key)) {
				sanitized[key] = '[REDACTED]';
			} else {
				sanitized[key] = sanitizeData(data[key], depth + 1);
			}
		}
		return sanitized;
	}

	function send(payload, opts) {
		const endpoint = (opts && opts.endpoint) || DEFAULT_ENDPOINT;
		const projectKey = (opts && opts.projectKey) || '';
		try {
			const body = safeStringify(payload);
			// Use fetch if available
			if (typeof fetch === 'function') {
				fetch(endpoint, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						Authorization: `Bearer ${projectKey}`
					},
					body
				}).catch(() => {
					// swallow network errors
				});
				return;
			}

			// Fallback to XHR
			const xhr = new XMLHttpRequest();
			xhr.open('POST', endpoint, true);
			xhr.setRequestHeader('Content-Type', 'application/json');
			xhr.setRequestHeader('Authorization', `Bearer ${projectKey}`);
			xhr.send(body);
		} catch (e) {
			// ignore
		}
	}

	const SnipLog = {
		_opts: { endpoint: DEFAULT_ENDPOINT, projectKey: '' },
		_sessionId: uuidv4(),

		/**
		 * Manually capture an error
		 * @param {Error} error - The error object
		 * @param {Object} metadata - Additional context
		 */
		captureError: function (error, metadata) {
			metadata = metadata || {};
			var payload = {
				message: error.message || String(error),
				stack: error.stack || '',
				url: window.location.href,
				browser: { userAgent: navigator.userAgent, platform: navigator.platform },
				device: detectDevice(),
				sessionId: this._sessionId,
				metadata: sanitizeData(metadata),
				ts: new Date().toISOString()
			};
			send(payload, this._opts);
		},

		/**
		 * Capture a non-error message/event
		 * @param {string} message - The message
		 * @param {Object} metadata - Additional context
		 */
		captureMessage: function (message, metadata) {
			metadata = metadata || {};
			var payload = {
				message: message,
				stack: '',
				url: window.location.href,
				browser: { userAgent: navigator.userAgent, platform: navigator.platform },
				device: detectDevice(),
				sessionId: this._sessionId,
				metadata: sanitizeData(metadata),
				ts: new Date().toISOString()
			};
			send(payload, this._opts);
		},

		init: function (opts) {
			this._opts = Object.assign({}, this._opts, opts || {});
			// capture window.onerror
			if (typeof window !== 'undefined') {
				const self = this;
				window.addEventListener('error', function (ev) {
					try {
						const e = ev.error || {};
						const payload = {
							message: e && e.message ? e.message : (ev.message || 'window.error'),
							stack: (e && e.stack) || `${ev.filename}:${ev.lineno}:${ev.colno}`,
							url: window.location.href,
							line: ev.lineno || null,
							column: ev.colno || null,
							browser: { userAgent: navigator.userAgent, platform: navigator.platform },
							device: detectDevice(),
							sessionId: self._sessionId,
							metadata: {},
							ts: new Date().toISOString()
						};
						send(payload, self._opts);
					} catch (ignore) { }
				});

				// unhandledrejection
				window.addEventListener('unhandledrejection', function (ev) {
					try {
						const reason = ev.reason;
						const payload = {
							message: reason && reason.message ? reason.message : String(reason || 'unhandledrejection'),
							stack: (reason && reason.stack) || '',
							url: window.location.href,
							browser: { userAgent: navigator.userAgent, platform: navigator.platform },
							device: detectDevice(),
							sessionId: self._sessionId,
							metadata: { type: 'promise' },
							ts: new Date().toISOString()
						};
						send(payload, self._opts);
					} catch (ignore) { }
				});

				// console.error wrapper (best-effort, does not break app)
				try {
					const origConsoleError = console.error.bind(console);
					console.error = function () {
						try {
							const args = Array.prototype.slice.call(arguments);
							const payload = {
								message: 'console.error',
								stack: '',
								url: window.location.href,
								browser: { userAgent: navigator.userAgent, platform: navigator.platform },
								device: detectDevice(),
								sessionId: self._sessionId,
								metadata: { console: args.map(a => (typeof a === 'object' ? safeStringify(a) : String(a))).join(' | ') },
								ts: new Date().toISOString()
							};
							send(payload, self._opts);
						} catch (ignore) { }
						// always call original
						origConsoleError.apply(null, arguments);
					};
				} catch (ignore) { }
			}
		}
	};

	// expose globally
	global.SnipLog = SnipLog;
})(typeof window !== 'undefined' ? window : this);

