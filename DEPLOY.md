# Deployment Guide — OOH Line (oohline.ch)

## Prerequisites

- Hostinger Business hosting plan (Node.js 20, MariaDB 10.6)
- SSH access to the server
- A domain pointed at the server (DNS A record for `oohline.ch` and `www.oohline.ch`)
- Email account on Hostinger SMTP (or Postmark API key)

---

## 1. Initial server setup

```bash
# Log in via SSH
ssh u1234567@oohline.ch

# Check Node.js version (must be 20+)
node --version

# Install pnpm (optional but faster than npm)
npm install -g pnpm
```

---

## 2. Clone the repository

```bash
cd ~
git clone https://github.com/your-org/oohline.git
cd oohline
```

---

## 3. Configure environment variables

```bash
cd backend
cp .env.example .env
nano .env
```

Fill in every value. Critical ones:

| Variable | Notes |
|---|---|
| `DATABASE_URL` | `mysql://USER:PASS@localhost:3306/oohline_db` |
| `SESSION_SECRET` | Run `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `COOKIE_DOMAIN` | `oohline.ch` |
| `COOKIE_SECURE` | `true` |
| `SMTP_HOST` | `smtp.hostinger.com` |
| `SMTP_PORT` | `465` |
| `SMTP_USER` | `devis@oohline.ch` |
| `SMTP_PASS` | SMTP password from Hostinger panel |
| `CONTACT_EMAIL` | `devis@oohline.ch` |
| `ADMIN_USERNAME` | First admin username |
| `ADMIN_PASSWORD` | Strong password — change immediately after first login |
| `APP_URL` | `https://oohline.ch` |

---

## 4. Create the MariaDB database

In Hostinger hPanel → Databases → MySQL Databases:

1. Create database: `oohline_db`
2. Create user: `oohline_user` with a strong password
3. Grant all privileges on `oohline_db` to `oohline_user`

Then update `DATABASE_URL` in `.env`:
```
DATABASE_URL="mysql://oohline_user:YOURPASS@localhost:3306/oohline_db"
```

---

## 5. Install dependencies and set up the database

```bash
cd ~/oohline/backend

# Install dependencies
npm install

# Generate Prisma client
npx prisma generate

# Run migrations (creates all tables)
npx prisma migrate deploy

# Seed the database (creates admin user, default formats, etc.)
node prisma/seed.js
```

---

## 6. Test the server locally

```bash
NODE_ENV=production node src/server.js
```

Visit `http://your-server-ip:3000` — you should see the catalogue.  
Press `Ctrl+C` when done.

---

## 7. Set up PM2 for process management

```bash
npm install -g pm2

# Start the app
pm2 start ~/oohline/backend/src/server.js --name oohline --node-args="--max-old-space-size=256"

# Save the process list so it restarts on reboot
pm2 save
pm2 startup
# Follow the printed command (e.g. sudo env PATH=... pm2 startup systemd -u user --hp /home/user)
```

Useful PM2 commands:
```bash
pm2 status          # Show running processes
pm2 logs oohline    # Tail logs
pm2 restart oohline # Restart after code update
pm2 stop oohline    # Stop
```

---

## 8. Configure Nginx

Hostinger Business provides Nginx. Copy the config:

```bash
sudo cp ~/oohline/nginx.conf /etc/nginx/sites-available/oohline.ch
sudo ln -s /etc/nginx/sites-available/oohline.ch /etc/nginx/sites-enabled/
```

Add the login rate-limit zone to `/etc/nginx/nginx.conf` inside the `http {}` block:
```nginx
http {
    # ... existing config ...
    limit_req_zone $binary_remote_addr zone=login:10m rate=10r/m;
}
```

Test and reload:
```bash
sudo nginx -t
sudo systemctl reload nginx
```

---

## 9. SSL — Let's Encrypt

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d oohline.ch -d www.oohline.ch
```

Certbot will:
- Obtain a certificate
- Automatically update the Nginx config with SSL paths
- Add a cron for auto-renewal

Test renewal:
```bash
sudo certbot renew --dry-run
```

---

## 10. First login

1. Visit `https://oohline.ch`
2. Click the lock icon (top-right) to open the admin login
3. Log in with the credentials from your `.env` (`ADMIN_USERNAME` / `ADMIN_PASSWORD`)
4. Go to **Admin → Compte** and immediately change both username and password
5. Optionally enable 2FA from the same screen

---

## 11. Updates

```bash
cd ~/oohline
git pull origin main

cd backend
npm install                # Only if package.json changed
npx prisma migrate deploy  # Only if schema.prisma changed
pm2 restart oohline
```

---

## Troubleshooting

### Server won't start
```bash
pm2 logs oohline --lines 50
```
Common causes: wrong `DATABASE_URL`, missing `.env`, port already in use.

### Can't connect to MariaDB
```bash
mysql -u oohline_user -p oohline_db
```
If this fails, check credentials in `.env` and Hostinger panel.

### Emails not sending
Check SMTP credentials. Test manually:
```bash
node -e "
const nm = require('nodemailer');
const t = nm.createTransport({ host:'smtp.hostinger.com', port:465, secure:true, auth:{user:'devis@oohline.ch',pass:'YOURPASS'} });
t.sendMail({from:'devis@oohline.ch',to:'devis@oohline.ch',subject:'test',text:'ok'}).then(console.log).catch(console.error);
"
```

### Reset admin password
```bash
cd ~/oohline/backend
node -e "
const { PrismaClient } = require('@prisma/client');
const argon2 = require('argon2');
const prisma = new PrismaClient();
argon2.hash('NewPassword123!').then(h => prisma.adminUser.updateMany({ data: { password_hash: h, failed_logins: 0, locked_until: null } })).then(console.log).finally(() => prisma.\$disconnect());
"
```

---

## Environment variables reference

See `backend/.env.example` for the full list with descriptions.
