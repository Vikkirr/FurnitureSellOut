const fs = require('fs');
const path = require('path');

function getDataDir() {
  const primary = path.join(__dirname, '..', 'data');
  const fallback = path.join(process.cwd(), 'data');
  if (fs.existsSync(primary)) return primary;
  if (fs.existsSync(fallback)) return fallback;
  try {
    fs.mkdirSync(primary, { recursive: true });
    return primary;
  } catch (_) {
    try {
      fs.mkdirSync(fallback, { recursive: true });
      return fallback;
    } catch (_) {
      return primary;
    }
  }
}

let dataDir = getDataDir();
function getSettingsPath() {
  return path.join(dataDir, 'settings.json');
}

const DEFAULT_PROMPT = `You are extracting product information from a web page (e.g. furniture listing).
Given the page content below, extract and return a JSON object with these exact keys (use empty string or null if not found):
name, manufacturer, sku, description, dimensions, weight, color, department, furniture_type, price, cost, retail_price, notes, guidelines.
Also include image_urls: an array of full image URLs that appear to be product photos (from the page or its metadata). Use only URLs that look like images (.jpg, .png, .webp or image host domains).
Return only valid JSON, no markdown or explanation.`;

function ensureDataDir() {
  dataDir = getDataDir();
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
}

function load() {
  ensureDataDir();
  const settingsPath = getSettingsPath();
  try {
    const raw = fs.readFileSync(settingsPath, 'utf8');
    const data = JSON.parse(raw);
    if (data.openaiApiKey && typeof data.openaiApiKey === 'string') {
      data.openaiApiKeyMasked = data.openaiApiKey.slice(0, 7) + '…';
      delete data.openaiApiKey;
    }
    return data;
  } catch (e) {
    if (e.code === 'ENOENT') return {};
    throw e;
  }
}

function save(updates) {
  ensureDataDir();
  const settingsPath = getSettingsPath();
  let current = {};
  try {
    if (fs.existsSync(settingsPath)) {
      const raw = fs.readFileSync(settingsPath, 'utf8');
      current = JSON.parse(raw || '{}');
    }
  } catch (e) {
    if (e.code !== 'ENOENT') throw e;
  }
  const next = { ...current, ...updates };
  const json = JSON.stringify(next, null, 2);
  try {
    fs.writeFileSync(settingsPath, json, 'utf8');
  } catch (e) {
    const altPath = path.join(process.cwd(), 'data', 'settings.json');
    if (altPath !== settingsPath) {
      try {
        const altDir = path.dirname(altPath);
        if (!fs.existsSync(altDir)) fs.mkdirSync(altDir, { recursive: true });
        fs.writeFileSync(altPath, json, 'utf8');
        dataDir = path.join(process.cwd(), 'data');
        return next;
      } catch (_) {}
    }
    e.settingsPath = settingsPath;
    throw e;
  }
  return next;
}

function getOpenAIApiKey() {
  const env = process.env.OPENAI_API_KEY;
  if (env && env.trim()) return env.trim();
  try {
    const raw = fs.readFileSync(getSettingsPath(), 'utf8');
    const data = JSON.parse(raw);
    return (data.openaiApiKey && data.openaiApiKey.trim()) ? data.openaiApiKey.trim() : null;
  } catch (_) {
    return null;
  }
}

function getPrompt() {
  const s = load();
  return (s.extractionPrompt && s.extractionPrompt.trim()) ? s.extractionPrompt.trim() : DEFAULT_PROMPT;
}

function getStampPath() {
  const s = load();
  if (s.stampImagePath && typeof s.stampImagePath === 'string' && s.stampImagePath.trim()) {
    const p = path.isAbsolute(s.stampImagePath) ? s.stampImagePath : path.join(__dirname, '..', s.stampImagePath);
    if (fs.existsSync(p)) return p;
  }
  const defaultStamp = path.join(__dirname, 'assets', 'BRAND NEW.png');
  if (fs.existsSync(defaultStamp)) return defaultStamp;
  return null;
}

function getDataDirPublic() {
  ensureDataDir();
  return dataDir;
}

module.exports = {
  load,
  save,
  getOpenAIApiKey,
  getPrompt,
  getStampPath,
  getDataDir: getDataDirPublic,
  DEFAULT_PROMPT,
};
