# RugbyCodex Documentation

Welcome to the RugbyCodex documentation! This directory contains comprehensive guides for developers, operators, and contributors.

## 📚 Documentation Structure

```
docs/
├── README.md                    # This file - documentation index
├── architecture/                # System design and architecture
│   └── ARCHITECTURE_GUIDE.md   # Complete codebase architecture guide
└── guides/                      # Development guides and tutorials
    └── (coming soon)
```

---

## 🏗️ Architecture

### [Architecture Guide](./architecture/ARCHITECTURE_GUIDE.md)

**Complete guide to understanding the codebase structure and patterns.**

Covers:
- Project overview and high-level architecture
- Directory structure (frontend, backend, edge functions)
- Module organization patterns
- Data flow from UI to database
- Authentication & authorization (JWT, RLS, route guards)
- Multi-tenant organization context system
- **Error handling** (standardized across 32 edge functions & 5 services)
- Naming conventions and best practices
- Technology stack (Vue 3, Pinia, Supabase, Deno)
- Design patterns (services, stores, composables)

**Start here if you're new to the codebase!**

---

## 📖 Development Guides

### Quick Start

**Prerequisites:**
- Node.js 20+
- Deno 2.0+
- Supabase CLI
- Git

**Setup:**
```bash
# Clone repository
git clone <repo-url>
cd rugbycodex

# Install frontend dependencies
cd frontend
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your Supabase credentials

# Start development server
npm run dev
```

**Supabase Edge Functions:**
```bash
cd frontend
supabase functions serve

# Deploy functions
supabase functions deploy <function-name>
```

### Module Development

**To add a new feature module:**

1. Create module structure:
```
modules/<feature>/
├── components/    # Feature-specific components
├── services/      # API & business logic
├── stores/        # Pinia state management
├── types/         # TypeScript definitions
└── views/         # Page components
```

2. Create service file:
```typescript
// modules/<feature>/services/<feature>Service.ts
export const featureService = {
  async fetchData() {
    const { data, error } = await invokeEdge('function-name', {
      orgScoped: true,
    });
    if (error) throw await handleEdgeFunctionError(error);
    return data;
  },
};
```

3. Create Pinia store:
```typescript
// modules/<feature>/stores/use<Feature>Store.ts
export const useFeatureStore = defineStore('feature', () => {
  const data = ref(null);
  const loading = ref(false);
  
  async function loadData() {
    loading.value = true;
    try {
      data.value = await featureService.fetchData();
    } catch (err) {
      // Handle error
    } finally {
      loading.value = false;
    }
  }
  
  return { data, loading, loadData };
});
```

4. Add routes:
```typescript
// router/<feature>Routes.ts
export const featureRoutes = {
  path: '/feature',
  component: () => import('@/modules/<feature>/views/FeatureView.vue'),
  meta: { requiresAuth: true },
};
```

### Edge Function Development

**To add a new edge function:**

1. Create function directory:
```bash
mkdir frontend/supabase/functions/<function-name>
cd frontend/supabase/functions/<function-name>
```

2. Create `index.ts`:
```typescript
import { handleCors } from "../_shared/cors.ts";
import { requireAuth } from "../_shared/auth.ts";
import { errorResponse, jsonResponse } from "../_shared/errors.ts";

Deno.serve(async (req: Request) => {
  const corsHeaders = handleCors(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // 1. Authenticate
    const auth = await requireAuth(req);
    
    // 2. Parse input
    const payload = await req.json();
    
    // 3. Validate
    if (!payload.requiredField) {
      return errorResponse(
        'MISSING_REQUIRED_FIELDS',
        'Missing requiredField',
        400
      );
    }
    
    // 4. Business logic
    const result = await doWork(payload);
    
    // 5. Return success
    return jsonResponse(result, 200);
    
  } catch (error) {
    return errorResponse('OPERATION_FAILED', error.message, 500);
  }
});
```

3. Add error code to `_shared/errors.ts` if needed

4. Deploy:
```bash
supabase functions deploy <function-name>
```

### Testing

**Component Testing:**
```bash
# Coming soon
npm run test:unit
```

**Edge Function Testing:**
```bash
# Local testing
supabase functions serve
curl -X POST http://localhost:54321/functions/v1/<function-name> \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"test": "data"}'
```

