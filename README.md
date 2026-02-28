# Furniture Overstock Sellout — Catalog

Furniture catalog website: browse products (no cart), filter by type/manufacturer/price, expand product details in-place. All communication and sales via Facebook Marketplace. Admin can manage products and use Excel import/export.

## Stack

- **Frontend**: React (Vite), TypeScript, React Router
- **Backend**: Express, SQLite (better-sqlite3), session-based admin auth
- **Excel**: SheetJS (xlsx) for import/export

## Setup

1. **Install dependencies**
   ```bash
   npm run install:all
   ```
   Or separately:
   ```bash
   npm install
   cd client && npm install
   ```

2. **Environment**
   - Copy `.env.example` to `.env` and set `ADMIN_PASSWORD` and `SESSION_SECRET` for production.
   - Defaults: `PORT=3080`, `ADMIN_PASSWORD=changeme`, SQLite at `./data/catalog.db`.

3. **Build frontend (for production)**
   ```bash
   npm run build
   ```
   This builds the client into `server/public`. The server serves these static files when `NODE_ENV=production`.

## Run

- **Development** (API + dev server with proxy):
  ```bash
  npm run dev
  ```
  Then open http://localhost:5173 (client); API runs on http://localhost:3080.

- **Production**
  ```bash
  NODE_ENV=production npm start
  ```
  Then open **http://\<VM-IP\>:3080** (e.g. http://192.168.4.64:3080). The server binds to `0.0.0.0`, so it is reachable from any machine on the network.

## VM deployment (e.g. Ubiquity at 192.168.4.64)

1. SSH into the VM and ensure Node.js (LTS) is installed.
2. Copy the project into the VM (or clone there).
3. Run `npm run install:all`, then `npm run build`, then `NODE_ENV=production npm start`.
4. Optionally use `pm2` or systemd to keep the process running.

## Features

- **Public**: Header (logo, tagline), dismissible disclaimer (no payments, FB Marketplace only), left sidebar filters (furniture type, manufacturer, price range), product grid, in-place product detail (gallery, specs, FB Marketplace button).
- **Admin** (`/admin`): Login with password, list/add/edit/delete products, bulk price and bulk status (available/pending/sold), Excel export and import.

Default admin password is `changeme`; set `ADMIN_PASSWORD` in `.env` for production.

## Troubleshooting: "Doesn't load" at http://\<VM-IP\>:3080

1. **Check the server is running** (on the VM):
   ```bash
   curl -s http://localhost:3080/api/health
   ```
   You should see `{"ok":true,"port":3080}`. If that fails, start the app:
   ```bash
   cd /home/vik/Documents/FurnitureCatalogWeb
   NODE_ENV=production npm start
   ```

2. **Build the frontend** (if you haven’t on this machine):
   ```bash
   npm run build
   ```
   Then restart with `NODE_ENV=production npm start`. Without this, `server/public/` is empty and the page won’t load.

3. **Open the health check from your browser**:  
   http://192.168.2.64:3080/api/health  
   - If this loads but `/` doesn’t, the app is reachable; the frontend is likely not built (see step 2).  
   - If this doesn’t load, see step 4.

4. **Firewall**: allow port 3080 on the VM, e.g.:
   ```bash
   sudo ufw allow 3080/tcp
   sudo ufw reload
   # or for firewalld: sudo firewall-cmd --add-port=3080/tcp --permanent && sudo firewall-cmd --reload
   ```

5. **Confirm the VM IP**: on the VM run `ip addr` or `hostname -I` and use that address (e.g. 192.168.2.64).
