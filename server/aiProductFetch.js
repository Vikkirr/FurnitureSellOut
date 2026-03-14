const fs = require('fs');
const path = require('path');
const { getOpenAIApiKey, getPrompt, getStampPath } = require('./settings');

const projectRoot = path.join(__dirname, '..');
const imagesDir = path.join(projectRoot, '_images');

function ensureImagesDir() {
  if (!fs.existsSync(imagesDir)) fs.mkdirSync(imagesDir, { recursive: true });
}

const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  'Cache-Control': 'no-cache',
  'Pragma': 'no-cache',
  'Sec-Ch-Ua': '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
  'Sec-Ch-Ua-Mobile': '?0',
  'Sec-Ch-Ua-Platform': '"Windows"',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Upgrade-Insecure-Requests': '1',
};

async function fetchPage(url) {
  const res = await fetch(url, {
    headers: { ...BROWSER_HEADERS, Referer: new URL(url).origin + '/' },
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`Failed to fetch page: ${res.status}`);
  return res.text();
}

function extractTextAndImageUrls(html, baseUrl) {
  let cheerio;
  try {
    cheerio = require('cheerio');
  } catch (_) {
    const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 50000);
    return { text, imageUrls: [] };
  }
  const $ = cheerio.load(html);
  const text = $('body').text().replace(/\s+/g, ' ').trim().slice(0, 50000);
  const imageUrls = [];
  $('img').each((_, el) => {
    const src = $(el).attr('src');
    if (src && /\.(jpg|jpeg|png|webp|gif)/i.test(src) && !/pixel|tracking|1x1|spacer/i.test(src)) {
      try {
        const full = new URL(src, baseUrl).href;
        if (!imageUrls.includes(full)) imageUrls.push(full);
      } catch (_) {}
    }
  });
  return { text, imageUrls };
}

async function callOpenAI(pageText, imageUrlsFromPage, apiKey) {
  const { OpenAI } = await import('openai');
  const client = new OpenAI({ apiKey });
  const prompt = getPrompt();
  const userContent = `Page text (first 50k chars):\n${pageText}\n\nImage URLs found on page (use these or extract from content):\n${imageUrlsFromPage.slice(0, 30).join('\n')}\n\nRespond with a valid JSON object only (no other text).`;
  const completion = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: prompt + '\n\nYou must respond with valid JSON only.' },
      { role: 'user', content: userContent },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.2,
  });
  const raw = completion.choices[0]?.message?.content?.trim();
  if (!raw) throw new Error('Empty response from OpenAI');
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    const cleaned = raw.replace(/^```json\s*/i, '').replace(/\s*```\s*$/i, '').trim();
    parsed = JSON.parse(cleaned);
  }
  return normalizeExtracted(parsed);
}

/** Map common alternate keys from the model to our schema so the form gets populated. */
function normalizeExtracted(extracted) {
  if (!extracted || typeof extracted !== 'object') return extracted;
  const e = { ...extracted };
  if ((e.name == null || e.name === '') && (e.title != null && e.title !== '')) e.name = e.title;
  if ((e.name == null || e.name === '') && (e.product_name != null && e.product_name !== '')) e.name = e.product_name;
  if ((e.manufacturer == null || e.manufacturer === '') && (e.brand != null && e.brand !== '')) e.manufacturer = e.brand;
  if ((e.description == null || e.description === '') && (e.features != null && e.features !== '')) e.description = e.features;
  if ((e.furniture_type == null || e.furniture_type === '') && (e.style != null && e.style !== '')) e.furniture_type = e.style;
  if (e.image_urls == null && Array.isArray(e.images)) e.image_urls = e.images;
  return e;
}

async function downloadImage(url, pageOrigin) {
  const res = await fetch(url, {
    headers: {
      ...BROWSER_HEADERS,
      Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
      Referer: pageOrigin ? pageOrigin + '/' : undefined,
    },
    redirect: 'follow',
  });
  if (!res.ok) return null;
  const buf = Buffer.from(await res.arrayBuffer());
  return buf.length > 0 ? buf : null;
}

