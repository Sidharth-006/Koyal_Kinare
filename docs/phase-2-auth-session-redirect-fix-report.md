# Phase 2 — Authentication & Session Redirect Fix Report

**Project:** Koyal Kinare Cafe Management System  
**Date:** September 24, 2026  
**Status:** FIXED  

---

## 1. Bug Reproduction

- **Reported Issue:** When signing in at `http://localhost:3001/login`, the user is authenticated and the Dashboard displays for approximately 1 second before unexpectedly redirecting back to `/login`.
- **Reproduction Steps:**
  1. Navigate to `http://localhost:3001/login`.
  2. Enter valid admin credentials and submit the form.
  3. `POST /api/auth/login` returns HTTP 200 with `Set-Cookie: koyal_session=...`.
  4. The client redirects to `/dashboard` via `router.push('/dashboard')`.
  5. The `DashboardLayout` component mounts and executes `checkAuth()` (`await api.me()`).
  6. The `GET /api/auth/me` request fails.
  7. The `catch` handler in `DashboardLayout` catches the error and executes `router.push('/login')`, causing the sudden redirect.

---

## 2. Exact Root Cause

Investigation revealed two compounding root causes:

1. **Webpack Runtime Module Chunk Corruption in Dev Server:**
   Earlier execution of `npm run build` while `next dev` was running in the backend wrote production-hashed artifacts into `backend/.next`, invalidating in-memory dev compilation chunks. When `DashboardLayout` initiated `GET /api/auth/me`, the backend dev server crashed with:
   ```
   ⨯ Error: Cannot find module './276.js'
   Require stack:
   - C:\zayka\backend\.next\server\webpack-runtime.js
   - C:\zayka\backend\.next\server\app\api\auth\me\route.js
   GET /api/auth/me 500 in 2782ms
   ```
2. **Improper Error Object Structure in `/api/auth/me` Route:**
   In `backend/src/app/api/auth/me/route.ts`:
   ```typescript
   if (!rawToken) {
     return errorResponse({ message: 'Unauthorized access', code: 'UNAUTHORIZED', statusCode: 401 });
   }
   ```
   Because `{ message: '...', code: '...', statusCode: 401 }` is a plain JavaScript object and not an instance of `AppError`, the centralized `errorResponse` handler treated it as an unhandled exception, logged an `Unhandled server error`, and responded with HTTP 500 instead of HTTP 401.

---

## 3. Evidence from Browser / Network Inspection

- **Backend Log Output (Before Fix):**
  ```
  GET /api/auth/me 500 in 2782ms (Cannot find module './276.js')
  GET /api/auth/me 500 in 84ms
  GET /api/auth/me 500 in 225ms
  ```
- **Frontend Behavior (Before Fix):**
  `api.me()` threw `ApiError(500, "An unexpected error occurred.")`, which entered `DashboardLayout`'s catch block, triggering `router.push('/login')`.
- **Backend / Network Behavior (After Fix):**
  - Unauthenticated `GET /api/auth/me` returns HTTP 401:
    ```json
    { "error": { "code": "UNAUTHORIZED", "message": "Unauthorized access" } }
    ```
  - Authenticated `GET /api/auth/me` returns HTTP 200:
    ```json
    { "data": { "admin": { "email": "admin@koyalkinare.com", "displayName": "Cafe Admin" } } }
    ```

---

## 4. Files Changed

Only the minimal required files were modified:
- `backend/src/app/api/auth/me/route.ts` (replaced plain error object with `new UnauthorizedError('Unauthorized access')`).
- `backend/.next` & `frontend/.next` caches were cleaned to remove corrupted webpack runtime chunks.

No database migrations, database tables, business logic, or frontend layout structures were altered.

---

## 5. Exact Fix Summary

1. In `backend/src/app/api/auth/me/route.ts`:
   - Imported `UnauthorizedError` from `@/shared/errors`.
   - Updated the missing token check from:
     ```typescript
     return errorResponse({ message: 'Unauthorized access', code: 'UNAUTHORIZED', statusCode: 401 });
     ```
     to:
     ```typescript
     return errorResponse(new UnauthorizedError('Unauthorized access'));
     ```
2. Cleaned `backend/.next` and `frontend/.next` build caches and restarted servers cleanly to restore consistent module resolution.

---

## 6. Cookie & Session Behavior

### Cookie Configuration Properties:
- **Cookie Name:** `koyal_session`
- **Path:** `/`
- **HttpOnly:** `true`
- **SameSite:** `Lax`
- **Secure:** `false` in development (environment-aware: `process.env.NODE_ENV === 'production'`)
- **Max-Age:** `604800` (7 days)

---

## 7. Verification Results

### 1. Browser Login & Dashboard Stability
- **Initial Login:** Submitted login credentials; redirect to `/dashboard` completed smoothly.
- **5-Second Persistence:** User remained on `/dashboard` with no redirect to `/login`.
- **Page Refresh:** Hard reload on `/dashboard` maintained authenticated state without flickering or redirection.

### 2. Authenticated Navigation
- `/pos`: Loaded catalog, categories, and order panel successfully while preserving session.
- `/inventory/items`: Loaded inventory table, status filters, and "+ Add Item" modal successfully while preserving session.
- `/expenses`: Loaded expense tracker and table while preserving session.
- `/reconciliation`: Loaded daily reconciliation preview and shift metrics while preserving session.

### 3. Logout & Re-login
- **Logout:** Clicking "Sign Out" in the sidebar immediately cleared session and redirected to `/login`.
- **Re-login:** Re-entering credentials logged in successfully and `/dashboard` remained permanently stable.

---

## 8. Test & Build Execution

| Suite | Command | Result |
| :--- | :--- | :--- |
| Frontend Type Check | `npx tsc --noEmit` | **0 errors (PASS)** |
| Frontend Unit Tests | `npm test` | **2 test files, 5 passed (100%)** |
| Frontend Production Build | `npm run build` | **Exit code 0 (PASS)** |
| Backend Type Check | `npx tsc --noEmit` | **0 errors (PASS)** |
| Backend Unit & Integration Tests | `npm test` | **10 test files, 44 passed (100%)** |
| Backend Production Build | `npm run build` | **Exit code 0 (PASS)** |

---

## 9. Git Safety Confirmation

- **NO Git restore, reset, revert, checkout, stash, or clean operations were performed.**
- Local files are preserved as the definitive source of truth.
- Read-only `git status` verifies that all local Phase 1 and Phase 2 Inventory Master modifications remain intact.

---

## 10. Final Verdict

**FINAL STATUS: FIXED**
