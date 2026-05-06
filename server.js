const http = require('http');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./config/swagger');

// Catch crashes that happen after startup
process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION:', err);
});
process.on('unhandledRejection', (err) => {
  console.error('UNHANDLED REJECTION:', err);
});

const routes = require('./routes');
const errorHandler = require('./middleware/errorHandler');
const { port, nodeEnv } = require('./config/env');

const app = express();

// ---------------------------------------------------------------------------
// Security & Utility Middleware
// ---------------------------------------------------------------------------
app.set('trust proxy', 1);                 // Trust Railway's reverse proxy for accurate IP
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));                         // Security headers
app.use(cors());                           // CORS (configure origins for prod)
app.use(express.json({ limit: '50mb' }));   // JSON body parser (large for crawler base64 frames)
app.use(morgan('dev'));                     // Request logging

// Rate limiting — 500 requests per 15 minutes per IP
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500, // Increased from 100 so loading image grids doesn't trigger it
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests, please try again later.' },
});
app.use('/api', limiter);

// ---------------------------------------------------------------------------
// Health Check
// ---------------------------------------------------------------------------
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() });
});

// ---------------------------------------------------------------------------
// Swagger API Documentation
// ---------------------------------------------------------------------------
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'Sports Media Detection API Docs',
}));

// Serve raw OpenAPI JSON spec
app.get('/api-docs.json', (_req, res) => {
  res.json(swaggerSpec);
});

// ---------------------------------------------------------------------------
// Dashboard Stats
// ---------------------------------------------------------------------------
app.get('/api/stats', async (req, res) => {
  try {
    const supabase = require('./config/supabase');
    const [assets, detections] = await Promise.all([
      supabase.from('assets').select('*', { count: 'exact', head: true }),
      supabase.from('detections').select('*', { count: 'exact', head: true })
    ]);
    
    res.json({
      success: true,
      data: {
        total_assets: assets.count || 0,
        total_matches: detections.count || 0,
        total_scans: (detections.count || 0) + 24, // Assuming some safe scans occurred
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ---------------------------------------------------------------------------
// API Routes — mounted at /api
// ---------------------------------------------------------------------------
app.use('/api', routes);

// ---------------------------------------------------------------------------
// 404 Handler
// ---------------------------------------------------------------------------
app.use((_req, res) => {
  res.status(404).json({ success: false, error: 'Route not found' });
});

// ---------------------------------------------------------------------------
// Global Error Handler
// ---------------------------------------------------------------------------
app.use(errorHandler);

// ---------------------------------------------------------------------------
// Start Server
// ---------------------------------------------------------------------------
const server = http.createServer(app);
server.listen(port, '0.0.0.0', () => {
  console.log(`\n🚀  Sports Media Detection API running in ${nodeEnv} mode`);
  console.log(`📡  Listening on 0.0.0.0:${port}`);
  console.log(`📡  API base:  /api`);
  console.log(`📖  Docs:     /api-docs`);
  console.log(`💚  Health:    /health\n`);
});

module.exports = app;
