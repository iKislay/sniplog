# SnipLog SDK

Enterprise-grade error tracking SDK for Node.js/Express backends and browser frontends.

## Installation

```bash
npm install sniplog-sdk
```

## Usage

### Node.js / Express Backend (Current Focus)

#### Basic Setup

```javascript
const express = require('express');
const SnipLog = require('sniplog-sdk');

const app = express(); //todo

// Initialize SnipLog
const sniplog = new SnipLog({
  endpoint: 'http://localhost:3000/api/errors',
  projectKey: 'your-project-key',
  autoCaptureExceptions: true, // Auto-capture uncaught exceptions
  timeout: 5000
});

// Add request middleware (adds req.sniplog helper)
app.use(sniplog.requestMiddleware());

// Your routes here...

// Add error middleware - MUST be after all routes
app.use(sniplog.errorMiddleware());

app.listen(3000);
```

#### Configuration Options

```javascript
const sniplog = new SnipLog({
  endpoint: 'http://localhost:3000/api/errors',  // SnipLog backend URL
  projectKey: 'your-api-key',                    // Project API key
  autoCaptureExceptions: true,                    // Auto-capture process errors (default: true)
  enabled: true,                                  // Enable/disable SDK (default: true)
  timeout: 5000,                                  // Request timeout in ms (default: 5000)
  discordWebhook: 'https://discord.com/api/webhooks/...'  // Optional: Discord webhook URL
});
```

#### Manual Error Capture

```javascript
app.get('/api/data', async (req, res) => {
  try {
    const data = await fetchData();
    res.json(data);
  } catch (err) {
    // Capture error with context
    req.sniplog.captureError(err, {
      userId: req.user?.id,
      operation: 'fetch-data',
      endpoint: '/api/data'
    });
    
    res.status(500).json({ error: 'Failed to fetch data' });
  }
});
```

#### Capture Messages (Non-Errors)

```javascript
app.post('/api/users', (req, res) => {
  req.sniplog.captureMessage('New user registration attempt', {
    level: 'info',
    email: req.body.email
  });
  
  // ... handle registration
});
```

#### Express Middleware Features

**Request Middleware** (`sniplog.requestMiddleware()`)
- Adds `req.sniplog.captureError()` and `req.sniplog.captureMessage()` helpers
- Automatically includes request context (method, URL, IP, user-agent)

**Error Middleware** (`sniplog.errorMiddleware()`)
- Captures all errors that reach Express error handlers
- Includes full request context
- Must be placed AFTER all routes and middleware

#### Auto-Capture Features

When `autoCaptureExceptions: true`:
- `uncaughtException` events are captured
- `unhandledRejection` events are captured

Each captured error includes:
- Error message and stack trace
- System info (Node version, OS, hostname)
- Process ID and session ID
- Custom metadata you provide

#### Example: Complete Express App

See `example-express-app.js` for a full working example.

To run the example:

```bash
# Start the SnipLog backend first (in another terminal)
cd backend
npm start

# Run the example app
cd sdk
node example-express-app.js

# Test error capture
curl http://localhost:4000/test-error
```

---

### Browser / Frontend (Coming Soon)

For frontend integration, include `browser.js` directly:

```html
<script src="/path/to/sniplog-sdk/src/browser.js"></script>
<script>
  SnipLog.init({
    endpoint: 'http://localhost:3000/api/errors',
    projectKey: 'your-project-key'
  });
</script>
```

The browser SDK will automatically capture:
- `window.onerror` (script errors)
- `unhandledrejection` (promise rejections)
- `console.error` (optional)

---

## API Reference

### Node.js SDK

#### `new SnipLog(config)`

Creates a new SnipLog instance.

**Parameters:**
- `config.endpoint` (string): SnipLog backend URL
- `config.projectKey` (string): Your project API key
- `config.autoCaptureExceptions` (boolean): Auto-capture process errors (default: true)
- `config.enabled` (boolean): Enable/disable SDK (default: true)
- `config.timeout` (number): Request timeout in ms (default: 5000)
- `config.discordWebhook` (string): Optional Discord webhook URL for real-time notifications

#### `sniplog.captureError(error, metadata)`

Manually capture an error.

**Parameters:**
- `error` (Error): The error object
- `metadata` (object): Additional context (userId, operation, etc.)

#### `sniplog.captureMessage(message, metadata)`

Capture a non-error message/event.

**Parameters:**
- `message` (string): The message
- `metadata` (object): Additional context

#### `sniplog.requestMiddleware()`

Returns Express middleware that adds `req.sniplog` helpers.

#### `sniplog.errorMiddleware()`

Returns Express error handling middleware. Place after all routes.

---

## Discord Webhook Integration

SnipLog supports real-time error notifications via Discord webhooks. Errors will be sent to both the backend database AND your Discord channel.

### Setup Discord Webhook

1. Open Discord and go to your server
2. Go to **Server Settings** > **Integrations** > **Webhooks**
3. Click **New Webhook** or **Create Webhook**
4. Copy the **Webhook URL**

### SDK Configuration

```javascript
const sniplog = new SnipLog({
  endpoint: 'http://localhost:3000/api/errors',
  projectKey: 'your-api-key',
  discordWebhook: 'https://discord.com/api/webhooks/1234567890/your-webhook-token'
});
```

### Backend Configuration

Alternatively, configure Discord webhook in the backend (all projects will use it):

**.env file:**
```bash
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/1234567890/your-webhook-token
```

### Discord Message Format

When an error occurs, you'll receive a Discord message like:

```
🚨 **expressError**: Cannot read property 'id' of undefined
📅 **Time**: 10/31/2025, 3:45:12 PM
🔗 **URL**: /api/users/123
📍 **Method**: GET
💻 **Host**: production-server
👤 **User**: user-456

```
Error: Cannot read property 'id' of undefined
    at getUserProfile (/app/routes/users.js:45:20)
    at Layer.handle [as handle_request]
    at next (/app/node_modules/express/lib/router/route.js:137:13)
```
```

### Features

- ✅ Real-time notifications in Discord
- ✅ Formatted with emojis and markdown
- ✅ Includes error message, stack trace, and metadata
- ✅ Truncated to fit Discord's 2000 character limit
- ✅ Works for both SDK and backend configurations

---

## Development

### Project Structure

```
sdk/
├── src/
│   ├── index.js        # Auto-detects environment (Node/browser)
│   ├── node.js         # Node.js/Express SDK
│   └── browser.js      # Browser SDK (for future frontend use)
├── example-express-app.js
├── package.json
└── README.md
```

### Testing Locally

```bash
# Link SDK locally
cd sdk
npm link

# Use in your project
cd your-express-app
npm link sniplog-sdk
```

---

## License

MIT
