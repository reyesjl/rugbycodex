# RugbyCodex: Immediate Actions & Quick Wins

**Created:** January 29, 2026  
**Priority:** HIGH  
**Estimated Time:** 2-4 hours  
**Cost:** $0 (all free optimizations)

---

## Overview

These are zero-cost optimizations you can implement TODAY to improve performance and prepare for scaling. These should be done BEFORE your current Linode Nanode becomes a bottleneck.

---

## 1. Nginx Configuration Optimization ⚡

**Impact:** 40-60% bandwidth reduction, 30-50% faster page loads  
**Time:** 15 minutes  
**Risk:** Low

### SSH into your Linode server:
```bash
ssh deploy@96.126.118.201
sudo nano /etc/nginx/nginx.conf
```

### Add these optimizations:

```nginx
# In the http block:
http {
    # Enable gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_comp_level 6;
    gzip_types
        text/plain
        text/css
        text/xml
        text/javascript
        application/javascript
        application/json
        application/xml+rss
        application/atom+xml
        application/rss+xml
        image/svg+xml
        font/woff
        font/woff2;

    # Connection optimization
    keepalive_timeout 65;
    keepalive_requests 100;

    # Buffer sizes
    client_body_buffer_size 16K;
    client_header_buffer_size 1k;
    large_client_header_buffers 4 8k;

    # Worker settings
    worker_processes auto;
    worker_connections 1024;
}
```

### In your site config (`/etc/nginx/sites-available/rugbycodex.com`):

```nginx
server {
    listen 443 ssl http2;  # Enable HTTP/2
    server_name rugbycodex.com www.rugbycodex.com;

    root /var/www/rugbycodex/current;
    index index.html;

    # Cache static assets aggressively
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot|webp|avif)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        access_log off;
    }

    # Index.html - no cache (SPA needs fresh HTML)
    location = /index.html {
        add_header Cache-Control "no-cache, no-store, must-revalidate";
        add_header Pragma "no-cache";
        add_header Expires "0";
    }

    # API calls should not be cached
    location /api {
        add_header Cache-Control "no-cache, no-store, must-revalidate";
    }

    # Fallback to index.html for SPA routing
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Health check endpoint
    location /health {
        access_log off;
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
}
```

### Test and reload:
```bash
sudo nginx -t
sudo systemctl reload nginx
```

---

## 2. Frontend Build Optimization 📦

**Impact:** Faster initial page load, better caching  
**Time:** 30 minutes  
**Risk:** Low

### Update `frontend/vite.config.ts`:

```typescript
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  
  build: {
    target: 'es2020',
    minify: 'terser',
    
    terserOptions: {
      compress: {
        drop_console: true,  // Remove console.logs in production
        drop_debugger: true,
      },
    },
    
    rollupOptions: {
      output: {
        // Manual chunking for better caching
        manualChunks: {
          'vendor-vue': ['vue', 'vue-router', 'pinia'],
          'vendor-supabase': ['@supabase/supabase-js'],
          'vendor-video': ['hls.js', 'shaka-player'],
          'vendor-aws': ['@aws-sdk/client-s3', '@aws-sdk/lib-storage'],
        },
        
        // Consistent chunk naming
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
    
    chunkSizeWarningLimit: 1000,
  },
  
  // Optimize dependencies
  optimizeDeps: {
    include: ['vue', 'vue-router', 'pinia'],
  },
});
```

### Test the build:
```bash
cd frontend
pnpm build

# Check bundle size
du -sh dist/*
```

### Expected result:
- Build size should be ~3-4MB (currently 3.2MB)
- Multiple chunk files for better caching
- No console.logs in production

---

## 3. Setup Uptime Monitoring 📊

**Impact:** Get alerted before users report issues  
**Time:** 10 minutes  
**Cost:** $0 (free tier)  
**Risk:** None

### Sign up for UptimeRobot:
1. Go to https://uptimerobot.com
2. Create free account
3. Add new monitor:
   - Monitor Type: HTTPS
   - Friendly Name: RugbyCodex Main Site
   - URL: https://rugbycodex.com
   - Monitoring Interval: 5 minutes

4. Add health check monitor:
   - URL: https://rugbycodex.com/health
   - Monitoring Interval: 5 minutes

5. Setup alerts:
   - Email notifications
   - Add Slack webhook (optional)

### Test alerts:
- Temporarily stop nginx: `sudo systemctl stop nginx`
- Wait 5 minutes for alert
- Restart: `sudo systemctl start nginx`

---

## 4. Automated Backups 💾

**Impact:** Disaster recovery  
**Time:** 15 minutes  
**Risk:** None

### Create backup script:
```bash
sudo nano /usr/local/bin/backup-rugbycodex.sh
```

### Script content:
```bash
#!/bin/bash
set -euo pipefail

BACKUP_DIR="/backup/rugbycodex"
RETENTION_DAYS=7

# Create backup directory if not exists
mkdir -p "$BACKUP_DIR"

# Backup current release
DATE=$(date +%Y%m%d-%H%M%S)
tar -czf "$BACKUP_DIR/rugbycodex-$DATE.tar.gz" \
    /var/www/rugbycodex/current

# Rotate old backups
find "$BACKUP_DIR" -name "rugbycodex-*.tar.gz" -mtime +$RETENTION_DAYS -delete

echo "Backup completed: rugbycodex-$DATE.tar.gz"
```

### Make executable:
```bash
sudo chmod +x /usr/local/bin/backup-rugbycodex.sh
```

### Add to crontab:
```bash
sudo crontab -e
```

### Add line:
```
0 2 * * * /usr/local/bin/backup-rugbycodex.sh >> /var/log/rugbycodex-backup.log 2>&1
```

