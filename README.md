# 🏫 Classroom Management System

A full-stack classroom management web application built with **React + Refine** on the frontend and **Express + Better Auth** on the backend. It supports role-based access for admins, teachers, and students with email/password and OAuth authentication.

🔗 **Live Demo:** [classroom-client-ten.vercel.app](https://classroom-client-ten.vercel.app)

---

## 📁 Repository Structure

This project is split into two repositories:

| Repo | Description |
|------|-------------|
| [classroom-client](https://github.com/Ashish-Tiwari80/classroom-client) | React frontend (Vite + Refine + shadcn/ui) |
| [classroom-server](https://github.com/Ashish-Tiwari80/classroom-server) | Express backend (Better Auth + Drizzle ORM + PostgreSQL) |

---

## ✨ Features

- 🔐 Email/password authentication
- 🔑 OAuth login with Google and GitHub
- 👥 Role-based access control (Admin, Teacher, Student)
- 🏛️ Department management
- 📚 Subject management
- 🏫 Class management
- 📋 Enrollment management
- 🖼️ Cloudinary image upload for user avatars
- 🌙 Dark/Light theme support
- 📱 Responsive UI with shadcn/ui components

---

## 🛠️ Tech Stack

### Frontend
- **React 19** with **TypeScript**
- **Vite** — build tool
- **Refine** — admin framework (data, auth, routing)
- **React Router v7** — routing
- **shadcn/ui + Radix UI** — component library
- **Tailwind CSS v4** — styling
- **Better Auth** (client) — authentication
- **Cloudinary** — image management
- **React Hook Form + Zod** — form validation
- **TanStack Table** — data tables
- **Recharts** — charts

### Backend
- **Node.js + Express v5** with **TypeScript**
- **Better Auth** — authentication & session management
- **Drizzle ORM** — database ORM
- **PostgreSQL** — database
- **Arcjet** — security middleware
- **CORS** — cross-origin configuration

### Deployment
- **Frontend** → Vercel
- **Backend** → Railway

---

## 🚀 Getting Started

### Prerequisites

- Node.js >= 18
- PostgreSQL database
- Google OAuth credentials
- GitHub OAuth credentials
- Cloudinary account

---

### 1. Clone the repositories

```bash
# Frontend
git clone https://github.com/Ashish-Tiwari80/classroom-client.git
cd classroom-client

# Backend (in a separate terminal)
git clone https://github.com/Ashish-Tiwari80/classroom-server.git
cd classroom-server
```

---

### 2. Setup the Backend

```bash
cd classroom-server
npm install
```

Create a `.env` file in the root:

```env
# Server
FRONTEND_URL=http://localhost:5173

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/classroom

# Better Auth
BETTER_AUTH_SECRET=your_long_random_secret_here
BETTER_AUTH_URL=http://localhost:8000

# Google OAuth
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# GitHub OAuth
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
```

Run database migrations:

```bash
npm run db:push
```

Start the development server:

```bash
npm run dev
```

The backend will run on `http://localhost:8000`.

---

### 3. Setup the Frontend

```bash
cd classroom-client
npm install
```

Create a `.env` file in the root:

```env
VITE_BACKEND_BASE_URL=http://localhost:8000
```

Start the development server:

```bash
npm run dev
```

The frontend will run on `http://localhost:5173`.

---

## ⚙️ OAuth Setup

### Google

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create OAuth 2.0 credentials
3. Add to **Authorized JavaScript origins**:
   - `http://localhost:5173` (dev)
   - `https://your-frontend.vercel.app` (prod)
4. Add to **Authorized redirect URIs**:
   - `http://localhost:8000/api/auth/callback/google` (dev)
   - `https://your-backend.railway.app/api/auth/callback/google` (prod)

### GitHub

1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Create a new OAuth App
3. Set **Homepage URL** to your frontend URL
4. Set **Authorization callback URL** to:
   - `http://localhost:8000/api/auth/callback/github` (dev)
   - `https://your-backend.railway.app/api/auth/callback/github` (prod)

---

## 🌐 Production Deployment

### Backend (Railway)

Set these environment variables in Railway:

```env
FRONTEND_URL=https://your-frontend.vercel.app
DATABASE_URL=your_production_postgres_url
BETTER_AUTH_SECRET=your_long_random_secret
BETTER_AUTH_URL=https://your-backend.railway.app
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
```

> ⚠️ `BETTER_AUTH_URL` must be the bare backend domain — no `/api/auth` suffix.

### Frontend (Vercel)

Set this environment variable in Vercel:

```env
VITE_BACKEND_BASE_URL=https://your-backend.railway.app
```

> ⚠️ Always test OAuth from the **production URL** (`your-frontend.vercel.app`), not Vercel preview URLs, as OAuth providers require exact redirect URI matches.

---

## 📂 Project Structure

### Frontend (`classroom-client`)

```
src/
├── components/        # Reusable UI components
├── pages/             # Route pages (login, register, dashboard, etc.)
├── providers/         # Refine auth & data providers
├── lib/               # auth-client, utils
├── hooks/             # Custom hooks
├── types/             # TypeScript types
└── constants/         # App constants (API URLs, roles, etc.)
```

### Backend (`classroom-server`)

```
src/
├── routes/            # Express routers (subjects, users, departments, classes, enrollments)
├── middleware/        # Security middleware (Arcjet)
├── lib/               # Better Auth config (auth.ts)
├── db/                # Drizzle ORM schema & connection
└── index.ts           # App entry point
```

---

## 📜 Available Scripts

### Frontend

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run start` | Run production build |

### Backend

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Compile TypeScript |
| `npm run start` | Run compiled production build |
| `npm run db:push` | Push schema to database |

---

## 🔒 User Roles

| Role | Description |
|------|-------------|
| `admin` | Full access to all resources |
| `teacher` | Manage classes and subjects |
| `student` | View enrolled classes |

---

## 📄 License

MIT
