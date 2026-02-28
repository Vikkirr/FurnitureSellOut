const crypto = require('crypto');

const TTL_MS = 10 * 60 * 1000; // 10 minutes
const tokens = new Map();

function add() {
  const token = crypto.randomBytes(24).toString('hex');
  tokens.set(token, Date.now() + TTL_MS);
  return token;
}

function isValid(token) {
  if (!token || typeof token !== 'string') return false;
  const expires = tokens.get(token);
  if (!expires || Date.now() > expires) {
    tokens.delete(token);
    return false;
  }
  return true;
}

// Clean expired every 5 min
setInterval(() => {
  const now = Date.now();
  for (const [t, expires] of tokens.entries()) {
    if (now > expires) tokens.delete(t);
  }
}, 5 * 60 * 1000);

module.exports = { add, isValid };
