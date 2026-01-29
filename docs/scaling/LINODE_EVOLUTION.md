# Linode Infrastructure: Evolution Roadmap

**Server:** rugbycodex.com (96.126.118.201)  
**Current Plan:** Nanode 1GB ($5/month)  
**Status:** Production, serving static Vue 3 SPA  

---

## Current Architecture

```
Internet
    ↓
Linode Nanode (96.126.118.201)
    ├── Nginx (web server)
    ├── SSL/TLS (Let's Encrypt)
    └── Static Files (/var/www/rugbycodex/current)
         ├── index.html (3.2MB build)
         ├── assets/*.js (chunked bundles)
         ├── assets/*.css
         └── assets/*.svg, *.png
```

**Current Capacity:**
- ~50-100 concurrent users (with CDN: 200-500)
- 1TB bandwidth/month
- Single point of failure
- Manual deployments

---

## Evolution Path

### Stage 1: Current (Nanode 1GB)
**When:** Now - 100 users  
**Cost:** $5/month

**Specs:**
- 1 vCPU (shared)
- 1GB RAM
- 25GB SSD
- 1TB transfer

**Optimizations:**
- ✅ Nginx gzip compression
- ✅ HTTP/2 enabled
- ✅ Aggressive asset caching
- ✅ Automated backups

**When to upgrade:** CPU >80% sustained OR >100 concurrent users

---

### Stage 2: Linode 2GB (Recommended at 100 users)
**When:** 100-500 users  
**Cost:** $12/month (+$7)

**Specs:**
- 1 vCPU (dedicated, not shared)
- 2GB RAM
- 50GB SSD
- 2TB transfer

**Why upgrade:**
- Dedicated CPU (better performance)
- More memory for nginx caching
- Better for SSL/TLS termination
- Handles traffic spikes better

**Setup:**
```bash
# 1. Resize in Linode dashboard
# 2. Reboot (automatic)
# 3. Verify: 
free -h  # Should show 2GB
nproc    # Should show 1 dedicated core
```

**Expected capacity:** 500-1,000 concurrent users (with CDN)

---

### Stage 3: Add Cloudflare CDN (Recommended at 100-200 users)
**When:** 100-1,000 users  
**Cost:** $0 (free tier)

**Architecture:**
```
Internet
    ↓
Cloudflare CDN (250+ global edge locations)
    ├── Cache static assets (90%+ hit rate)
    ├── DDoS protection
    ├── SSL/TLS termination
    └── Smart routing
    ↓
Linode Server (origin)
    └── Only serves cache misses (~10% of traffic)
```

**Setup:**
1. Create Cloudflare account
2. Add domain: rugbycodex.com
3. Update nameservers at registrar
4. Configure page rules:
   - Cache everything except `/api/*`
   - Edge cache TTL: 1 hour
   - Browser cache TTL: 4 hours

**Impact:**
- 70-90% reduction in server load
- 50-70% faster global access
- Can handle 10,000+ concurrent users (CDN layer)
- DDoS protection included

**When to move to Stage 4:** >1,000 sustained concurrent users OR need 99.9% uptime

---

### Stage 4: Horizontal Scaling (3-Node Cluster)
**When:** 1,000-5,000 users  
**Cost:** $82/month

**Architecture:**
```
Internet
    ↓
Cloudflare CDN
    ↓
Linode NodeBalancer ($10/month)
    ├─→ Frontend Server 1 (Linode 4GB - $24/mo)
    ├─→ Frontend Server 2 (Linode 4GB - $24/mo)
    └─→ Frontend Server 3 (Linode 4GB - $24/mo)
```

**Setup Process:**

#### Step 1: Create Identical Servers
```bash
# On each server (clone from template)
ssh deploy@server1
cd /var/www/rugbycodex
# Same nginx config, same deploy script
```

#### Step 2: Setup NodeBalancer
1. Linode Dashboard → NodeBalancers → Create
2. Add backends:
   - Server 1: 96.126.118.201:443
   - Server 2: [new IP]:443
   - Server 3: [new IP]:443
3. Health check: GET /health
4. Session affinity: None (stateless app)

#### Step 3: Update DNS
```
A record: rugbycodex.com → [NodeBalancer IP]
```

#### Step 4: Multi-Server Deployment
```bash
# deploy-multi.sh
SERVERS=(
  "deploy@server1"
  "deploy@server2"
  "deploy@server3"
)

pnpm build

for server in "${SERVERS[@]}"; do
  rsync -avz dist/ "$server:/var/www/rugbycodex/" &
done
wait

echo "Deployed to all servers"
```

**Benefits:**
- Zero single point of failure
- Auto-failover (health checks)
- Rolling deployments possible
- 99.9% uptime achievable

**When to move to Stage 5:** Cost >$100/month OR need auto-scaling

---

