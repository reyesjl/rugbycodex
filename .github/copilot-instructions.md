# Rugbycodex Copilot Instructions

## Project Overview
Rugbycodex is a multi-tenant rugby intelligence platform that manages events, matches, and training sessions. It organizes video and metadata into searchable libraries, enabling coaches and unions to track development, tag plays, and build AI-driven insights for player and team performance.

## Technology Stack

### Frontend
- **Framework**: Vue 3 (Composition API)
- **Language**: TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS v4
- **State Management**: Pinia
- **Routing**: Vue Router
- **Backend/Auth**: Supabase (PostgreSQL + Authentication)
- **Package Manager**: pnpm

### Key Dependencies
- `@supabase/supabase-js` - Backend API and authentication
- `vue-router` - Client-side routing
- `pinia` - State management
- `@iconify/vue` - Icon library
- `jwt-decode` - JWT token parsing

## Project Structure

```
rugbycodex/
├── frontend/
│   ├── src/
│   │   ├── assets/          # Static assets (images, fonts, etc.)
│   │   ├── components/      # Reusable Vue components
│   │   ├── composables/     # Vue composables (shared logic)
│   │   ├── data/            # Static data files
│   │   ├── layouts/         # Layout components (MainLayout, minimal layout)
│   │   ├── lib/             # Library configurations (Supabase client)
│   │   ├── router/          # Vue Router configuration
│   │   ├── services/        # API service modules (org_service.ts)
│   │   ├── stores/          # Pinia stores (auth, profile)
│   │   ├── utils/           # Utility functions
│   │   ├── views/           # Page components
│   │   │   ├── admin/       # Admin-specific pages
│   │   │   ├── auth/        # Authentication pages
│   │   │   └── organizations/ # Organization-specific pages
│   │   ├── App.vue          # Root component
│   │   └── main.ts          # Application entry point
│   ├── public/              # Public static files
│   ├── eslint.config.js     # ESLint configuration
│   ├── vite.config.ts       # Vite configuration
│   ├── tailwind.config.ts   # Tailwind configuration
│   └── package.json         # Dependencies and scripts
└── .github/                 # GitHub workflows and configurations
```

## Code Style and Conventions

### General Guidelines
- Use TypeScript for type safety
- Prefer Vue 3 Composition API with `<script setup>` syntax
- Use single-file components (.vue files)
- Follow ESLint rules defined in `eslint.config.js`
- Component names should be PascalCase
- File names match component names

### Vue-Specific Patterns
- Use Composition API with `<script setup lang="ts">`
- Define reactive state with `ref()` and `reactive()`
- Use composables for shared logic
- Prefer `defineProps()` and `defineEmits()` for component APIs
- Use Pinia stores for global state management

### TypeScript Guidelines
- Avoid using `any` type (currently set to 'warn')
- Define interfaces for complex data structures
- Use type inference where possible
- Export types/interfaces that are used across multiple files

### Component Organization
- **Components**: Small, reusable UI elements (e.g., buttons, modals, inputs)
- **Views**: Full page components that represent routes
- **Layouts**: Wrapping components that define page structure
- **Composables**: Reusable composition functions with `use` prefix

### Naming Conventions
- Components: PascalCase (e.g., `CustomSelect.vue`, `ErrorNotification.vue`)
- Composables: camelCase with `use` prefix (e.g., `useAuth`, `useProfile`)
- Stores: camelCase (e.g., `authStore`, `profileStore`)
- Services: snake_case files (e.g., `org_service.ts`)
- Routes: camelCase (e.g., `organizationDashboard`)

### State Management
- Use Pinia stores for global state
- Store files located in `src/stores/`
- Define stores with `defineStore()`
- Use composition API style for stores
- Key stores:
  - `auth.ts` - Authentication state and user session
  - `profile.ts` - User profile data
  - `index.ts` - Pinia instance export

## Development Workflow

### Setup
```bash
cd frontend
pnpm install
```

### Development Commands
```bash
# Start development server
pnpm dev

# Build for production
pnpm run build

# Run linter
pnpm run lint

# Preview production build
pnpm preview
```