### Test backup:
```bash
sudo /usr/local/bin/backup-rugbycodex.sh
ls -lh /backup/rugbycodex/
```

---

## 5. SSL Certificate Auto-Renewal ✅

**Impact:** Avoid SSL expiration downtime  
**Time:** 5 minutes  
**Risk:** None

### Check certbot is installed:
```bash
certbot --version
```

### Test renewal:
```bash
sudo certbot renew --dry-run
```

### Add to crontab if not present:
```bash
sudo crontab -l | grep -q certbot || (sudo crontab -l; echo "0 0 1 * * certbot renew --quiet --post-hook 'systemctl reload nginx'") | sudo crontab -
```

### Verify:
```bash
sudo crontab -l
```

---

## 6. Server Monitoring with Netdata (Optional) 📈

**Impact:** Real-time server metrics  
**Time:** 15 minutes  
**Cost:** $0  
**Risk:** Low

### Install Netdata:
```bash
bash <(curl -Ss https://my-netdata.io/kickstart.sh)
```

### Access dashboard:
- Open: http://96.126.118.201:19999
- Or setup nginx proxy for https://monitor.rugbycodex.com

### Key metrics to watch:
- CPU usage (should be <50% average)
- Memory usage (should be <80%)
- Network bandwidth
- Disk I/O
- Nginx requests/sec

---

## 7. Git Tag Current Stable Version 🏷️

**Impact:** Easy rollback if needed  
**Time:** 2 minutes  
**Risk:** None

### Tag current working version:
```bash
cd /home/reyesjl/projects/rugbycodex
git tag -a v1.0-stable -m "Stable version before scaling changes"
git push origin v1.0-stable
```

### To rollback in future:
```bash
git checkout v1.0-stable
```

---

## 8. Document Current Infrastructure 📝

**Impact:** Knowledge preservation  
**Time:** 10 minutes  
**Risk:** None

### Create server info file:
```bash
ssh deploy@96.126.118.201
sudo nano /var/www/rugbycodex/SERVER_INFO.txt
```

### Content:
```
RugbyCodex Production Server
============================

Server: Linode Nanode 1GB
IP: 96.126.118.201
Region: [Your region]
OS: Ubuntu [version]

Nginx Config: /etc/nginx/sites-available/rugbycodex.com
SSL Certs: /etc/letsencrypt/live/rugbycodex.com/
Deploy User: deploy
Web Root: /var/www/rugbycodex/current
Releases: /var/www/rugbycodex/releases/

Supabase:
- URL: https://ydsimnuvknhujynmitop.supabase.co
- Region: [Your region]

Wasabi:
- Region: [Your region]
- Bucket: [Your bucket]

AWS:
- Region: us-east-1
- ECS Cluster: rugbycodex-cluster
- SQS Queue: rugbycodex-transcode-jobs

Last Updated: 2026-01-29
```

---

## Testing Your Optimizations

### 1. Test Page Load Speed:
- Use https://pagespeed.web.dev/
- Test: rugbycodex.com
- Target: >90 score on mobile and desktop

### 2. Test Compression:
```bash
curl -H "Accept-Encoding: gzip" -I https://rugbycodex.com
```
- Should see: `Content-Encoding: gzip`

### 3. Test Caching:
```bash
curl -I https://rugbycodex.com/assets/index-[hash].js
```
- Should see: `Cache-Control: public, immutable`

### 4. Test HTTP/2:
```bash
curl -I --http2 https://rugbycodex.com
```
- Should see: `HTTP/2 200`

### 5. Load Test (Optional):
```bash
# Install Apache Bench
sudo apt install apache2-utils

# Test 1000 requests, 10 concurrent
ab -n 1000 -c 10 https://rugbycodex.com/
```

**Expected results:**
- Requests per second: >100
- Time per request: <100ms (mean)
- No failed requests

---

## Success Metrics

After implementing these optimizations, you should see:

✅ **Performance:**
- Page load time: <2 seconds (down from 3-4s)
- Bandwidth usage: -50% (gzip compression)
- Concurrent users supported: 2-3x increase

✅ **Reliability:**
- Uptime monitoring active
- Daily backups running
- SSL auto-renewal configured

✅ **Observability:**
- Server metrics visible (Netdata)
- Uptime alerts configured
- Build size optimized

---

## Next Steps (After Immediate Actions)

Once you've completed these immediate actions, refer to the main scaling plan for:

1. **Phase 1 (Week 2-4):** Add Cloudflare CDN
2. **Phase 2 (Month 2-3):** Upgrade Linode server
3. **Phase 3 (Month 3-6):** Scale to multiple servers

---

## Troubleshooting

### Nginx won't reload after config changes:
```bash
# Check syntax
sudo nginx -t

# View error log
sudo tail -f /var/log/nginx/error.log
```

### Build fails after vite.config.ts changes:
```bash
# Clear cache
rm -rf node_modules/.vite

# Rebuild
pnpm build
```

### Backup script not running:
```bash
# Check cron logs
sudo grep CRON /var/log/syslog

# Run manually
sudo /usr/local/bin/backup-rugbycodex.sh
```

---

## Support Resources

- **Nginx Docs:** https://nginx.org/en/docs/
- **Vite Docs:** https://vitejs.dev/guide/
- **Linode Guides:** https://www.linode.com/docs/
- **UptimeRobot:** https://uptimerobot.com/api/

---

**Estimated Total Time:** 2-4 hours  
**Estimated Impact:** 2-3x performance improvement  
**Cost:** $0

**Questions?** Review the main RUGBYCODEX_SCALING_PLAN.md for comprehensive guidance.