### Stage 5: Migrate to Vercel (Recommended at 3,000+ users)
**When:** 3,000-10,000 users  
**Cost:** $20-200/month (usage-based)

**Why migrate:**
- Zero infrastructure management
- Global edge network (300+ locations)
- Auto-scaling (unlimited)
- Git-based deployments
- Preview deployments for PRs
- Better DX (developer experience)

**Architecture:**
```
Internet
    ↓
Vercel Edge Network (Global)
    ├── Automatic caching
    ├── DDoS protection
    ├── SSL/TLS included
    └── Smart routing
    ↓
Supabase Edge Functions (API)
```

**Migration Process:**

#### Step 1: Create Vercel Account
```bash
npm i -g vercel
vercel login
```

#### Step 2: Configure Project
```bash
cd frontend

# Create vercel.json
cat > vercel.json << 'EOF'
{
  "buildCommand": "pnpm build",
  "outputDirectory": "dist",
  "framework": "vite",
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ],
  "headers": [
    {
      "source": "/assets/(.*)",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=31536000, immutable"
        }
      ]
    }
  ]
}
EOF
```

#### Step 3: Deploy to Vercel
```bash
vercel --prod
```

#### Step 4: Update DNS (Gradual Migration)
```
# Week 1: Test deployment
test.rugbycodex.com → Vercel

# Week 2: Split traffic (Cloudflare load balancing)
rugbycodex.com → 50% Vercel, 50% Linode

# Week 3: Full migration
rugbycodex.com → 100% Vercel

# Week 4: Decommission Linode servers
```

#### Step 5: CI/CD Integration
```yaml
# .github/workflows/deploy.yml
name: Deploy to Vercel
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm run build
      - uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
```

**Cost Breakdown (Vercel):**
- Free tier: 100GB bandwidth
- Pro tier ($20/mo): 1TB bandwidth
- Additional: $0.15/GB over quota

**Expected capacity:** 10,000+ concurrent users, unlimited scaling

---

## Decision Matrix

### When Should You Move to Next Stage?

| Trigger | Current Stage | Next Stage | Action |
|---------|--------------|------------|--------|
| CPU >80% sustained | 1 (Nanode) | 2 (2GB) | Upgrade in dashboard |
| 100+ concurrent users | 1 (Nanode) | 2 (2GB) + CDN | Add Cloudflare |
| >4h/month maintenance | 2 (2GB) | 4 (3-node) | Add load balancer |
| Need 99.9% uptime | Any | 4 (3-node) | Add redundancy |
| >$100/month infra cost | 4 (3-node) | 5 (Vercel) | Migrate to serverless |
| >5,000 users | 4 (3-node) | 5 (Vercel) | Scale globally |

---

## Cost Comparison

### 1,000 Users
| Option | Cost/Month | Pros | Cons |
|--------|-----------|------|------|
| Linode 2GB + CF | $12 | Cheap, simple | Manual scaling |
| 3x Linode 4GB | $82 | HA, no SPOF | Manual management |
| Vercel Pro | $20 | Auto-scale, global | Vendor lock-in |

**Recommended:** Linode 2GB + Cloudflare ($12/month)

### 5,000 Users
| Option | Cost/Month | Pros | Cons |
|--------|-----------|------|------|
| 3x Linode 4GB | $82 | Full control | Manual scaling |
| Vercel Pro | $20-50 | Auto-scale | Usage costs |

**Recommended:** Vercel Pro ($20-50/month)

### 10,000+ Users
| Option | Cost/Month | Pros | Cons |
|--------|-----------|------|------|
| 5+ Linode | $150+ | Full control | Complex management |
| Kubernetes (LKE) | $100-200 | Auto-scale | Complexity |
| Vercel | $50-200 | Zero management | Higher cost at scale |

**Recommended:** Vercel ($50-200/month) - Best ROI for team productivity

---

## Monitoring Thresholds

### Stage 1 (Nanode 1GB)
**Alert when:**
- CPU >80% for 5 minutes
- Memory >90%
- Disk >80%
- Response time >2 seconds
- Error rate >5%

**Action:** Upgrade to Stage 2

### Stage 2 (Linode 2GB)
**Alert when:**
- CPU >70% sustained
- Memory >85%
- Concurrent connections >500
- Bandwidth >1TB/month

**Action:** Add Cloudflare CDN (Stage 3)

### Stage 3 (With CDN)
**Alert when:**
- Origin requests >10% (low cache hit)
- Server CPU >60% sustained
- Need 99.9% uptime SLA

**Action:** Move to Stage 4 (3-node cluster)

### Stage 4 (3-Node Cluster)
**Alert when:**
- All nodes >60% CPU
- Manual scaling becoming frequent
- DevOps time >4 hours/week

**Action:** Migrate to Vercel (Stage 5)

---

## Backup & Rollback Strategies