### Environment Variables
Create `.env.development` and `.env.production` files with:
- `VITE_SUPABASE_URL` - Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Supabase anonymous key
- `VITE_TURNSTILE_SITE_KEY` (optional) - Cloudflare Turnstile site key
- `VITE_TURNSTILE_SITE_KEY_DEV` (optional) - Cloudflare Turnstile dev key

## Authentication and Authorization

### Authentication Flow
- Email-based authentication via Supabase
- Users sign up at `/signup` and receive confirmation email
- Login at `/login`
- Password reset flow: `/reset-password` → email link → `/reset-password/update`
- Session stored in Supabase client and managed by auth store

### Route Guards
- `requiresAuth: true` - User must be logged in
- `requiresAdmin: true` - User must have admin privileges
- `guestOnly: true` - Only accessible when not logged in
- Redirects handled in router beforeEach guard

### Supabase Integration
- Client initialized in `src/lib/supabaseClient.ts`
- Auth state managed in `src/stores/auth.ts`
- Use `useAuthStore()` to access authentication state
- Check `authStore.isAuthenticated` for login status
- Check `authStore.isAdmin` for admin privileges

## Feature Highlights

### Multi-tenant Organization System
- Organizations accessible via `/organizations/:orgSlug`
- Organization-specific dashboards and data
- Admin can create and manage organizations

### Admin Features
- Admin dashboard accessible only to admin users
- Separate admin routes in `src/router/admin.ts`
- Admin views in `src/views/admin/`
- Organization management: create, list, manage

### Cloudflare Turnstile (Optional)
- Bot protection on signup form
- Widget rendered when `VITE_TURNSTILE_SITE_KEY` is set
- Form submission blocked until valid token received

## Common Patterns

### API Service Pattern
```typescript
// services/example_service.ts
import { supabase } from '@/lib/supabaseClient'

export async function fetchData() {
  const { data, error } = await supabase
    .from('table_name')
    .select('*')
  
  if (error) throw error
  return data
}
```

### Route Guard Pattern
```typescript
// In router configuration
{
  path: '/protected',
  component: () => import('@/views/Protected.vue'),
  meta: { requiresAuth: true }
}
```

### Store Usage Pattern
```typescript
import { useAuthStore } from '@/stores/auth'

const authStore = useAuthStore()
if (authStore.isAuthenticated) {
  // User is logged in
}
```

## Linting and Code Quality

### ESLint Configuration
- Uses flat config format (`eslint.config.js`)
- TypeScript ESLint rules enabled
- Vue-specific rules configured
- Relaxed rules for HTML formatting to allow flexibility

### Current Lint Status
- Some warnings for `@typescript-eslint/no-explicit-any` are expected
- Goal is to reduce `any` usage over time
- One known error: `PointerEvent` not defined in MainLayout.vue

### Before Committing
1. Run `pnpm run lint` to check for issues
2. Fix any new errors introduced by your changes
3. Build with `pnpm run build` to ensure no TypeScript errors

## Best Practices

### When Adding New Features
1. Check if similar patterns exist in the codebase
2. Follow the established folder structure
3. Create services for API interactions
4. Use stores for shared state
5. Create composables for shared logic
6. Add proper TypeScript types
7. Follow Vue 3 Composition API patterns

### When Modifying Authentication
- Always test login/logout flow
- Verify route guards work correctly
- Check that protected routes redirect properly
- Ensure Supabase session is maintained

### When Working with Supabase
- Import supabase client from `@/lib/supabaseClient`
- Handle errors from Supabase operations
- Use proper TypeScript types for database tables
- Check Supabase dashboard for schema reference

### Performance Considerations
- Use lazy loading for routes (already implemented)
- Avoid unnecessary re-renders
- Use computed properties for derived state
- Leverage Vite's code splitting

## Testing
- No test infrastructure currently exists
- Manual testing required for changes
- Test in development server with `pnpm dev`
- Verify production build with `pnpm run build && pnpm preview`

## Aliases
- `@/` resolves to `src/` directory
- Example: `import Component from '@/components/Component.vue'`

## Additional Notes
- The project uses Vite's plugin system for Tailwind CSS integration
- Vue TSC is used for type checking during builds
- Path resolution configured in `vite.config.ts`
- The frontend is the main development focus (no backend code in repo)
- Backend functionality provided by Supabase (external service)
