# SocialSync Backend Deployment Guide 🚀

Yeh guide aapko **SocialSync Express + TypeScript Backend** ko **Render** ya **Railway** par deploy karne ke complete steps batati hai.

---

## Method 1: Render Par Deploy Karna (Recommended & Free)

### Option A: Automatic Blueprint Deployment (`render.yaml`)
1. Apne code ko GitHub repository par push karein:
   ```bash
   git add .
   git commit -m "Add production backend config"
   git push origin main
   ```
2. [Render Dashboard](https://dashboard.render.com/) me login karein.
3. **New +** button par click karke **Blueprints** select karein.
4. Apni GitHub repository connect karein.
5. Render automatic `render.yaml` file ko detect kar lega aur ek **Web Service** aur ek **PostgreSQL Database** setup kar dega.
6. Deployment start ho jaayegi!

---

### Option B: Manual Web Service Setup (Render Dashboard)
1. Render Dashboard me **New +** -> **Web Service** par click karein.
2. Root directory me `backend` set karein (agar monorepo hai).
3. **Build Command**:
   ```bash
   npm install && npm run build
   ```
4. **Start Command**:
   ```bash
   npx prisma db push && npm run start
   ```
5. **Environment Variables** add karein:
   - `PORT`: `5000`
   - `NODE_ENV`: `production`
   - `JWT_SECRET`: Random 32+ character key
   - `ENCRYPTION_KEY`: 64-character hex key (Generate with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`)
   - `DATABASE_URL`: Apne Render PostgreSQL database ka internal connection string link.
   - `FRONTEND_URL`: Apne deployed frontend ka URL (e.g., `https://socialsync-frontend.onrender.com`)
   - `MOCK_MODE`: `true` (testing ke liye) ya `false` (real OAuth ke liye)
   - `USE_REDIS`: `false`

---

## Method 2: Railway Par Deploy Karna

1. [Railway.app](https://railway.app/) par login karein aur Naya Project create karein.
2. **Deploy from GitHub repo** select karein aur repository Choose karein.
3. Add a **PostgreSQL Database** service inside Railway.
4. Backend Service ke **Variables** tab me:
   - `DATABASE_URL` -> `${{Postgres.DATABASE_URL}}`
   - `PORT` -> `5000`
   - `NODE_ENV` -> `production`
   - `JWT_SECRET` -> (Aapka secret key)
   - `ENCRYPTION_KEY` -> (32-byte hex string)
   - `FRONTEND_URL` -> (Frontend domain)
5. **Build Command**: `npm run build`
6. **Start Command**: `npx prisma db push && npm run start`

---

## Health Check Verification

Deployment complete hone ke baad, browser me yeh test karein:
```
https://<your-backend-domain>.onrender.com/api/health
```
Response:
```json
{
  "status": "ok",
  "timestamp": "2026-08-25T16:35:00.000Z",
  "environment": "production",
  "mockMode": "true"
}
```
