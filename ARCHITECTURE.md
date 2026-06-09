# Claude Artifacts — Master Architecture Document

> **Last reviewed:** 2026-06-09  
> **Stack:** Next.js 16 · React 19 · Supabase · Tailwind CSS 4 · TypeScript 5

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Repository Layout](#2-repository-layout)
3. [Architecture Diagrams](#3-architecture-diagrams)
4. [Technology Stack](#4-technology-stack)
5. [Authentication & Authorization](#5-authentication--authorization)
6. [Database Design](#6-database-design)
7. [Storage Layer](#7-storage-layer)
8. [Artifact Preview Pipeline](#8-artifact-preview-pipeline)
9. [Upload & Edit Flows](#9-upload--edit-flows)
10. [Component Architecture](#10-component-architecture)
11. [API Routes & Server Actions](#11-api-routes--server-actions)
12. [Caching & Revalidation](#12-caching--revalidation)
13. [SEO & Metadata](#13-seo--metadata)
14. [Security Model](#14-security-model)
15. [Architecture Decision Records](#15-architecture-decision-records)
16. [Known Limitations & Future Work](#16-known-limitations--future-work)

---

## 1. System Overview

Claude Artifacts is a full-stack **artifact gallery** — a place where users upload interactive HTML/JSX/JS components (built with Claude) and share them publicly. The core value propositions are:

- **Upload** a raw `.html`, `.jsx`, or `.js` file and get a hosted, sandboxed preview.
- **Browse** a gallery of publicly shared artifacts sorted by recency or likes.
- **Social features** — like artifacts, leave comments, follow user profiles.
- **API access** — personal access tokens let agents and scripts programmatically manage artifacts.

The application is a Next.js 16 app deployed on Vercel with Supabase as the backend (Postgres, Auth, Storage).

---

## 2. Repository Layout

```
claude-artifacts/
├── public/
│   └── artifacts/              # (unused static artifacts dir)
├── src/
│   ├── app/                    # Next.js App Router pages & API routes
│   │   ├── layout.tsx          # Root layout (fonts, <Header>)
│   │   ├── page.tsx            # Home — Top Rated + Latest + Search
│   │   ├── robots.ts           # SEO robots.txt
│   │   ├── sitemap.ts          # Dynamic XML sitemap
│   │   ├── api/
│   │   │   ├── auth/github/    # GitHub OAuth initiation
│   │   │   ├── preview/[slug]/ # Unauthenticated preview endpoint
│   │   │   └── download-all/   # ZIP bulk download
│   │   ├── artifact/[slug]/
│   │   │   ├── page.tsx        # Artifact viewer + info panel
│   │   │   ├── preview/        # Authenticated preview (with CSP)
│   │   │   ├── edit/           # Edit metadata / replace file
│   │   │   └── actions.ts      # update / delete server actions
│   │   ├── auth/
│   │   │   ├── callback/       # OAuth & OTP callback handler
│   │   │   ├── signout/        # POST sign-out
│   │   │   └── auth-code-error/# Error page
│   │   ├── login/              # Login page + email form + actions
│   │   ├── upload/             # Upload form + actions
│   │   ├── my-artifacts/       # Owner gallery (protected)
│   │   ├── liked-artifacts/    # Liked gallery (protected)
│   │   ├── top-rated/          # Top 100 by likes
│   │   ├── user/[username]/    # Public profile
│   │   └── personal-access-tokens/ # PAT management
│   ├── components/
│   │   ├── header.tsx          # Server — nav + auth state
│   │   ├── user-menu.tsx       # Client — dropdown
│   │   ├── artifact-card.tsx   # Server — gallery card
│   │   ├── artifact-viewer.tsx # Client — iframe loader
│   │   ├── artifact-info-panel.tsx # Client — metadata panel
│   │   ├── comments-section.tsx # Client — comments CRUD
│   │   ├── like-button.tsx     # Client — optimistic like
│   │   ├── search-bar.tsx      # Client — debounced URL search
│   │   ├── artifact-list.tsx   # Server — search results grid
│   │   └── download-all-button.tsx # Client — ZIP download
│   └── lib/
│       ├── artifacts.ts        # Artifact TypeScript interface
│       ├── preview.ts          # JSX→HTML transpilation pipeline
│       └── supabase/
│           ├── server.ts       # Server-side Supabase client
│           ├── client.ts       # Browser Supabase client
│           ├── artifacts.ts    # Artifact CRUD (332 lines)
│           └── likes.ts        # Like toggle server action
├── supabase/
│   └── schema.sql              # Full database schema + RLS + triggers
├── CLAUDE.md / AGENTS.md       # Dev agent instructions
├── next.config.ts
├── tsconfig.json
├── tailwind.config / postcss.config.mjs
└── env.example
```

---

## 3. Architecture Diagrams

### 3.1 High-Level System Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│                          Browser / Client                         │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────────────┐  │
│  │  Next.js RSC  │   │ Client React │   │  Preview <iframe>    │  │
│  │  (SSR/SSG)   │   │  Components  │   │  (sandboxed JSX)     │  │
│  └──────┬───────┘   └──────┬───────┘   └──────────┬───────────┘  │
└─────────┼─────────────────┼────────────────────────┼─────────────┘
          │ HTTP/HTTPS       │ Server Actions          │ /preview
          ▼                  ▼                         ▼
┌──────────────────────────────────────────────────────────────────┐
│                      Next.js App (Vercel)                         │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │
│  │ App Router  │  │ Server       │  │ API Routes               │  │
│  │ Pages/RSC   │  │ Actions      │  │ /api/preview/[slug]      │  │
│  │             │  │ (mutations)  │  │ /api/download-all        │  │
│  └──────┬──────┘  └──────┬───────┘  │ /api/auth/github        │  │
│         │                │          └──────────┬───────────────┘  │
│         │      ┌─────────┴──────────────────────┘                │
│         │      │    Supabase SSR Client                           │
└─────────┼──────┼─────────────────────────────────────────────────┘
          │      │
          ▼      ▼
┌──────────────────────────────────────────────────────────────────┐
│                          Supabase (BaaS)                          │
│  ┌──────────────┐  ┌───────────────┐  ┌────────────────────────┐  │
│  │  PostgreSQL  │  │  Auth         │  │  Storage               │  │
│  │  (5 tables)  │  │  (JWT, OAuth) │  │  (artifacts bucket)    │  │
│  │  + RLS       │  │  + Sessions   │  │  {user_id}/{slug}.ext  │  │
│  └──────────────┘  └───────────────┘  └────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
          │
          ▼
┌──────────────────────────────────────────────────────────────────┐
│                     External CDNs (Preview only)                  │
│   unpkg.com (React 18, Recharts, Babel)  ·  cdn.tailwindcss.com  │
└──────────────────────────────────────────────────────────────────┘
```

### 3.2 Authentication Flow

```
User                   Next.js                 Supabase Auth         GitHub
 │                        │                         │                   │
 │── GET /login ──────────►                         │                   │
 │◄── Login page ─────────                         │                   │
 │                        │                         │                   │
 │── Click "Sign in       │                         │                   │
 │   with GitHub" ────────►                         │                   │
 │                        │── GET /api/auth/github ─►                   │
 │                        │◄─ signInWithOAuth() ────                    │
 │◄── 302 redirect ───────                                              │
 │───────────────────────────────────────────────── authorize ─────────►
 │◄──────────────────────────────────────────────── callback URL ───────
 │── GET /auth/callback?code= ────────────────────►                     │
 │                        │── exchangeCodeForSession() ─────────────────►
 │                        │◄── JWT session tokens ──────────────────────
 │                        │                         │                   │
 │                        │   Set session cookies   │                   │
 │◄── 302 redirect / ─────                         │                   │
 │                        │                         │                   │

(Email/OTP flow is similar but via Supabase email magic links)
```

### 3.3 Upload Flow

```
User                Upload Form              Server Action          Supabase
 │                      │                        │                     │
 │── Fill form ─────────►                        │                     │
 │── Submit ────────────►                        │                     │
 │                      │── uploadArtifact() ────►                     │
 │                      │                        │── auth.getUser() ──►│
 │                      │                        │◄── user ────────────│
 │                      │                        │                     │
 │                      │                Validate inputs               │
 │                      │                Generate slug                 │
 │                      │                        │                     │
 │                      │                        │── storage.upload() ─►
 │                      │                        │◄── success / error ─│
 │                      │                        │                     │
 │                      │                        │── db.insert() ──────►
 │                      │                        │◄── success / error ─│
 │                      │                        │                     │
 │                      │                 (on db error: delete file)   │
 │                      │                        │                     │
 │◄── redirect /artifact/[slug] ─────────────────                     │
```

### 3.4 Preview Pipeline

```
Browser                    Preview Route               CDNs (unpkg, tailwind)
   │                            │                              │
   │── GET /artifact/[slug]/preview ───────────────────────────►
   │                            │── fetchArtifact(slug)        │
   │                            │── downloadArtifactFile()     │
   │                            │                              │
   │                            │  if .jsx or .js:             │
   │                            │    processJSX(source)        │
   │                            │      → strip imports         │
   │                            │      → extract component     │
   │                            │      → inject CDN shims      │
   │                            │    buildHTML(processed)      │
   │                            │      → wrap in HTML doc      │
   │                            │      → inject React CDN      │
   │                            │      → inject Tailwind CDN   │
   │                            │      → inject Babel runtime  │
   │                            │      → add error overlay     │
   │                            │  else: serve raw HTML        │
   │                            │                              │
   │◄── HTML document (CSP headers) ──────────────────────────
   │                            │                              │
   │  <iframe> parses HTML      │                              │
   │────────────── fetch React, Babel, Tailwind ──────────────►
   │◄──────────────────────────────────────────────────────────
   │  Babel compiles JSX in-browser                           │
   │  ReactDOM.createRoot().render(<Component />)             │
```

### 3.5 Entity-Relationship Diagram

```
auth.users (Supabase managed)
    │ 1
    ├──────────────────────────────────────────────┐
    │                                              │
    │ 1                                            │ 1
    ▼                                              ▼
profiles                                       artifacts
─────────────                                  ────────────────────
id (PK, FK→auth.users)                        id (PK)
username                                       slug (UNIQUE)
github_username                                title
avatar_url                                     description
created_at                                     owner_id (FK→auth.users)
                                               storage_path
                                               tags (text[])
                                               is_public
                                               author_name_visible
                                               like_count (denormalized)
                                               created_at / updated_at
                                                    │ 1
                              ┌─────────────────────┤
                              │                     │
                              │ N                   │ N
                              ▼                     ▼
                           comments              likes
                           ─────────────         ─────────────
                           id (PK)               id (PK)
                           artifact_id (FK)      artifact_id (FK)
                           user_id (FK)          user_id (FK)
                           body                  created_at
                           created_at            UNIQUE(artifact_id, user_id)

auth.users
    │ 1
    ▼
personal_access_tokens
───────────────────────
id (PK)
user_id (FK→auth.users)
name
token_hash (UNIQUE)
token_prefix
created_at
last_used_at (nullable)
expires_at (nullable)
```

### 3.6 Component Tree

```
RootLayout (Server)
└── <Header> (Server — reads auth)
    └── <UserMenu> (Client — toggle state)
│
├── HomePage (Server)
│   ├── <Suspense> → <SearchBar> (Client — debounced URL)
│   ├── <TopRatedSection> (Server — fetchTopRated)
│   │   └── <ArtifactCard> × N (Server)
│   └── <LatestSection> (Server — fetchLatest)
│       └── <ArtifactCard> × N (Server)
│
├── ArtifactPage /artifact/[slug] (Server)
│   ├── <ArtifactViewer> (Client — iframe + load state)
│   └── <ArtifactInfoPanel> (Client — expandable panel)
│       ├── <LikeButton> (Client — optimistic)
│       └── <CommentsSection> (Client — CRUD)
│
├── UploadPage (Server → Client form)
│   └── <UploadForm> (Client — file input, validation)
│
├── EditPage (Server → Client form)
│   └── <EditArtifactForm> (Client — metadata + file replace)
│
├── MyArtifactsPage (Server — protected, fetchByOwner)
│   └── <ArtifactCard> × N
│
├── UserProfilePage /user/[username] (Server)
│   └── <ArtifactCard> × N
│
└── PersonalAccessTokensPage (Server → Client)
    └── <TokenManager> (Client — generate/revoke)
```

---

## 4. Technology Stack

| Layer | Technology | Version | Notes |
|---|---|---|---|
| Framework | Next.js | 16.2.4 | App Router, RSC, Server Actions |
| UI Runtime | React | 19.2.4 | Concurrent mode, latest hooks |
| Styling | Tailwind CSS | 4.x | PostCSS plugin; no config file needed |
| Backend-as-a-Service | Supabase | — | Postgres + Auth + Storage |
| Supabase SDK | @supabase/ssr | 0.10.2 | Cookie-based SSR sessions |
| Compression | fflate | 0.8.3 | In-memory ZIP for bulk download |
| Language | TypeScript | 5.x | Strict mode, path alias `@/*` |
| Deploy Target | Vercel | — | Edge + Node.js runtime |
| Preview CDNs | unpkg, tailwindcss CDN | — | React 18, Recharts, Babel standalone |

---

## 5. Authentication & Authorization

### 5.1 Auth Providers

Two auth methods are supported, both via Supabase Auth:

| Method | Flow | Notes |
|---|---|---|
| GitHub OAuth | OAuth 2.0 → Supabase → callback | Primary method; populates `github_username` |
| Email OTP | Supabase magic link / passwordless | Fallback; email form at `/login` |

### 5.2 Session Management

Sessions are managed by `@supabase/ssr` using **HTTP-only cookies**. `/src/proxy.ts` defines a session-refresh helper and a route matcher config, but there is **no `middleware.ts`** file in the repo — it is not wired as Next.js middleware yet. Token refresh instead happens implicitly per-request inside each protected page or server action through individual `createClient()` calls.

```
Request → (no global middleware)
  → each Page/Action calls createClient()
  → supabase.auth.getUser()   ← refreshes token if near expiry
  → cookie writes available in Server Components via cookies() API
```

`proxy.ts` is prepared infrastructure for a future global middleware wire-up. Once connected (by creating `src/middleware.ts` that calls `proxy(request)`), session refresh will happen on every request instead of only within authenticated pages.

### 5.3 Server-Side Auth Pattern

Every protected server action follows this pattern:

```typescript
const supabase = await createClient();       // cookie-based
const { data: { user } } = await supabase.auth.getUser();
if (!user) return { error: "Not authenticated." };

const artifact = await fetchArtifact(slug);
if (artifact.owner_id !== user.id) return { error: "Not authorized." };
```

Authorization is always re-verified server-side; there is no trust of client-supplied user IDs.

### 5.4 Personal Access Tokens (PATs)

PATs are designed for agent/API access. The security model:

- Token is generated with `crypto.randomBytes` (or equivalent Web Crypto).
- Only a **hash** of the token is stored in `personal_access_tokens.token_hash`.
- The raw token is shown to the user **once** at creation time.
- A prefix (`cap_...`) is stored for display without revealing the full token.
- `last_used_at` tracks usage; `expires_at` is optional.

### 5.5 Route Protection

Pages protect themselves with server-side redirects:

```typescript
const { data: { user } } = await supabase.auth.getUser();
if (!user) redirect("/login");
```

There is no centralized route guard (middleware-based protection is not used for pages). Each protected page independently verifies auth.

---

## 6. Database Design

### 6.1 Tables

#### `public.profiles`
Extends `auth.users` with displayable metadata. Created automatically via trigger on signup.

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | FK → `auth.users.id` |
| username | text | Display name |
| github_username | text | From OAuth |
| avatar_url | text | GitHub avatar |
| created_at | timestamptz | |

#### `public.artifacts`

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| slug | text UNIQUE | URL-safe identifier |
| title | text | Required, max 100 chars |
| description | text | Optional |
| owner_id | uuid | FK → `auth.users.id` |
| storage_path | text | `{user_id}/{slug}.{ext}` |
| tags | text[] | Max 10, max 30 chars each |
| is_public | boolean | Default true |
| author_name_visible | boolean | Default true |
| like_count | int | Denormalized; maintained by trigger |
| created_at | timestamptz | |
| updated_at | timestamptz | |

#### `public.comments`

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| artifact_id | uuid | FK → `artifacts.id` |
| user_id | uuid | FK → `auth.users.id` |
| body | text | Max 1000 chars (enforced in DB) |
| created_at | timestamptz | |

#### `public.likes`

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| artifact_id | uuid | FK → `artifacts.id` |
| user_id | uuid | FK → `auth.users.id` |
| created_at | timestamptz | |
| — | UNIQUE | `(artifact_id, user_id)` |

#### `public.personal_access_tokens`

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| user_id | uuid | FK → `auth.users.id` |
| name | text | User-given name |
| token_hash | text UNIQUE | SHA-256 of raw token |
| token_prefix | text | `cap_...` prefix for display |
| created_at | timestamptz | |
| last_used_at | timestamptz | Nullable |
| expires_at | timestamptz | Nullable |

### 6.2 Indexes

| Index | Columns | Purpose |
|---|---|---|
| `artifacts_owner_created` | `(owner_id, created_at DESC)` | My Artifacts page |
| `artifacts_like_count` | `(like_count DESC, created_at DESC)` | Top Rated page |
| `artifacts_public_created` | `(created_at DESC) WHERE is_public` | Home Latest section |
| `comments_artifact_id` | `(artifact_id)` | Load comments per artifact |
| `pat_user_created` | `(user_id, created_at DESC)` | List user's PATs |

### 6.3 Triggers & Functions

**`handle_new_user()`** — Fires on `INSERT` into `auth.users`, creates a corresponding row in `public.profiles` with GitHub data if available.

**`update_artifact_like_count()`** — Fires on `INSERT` / `DELETE` from `public.likes`, increments or decrements `artifacts.like_count`. This keeps the count denormalized for fast sorting without a subquery.

### 6.4 Row-Level Security (RLS)

All tables have RLS enabled. Key policies:

| Table | Operation | Policy |
|---|---|---|
| profiles | SELECT | Anyone can read |
| profiles | INSERT/UPDATE | Owner only (`id = auth.uid()`) |
| artifacts | SELECT | Public if `is_public = true`, or owner |
| artifacts | INSERT | Authenticated, `owner_id = auth.uid()` |
| artifacts | UPDATE/DELETE | Owner only |
| comments | SELECT | On public artifact, or comment author |
| comments | INSERT | Authenticated users |
| comments | DELETE | Comment author only |
| likes | SELECT | Anyone |
| likes | INSERT | Authenticated, `user_id = auth.uid()` |
| likes | DELETE | Owner only |
| storage/artifacts | SELECT | Public if artifact `is_public`, or owner |
| storage/artifacts | INSERT/DELETE | Owner (`storage_path` starts with `{user_id}/`) |

RLS provides a **second layer of defense** — server actions also enforce ownership, but RLS prevents accidental bypasses.

---

## 7. Storage Layer

### 7.1 Bucket Configuration

Single private bucket: `artifacts`

Files are stored at: `{owner_id}/{slug}.{ext}`

Examples:
```
a1b2c3.../my-cool-app-lz1k9.jsx
a1b2c3.../dashboard-lz1ka.html
```

### 7.2 Content Types

| Extension | Content-Type stored |
|---|---|
| `.jsx`, `.js` | `text/plain; charset=utf-8` |
| `.html` | `text/html; charset=utf-8` |

JSX/JS files are stored as plain text because they are not served directly — they are fetched server-side, transformed, and served wrapped in a generated HTML document.

### 7.3 File Operations

| Operation | Function | Notes |
|---|---|---|
| Upload | `uploadArtifactFile(path, buffer, {upsert})` | Uses Blob, not File |
| Download | `downloadArtifactFile(path)` | Returns Blob |
| Delete | `deleteArtifactFile(path)` | Called on delete or file replace |

For **file replacement**: old file is deleted first, then new file is uploaded. This avoids needing a storage UPDATE policy (only INSERT and DELETE are needed).

---

## 8. Artifact Preview Pipeline

### 8.1 Two Preview Endpoints

| Endpoint | Path | Auth | CSP Headers | Use Case |
|---|---|---|---|---|
| App Route | `/artifact/[slug]/preview` | Public | Full CSP set | In-app iframe |
| API Route | `/api/preview/[slug]` | Public | Minimal | External embeds |

The app route includes these security headers:
```
Cache-Control: private, no-store
X-Content-Type-Options: nosniff
Content-Security-Policy: default-src 'self' 'unsafe-inline' 'unsafe-eval'
  https://unpkg.com https://cdn.tailwindcss.com; frame-ancestors 'self'
```

`'unsafe-eval'` is unavoidable — Babel requires it to compile JSX at runtime in the browser.

### 8.2 JSX→HTML Transformation (src/lib/preview.ts)

The pipeline has three stages:

**Stage 1 — Import Rewriting**

```
import React, { useState } from 'react';
  →  const { useState } = React;

import { BarChart } from 'recharts';
  →  const { BarChart } = Recharts;

import { Home } from 'lucide-react';
  →  const { Home } = LucideReact;  (shimmed — see below)

import anything from 'unknown-pkg';
  →  (stripped entirely)
```

**Stage 2 — Export Extraction**

```
export default function MyApp() { ... }
  →  function MyApp() { ... }      (componentName = "MyApp")

export default MyApp;
  →  (stripped)                    (componentName = "MyApp")
```

**Stage 3 — HTML Document Assembly**

The processed code is wrapped in a full HTML document:

```html
<!DOCTYPE html>
<html>
<head>
  <script src="https://unpkg.com/react@18/umd/react.production.min.js">
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js">
  <script src="https://cdn.tailwindcss.com">
  <!-- Conditionally: Recharts, react-is preload -->
  <script src="https://unpkg.com/@babel/standalone/babel.min.js">
  <!-- Error overlay styles + global window.onerror handler -->
</head>
<body>
  <div id="root"></div>
  <script type="text/babel">
    [PROCESSED CODE]
    ReactDOM.createRoot(document.getElementById("root"))
      .render(React.createElement(MyApp));
  </script>
</body>
</html>
```

### 8.3 CDN Library Map

| Import package | CDN URL | Global variable |
|---|---|---|
| `react` | unpkg React 18 UMD | `React` |
| `react-dom` | unpkg ReactDOM 18 UMD | `ReactDOM` |
| `recharts` | unpkg Recharts 2.5.0 | `Recharts` |
| `lucide-react` | (inline shim) | `LucideReact` |
| `tailwindcss` | cdn.tailwindcss.com | — |

The `lucide-react` shim is a `Proxy` that returns a generic circle SVG for every requested icon name, ensuring artifacts that import specific icons don't crash.

### 8.4 Error Overlay

A fixed-position overlay is injected into every preview HTML. It listens for `window.error` events and displays the error stack trace in a dark overlay. This surfaces JSX runtime errors without crashing the iframe silently.

---

## 9. Upload & Edit Flows

### 9.1 Upload Validation Rules

| Rule | Constraint |
|---|---|
| Allowed extensions | `.html`, `.jsx`, `.js` |
| Max file size | 5 MB |
| Title required | Yes |
| Max title length | 100 characters |
| Max tags | 10 |
| Max tag length | 30 characters per tag |
| Max artifacts per user | 100 |
| MIME validation | Extension-based (not MIME type) to support iOS |

### 9.2 Slug Generation

```
titleToSlug("My Awesome App!") →  "my-awesome-app-lz1k9f"

Algorithm:
  1. lowercase
  2. strip non-alphanumeric (except space, hyphen)
  3. trim
  4. spaces → hyphens
  5. collapse consecutive hyphens
  6. truncate to 60 chars
  7. append "-" + Date.now().toString(36)  ← ensures uniqueness
```

### 9.3 Edit Flow

Two independent server actions for editing:

**`updateArtifactDetails`** — Updates metadata only (title, description, tags, visibility). No file I/O.

**`replaceArtifactFile`** — Replaces the stored file:
1. Validate new file (extension + size).
2. Delete old file from storage.
3. Upload new file (with potentially different extension).
4. If `storage_path` changed, update DB record.

Both actions verify ownership before any mutation.

---

## 10. Component Architecture

### 10.1 Server vs Client Components

| Component | Type | Why |
|---|---|---|
| Header | Server | Reads auth; no interactivity |
| ArtifactCard | Server | Pure presentational |
| ArtifactList | Server | Data fetching |
| Root Layout | Server | Structure only |
| All page.tsx files | Server | Data fetching, redirects |
| UserMenu | Client | `useState` (dropdown open) |
| ArtifactViewer | Client | `onLoad` iframe event |
| ArtifactInfoPanel | Client | Expandable panel state |
| CommentsSection | Client | Comment CRUD, form state |
| LikeButton | Client | Optimistic update state |
| SearchBar | Client | Debounced URL routing |
| DownloadAllButton | Client | Fetch + blob |
| UploadForm | Client | File input, pending state |
| EditArtifactForm | Client | Form state |
| TokenManager | Client | Token generation UI |

### 10.2 Data Flow Pattern

Server components fetch data directly from Supabase, then pass serializable props to client components:

```
Server Page (async)
  → await fetchArtifact(slug)           // direct DB query
  → await supabase.auth.getUser()       // session check
  → canEdit = user?.id === artifact.owner_id
  → userHasLiked = await hasUserLiked(...)

  → render <ArtifactInfoPanel
      artifact={artifact}               // serialized object
      canEdit={canEdit}                 // boolean
      currentUserId={user?.id ?? null}  // string | null
      userHasLiked={userHasLiked}       // boolean
    />
```

No auth state, Supabase clients, or async operations leak into client components.

### 10.3 Mutation Pattern (Server Actions)

Client components call server actions directly (no fetch/XHR):

```typescript
// Client component
import { toggleLike } from "@/lib/supabase/likes";

async function handleClick() {
  setLiked(!liked);           // optimistic update
  await toggleLike(id, slug); // server action (re-authed server-side)
}
```

Server actions re-verify authentication on every call — the client cannot fake an authenticated session.

### 10.4 Search Pattern

Search state lives in the URL (not React state):

```
User types → SearchBar debounces 200ms → router.replace("/?q=...")
              ↓
         Next.js re-renders HomePage (Server Component)
              ↓
         Receives searchParams.q → fetchArtifactsBySearch(q)
              ↓
         Returns <ArtifactList> with results
```

This makes search results shareable and bookmarkable.

---

## 11. API Routes & Server Actions

### 11.1 API Routes

| Route | Method | Auth | Purpose |
|---|---|---|---|
| `/api/auth/github` | GET | — | Initiate GitHub OAuth |
| `/api/preview/[slug]` | GET | — | Serve artifact preview HTML |
| `/api/download-all` | GET | Required | Stream ZIP of all user artifacts |
| `/auth/callback` | GET | — | Exchange OAuth code / OTP for session |
| `/auth/signout` | POST | — | Clear session cookies |

### 11.2 Server Actions

| Action | File | Auth Check |
|---|---|---|
| `uploadArtifact` | `upload/actions.ts` | Required |
| `updateArtifactDetails` | `artifact/[slug]/actions.ts` | Owner |
| `replaceArtifactFile` | `artifact/[slug]/actions.ts` | Owner |
| `deleteArtifactDetails` | `artifact/[slug]/actions.ts` | Owner |
| `toggleLike` | `lib/supabase/likes.ts` | Required |
| `loginWithEmail` | `login/actions.ts` | — |
| `createPersonalAccessToken` | `personal-access-tokens/actions.ts` | Required |
| `revokePersonalAccessToken` | `personal-access-tokens/actions.ts` | Owner |
| `revokeAllTokens` | `personal-access-tokens/actions.ts` | Required |

### 11.3 Bulk Download Implementation

```
GET /api/download-all
  → auth check (401 if missing)
  → fetchArtifactsByOwner(user.id)
  → 404 if none, 413 if > 200
  → Promise.all(artifacts.map(downloadArtifactFile))   ← parallel fetches
  → zipSync(files)                                     ← fflate in-memory
  → Response(zipped, { Content-Type: application/zip })
```

Note: In-memory ZIP construction means all files must fit in serverless function memory. The 200-artifact guard limits this.

---

## 12. Caching & Revalidation

The app uses Next.js path-based cache revalidation. After every mutation, the relevant paths are invalidated:

| Mutation | Paths Revalidated |
|---|---|
| Upload artifact | `/`, `/my-artifacts` |
| Update artifact | `/`, `/artifact/[slug]`, `/my-artifacts` |
| Delete artifact | `/`, `/my-artifacts` |
| Toggle like | `/`, `/artifact/[slug]`, `/top-rated` |
| Add/delete comment | `/artifact/[slug]` |

The preview route sets `Cache-Control: private, no-store` — previews are never cached because the artifact content could be replaced.

There is no incremental static regeneration (ISR) or edge caching configured at the route level. All pages are dynamically server-rendered.

---

## 13. SEO & Metadata

### 13.1 Static Metadata

Root layout (`layout.tsx`) exports static `metadata`:
```
title: "Claude Artifacts"
description: "A gallery of interactive artifacts built with Claude."
```

### 13.2 Dynamic Metadata

Artifact detail pages generate per-artifact metadata via `generateMetadata()`:
- Title: `{artifact.title} | Claude Artifacts`
- Description: artifact description
- Keywords: artifact tags
- Canonical URL: `{NEXT_PUBLIC_SITE_URL}/artifact/{slug}`
- Open Graph: type, url, title, description

### 13.3 Sitemap

`/src/app/sitemap.ts` generates a dynamic XML sitemap containing all `is_public = true` artifacts with their `updated_at` timestamps and `changefreq: weekly`.

### 13.4 Robots

`/src/app/robots.ts` serves a `robots.txt` that allows all bots and points to the sitemap URL.

---

## 14. Security Model

### 14.1 Defense-in-Depth

```
Request
  │
  ├─ Supabase RLS (database-level authorization)
  │     ← Cannot be bypassed by application bugs
  │
  ├─ Server Action ownership check (application-level)
  │     artifact.owner_id === user.id
  │
  ├─ Session cookie (HTTP-only, Supabase SSR)
  │     ← Cannot be read by client JavaScript
  │
  └─ Input validation (server-side, before any DB/storage call)
```

### 14.2 Intentional Security Trade-offs

| Trade-off | Reason |
|---|---|
| `'unsafe-eval'` in CSP | Required for Babel to compile JSX at runtime in iframe |
| `'unsafe-inline'` in CSP | Required for Tailwind CDN injection |
| Extension-based MIME validation | iOS assigns `application/octet-stream` to `.jsx` files |
| No iframe `sandbox` attribute | Artifacts need `allow-scripts`; full sandbox is set via CSP `frame-ancestors` instead |
| Public preview endpoints (no auth) | Artifacts are intended to be publicly embeddable |

### 14.3 XSS Posture

The preview iframe is **intentionally a code execution environment**. Users upload and run arbitrary JavaScript. The security boundary is:

- `frame-ancestors 'self'` — prevents the preview being loaded in external sites.
- Preview is isolated to its own document origin (`/artifact/[slug]/preview` path).
- No cross-origin `postMessage` bridges are implemented.
- The parent page and preview share origin — this means `parent.window` access is possible. Future hardening could use `sandbox="allow-scripts allow-same-origin"` with a different origin for previews.

### 14.4 PAT Security

- Tokens are never stored plaintext.
- Token validation requires a DB lookup by hash.
- Tokens can be individually or bulk-revoked.
- PAT infrastructure exists but there is no middleware that validates `Authorization: Bearer cap_...` headers yet — this appears to be in-progress work.

---

## 15. Architecture Decision Records

### ADR-001: Next.js App Router over Pages Router

**Decision:** Use App Router (RSC) with async server components.  
**Rationale:** Direct database access in components eliminates boilerplate `getServerSideProps`. Server Actions provide type-safe mutations. RSC reduces client bundle size.  
**Trade-off:** RSC mental model is more complex; tooling support was immature at time of adoption.

---

### ADR-002: Supabase over custom backend

**Decision:** Supabase for Postgres, Auth, and Storage.  
**Rationale:** Built-in RLS, OAuth, and Storage with sensible defaults reduces infrastructure surface area significantly.  
**Trade-off:** Vendor lock-in; RLS policies must be carefully maintained in tandem with application-level auth.

---

### ADR-003: In-browser Babel transpilation for JSX previews

**Decision:** Transform JSX → HTML server-side (import rewriting) then compile via `@babel/standalone` in the browser.  
**Rationale:** Avoids bundling Babel into the server; keeps preview rendering stateless and cacheable.  
**Trade-off:** Requires `'unsafe-eval'` CSP. Preview load time includes CDN latency for Babel, React, and Tailwind scripts. Babel compilation adds ~200–500ms on first render.

---

### ADR-004: Denormalized `like_count` on artifacts

**Decision:** Maintain a `like_count` integer column on `artifacts`, updated by a Postgres trigger.  
**Rationale:** Top Rated query `ORDER BY like_count DESC` would require an expensive `COUNT(*)` subquery on every request without it.  
**Trade-off:** Count can theoretically drift from the `likes` table if the trigger fails. Periodic reconciliation query not currently implemented.

---

### ADR-005: URL query params for search state

**Decision:** Search query lives in `?q=` URL param, not React state.  
**Rationale:** Search results become shareable and linkable. Eliminates client-side state synchronization. Leverages Next.js RSC re-rendering on URL change.  
**Trade-off:** Every keystroke (after 200ms debounce) triggers a server-side re-render via `router.replace()`.

---

### ADR-006: Per-page auth guards instead of middleware

**Decision:** Each protected page calls `supabase.auth.getUser()` and redirects to `/login` if unauthenticated.  
**Rationale:** Middleware-based protection adds complexity; the number of protected routes is small. `/src/proxy.ts` exists and is ready to be promoted to `src/middleware.ts` when needed.  
**Trade-off:** No centralized enforcement. A new protected route could accidentally be added without the guard. Session tokens are also refreshed only within pages that call `createClient()`, not on every request. Future: create `src/middleware.ts` that re-exports `proxy` and `config` from `proxy.ts` to get global session refresh and centralized auth guards.

---

### ADR-007: Extension-based file type validation

**Decision:** Validate uploaded files by extension (`.html`, `.jsx`, `.js`) rather than MIME type.  
**Rationale:** iOS browsers send `application/octet-stream` for `.jsx` files, making MIME validation unreliable.  
**Trade-off:** A user could rename a non-code file to `.html` and upload it. Content is sandboxed in an iframe so impact is limited.

---

## 16. Known Limitations & Future Work

### Current Limitations

| Area | Limitation |
|---|---|
| **Pagination** | All queries return full result sets. Top Rated and user galleries could be slow with large datasets. |
| **PAT Validation** | PAT infrastructure is built but no route/middleware validates `Authorization: Bearer` headers yet. |
| **Preview isolation** | Preview iframe shares origin with parent; full origin isolation would require a separate domain. |
| **Search** | Full-text search is implemented as `ILIKE %query%` on title, description, tags — no Postgres FTS index. |
| **Like count drift** | `like_count` is maintained by trigger; no reconciliation mechanism if trigger fails. |
| **Bulk download scaling** | In-memory ZIP construction fails for large artifact collections (> ~200 files or large total size). |
| **No rate limiting** | Upload, like, and comment endpoints have no rate limiting beyond per-user artifact count cap. |
| **No image support** | Only HTML/JSX/JS artifacts are supported; no static image or media artifacts. |
| **Comment loading** | Comments are loaded client-side on mount via `useEffect` — introduces a waterfall after page load. |

### Potential Improvements

- **Streaming ZIP**: Replace in-memory `zipSync` with a streaming ZIP response for large downloads.
- **Postgres FTS**: Add a `tsvector` column + GIN index on `artifacts` for proper full-text search.
- **Preview origin isolation**: Serve previews from a separate subdomain to eliminate same-origin risk.
- **Centralized route middleware**: Protect all `/my-*` and `/personal-*` routes via `proxy.ts` matcher.
- **PAT middleware**: Add `Authorization: Bearer` validation in middleware for programmatic API access.
- **Pagination / infinite scroll**: Add cursor-based pagination to gallery queries.
- **Like count reconciliation**: Nightly SQL job to `UPDATE artifacts SET like_count = (SELECT COUNT(*) FROM likes WHERE artifact_id = artifacts.id)`.
