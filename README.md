# Nexora Super To-Do List

## Description
A super UI/UX To-Do List with instant interactions, filtering/search, task details (notes, due date, priority), and optional persistence via a small Express API.

## Features
- Add tasks with: title, notes, due date, priority
- Mark complete / undo
- Edit tasks (inline modal)
- Delete tasks
- Filters: All / Active / Completed
- Search by title
- Sort by: Created (newest), Due date, Priority
- Persists tasks via Express API (`/api/tasks`) and local optimistic updates

## Technologies Used
- JavaScript
- DOM & Events
- Arrays & Functions
- Fetch API / JSON
- Node.js
- Express.js

## Run Instructions (Local)
1. Install dependencies:
   ```bash
   npm install
   ```
2. Start server:
   ```bash
   npm start
   ```
3. Open:
   - http://localhost:3000

## Deploy to Vercel

This project is a full Node/Express app (static UI from `public/` + API under `/api/*`).

### Option A (Recommended): Deploy as a Node.js app
1. Push this repo to GitHub.
2. In Vercel: **New Project** → select this repo → framework should detect **Node.js**.
3. Make sure the server entry runs `server.js`.
4. Set **Build Command**: `npm install` (or leave Vercel defaults)
5. Set **Output Directory**: leave blank.
6. Set **Environment variable** (optional): `PORT`.

### Option B (UI-only static)
- If Vercel won’t run Express easily, deploy only `public/` as a static site and switch `API_BASE` to an empty string and remove API calls (not needed in this repo).

## API Endpoints
- `GET /api/tasks`
- `POST /api/tasks`
- `PATCH /api/tasks/:id`
- `DELETE /api/tasks/:id`

