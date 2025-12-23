// Simple test to verify the server starts
const express = require('express');
const SnipLog = require('./src/node');

console.log('1. Loading Express...');
const app = express();
app.use(express.json());

console.log('2. Creating SnipLog instance...');
const sniplog = new SnipLog({
  endpoint: 'http://localhost:3000/api/errors',
  projectKey: 'dev-project-key',
  autoCaptureExceptions: false,  // Disable for testing
  timeout: 5000
});

console.log('3. Adding middleware...');
app.use(sniplog.requestMiddleware());

console.log('4. Adding routes...');
app.get('/', (req, res) => {
  res.json({ message: 'Test app running!' });
});

app.get('/test', (req, res) => {
  req.sniplog.captureMessage('Test endpoint hit');
  res.json({ status: 'ok' });
});

console.log('5. Adding error middleware...');
app.use(sniplog.errorMiddleware());

console.log('6. Starting server...');
const PORT = 4000;
app.listen(PORT, () => {
  console.log(`✓ Server started successfully on http://localhost:${PORT}`);
  console.log('Test with: curl http://localhost:4000/');
});
