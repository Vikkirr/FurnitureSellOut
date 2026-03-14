# Deploy Dev → Prod (simple, every time)

Two copies only: **Dev** (where you develop) and **Prod** (live site). When you're satisfied on Dev, push to GitHub, then pull on Prod.

---

## On Dev (when you're satisfied with your changes)

Run these in order in your project folder (e.g. `~/Documents/FurnitureCatalogWeb`):

```bash
git status
git add -A
git commit -m "Describe your changes"
git push origin main
```

- If **push** says **"Everything up-to-date"**, you didn't add/commit: run `git add -A` and `git commit -m "..."` again, then push.
- Use a short, clear message for `git commit -m "..."` (e.g. `"3-column admin sync layout"` or `"Copy SKU + seller profile URL"`).

---

## On Prod (to get the latest from Dev)

SSH to Prod, then in the app folder:

```bash
cd /srv/furnitureapp
git pull origin main
npm ci
npm run build
sudo systemctl restart furnitureapp
```

- **Hard-refresh** the browser (Ctrl+Shift+R / Cmd+Shift+R) if the UI looks old.

---

## Summary

| Where | What to run |
|-------|-------------|
| **Dev** | `git status` → `git add -A` → `git commit -m "..."` → `git push origin main` |
| **Prod** | `git pull origin main` → `npm ci` → `npm run build` → `sudo systemctl restart furnitureapp` |

Same steps every time.
