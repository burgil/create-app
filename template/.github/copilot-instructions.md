# Create App Template  Copilot Instructions

**Project Overview**: This is a minimal Vite + React starter template designed for the create-app CLI.

## Tech Stack
- **Framework**: Vite + React 19 + TypeScript
- **Styling**: Tailwind CSS 4 (via @tailwindcss/vite)
- **Router**: React Router v7
- **Animations**: Framer Motion
- **Icons**: Lucide React + React Icons

## Structure
- **Pages**: src/pages/  Currently `home.tsx` and `about.tsx`
- **Components**: src/components/  Reusable UI components
- **Router**: src/Router.tsx  Route definitions with lazy loading
- **Layout**: src/Layout.tsx  Wraps pages with Suspense + SEO
- **SEO**: seo.json  Metadata for pages (used by prerender script)

## Key Commands
- pnpm dev  Start dev server
- pnpm build  Build for production (includes prerender)
- pnpm lint  Run ESLint

## Template Guidelines
- **Keep it generic**: No product-specific content
- **Use examples**: Show lucide-react, react-icons, and framer-motion in action
- **Stay minimal**: Simple, clean code that's easy to understand
- **Social links**: GitHub (https://github.com/burgil) and YouTube (https://youtube.com/@BurgilBuilds)

## Adding Routes
1. Create page in src/pages/<name>.tsx
2. Add lazy import in src/Router.tsx
3. Add route in Router: <Route path="name" element={<Component />} />
4. Update seo.json with metadata for the route
5. Update Navbar.tsx if needed

## Notes
- This template is meant to be scaffolded via:

```
npx github:burgil/create-app my-project
```
- Keep examples short and practical
- ErrorBoundary wraps the entire app for error handling
- Use @ alias for imports from src (e.g., import Component from '@/components/Component')