async function stampImage(inputBuffer, stampPath) {
  const sharp = require('sharp');
  let image = sharp(inputBuffer);
  const meta = await image.metadata();
  const width = meta.width || 800;
  const height = meta.height || 600;
  const stampSize = Math.min(width, height) * 0.25;
  const stampX = width - stampSize - Math.floor(width * 0.02);
  const stampY = height - stampSize - Math.floor(height * 0.02);
  if (stampPath && fs.existsSync(stampPath)) {
    const stampBuf = await sharp(stampPath)
      .resize(Math.round(stampSize))
      .toBuffer();
    const composed = await image
      .composite([{ input: stampBuf, left: Math.max(0, stampX), top: Math.max(0, stampY) }])
      .jpeg({ quality: 90 })
      .toBuffer();
    return composed;
  }
  const textSvg = Buffer.from(
    `<svg width="${Math.round(stampSize)}" height="${Math.round(stampSize * 0.4)}">
      <rect width="100%" height="100%" fill="#c99000" rx="4"/>
      <text x="50%" y="55%" dominant-baseline="middle" text-anchor="middle" fill="#1a1a1a" font-size="${Math.round(stampSize * 0.2)}" font-weight="bold" font-family="sans-serif">BRAND NEW</text>
    </svg>`
  );
  const composed = await image
    .composite([{ input: textSvg, left: Math.max(0, stampX), top: Math.max(0, stampY) }])
    .jpeg({ quality: 90 })
    .toBuffer();
  return composed;
}

function uniqueFilename() {
  return `ai-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

async function processImages(extracted, stampPath, pageOrigin) {
  ensureImagesDir();
  const urls = Array.isArray(extracted.image_urls) ? extracted.image_urls : [];
  const stamped = [];
  for (let i = 0; i < Math.min(urls.length, 20); i++) {
    const url = urls[i];
    if (typeof url !== 'string' || !url.startsWith('http')) continue;
    try {
      const buf = await downloadImage(url, pageOrigin);
      if (!buf) continue;
      const stampedBuf = await stampImage(buf, stampPath);
      const base = `${uniqueFilename()}-${i}.jpg`;
      const filePath = path.join(imagesDir, base);
      fs.writeFileSync(filePath, stampedBuf);
      stamped.push(`/_images/${base}`);
    } catch (e) {
      console.warn('Image process skip:', url, e.message);
    }
  }
  return stamped;
}

async function fetchProductFromUrl(url) {
  if (!url || typeof url !== 'string' || !url.startsWith('http')) {
    throw new Error('Invalid URL');
  }
  const apiKey = getOpenAIApiKey();
  if (!apiKey) throw new Error('OpenAI API key not configured. Set it in Admin → Settings.');
  const pageHtml = await fetchPage(url);
  const baseUrl = url.split('?')[0].replace(/\/[^/]*$/, '/');
  const { text, imageUrls } = extractTextAndImageUrls(pageHtml, baseUrl);
  const extracted = await callOpenAI(text, imageUrls, apiKey);
  const imageUrlsToUse = (Array.isArray(extracted.image_urls) && extracted.image_urls.length > 0)
    ? extracted.image_urls
    : imageUrls;
  const pageOrigin = new URL(url).origin;
  if (imageUrlsToUse.length > 0) {
    extracted.image_urls = await processImages({ ...extracted, image_urls: imageUrlsToUse }, getStampPath(), pageOrigin);
  } else {
    extracted.image_urls = [];
  }
  return {
    name: extracted.name || '',
    manufacturer: extracted.manufacturer || '',
    sku: extracted.sku || null,
    description: extracted.description || null,
    dimensions: extracted.dimensions || null,
    weight: extracted.weight || null,
    color: extracted.color || null,
    department: extracted.department || null,
    furniture_type: extracted.furniture_type || 'Other',
    price: typeof extracted.price === 'number' ? extracted.price : (parseFloat(extracted.price) || 0),
    cost: extracted.cost != null ? (typeof extracted.cost === 'number' ? extracted.cost : parseFloat(extracted.cost)) : null,
    retail_price: extracted.retail_price != null ? (typeof extracted.retail_price === 'number' ? extracted.retail_price : parseFloat(extracted.retail_price)) : null,
    notes: extracted.notes || null,
    guidelines: extracted.guidelines || null,
    fb_marketplace_url: url,
    pick_url: url,
    image_urls: extracted.image_urls || [],
    status: 'available',
    quantity: 1,
  };
}

module.exports = { fetchProductFromUrl };
