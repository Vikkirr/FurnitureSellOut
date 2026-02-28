const { isValid: isImportTokenValid } = require('../importTokens');

function requireAdmin(req, res, next) {
  if (req.session && req.session.admin) {
    return next();
  }
  res.status(401).json({ error: 'Admin authentication required' });
}

/** Use for import route: allow session cookie OR token in header or body (body available after multer). */
function requireAdminOrImportToken(req, res, next) {
  if (req.session && req.session.admin) {
    return next();
  }
  const token = req.headers['x-import-token'] || (req.body && req.body.import_token);
  if (token && isImportTokenValid(token)) {
    return next();
  }
  res.status(401).json({ error: 'Admin authentication required' });
}

module.exports = { requireAdmin, requireAdminOrImportToken };