---

## 🔧 Operations

### Deployment

**Frontend:**
```bash
npm run build
# Deploy build artifacts to your hosting platform
```

**Edge Functions:**
```bash
# Deploy all functions
supabase functions deploy

# Deploy specific function
supabase functions deploy <function-name>

# View logs
supabase functions logs <function-name>
```

### Environment Variables

**Frontend (`.env`):**
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_WASABI_BUCKET=your-bucket
VITE_CDN_BASE_URL=https://cdn.example.com
```

**Edge Functions:**
Set secrets via Supabase CLI:
```bash
supabase secrets set OPENAI_API_KEY=your-key
supabase secrets set WASABI_ACCESS_KEY_ID=your-key
supabase secrets set WASABI_SECRET_ACCESS_KEY=your-secret
```

---

## 🎯 Best Practices

### Code Style

- **TypeScript:** Use strict mode, define explicit types
- **Vue Components:** Use Composition API with `<script setup>`
- **Naming:** Follow conventions in Architecture Guide
- **Error Handling:** Always use `handleEdgeFunctionError` for edge function errors
- **State Management:** Use Pinia stores for shared state
- **API Calls:** Always go through service layer

### Security

- **Authentication:** All protected routes require auth
- **Authorization:** Use route guards + edge function checks + RLS
- **Org Context:** Always validate org membership before operations
- **Input Validation:** Validate all user input on backend
- **Error Messages:** Don't expose sensitive info in error messages

### Performance

- **Lazy Loading:** Use dynamic imports for routes
- **State Management:** Only store what's needed, avoid duplication
- **API Calls:** Batch related requests when possible
- **Media:** Use HLS streaming for video, not direct file serving
- **Caching:** Cache static assets, use CDN for media

---

## 🤝 Contributing

### Workflow

1. Create feature branch: `git checkout -b feature/your-feature`
2. Make changes following patterns in Architecture Guide
3. Test locally (frontend + edge functions)
4. Commit with descriptive messages
5. Push and create pull request

### Commit Messages

Follow conventional commits:
```
feat: add video upload resumability
fix: resolve storage quota calculation bug
docs: update architecture guide
refactor: migrate to new error handler
```

### Code Review Checklist

- [ ] Follows architecture patterns
- [ ] TypeScript types defined
- [ ] Error handling implemented
- [ ] Service layer used for API calls
- [ ] Route guards configured if needed
- [ ] Edge function uses shared utilities
- [ ] No hardcoded secrets
- [ ] Documentation updated

---

## 📞 Support

### Resources

- **Architecture Questions:** See [Architecture Guide](./architecture/ARCHITECTURE_GUIDE.md)
- **Supabase Docs:** https://supabase.com/docs
- **Vue 3 Docs:** https://vuejs.org
- **Deno Docs:** https://deno.com/manual

### Common Issues

**Edge function failing:**
- Check logs: `supabase functions logs <function-name>`
- Verify secrets are set: `supabase secrets list`
- Test locally first: `supabase functions serve`

**Authentication errors:**
- Verify JWT token in browser DevTools
- Check RLS policies in Supabase dashboard
- Ensure `requireAuth()` is called in edge function

**Org context issues:**
- Verify `orgScoped: true` in `invokeEdge()` call
- Check `activeOrgIdRef.value` is set
- Ensure user is member of org (check `org_memberships` table)

**Upload failures:**
- Check storage quota: see `OrgMediaV2.vue` for quota display
- Verify Wasabi credentials in secrets
- Check S3 bucket CORS configuration

---

## 📝 Recent Updates

### 2026-01-23: Error Handling Standardization

**Major migration completed:**
- ✅ All 32 edge functions migrated to standardized error handling
- ✅ All 5 frontend services migrated to new error handler
- ✅ Follows Supabase best practices with proper error types
- ✅ User-friendly error message transformations
- 📖 See [Architecture Guide - Error Handling](./architecture/ARCHITECTURE_GUIDE.md#error-handling)

**Impact:**
- Consistent error structure across entire codebase
- Better error messages for users
- Improved debugging with auto-logging
- Type-safe error codes (33 defined codes)

---

## 📄 License

[Add your license here]

---

**Last Updated:** January 23, 2026
