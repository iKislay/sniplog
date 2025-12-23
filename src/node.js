/**
 * SnipLog SDK - Node.js/Express Backend Version
 * 
 * Usage:
 *   const SnipLog = require('sniplog-sdk/node');
 *   const sniplog = new SnipLog({ endpoint: 'http://localhost:3000/api/errors', projectKey: 'your-key' });
 * 
 *   // Express middleware (captures uncaught errors)
 *   app.use(sniplog.errorMiddleware());
 * 
 *   // Manual capture
 *   sniplog.captureError(new Error('something failed'), { userId: '123' });
 */

const http = require('http');
const https = require('https');
const crypto = require('crypto');
const os = require('os');

class SnipLog {
  constructor(config = {}) {
    this.endpoint = config.endpoint || 'http://localhost:3000/api/errors';
    this.projectKey = config.projectKey || '';
    this.webhookUrl = config.webhookUrl || config.discordWebhook || ''; // Discord webhook URL
    this.sessionId = this._generateSessionId();
    this.enabled = config.enabled !== false;
    this.timeout = config.timeout || 5000;
    
    // Auto-capture process-level errors
    if (config.autoCaptureExceptions !== false) {
      this._attachGlobalHandlers();
    }
  }

  _generateSessionId() {
    return crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex');
  }