### Current Setup (Stages 1-4)
**Backup:**
```bash
# Daily at 2 AM
0 2 * * * /usr/local/bin/backup-rugbycodex.sh
```

**Rollback:**
```bash
# Rollback to previous release
cd /var/www/rugbycodex
ln -sfn releases/release_20260128120000 current
sudo systemctl reload nginx
```

### Vercel (Stage 5)
**Backup:** Automatic via Git history  
**Rollback:** One-click in Vercel dashboard
```bash
# Or via CLI
vercel rollback [deployment-url]
```

---

## Testing Each Stage

### Stage 1-2 Testing:
```bash
# Load test
ab -n 10000 -c 100 https://rugbycodex.com/

# Expected:
# - Requests/sec: >100
# - Failed: 0%
```

### Stage 3 Testing (CDN):
```bash
# Check cache hit rate
curl -I https://rugbycodex.com/assets/index.js
# Should see: cf-cache-status: HIT

# Test from different regions
# Use: webpagetest.org
```

### Stage 4 Testing (Multi-Node):
```bash
# Test failover
# Stop nginx on one server
ssh server1 'sudo systemctl stop nginx'

# Site should still be up (NodeBalancer routes around it)
curl https://rugbycodex.com  # Should return 200

# Restart
ssh server1 'sudo systemctl start nginx'
```

### Stage 5 Testing (Vercel):
```bash
# Test preview deployment
vercel
# Creates preview URL

# Test production
vercel --prod
```

---

## Estimated Timeline

### Conservative Path (Low Growth)
- **Month 0-6:** Stage 1 (Nanode)
- **Month 6-12:** Stage 2 (2GB)
- **Month 12-18:** Stage 3 (+ CDN)
- **Month 18-24:** Stage 4 (3-node)
- **Month 24+:** Stage 5 (Vercel)

### Aggressive Path (Rapid Growth)
- **Month 0-2:** Stage 1 (Nanode)
- **Month 2-4:** Stage 2 (2GB) + Stage 3 (CDN)
- **Month 4-8:** Stage 4 (3-node)
- **Month 8+:** Stage 5 (Vercel)

### Startup Path (Optimize for Speed)
- **Month 0-3:** Stage 1 optimized
- **Month 3-6:** Jump directly to Vercel (Stage 5)
- **Rationale:** Focus on product, not infrastructure

---

## Summary & Recommendation

### Current State: GOOD ✅
- Nanode 1GB is sufficient for 0-100 users
- Need immediate optimizations (see IMMEDIATE_ACTIONS.md)
- No urgent changes required

### 3-Month Plan: ADD CDN 🎯
- Keep Nanode 1GB
- Add Cloudflare (free)
- Implement all nginx optimizations
- **Cost:** $5/month (no change)
- **Capacity:** 500-1,000 users

### 6-Month Plan: UPGRADE SERVER 📈
- Upgrade to Linode 2GB
- Keep Cloudflare
- **Cost:** $12/month (+$7)
- **Capacity:** 1,000-2,000 users

### 12-Month Plan: SCALE HORIZONTALLY 🚀
- 3-node cluster OR migrate to Vercel
- **Recommended:** Migrate to Vercel
- **Cost:** $20-50/month
- **Capacity:** 5,000-10,000 users

---

## Questions to Consider

1. **How fast are you growing?**
   - Slow (<100 users/year): Stay on Linode longer
   - Fast (>500 users/year): Move to Vercel sooner

2. **What's your team size?**
   - Solo/2 people: Vercel (less ops work)
   - 5+ people: Can manage Linode cluster

3. **What's your budget?**
   - <$50/month: Optimize current setup
   - $50-200/month: Vercel when you hit 1,000 users
   - >$200/month: Multi-region, enterprise-grade

4. **What's your priority?**
   - Cost optimization: Stay on Linode as long as possible
   - Time optimization: Move to Vercel early
   - Learning: Build and manage your own infrastructure

---

## Final Recommendation

**For RugbyCodex specifically:**

1. **Now - Month 3:** Optimize Nanode ($5/month)
   - Implement all immediate actions
   - Add uptime monitoring
   - Setup Cloudflare

2. **Month 3-6:** Upgrade to 2GB ($12/month)
   - When you hit 100+ concurrent users
   - Keep Cloudflare

3. **Month 6-12:** Evaluate Vercel migration
   - If growing fast (>500 users)
   - If DevOps time becoming a burden
   - Cost will be $20-50/month

4. **Month 12+:** Full migration to Vercel
   - Decommission Linode entirely
   - Focus 100% on product development
   - Let Vercel handle infrastructure

**Total infrastructure evolution cost:**
- Year 1: $60-150 (mostly $5/month)
- Year 2: $240-600 (Vercel or multi-node)
- Year 3+: $600-2,400 (scaling with revenue)

---

**Last Updated:** January 29, 2026  
**Next Review:** April 2026
