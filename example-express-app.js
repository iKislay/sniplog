/**
 * Example Express app using SnipLog SDK
 * 
 * This demonstrates how to integrate SnipLog error tracking
 * into your Express.js backend application.
 */

const express = require('express');
const SnipLog = require('./src/node'); // or require('./sdk/src/index.js') if using locally

const app = express();
app.use(express.json());

// Initialize SnipLog
const sniplog = new SnipLog({
  endpoint: 'http://localhost:3001/api/errors',
  projectKey: 'sk_gj1gtqv7f_mjjvjlh3',
  autoCaptureExceptions: false, // Disabled to prevent conflicts - enable if needed
  timeout: 5000,
  // Optional: Discord webhook for real-time error notifications
});

// Add request middleware (optional - adds req.sniplog helper)
app.use(sniplog.requestMiddleware());6

// Your routes
app.get('/', (req, res) => {
  res.json({ message: 'SnipLog Example App' });
});

app.get('/test-error', (req, res, next) => {
  // This error will be caught by the error middleware below
  throw new Error('Intentional test error from route');
});

app.get('/test-manual-capture', (req, res) => {
  try {
    // Simulate some operation that fails
    const result = JSON.parse('invalid json');
    res.json({ result });
  } catch (err) {
    // Manual error capture using req.sniplog helper
    req.sniplog.captureError(err, {
      action: 'parsing-user-data',
      userId: 'test-user-123'
    });
    
    res.status(500).json({ error: 'Failed to parse data' });
  }
});

app.get('/test-message', (req, res) => {
  // Capture non-error events
  req.sniplog.captureMessage('User visited test-message endpoint', {
    level: 'info',
    userId: 'test-user-456'
  });
  
  res.json({ message: 'Message logged to SnipLog' });
});

app.post('/api/data', (req, res) => {
  // Simulate async error
  setTimeout(() => {
    const err = new Error('Database connection timeout');
    sniplog.captureError(err, {
      operation: 'save-data',
      data: req.body
    });
    res.status(500).json({ error: 'Operation failed' });
  }, 100);
});

// Add SnipLog error middleware - MUST be after all routes
app.use(sniplog.errorMiddleware());

// Optional: Add a final error handler for your app
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: err.message 
  });
});

const PORT = process.env.APP_PORT || 4000;
app.listen(PORT, () => {
  console.log(`Example app listening on http://localhost:${PORT}`);
  console.log('Try these endpoints:');
  console.log(`  GET  http://localhost:${PORT}/test-error`);
  console.log(`  GET  http://localhost:${PORT}/test-manual-capture`);
  console.log(`  GET  http://localhost:${PORT}/test-message`);
  console.log(`  POST http://localhost:${PORT}/api/data`);
});
