# ZX-CRM Project Documentation

## Overview
ZX-CRM is a professional, high-end Customer Relationship Management system designed for modern sales and automation workflows. It features a robust React frontend and a scalable Express/Node backend powered by Prisma.

---

## Tech Stack

### Frontend
- **Framework:** React 19 (Vite)
- **Styling:** TailwindCSS 4 (Modern utility-first styling)
- **State Management:** Zustand (Global state) & React Context
- **Data Fetching:** TanStack Query (React Query)
- **Routing:** React Router 7
- **Icons:** Lucide React & HeroIcons
- **Charts:** Recharts (Data visualization)
- **Components:** Custom premium UI components with glassmorphism and modern animations.

### Backend
- **Runtime:** Node.js
- **Framework:** Express.js
- **Database ORM:** Prisma
- **Authentication:** JWT (JSON Web Tokens) with Bcrypt for hashing.
- **Documentation:** Swagger/OpenAPI & Redoc UI
- **Notifications:** Node-cron & Nodemailer

---

## Core Modules

### 1. Sales & Lead Management
- **Lead Pipeline:** Track leads from source to conversion.
- **Lead Sources:** Facebook, Instagram, Website, LinkedIn, Calendly, and Manual.
- **Lead Scoring:** Automatic scoring based on interactions.
- **Notes & Activity:** Detailed history for every lead.

### 2. Task & Project Management
- **Sprints:** Agile sprint planning and tracking.
- **Tasks:** Kanban-style task management (Todo, In Progress, Done).
- **Time Tracking:** Estimated vs. Actual hours.

### 3. HRM & Team Management
- **Attendance:** Location-based check-in/check-out.
- **Leave Management:** Application and approval workflow for team members.
- **User Status:** Real-time online/offline/break status tracking.
- **Departments:** Hierarchical organization of users.

### 4. Communication & Integrations
- **Chat:** Real-time messaging powered by Stream.
- **Call Logs:** Integration with Callyzer for call tracking.
- **AI Integration:** OpenAI integration for automation and summaries.
- **Invoices & SLA:** Automatic generation of professional invoices and Service Level Agreements.

---

## Project Structure

### Backend (`/backend`)
- `src/app.js`: Main application entry point and route registration.
- `src/controllers/`: Logic for handling API requests.
- `src/routes/`: API endpoint definitions.
- `src/utils/`: Shared utilities (Prisma client, JWT helpers).
- `prisma/`: Database schema and migration files.

### Frontend (`/frontend`)
- `src/pages/`: Full-page components for different modules.
- `src/components/`: Reusable UI elements.
- `src/layouts/`: Common page structures (Sidebar, Navbar).
- `src/api/`: Axios instances and API services.
- `src/context/`: Global application state and authentication.

---

## Getting Started

### Backend Setup
1. `cd backend`
2. `npm install`
3. Configure `.env` with `DATABASE_URL` and `JWT_SECRET`.
4. `npx prisma db push`
5. `npm run dev`

### Frontend Setup
1. `cd frontend`
2. `npm install`
3. Configure `.env` with `VITE_API_URL`.
4. `npm run dev`

---

## API Documentation
The backend provides a comprehensive API documentation available at:
- **Swagger UI:** `http://localhost:5001/api-docs`
- **Redoc UI:** `http://localhost:5001/docs`
