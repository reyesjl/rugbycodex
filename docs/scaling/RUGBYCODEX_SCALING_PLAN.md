# RugbyCodex Comprehensive Scaling Plan
**Created:** January 29, 2026  
**Status:** Strategic Roadmap  
**Domain:** rugbycodex.com (Currently on Linode Nanode 1GB)

---

## Executive Summary

RugbyCodex is a multi-tenant rugby intelligence platform with serverless architecture for AI processing and video transcoding. Current infrastructure combines:
- **Frontend:** Linode Nanode (1GB RAM, 1 vCPU @ 96.126.118.201)
- **Backend:** Supabase (Serverless Edge Functions, PostgreSQL)
- **Storage:** Wasabi S3 (video storage)
- **Compute:** AWS ECS with GPU workers (scales 0-3 instances)
- **Logging:** Axiom (30-day retention, 500GB/month free tier)

**Critical Bottleneck:** The Linode Nanode server is the single point of failure and will become a scaling constraint as traffic grows.

This plan provides a phased approach to scale from current state (early-stage, low traffic) through enterprise-level operations (10,000+ concurrent users).

---

## Table of Contents

1. [Current State Analysis](#current-state-analysis)
2. [Scaling Phases Overview](#scaling-phases-overview)
3. [Phase 1: Immediate Optimizations (0-100 users)](#phase-1-immediate-optimizations-0-100-users)
4. [Phase 2: CDN & Caching (100-1,000 users)](#phase-2-cdn--caching-100-1000-users)
5. [Phase 3: Distributed Frontend (1,000-5,000 users)](#phase-3-distributed-frontend-1000-5000-users)
6. [Phase 4: Database Scaling (5,000-10,000 users)](#phase-4-database-scaling-5000-10000-users)
7. [Phase 5: Multi-Region & Global (10,000+ users)](#phase-5-multi-region--global-10000-users)
8. [Linode Server Evolution](#linode-server-evolution)
9. [AWS Infrastructure Scaling](#aws-infrastructure-scaling)
10. [Database Scaling Strategy](#database-scaling-strategy)
11. [Cost Projections](#cost-projections)
12. [Monitoring & Alerting](#monitoring--alerting)
13. [Implementation Timeline](#implementation-timeline)
14. [Risk Mitigation](#risk-mitigation)

---

## Current State Analysis

### Frontend Infrastructure (Linode)
**Server:** Nanode 1GB  
**Location:** 96.126.118.201  
**Specs:**
- 1 vCPU (shared)
- 1GB RAM
- 25GB SSD
- 1TB transfer/month
- Cost: ~$5/month

**Deployment:**
- Static Vue 3 SPA (3.2MB build)
- Deployed to `/var/www/rugbycodex/current`
- Nginx serving static files
- No server-side rendering
- No load balancing
- No CDN
- No caching layer

**Current Limitations:**
- Single point of failure
- Limited concurrent connections (~500-1000 max)
- Network bandwidth constrained
- CPU-bound for SSL/TLS termination
- No geographic distribution
- Manual deployments via rsync

### Backend Infrastructure (Supabase)
**Current Plan:** Likely Pro or Free tier  
**Components:**
- 32 Edge Functions (Deno runtime)
- PostgreSQL database (managed)
- Authentication & JWT
- Row-Level Security (RLS)
- Real-time subscriptions

**Database Tables:** 20+ tables including:
- organizations (multi-tenancy)
- media_assets (video metadata)
- narrations (AI transcriptions)
- jobs (async processing queue)
- profiles, org_members, groups
- assignments, media_asset_segments

### AWS Infrastructure (Video Processing)
**Current Setup:**
- ECS Cluster: rugbycodex-cluster
- Auto Scaling Group: 0-3 g4dn.xlarge instances
- SQS: rugbycodex-transcode-jobs
- GPU: NVIDIA T4 (NVENC hardware encoding)
- Region: us-east-1
- Cost: $0/hr idle, ~$0.50-1.50/hr active

**Quota Constraints:**
- On-Demand G instances: 4 vCPUs (1 instance max)
- Spot G instances: 8 vCPUs (2 instances max)
- Total: 3 workers maximum
- Pending increase request: 16 vCPUs

### Storage (Wasabi)
- S3-compatible object storage
- Video files (original + HLS segments)
- Cost: ~$0.0059/GB/month
- No egress fees (major advantage)

### Monitoring (Axiom)
- 30-day log retention
- 500GB/month ingest (free tier)
- Frontend + Edge Function logs
- Request tracing with correlation IDs

---

## Scaling Phases Overview

| Phase | User Range | Monthly Cost | Key Changes |
|-------|-----------|--------------|-------------|
| **Current** | 0-50 | $50-100 | Linode Nanode + Supabase + AWS minimal |
| **Phase 1** | 50-100 | $100-200 | Optimize Nanode, add monitoring |
| **Phase 2** | 100-1,000 | $200-500 | Add CDN (Cloudflare), Linode upgrade |
| **Phase 3** | 1,000-5,000 | $500-1,500 | Kubernetes/multiple servers, load balancer |
| **Phase 4** | 5,000-10,000 | $1,500-3,000 | Database read replicas, caching layer |
| **Phase 5** | 10,000+ | $3,000-10,000+ | Multi-region, enterprise Supabase |

---

## Phase 1: Immediate Optimizations (0-100 users)
**Timeline:** Immediate - 3 months  
**Cost Impact:** +$50-100/month  
**Risk Level:** Low

### Goals
- Improve current Linode server performance
- Add monitoring and alerting
- Prepare for traffic growth
- No infrastructure changes

### Actions

#### 1.1 Nginx Optimization
**File:** `/etc/nginx/nginx.conf` on Linode server

```nginx
# Enable gzip compression
gzip on;
gzip_vary on;
gzip_min_length 1024;
gzip_types text/plain text/css text/xml text/javascript 
           application/javascript application/json application/xml+rss 
           application/wasm font/woff2;

# Enable HTTP/2
listen 443 ssl http2;

# Aggressive caching for static assets
location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}

# Index.html - no cache (SPA needs fresh HTML)
location = /index.html {
    add_header Cache-Control "no-cache, no-store, must-revalidate";
}

# Connection optimization
keepalive_timeout 65;
keepalive_requests 100;

# Buffer sizes
client_body_buffer_size 16K;
client_header_buffer_size 1k;
large_client_header_buffers 4 8k;

# Worker processes
worker_processes auto;
worker_connections 1024;
```

**Expected Impact:**
- 40-60% reduction in bandwidth usage (gzip)
- 30-50% faster page loads (caching)
- Support 2-3x more concurrent users

#### 1.2 Build Optimization
**File:** `frontend/vite.config.ts`

```typescript
export default defineConfig({
  build: {
    target: 'es2020',
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true, // Remove console.logs in production
        drop_debugger: true,
      },
    },
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-vue': ['vue', 'vue-router', 'pinia'],
          'vendor-supabase': ['@supabase/supabase-js'],
          'vendor-video': ['hls.js', 'shaka-player'],
          'vendor-aws': ['@aws-sdk/client-s3', '@aws-sdk/lib-storage'],
        },
      },
    },
    chunkSizeWarningLimit: 1000,
  },
});
```

**Expected Impact:**
- Faster initial page load (code splitting)
- Better browser caching (stable chunk hashes)
- Smaller bundle size

#### 1.3 Enhanced Monitoring
**Setup Uptime Monitoring:**
- UptimeRobot (free tier) - https://uptimerobot.com
- Monitor: rugbycodex.com, 5-minute intervals
- Alert via email/Slack on downtime

**Setup Server Monitoring:**
```bash
# Install node_exporter on Linode
sudo apt install prometheus-node-exporter

# Monitor with free tier Grafana Cloud
# Or use Netdata (self-hosted)
sudo apt install netdata
```

**Metrics to track:**
- CPU usage
- Memory usage
- Disk I/O
- Network bandwidth
- Nginx requests/sec
- Response times

#### 1.4 Automated Backups
```bash
# Add to Linode scheduled tasks
# Backup static files daily
0 2 * * * tar -czf /backup/rugbycodex-$(date +\%Y\%m\%d).tar.gz /var/www/rugbycodex

# Rotate backups (keep last 7 days)
0 3 * * * find /backup/rugbycodex-* -mtime +7 -delete
```

#### 1.5 SSL Certificate Automation
```bash
# Ensure certbot auto-renewal is working
sudo certbot renew --dry-run

# Add to crontab if not present
0 0 1 * * certbot renew --quiet
```

### Phase 1 Costs
| Item | Cost/Month |
|------|-----------|
| Linode Nanode | $5 |
| Supabase Pro (if needed) | $25 |
| UptimeRobot Free | $0 |
| AWS (light usage) | $10-20 |
| **Total** | **$40-50** |

### Phase 1 Success Metrics
- ✅ Page load time < 2 seconds
- ✅ Server uptime > 99.5%
- ✅ Handling 100+ concurrent users
- ✅ No manual intervention for 30 days

---

## Phase 2: CDN & Caching (100-1,000 users)
**Timeline:** 3-6 months  
**Cost Impact:** +$100-300/month  
**Risk Level:** Low

### Goals
- Reduce load on Linode server
- Improve global latency
- Handle traffic spikes
- Maintain low cost

### Actions

#### 2.1 Cloudflare CDN Integration
**Why Cloudflare:**
- Free tier includes CDN
- Global edge network (250+ locations)
- DDoS protection
- SSL/TLS termination
- Web Application Firewall (WAF)

**Setup Steps:**
1. Create Cloudflare account
2. Add rugbycodex.com domain
3. Update nameservers at domain registrar
4. Configure caching rules

**Cloudflare Cache Rules:**
```
# Cache everything except API calls
Cache Level: Standard
Browser Cache TTL: 4 hours

# Page Rules
rugbycodex.com/*
  - Cache Level: Cache Everything
  - Edge Cache TTL: 1 hour

rugbycodex.com/index.html
  - Cache Level: Bypass
  - Browser Cache TTL: 0

*.supabase.co/*
  - Cache Level: Bypass (don't cache API)
```

**Expected Impact:**
- 70-90% reduction in Linode bandwidth
- 50-70% faster global access
- Handle traffic spikes up to 10,000 concurrent users
- DDoS protection included

#### 2.2 Linode Server Upgrade
**Upgrade to:** Linode 2GB  
**Specs:**
- 1 dedicated vCPU (not shared)
- 2GB RAM
- 50GB SSD
- 2TB transfer/month
- Cost: $12/month (+$7)

**Why upgrade:**
- Dedicated CPU (better performance)
- More headroom for SSL/TLS
- Better for 1,000+ users behind CDN

#### 2.3 Implement Service Worker Caching
**File:** `frontend/public/sw.js`

```javascript
// Cache static assets for offline support
const CACHE_NAME = 'rugbycodex-v1';
const urlsToCache = [
  '/',
  '/index.html',
  // Add critical CSS/JS here
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => response || fetch(event.request))
  );
});
```

**Benefits:**
- Faster repeat visits
- Partial offline support
- Reduced server load

#### 2.4 Setup Error Tracking
**Recommended:** Sentry (free tier)

```typescript
// frontend/src/main.ts
import * as Sentry from '@sentry/vue';

Sentry.init({
  app,
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE,
  tracesSampleRate: 0.1, // 10% of transactions
});
```

**Benefits:**
- Track JavaScript errors in production
- User session replay
- Performance monitoring

### Phase 2 Costs
| Item | Cost/Month |
|------|-----------|
| Linode 2GB | $12 |
| Cloudflare Free | $0 |
| Supabase Pro | $25 |
| Sentry Free | $0 |
| AWS (moderate usage) | $20-50 |
| **Total** | **$57-87** |

### Phase 2 Success Metrics
- ✅ Global latency < 200ms (P95)
- ✅ 95% cache hit rate on Cloudflare
- ✅ Handling 1,000 concurrent users
- ✅ Zero unplanned downtime

---

## Phase 3: Distributed Frontend (1,000-5,000 users)
**Timeline:** 6-12 months  
**Cost Impact:** +$300-1,000/month  
**Risk Level:** Medium

### Goals
- Eliminate single point of failure
- Auto-scaling web servers
- Geographic distribution
- High availability (99.9%+)

### Strategy Options

#### Option A: Linode Managed Kubernetes (LKE)
**Architecture:**
```
Cloudflare CDN
    ↓
Linode NodeBalancer (Load Balancer)
    ↓
LKE Cluster (3 nodes)
    ├── nginx-ingress
    ├── Frontend Pod 1 (replica 3x)
    ├── Frontend Pod 2 (replica 3x)
    └── Frontend Pod 3 (replica 3x)
```

**Specs:**
- 3x Linode 4GB nodes ($24/node = $72/month)
- NodeBalancer: $10/month
- Horizontal Pod Autoscaler (scale 3-9 replicas)
- Total: ~$82/month base

**Deployment:**
```yaml
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: rugbycodex-frontend
spec:
  replicas: 3
  selector:
    matchLabels:
      app: rugbycodex-frontend
  template:
    metadata:
      labels:
        app: rugbycodex-frontend
    spec:
      containers:
      - name: nginx
        image: nginx:alpine
        ports:
        - containerPort: 80
        volumeMounts:
        - name: frontend-dist
          mountPath: /usr/share/nginx/html
        resources:
          requests:
            memory: "256Mi"
            cpu: "100m"
          limits:
            memory: "512Mi"
            cpu: "500m"
---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: rugbycodex-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: rugbycodex-frontend
  minReplicas: 3
  maxReplicas: 9
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
```

**Pros:**
- True auto-scaling
- Zero-downtime deployments
- Self-healing (pod restarts)
- Industry-standard (Kubernetes)

**Cons:**
- More complex to manage
- Higher learning curve
- Overkill for <5,000 users

#### Option B: Multiple Linode Instances + NodeBalancer (Recommended)
**Architecture:**
```
Cloudflare CDN
    ↓
Linode NodeBalancer
    ↓
    ├── Frontend Server 1 (Linode 4GB)
    ├── Frontend Server 2 (Linode 4GB)
    └── Frontend Server 3 (Linode 4GB)
```

**Specs:**
- 3x Linode 4GB ($24/month each = $72/month)
- NodeBalancer: $10/month
- Total: $82/month

**Setup:**
1. Create 3 Linode instances from template
2. Setup NodeBalancer with health checks
3. Configure Cloudflare to point to NodeBalancer IP
4. Deploy via CI/CD to all nodes

**Deployment Script:**
```bash
#!/bin/bash
# deploy-multi.sh

SERVERS=(
  "deploy@192.168.1.101"
  "deploy@192.168.1.102"
  "deploy@192.168.1.103"
)

# Build once
pnpm build

# Deploy to all servers in parallel
for server in "${SERVERS[@]}"; do
  (
    echo "Deploying to $server..."
    rsync -avz --delete ./dist/ "$server:/var/www/rugbycodex/"
  ) &
done

wait
echo "Deployment complete!"
```

**Health Check:**
```nginx
# Add to nginx config
location /health {
    access_log off;
    return 200 "healthy\n";
    add_header Content-Type text/plain;
}
```

**Pros:**
- Simpler than Kubernetes
- Easier to debug
- Lower overhead
- Sufficient for 5,000 users

**Cons:**
- Manual scaling (add more nodes)
- Less automation

#### Option C: Vercel/Netlify (Serverless Frontend)
**Architecture:**
```
Vercel Edge Network (Global)
    ↓
Static SPA (auto-deployed)
    ↓
Supabase Edge Functions (API)
```

**Cost:**
- Vercel Pro: $20/month
- Unlimited bandwidth
- Global CDN included
- Auto-scaling

**Pros:**
- Zero infrastructure management
- Global by default
- Git-based deployments
- Preview deployments for PRs
- Excellent DX

**Cons:**
- Less control
- Vendor lock-in
- May be more expensive at scale

### Recommended: Option B (Multi-Node) → Transition to Option C (Vercel) at 3,000+ users

### Phase 3 Costs (Option B)
| Item | Cost/Month |
|------|-----------|
| 3x Linode 4GB | $72 |
| NodeBalancer | $10 |
| Cloudflare Free | $0 |
| Supabase Pro | $25 |
| AWS (scaling up) | $50-100 |
| Axiom (may need paid tier) | $0-25 |
| **Total** | **$157-232** |

### Phase 3 Success Metrics
- ✅ 99.9% uptime (43 minutes downtime/month)
- ✅ Zero single point of failure
- ✅ Handling 5,000 concurrent users
- ✅ Rolling deployments with zero downtime

---

## Phase 4: Database Scaling (5,000-10,000 users)
**Timeline:** 12-18 months  
**Cost Impact:** +$200-1,000/month  
**Risk Level:** High

### Goals
- Scale database reads
- Improve query performance
- Handle 10,000+ concurrent users
- Maintain sub-100ms query times

### Supabase Scaling Path

#### 4.1 Upgrade Supabase Plan
**Current:** Pro ($25/month)  
**Target:** Team or Enterprise

**Team Plan (~$599/month):**
- Dedicated compute (8 vCPU, 32GB RAM)
- 500GB database storage
- 250GB bandwidth
- Read replicas available
- Point-in-time recovery (30 days)

**Expected capacity:**
- 10,000+ concurrent users
- 10,000+ requests/second
- 1TB+ database size

#### 4.2 Read Replicas
**Architecture:**
```
Supabase Primary DB (writes)
    ↓
    ├── Read Replica 1 (us-east-1)
    ├── Read Replica 2 (us-west-2)
    └── Read Replica 3 (eu-west-1)
```

**Query Routing:**
```typescript
// lib/supabaseClient.ts
import { createClient } from '@supabase/supabase-js';

// Primary (writes)
export const supabasePrimary = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

// Read replica (reads)
export const supabaseRead = createClient(
  import.meta.env.VITE_SUPABASE_READ_REPLICA_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

// Smart client that routes automatically
export function getSupabaseClient(operation: 'read' | 'write' = 'read') {
  return operation === 'write' ? supabasePrimary : supabaseRead;
}
```

**Expected Impact:**
- 3-5x read throughput
- Lower latency for global users
- Primary database less stressed

#### 4.3 Caching Layer (Redis)
**Setup:** Upstash Redis (serverless Redis)

**Architecture:**
```
Edge Function
    ↓
    ├─→ Check Redis Cache
    │   ├─→ Cache Hit: Return
    │   └─→ Cache Miss:
    │         ├─→ Query Supabase
    │         ├─→ Store in Redis
    │         └─→ Return
```

**Example:**
```typescript
// _shared/cache.ts
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: Deno.env.get('UPSTASH_REDIS_URL')!,
  token: Deno.env.get('UPSTASH_REDIS_TOKEN')!,
});

export async function getCached<T>(
  key: string,
  ttlSeconds: number,
  fetcher: () => Promise<T>
): Promise<T> {
  // Try cache
  const cached = await redis.get<T>(key);
  if (cached) return cached;
  
  // Fetch and cache
  const data = await fetcher();
  await redis.setex(key, ttlSeconds, data);
  return data;
}

// Usage in edge function
const orgData = await getCached(
  `org:${orgId}`,
  300, // 5 minutes
  () => supabase.from('organizations').select('*').eq('id', orgId).single()
);
```

**Cache Strategy:**
- Organization data: 5 minutes
- User profiles: 10 minutes
- Media metadata: 1 minute
- Streaming URLs: 1 hour
- Static content: 24 hours

**Cost:** Upstash free tier (10,000 requests/day), then ~$10-50/month

#### 4.4 Database Optimization

**Indexing Strategy:**
```sql
-- Critical indexes for performance
CREATE INDEX CONCURRENTLY idx_media_assets_org_created 
  ON media_assets(org_id, created_at DESC);

CREATE INDEX CONCURRENTLY idx_narrations_embedding_ivfflat 
  ON narrations USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

CREATE INDEX CONCURRENTLY idx_jobs_org_state_type 
  ON jobs(org_id, state, type);

CREATE INDEX CONCURRENTLY idx_org_members_user 
  ON org_members(user_id) WHERE role IN ('owner', 'manager');

-- Full-text search index
CREATE INDEX CONCURRENTLY idx_narrations_transcript_tsv 
  ON narrations USING GIN(transcript_tsv);
```

**Query Optimization:**
- Use `EXPLAIN ANALYZE` for slow queries
- Implement connection pooling (Supavisor)
- Batch similar queries
- Paginate results (limit 50-100 per page)

#### 4.5 Connection Pooling
**Enable Supavisor:**
- Connection pooler built into Supabase
- Reduces connection overhead
- Handles 10,000+ concurrent connections
- No code changes required

### Phase 4 Costs
| Item | Cost/Month |
|------|-----------|
| Frontend (Vercel Pro) | $20 |
| Supabase Team | $599 |
| Read Replicas (2x) | $1,200 |
| Upstash Redis | $10-50 |
| AWS (heavy usage) | $100-200 |
| Cloudflare (may upgrade) | $0-20 |
| Axiom | $25-50 |
| **Total** | **$1,954-2,139** |

### Phase 4 Success Metrics
- ✅ Supporting 10,000 concurrent users
- ✅ P95 query latency < 100ms
- ✅ Database read throughput > 100,000 qps
- ✅ 99.95% uptime

---

## Phase 5: Multi-Region & Global (10,000+ users)
**Timeline:** 18-24 months  
**Cost Impact:** +$2,000-5,000/month  
**Risk Level:** High

### Goals
- Global presence
- Sub-50ms latency worldwide
- 99.99% uptime (52 minutes/year)
- Enterprise-scale

### Architecture

#### 5.1 Multi-Region Deployment
```
Global Architecture:

┌─────────────────────────────────────────┐
│         Cloudflare (Global CDN)         │
│     - 250+ edge locations               │
│     - Smart routing                     │
└─────────────────────────────────────────┘
              │
    ┌─────────┼─────────┐
    │         │         │
┌───▼───┐ ┌───▼───┐ ┌───▼───┐
│ US-E  │ │ US-W  │ │ EU-W  │
│ East  │ │ West  │ │ Europe│
└───┬───┘ └───┬───┘ └───┬───┘
    │         │         │
    └─────────┼─────────┘
              ▼
    ┌──────────────────┐
    │ Supabase Primary │
    │   (Multi-AZ)     │
    └──────────────────┘
         │
    ┌────┼────┐
    ▼    ▼    ▼
  [Read Replicas Globally]
```

#### 5.2 Geographic Routing
**Cloudflare Load Balancing:**
- Route users to nearest region
- Health checks on all endpoints
- Automatic failover

**Cost:** Cloudflare Load Balancing ~$5/month

#### 5.3 Database Strategy: Multi-Region

**Option A: Supabase Multi-Region (Coming Soon)**
- Wait for official Supabase multi-region support
- Primary in us-east-1
- Read replicas in other regions

**Option B: CockroachDB (Alternative)**
- Multi-region by default
- Strong consistency
- Compatible with PostgreSQL
- Cost: ~$1,000-2,000/month

**Option C: Hybrid Approach**
- Keep Supabase for auth & primary DB
- Use CockroachDB for global tables
- Edge caching for most reads

#### 5.4 Video Storage: Multi-Region

**Current:** Wasabi (single region)  
**Target:** Multi-region with CDN

**Options:**

**A. Cloudflare R2 (Recommended)**
- S3-compatible API
- Zero egress fees
- Global distribution
- $0.015/GB/month storage
- Migration: Copy from Wasabi via AWS DataSync

**B. Wasabi + Cloudflare CDN**
- Keep Wasabi as origin
- Cloudflare caches HLS segments
- Lower migration effort

#### 5.5 AWS Multi-Region Transcoding
```
Video Upload (any region)
    ↓
SQS Regional Queues
    ├── us-east-1-queue
    ├── us-west-2-queue
    └── eu-west-1-queue
    ↓
Regional ECS Clusters
    ├── us-east-1 (3-6 workers)
    ├── us-west-2 (3-6 workers)
    └── eu-west-1 (3-6 workers)
    ↓
Upload to nearest region storage
```

**Benefits:**
- Lower latency for uploads
- Distributed processing
- Regional cost optimization

**Cost Impact:** +$200-500/month (multi-region ECS)

### Phase 5 Costs (Estimate)
| Item | Cost/Month |
|------|-----------|
| Cloudflare Enterprise | $200 |
| Vercel Enterprise | $200 |
| Supabase Enterprise | $2,000+ |
| Read Replicas (5x) | $3,000 |
| Redis (Enterprise) | $100-200 |
| AWS Multi-Region | $500-1,000 |
| R2 Storage (10TB) | $150 |
| Monitoring (DataDog/New Relic) | $200-500 |
| **Total** | **$6,350-7,050+** |

### Phase 5 Success Metrics
- ✅ 99.99% uptime (52 min/year)
- ✅ P95 latency < 50ms globally
- ✅ Supporting 50,000+ concurrent users
- ✅ Multi-region failover tested

---

## Linode Server Evolution

### Current: Nanode 1GB ($5/month)
- **When:** Current state (0-100 users)
- **Specs:** 1 vCPU shared, 1GB RAM, 25GB SSD
- **Capacity:** ~100 concurrent users with CDN
- **Role:** Single static file server

### Phase 1: Upgrade to Linode 2GB ($12/month)
- **When:** 100-500 users
- **Specs:** 1 vCPU dedicated, 2GB RAM, 50GB SSD
- **Capacity:** ~500 concurrent users with CDN
- **Role:** Primary static file server

### Phase 2: Horizontal Scaling (3x Linode 4GB = $72/month)
- **When:** 500-5,000 users
- **Specs:** 2 vCPU, 4GB RAM, 80GB SSD (each)
- **Capacity:** 5,000+ concurrent users
- **Role:** Load-balanced frontend cluster
- **Setup:** NodeBalancer + 3 identical nodes

### Phase 3: Kubernetes (LKE) or Migrate to Vercel
- **When:** 5,000-10,000 users

**Option A: Stay on Linode (LKE)**
- 3-5 node Kubernetes cluster
- Auto-scaling pods
- Cost: $100-200/month

**Option B: Migrate to Vercel (Recommended)**
- Zero infrastructure management
- Global CDN included
- Cost: $20-200/month depending on traffic
- **Migration:** Point DNS to Vercel, deploy via Git

### Phase 4: Full Migration to Serverless/Edge
- **When:** 10,000+ users
- Linode server eliminated entirely
- Vercel or Cloudflare Pages for frontend
- 100% serverless architecture

---

## AWS Infrastructure Scaling

### Current State
- **Region:** us-east-1 only
- **Instances:** 0-3 g4dn.xlarge
- **Quota:** 4 vCPU On-Demand + 8 vCPU Spot
- **Cost:** $0-50/month (usage-based)

### Phase 1: Quota Increase (Pending)
- **Target:** 16 vCPU On-Demand
- **Capacity:** 4 g4dn.xlarge instances
- **Impact:** Process 4 videos simultaneously
- **Cost:** Same (still scales to zero)

### Phase 2: Spot Fleet Optimization
```yaml
# Mixed instance policy
OnDemandBaseCapacity: 1
OnDemandPercentageAboveBaseCapacity: 0
SpotAllocationStrategy: capacity-optimized

InstanceTypes:
  - g4dn.xlarge   (preferred)
  - g4dn.2xlarge  (backup, more expensive but available)
  - g5.xlarge     (backup, newer GPU)
```

**Expected:**
- 95%+ spot instance success rate
- Lower costs (70% discount on spot)
- Auto-fallback to on-demand

### Phase 3: Multi-Region Transcoding
- **Regions:** us-east-1, us-west-2, eu-west-1
- **Routing:** Upload to nearest region
- **Benefit:** Lower latency, global coverage
- **Cost:** +50% (but better user experience)

### Phase 4: Reserved Instances (If Predictable Load)
- **When:** Consistent 24/7 video processing
- **Strategy:** Reserve 2-3 baseline instances, scale spot for peaks
- **Savings:** 40-60% vs on-demand
- **Risk:** Only if truly predictable load

### Cost Projections (AWS)

| Usage Level | Monthly Videos | Processing Hours | Cost/Month |
|-------------|----------------|------------------|-----------|
| Light | 50 | 20 hrs | $10-15 |
| Moderate | 200 | 80 hrs | $40-60 |
| Heavy | 500 | 200 hrs | $100-150 |
| Enterprise | 2,000+ | 800+ hrs | $400-600 |

---

## Database Scaling Strategy

### Current Database Structure
**Supabase PostgreSQL:**
- 20+ tables
- Row-Level Security (RLS) enabled
- Vector embeddings (pgvector)
- Full-text search (tsvector)
- Foreign keys and constraints

**Key Tables:**
- `organizations` - Multi-tenant root
- `media_assets` - Video metadata (~1KB per row)
- `media_asset_segments` - Timestamped clips
- `narrations` - AI transcriptions with embeddings
- `jobs` - Async job queue
- `profiles`, `org_members` - User data

### Growth Estimates

| Metric | Current | 1 Year | 3 Years | 5 Years |
|--------|---------|--------|---------|---------|
| Organizations | 10 | 100 | 1,000 | 5,000 |
| Users | 50 | 500 | 5,000 | 25,000 |
| Videos | 100 | 5,000 | 50,000 | 250,000 |
| Segments | 1,000 | 50,000 | 500,000 | 2.5M |
| Narrations | 500 | 25,000 | 250,000 | 1.25M |
| DB Size | 1GB | 10GB | 100GB | 500GB |

### Scaling Actions by Database Size

#### 0-10GB (Current - Phase 1)
**Actions:**
- Optimize indexes
- Monitor slow queries
- Implement query timeouts
- Use Supabase Pro plan

**Queries/Second:** 1,000-5,000

#### 10-50GB (Phase 2)
**Actions:**
- Add read replicas
- Implement Redis caching
- Partition large tables
- Use connection pooling

**Queries/Second:** 5,000-20,000

#### 50-100GB (Phase 3)
**Actions:**
- Table partitioning:
```sql
-- Partition media_assets by created_at (monthly)
CREATE TABLE media_assets_y2026m01 
  PARTITION OF media_assets 
  FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');

CREATE TABLE media_assets_y2026m02 
  PARTITION OF media_assets 
  FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');
```

- Archive old data to S3 (Glacier)
- Implement database sharding by org_id
- Upgrade to Supabase Team/Enterprise

**Queries/Second:** 20,000-50,000

#### 100GB+ (Phase 4)
**Actions:**
- Multi-region read replicas
- Vertical partitioning (split tables)
- Consider CockroachDB for global tables
- Dedicated database cluster

**Queries/Second:** 50,000+

### Table-Specific Strategies

#### `media_assets` (High Growth)
**Current:** ~100 rows  
**Projected:** 250,000 rows (5 years)

**Scaling:**
1. Partition by `created_at` (monthly partitions)
2. Archive videos older than 2 years to cold storage
3. Index on `(org_id, created_at, status)`
4. Separate hot/cold storage

#### `narrations` (Vector Search Heavy)
**Current:** ~500 rows with embeddings  
**Projected:** 1.25M rows (5 years)

**Scaling:**
1. Use IVFFlat index for vector search:
```sql
CREATE INDEX ON narrations 
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 1000);
```

2. Consider specialized vector DB (Pinecone/Qdrant)
3. Partition by `created_at`
4. Cache frequent embeddings

#### `jobs` (Queue Table)
**Current:** ~1,000 rows  
**Projected:** 1M+ rows (5 years)

**Scaling:**
1. Auto-delete completed jobs after 30 days:
```sql
-- Scheduled job
DELETE FROM jobs 
WHERE state IN ('succeeded', 'failed') 
  AND finished_at < NOW() - INTERVAL '30 days';
```

2. Move to dedicated queue service (AWS SQS already in use)
3. Archive job history to data warehouse

---

## Cost Projections

### Year 1 (0-500 users)
| Month | Users | Frontend | Backend | AWS | Storage | Monitoring | Total |
|-------|-------|----------|---------|-----|---------|------------|-------|
| 1-3 | 50 | $5 | $25 | $10 | $5 | $0 | **$45** |
| 4-6 | 100 | $12 | $25 | $20 | $10 | $10 | **$77** |
| 7-9 | 250 | $72 | $25 | $40 | $20 | $20 | **$177** |
| 10-12 | 500 | $72 | $25 | $60 | $30 | $25 | **$212** |

**Total Year 1:** ~$1,500-2,500

### Year 2 (500-2,000 users)
| Quarter | Users | Frontend | Backend | AWS | Storage | Other | Total |
|---------|-------|----------|---------|-----|---------|-------|-------|
| Q1 | 750 | $72 | $25 | $80 | $40 | $30 | **$247** |
| Q2 | 1,000 | $72 | $599 | $100 | $60 | $40 | **$871** |
| Q3 | 1,500 | $20* | $599 | $150 | $80 | $50 | **$899** |
| Q4 | 2,000 | $20 | $599 | $200 | $100 | $60 | **$979** |

*Migrated to Vercel

**Total Year 2:** ~$10,000-12,000

### Year 3 (2,000-5,000 users)
| Quarter | Users | Monthly Cost |
|---------|-------|--------------|
| Q1 | 2,500 | $1,100 |
| Q2 | 3,000 | $1,300 |
| Q3 | 4,000 | $1,600 |
| Q4 | 5,000 | $2,000 |

**Total Year 3:** ~$18,000-24,000

### Year 4-5 (5,000-25,000 users)
- **Monthly:** $2,000-7,000
- **Annual:** $24,000-84,000

### Break-Even Analysis

**Assumptions:**
- Average revenue per user (ARPU): $10-20/month
- Gross margin: 70% (after direct costs)

**Break-Even Points:**
| Phase | Monthly Cost | Users Needed | Revenue Needed |
|-------|--------------|--------------|----------------|
| Phase 1 | $50 | 5-10 | $50-100 |
| Phase 2 | $200 | 20-40 | $200-400 |
| Phase 3 | $500 | 50-100 | $500-1,000 |
| Phase 4 | $2,000 | 200-400 | $2,000-4,000 |
| Phase 5 | $7,000 | 700-1,400 | $7,000-14,000 |

---

## Monitoring & Alerting

### Current State (Axiom)
- Frontend logs
- Edge function logs
- 30-day retention
- 500GB/month ingest

### Phase 1: Enhanced Monitoring
**Add:**
- Server monitoring (Netdata/Prometheus)
- Uptime monitoring (UptimeRobot)
- Error tracking (Sentry)

**Alerts:**
- Server CPU > 80% for 5 minutes
- Server memory > 90%
- Response time > 2 seconds
- Error rate > 5%

### Phase 2: Application Performance Monitoring (APM)
**Add:** DataDog or New Relic

**Metrics:**
- Request latency (P50, P95, P99)
- Throughput (requests/sec)
- Error rates by endpoint
- Database query performance
- Apdex score

**Cost:** $0 (free tier) → $100-300/month

### Phase 3: Business Metrics Dashboard
**Track:**
- Daily/Monthly Active Users
- Video uploads per day
- Transcoding success rate
- Storage growth rate
- Revenue metrics
- User retention

**Tool:** Metabase or custom Grafana dashboard

### Phase 4: On-Call & Incident Management
**Tool:** PagerDuty or Opsgenie

**On-Call Rotation:**
- 24/7 coverage
- Escalation policies
- Runbooks for common issues

**Cost:** $0-100/month

### Monitoring Costs by Phase

| Phase | Tools | Monthly Cost |
|-------|-------|--------------|
| 1 | Axiom + UptimeRobot + Netdata | $0-10 |
| 2 | + Sentry + DataDog | $50-100 |
| 3 | + Metabase | $50-150 |
| 4 | + PagerDuty | $100-300 |

---

## Implementation Timeline

### Q1 2026 (Current)
- ✅ Optimize Linode Nanode
- ✅ Setup monitoring (UptimeRobot, Netdata)
- ✅ Implement Nginx caching
- ✅ Build optimization (code splitting)

### Q2 2026
- 🎯 Add Cloudflare CDN
- 🎯 Upgrade to Linode 2GB
- 🎯 Implement service worker
- 🎯 Add Sentry error tracking
- 🎯 AWS quota increase to 16 vCPU

### Q3 2026
- 🎯 Deploy 3x Linode nodes + NodeBalancer
- 🎯 Implement zero-downtime deployments
- 🎯 Add Redis caching layer
- 🎯 Optimize database indexes

### Q4 2026
- 🎯 Migrate to Vercel (evaluate)
- 🎯 Add Supabase read replicas
- 🎯 Implement multi-region AWS transcoding
- 🎯 Setup comprehensive monitoring

### 2027
- 🎯 Scale to 5,000-10,000 users
- 🎯 Upgrade Supabase to Team plan
- 🎯 Implement database partitioning
- 🎯 Consider multi-region deployment

---

## Risk Mitigation

### Risk 1: Linode Server Failure
**Impact:** Complete site outage  
**Probability:** Medium (single point of failure)

**Mitigation:**
- **Short-term:** Daily backups, monitoring, alerting
- **Medium-term:** Add 2 more nodes + load balancer
- **Long-term:** Migrate to Vercel (serverless)

**Recovery Time:** 15-30 minutes (restore from backup)

### Risk 2: Supabase Outage
**Impact:** API and database unavailable  
**Probability:** Low (99.9% SLA)

**Mitigation:**
- Read replicas for redundancy
- Graceful degradation (show cached data)
- Status page monitoring
- Backup database dumps daily

**Recovery Time:** 0-5 minutes (automatic failover)

### Risk 3: AWS Transcoding Capacity
**Impact:** Video processing delays  
**Probability:** Medium (spot instance interruptions)

**Mitigation:**
- Hybrid on-demand + spot strategy
- Multi-region processing
- Queue monitoring and alerts
- Reserved capacity for baseline

**Recovery Time:** 5-10 minutes (auto-restart)

### Risk 4: Rapid Traffic Spike (Viral Growth)
**Impact:** Site slowdown or crash  
**Probability:** Low but possible

**Mitigation:**
- CDN absorbs most traffic
- Auto-scaling configured
- Rate limiting on API
- DDoS protection (Cloudflare)

**Recovery Time:** Automatic (scaling)

### Risk 5: Database Growth Beyond Capacity
**Impact:** Performance degradation  
**Probability:** Medium (over 2-3 years)

**Mitigation:**
- Regular monitoring of DB size
- Automated archiving of old data
- Table partitioning strategy
- Plan upgrade path early

**Recovery Time:** Scheduled maintenance

### Risk 6: Cost Overrun
**Impact:** Financial strain  
**Probability:** Medium (unexpected growth)

**Mitigation:**
- Cost monitoring and alerts
- Usage-based scaling (pay for what you use)
- Budget caps on services
- Regular cost reviews

**Recovery Time:** Immediate (scale down)

---

## Key Decisions & Recommendations

### Decision 1: When to Move Off Linode?
**Recommendation:** Phase 3 (1,000-3,000 users)

**Trigger Points:**
- Spending >4 hours/month on server maintenance
- Need for global CDN beyond Cloudflare
- Requiring zero-downtime deployments
- Team size > 3 developers

**Migration:** Linode → Vercel or Cloudflare Pages

### Decision 2: Kubernetes vs Simple Load Balancing?
**Recommendation:** Simple Load Balancing until 5,000 users

**Rationale:**
- Kubernetes adds complexity
- 3-node nginx cluster sufficient for 5,000 users
- Easier to debug and maintain
- Lower learning curve

**Transition:** Move to Kubernetes only if:
- Need auto-scaling beyond 3 nodes
- Running microservices
- Team has Kubernetes expertise

### Decision 3: When to Upgrade Supabase?
**Recommendation:**
- **Phase 2 (500 users):** Stay on Pro ($25/month)
- **Phase 3 (2,000 users):** Evaluate Team plan ($599/month)
- **Phase 4 (5,000 users):** Upgrade to Team plan
- **Phase 5 (10,000+ users):** Evaluate Enterprise

**Trigger Points:**
- Database size > 10GB
- Queries/second > 5,000
- Need read replicas
- Need dedicated support

### Decision 4: Self-Host vs Managed Services?
**Recommendation:** Managed services (current approach)

**Rationale:**
- Focus on product, not infrastructure
- Better uptime guarantees
- Lower long-term costs (no DevOps salary)
- Easier to scale

**Self-hosting only makes sense if:**
- Team size > 20 engineers
- Unique infrastructure requirements
- Predictable, massive scale (100,000+ users)

---

## Summary & Next Steps

### Immediate Actions (Next 30 Days)
1. ✅ Optimize Nginx configuration on Linode
2. ✅ Setup UptimeRobot monitoring
3. ✅ Implement build optimizations (code splitting)
4. ✅ Request AWS quota increase (16 vCPU)
5. ✅ Setup automated backups

### Short-Term (Next 90 Days)
1. 🎯 Add Cloudflare CDN
2. 🎯 Upgrade Linode to 2GB plan
3. 🎯 Implement service worker caching
4. 🎯 Add Sentry error tracking
5. 🎯 Create runbooks for common issues

### Medium-Term (6-12 Months)
1. 🎯 Scale to 3-node frontend cluster
2. 🎯 Add Redis caching layer
3. 🎯 Implement Supabase read replicas
4. 🎯 Multi-region AWS transcoding
5. 🎯 Evaluate Vercel migration

### Long-Term (1-2 Years)
1. 🎯 Migrate to serverless frontend (Vercel)
2. 🎯 Upgrade Supabase to Team/Enterprise
3. 🎯 Implement database partitioning
4. 🎯 Multi-region deployment
5. 🎯 99.99% uptime target

---

## Appendix: Technology Stack Summary

### Current Stack
| Layer | Technology | Purpose |
|-------|------------|---------|
| **Frontend** | Vue 3 + Vite | SPA framework |
| **Hosting** | Linode Nanode | Static file serving |
| **CDN** | None (to add) | Content delivery |
| **Backend** | Supabase Edge Functions | Serverless API |
| **Database** | Supabase PostgreSQL | Relational data |
| **Auth** | Supabase Auth | Authentication |
| **Storage** | Wasabi S3 | Video storage |
| **Compute** | AWS ECS + GPU | Video transcoding |
| **Queue** | AWS SQS | Job distribution |
| **Logging** | Axiom | Observability |

### Target Stack (Phase 5)
| Layer | Technology | Purpose |
|-------|------------|---------|
| **Frontend** | Vue 3 + Vercel | Global edge network |
| **CDN** | Cloudflare Enterprise | DDoS + CDN |
| **Backend** | Supabase Enterprise | Serverless API |
| **Database** | Supabase + Read Replicas | Multi-region DB |
| **Cache** | Upstash Redis | Application caching |
| **Storage** | Cloudflare R2 | Multi-region storage |
| **Compute** | AWS ECS Multi-Region | Global transcoding |
| **Monitoring** | DataDog | Full-stack observability |

---

## Document Maintenance

**Review Schedule:** Quarterly  
**Next Review:** April 2026  
**Owner:** CTO/Technical Lead

**Change Log:**
- 2026-01-29: Initial comprehensive scaling plan created
- Future updates as infrastructure evolves

---

**Questions or concerns? Review this plan with your technical team and adjust based on:**
- Actual user growth rate
- Revenue projections
- Team size and expertise
- Specific feature requirements
- Regulatory/compliance needs