  _attachGlobalHandlers() {
    // Capture uncaught exceptions
    process.on('uncaughtException', (err) => {
      this.captureError(err, { type: 'uncaughtException' });
      // Allow process to continue or exit based on your policy
    });

    // Capture unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      const err = reason instanceof Error ? reason : new Error(String(reason));
      this.captureError(err, { type: 'unhandledRejection' });
    });
  }

  /**
   * Capture an error manually
   * @param {Error} error - The error object
   * @param {Object} metadata - Additional context
   */
  captureError(error, metadata = {}) {
    if (!this.enabled) return;

    const payload = this._buildPayload(error, metadata);
    this._send(payload);
  }

  /**
   * Capture a message (non-error event)
   * @param {string} message - The message
   * @param {Object} metadata - Additional context
   */
  captureMessage(message, metadata = {}) {
    if (!this.enabled) return;

    const payload = {
      message: message,
      stack: '',
      url: metadata.url || '',
      browser: this._getSystemInfo(),
      device: 'server',
      sessionId: this.sessionId,
      metadata: { ...metadata, level: metadata.level || 'info' },
      ts: new Date().toISOString()
    };
    this._send(payload);
  }

  _buildPayload(error, metadata = {}) {
    return {
      message: error.message || 'Unknown error',
      stack: error.stack || '',
      url: metadata.url || '',
      line: this._extractLineNumber(error),
      column: this._extractColumnNumber(error),
      browser: this._getSystemInfo(),
      device: 'server',
      sessionId: this.sessionId,
      metadata: {
        ...metadata,
        errorName: error.name,
        hostname: os.hostname(),
        pid: process.pid
      },
      ts: new Date().toISOString()
    };
  }

  _extractLineNumber(error) {
    if (!error.stack) return null;
    const match = error.stack.match(/:(\d+)(?::(\d+))?\)?$/m);
    return match ? parseInt(match[1], 10) : null;
  }

  _extractColumnNumber(error) {
    if (!error.stack) return null;
    const match = error.stack.match(/:(\d+):(\d+)\)?$/m);
    return match ? parseInt(match[2], 10) : null;
  }

  _getSystemInfo() {
    return {
      userAgent: `Node.js/${process.version}`,
      platform: `${os.platform()} ${os.release()}`,
      arch: os.arch(),
      nodeVersion: process.version
    };
  }

  _send(payload) {
    const url = new URL(this.endpoint);
    const isHttps = url.protocol === 'https:';
    const client = isHttps ? https : http;

    const body = JSON.stringify(payload);
    const options = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + url.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        'Authorization': `Bearer ${this.projectKey}`
      },
      timeout: this.timeout
    };

    const req = client.request(options, (res) => {
      // Consume response to free up memory
      res.on('data', () => {});
      res.on('end', () => {
        if (res.statusCode >= 400) {
          console.warn(`[SnipLog] Error reporting failed with status ${res.statusCode}`);
        }
      });
    });

    req.on('error', (err) => {
      console.warn('[SnipLog] Failed to send error:', err.message);
    });

    req.on('timeout', () => {
      req.destroy();
      console.warn('[SnipLog] Request timeout');
    });

    req.write(body);
    req.end();

    // Send to Discord webhook if configured
    if (this.webhookUrl) {
      this._sendToDiscord(payload);
    }
  }

  /**
   * Send error notification to Discord webhook
   * @param {Object} payload - The error payload
   */
  _sendToDiscord(payload) {
    try {
      const url = new URL(this.webhookUrl);
      const isHttps = url.protocol === 'https:';
      const client = isHttps ? https : http;

      // Format Discord message
      const errorMessage = this._formatDiscordMessage(payload);
      const discordPayload = JSON.stringify({ content: errorMessage });

      const options = {
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: url.pathname + url.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(discordPayload)
        },
        timeout: this.timeout
      };

      const req = client.request(options, (res) => {
        res.on('data', () => {});
        res.on('end', () => {
          if (res.statusCode >= 400) {
            console.warn(`[SnipLog] Discord webhook failed with status ${res.statusCode}`);
          }
        });
      });

      req.on('error', (err) => {
        console.warn('[SnipLog] Failed to send to Discord:', err.message);
      });

      req.on('timeout', () => {
        req.destroy();
      });

      req.write(discordPayload);
      req.end();
    } catch (err) {
      console.warn('[SnipLog] Discord webhook error:', err.message);
    }
  }

  /**
   * Format error payload for Discord message
   * @param {Object} payload - The error payload
   * @returns {string} Formatted Discord message
   */
  _formatDiscordMessage(payload) {
    const emoji = payload.metadata?.type === 'expressError' ? '🚨' : '⚠️';
    const errorType = payload.metadata?.type || 'Error';
    const timestamp = new Date(payload.ts).toLocaleString();
    
    let message = `${emoji} **${errorType}**: ${payload.message}\n`;
    message += `📅 **Time**: ${timestamp}\n`;
    message += `🔗 **URL**: ${payload.url || 'N/A'}\n`;
    
    if (payload.metadata?.method) {
      message += `📍 **Method**: ${payload.metadata.method}\n`;
    }
    
    if (payload.metadata?.hostname) {
      message += `💻 **Host**: ${payload.metadata.hostname}\n`;
    }
    
    if (payload.metadata?.userId) {
      message += `👤 **User**: ${payload.metadata.userId}\n`;
    }
    
    // Add stack trace (truncated for Discord's limit)
    if (payload.stack) {
      const stackLines = payload.stack.split('\n').slice(0, 5).join('\n');
      message += `\n\`\`\`\n${stackLines}\n\`\`\``;
    }
    
    // Discord has a 2000 character limit
    if (message.length > 1900) {
      message = message.substring(0, 1900) + '\n... (truncated)';
    }
    
    return message;
  }

  /**
   * Express error middleware
   * Place this AFTER all routes and other middleware
   * 
   * Example:
   *   app.use(sniplog.errorMiddleware());
   */
  errorMiddleware() {
    const self = this;
    return function sniplogErrorHandler(err, req, res, next) {
      // Capture the error
      self.captureError(err, {
        type: 'expressError',
        method: req.method,
        url: req.originalUrl || req.url,
        ip: req.ip || req.connection.remoteAddress,
        userAgent: req.get('user-agent'),
        userId: req.user ? req.user.id : undefined,
        body: req.body,
        query: req.query,
        params: req.params
      });

      // Pass error to next error handler
      next(err);
    };
  }

  /**
   * Express request middleware (captures request context for later errors)
   * Place this BEFORE routes
   * 
   * Example:
   *   app.use(sniplog.requestMiddleware());
   */
  requestMiddleware() {
    const self = this;
    return function sniplogRequestHandler(req, res, next) {
      // Attach a helper to capture errors within this request
      req.sniplog = {
        captureError: (err, metadata = {}) => {
          self.captureError(err, {
            ...metadata,
            method: req.method,
            url: req.originalUrl || req.url,
            ip: req.ip || req.connection.remoteAddress,
            userAgent: req.get('user-agent')
          });
        },
        captureMessage: (message, metadata = {}) => {
          self.captureMessage(message, {
            ...metadata,
            method: req.method,
            url: req.originalUrl || req.url
          });
        }
      };
      next();
    };
  }
}

module.exports = SnipLog;
