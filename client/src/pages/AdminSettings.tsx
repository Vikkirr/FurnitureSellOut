import { useState, useEffect } from 'react';
import { adminGetSettings, adminPutSettings, type AdminSettings } from '../api';

export default function AdminSettings() {
  const [settings, setSettings] = useState<AdminSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [form, setForm] = useState({
    openaiApiKey: '',
    extractionPrompt: '',
    stampImagePath: '',
    sellerProfileUrl: '',
  });

  const [debugInfo, setDebugInfo] = useState<{ dataDir: string | null; settingsPath: string | null; cwd: string } | null>(null);

  useEffect(() => {
    adminGetSettings(true)
      .then((data) => {
        setSettings(data);
        setForm({
          openaiApiKey: '',
          extractionPrompt: data.extractionPrompt ?? '',
          stampImagePath: data.stampImagePath ?? '',
          sellerProfileUrl: data.sellerProfileUrl ?? '',
        });
        if (data._debug) setDebugInfo(data._debug);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    try {
      const payload: Record<string, string> = {
        extractionPrompt: form.extractionPrompt ?? '',
        stampImagePath: form.stampImagePath ?? '',
        sellerProfileUrl: form.sellerProfileUrl ?? '',
      };
      if (form.openaiApiKey != null && form.openaiApiKey !== '') payload.openaiApiKey = form.openaiApiKey;
      await adminPutSettings(payload);
      setMessage('Settings saved.');
      setForm((prev) => ({ ...prev, openaiApiKey: '' }));
      const updated = await adminGetSettings();
      setSettings(updated);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save';
      setMessage(msg);
      console.error('Settings save error:', err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="admin-page"><p>Loading settings…</p></div>;

  return (
    <div className="admin-page">
      <header className="admin-page-header">
        <h1>Settings</h1>
      </header>
      <p className="admin-page-lead">
        Configure the OpenAI API key and prompts used when fetching product details from a URL (Fetch with AI).
      </p>
      <details className="admin-prompt-details">
        <summary>What is sent to the AI</summary>
        <p className="admin-field-hint">
          <strong>System message:</strong> The &quot;Product extraction prompt&quot; below (or the built-in default if empty).
        </p>
        <p className="admin-field-hint">
          <strong>User message:</strong> A fixed template plus the scraped page text and image URLs:
          <code className="admin-prompt-code">Page text (first 50k chars): … [page content] … Image URLs found on page: … [list of URLs]</code>
          No other text is added; you control the system prompt only.
        </p>
      </details>
      {message && (
        <p className={`admin-message ${message.startsWith('Settings saved') ? '' : 'admin-load-error'}`} role="alert">
          {message}
        </p>
      )}
      <form className="admin-form admin-settings-form" onSubmit={handleSubmit}>
        <section className="admin-section">
          <h2>OpenAI API</h2>
          <label>
            API key
            <input
              type="password"
              autoComplete="off"
              placeholder={settings?.openaiApiKeyMasked ? `${settings.openaiApiKeyMasked} (leave blank to keep)` : 'sk-...'}
              value={form.openaiApiKey}
              onChange={(e) => setForm((prev) => ({ ...prev, openaiApiKey: e.target.value }))}
              className="admin-input-wide"
            />
          </label>
          <p className="admin-field-hint">Stored in data/settings.json. You can also set OPENAI_API_KEY in .env.</p>
          {debugInfo?.settingsPath && (
            <p className="admin-field-hint admin-debug-path">Server is using: <code>{debugInfo.settingsPath}</code> (cwd: {debugInfo.cwd})</p>
          )}
        </section>
        <section className="admin-section">
          <h2>Product extraction prompt</h2>
          <label>
            <textarea
              rows={12}
              placeholder="System prompt sent to the model to extract product fields from page content…"
              value={form.extractionPrompt}
              onChange={(e) => setForm((prev) => ({ ...prev, extractionPrompt: e.target.value }))}
              className="admin-textarea"
            />
          </label>
          <p className="admin-field-hint">The model will receive this prompt plus the page text and image URLs. It should return JSON with keys: name, manufacturer, sku, description, dimensions, weight, color, department, furniture_type, price, cost, retail_price, notes, guidelines, image_urls.</p>
        </section>
        <section className="admin-section">
          <h2>Stamp image</h2>
          <label>
            Path to BRAND NEW.png (relative to project root or absolute)
            <input
              type="text"
              placeholder="e.g. server/assets/BRAND NEW.png or data/stamp.png"
              value={form.stampImagePath}
              onChange={(e) => setForm((prev) => ({ ...prev, stampImagePath: e.target.value }))}
              className="admin-input-wide"
            />
          </label>
          <p className="admin-field-hint">If empty or file missing, a text “BRAND NEW” badge is used when stamping product images.</p>
        </section>
        <section className="admin-section">
          <h2>Seller&apos;s profile URL</h2>
          <label>
            <input
              type="url"
              placeholder="https://www.facebook.com/marketplace/profile/..."
              value={form.sellerProfileUrl}
              onChange={(e) => setForm((prev) => ({ ...prev, sellerProfileUrl: e.target.value }))}
              className="admin-input-wide"
            />
          </label>
          <p className="admin-field-hint">Your Facebook Marketplace seller profile URL. Shown in the catalog &quot;Copy item and view on Facebook Marketplace&quot; flow so buyers know where to paste the SKU.</p>
        </section>
        <div className="admin-form-actions">
          <button type="submit" disabled={saving} className="admin-btn-primary">
            {saving ? 'Saving…' : 'Save settings'}
          </button>
        </div>
      </form>
    </div>
  );
}
