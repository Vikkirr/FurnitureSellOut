require('dotenv').config();
const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const FileStore = require('session-file-store')(session);
const productsRouter = require('./routes/products');
const adminRouter = require('./routes/admin');
const { sendTemplateResponse, importUpload, handleImport } = adminRouter;
const { initDb } = require('./db');
const settings = require('./settings');

const PORT = process.env.PORT || 3080;
const app = express();

initDb();

app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? false : ['http://localhost:5173', 'http://127.0.0.1:5173'],
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());
const sessionConfig = {
  secret: process.env.SESSION_SECRET || 'furniture-catalog-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.HTTPS === 'true',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000,
    sameSite: 'lax',
  },
};
if (process.env.NODE_ENV === 'production') {
  const sessionsDir = path.join(__dirname, '..', 'data', 'sessions');
  if (!fs.existsSync(sessionsDir)) fs.mkdirSync(sessionsDir, { recursive: true });
  sessionConfig.store = new FileStore({
    path: sessionsDir,
    ttl: 24 * 60 * 60, // 24h, match cookie maxAge
  });
}
app.use(session(sessionConfig));

app.get('/api/health', (req, res) => res.json({ ok: true, port: PORT }));

app.get('/api/seller-profile-url', (req, res) => {
  const url = settings.getSellerProfileUrl && settings.getSellerProfileUrl();
  res.json({ sellerProfileUrl: url || null });
});

// Public template download (no /admin in path so proxies don't require sign-in)
app.get('/api/export-template', (req, res) => sendTemplateResponse(res));

// Excel import at /api/import (not under /api/admin so proxies that require auth for /admin don't block it)
app.post('/api/import', importUpload.single('file'), handleImport);

// Serve project _images folder: /images and /_images (product data often uses /_images/...)
const projectRoot = path.join(__dirname, '..');
const imagesDir = path.join(projectRoot, '_images');
app.use('/images', express.static(imagesDir));
app.use('/_images', express.static(imagesDir));

app.use('/api/products', productsRouter);
app.use('/api/admin', adminRouter);

// Serve built frontend whenever it exists (so IP access and npm start work without NODE_ENV=production)
const publicPath = path.join(__dirname, 'public');
const indexHtml = path.join(publicPath, 'index.html');
const frontendBuilt = fs.existsSync(indexHtml);

if (frontendBuilt) {
  app.use(express.static(publicPath, {
    setHeaders: (res) => res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate'),
  }));
  // SPA fallback: serve index.html only for non-API, non-asset routes (avoid sending HTML for missing /assets/*.js)
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/assets') || req.path.startsWith('/images') || req.path.startsWith('/_images')) return next();
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.sendFile(indexHtml);
  });
} else {
  app.get('/', (req, res) => {
    res.status(503).send(
      '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Setup required</title></head><body>' +
      '<h1>Frontend not built</h1><p>Run from the project root:</p><pre>npm run build\nnpm start</pre>' +
      '<p>Then reload this page.</p></body></html>'
    );
  });
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT} (access via http://<this-machine-ip>:${PORT})`);
  if (!frontendBuilt) console.log('WARNING: Frontend not built. Run "npm run build" then restart.');
});
