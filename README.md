# SerenityCare - Sober House & Recovery Management SPA

A Single Page Application (SPA) designed for sober living residences, rehabilitation clinics, and addiction recovery facilities. Built with pure **HTML5**, **Tailwind CSS**, and **Vanilla JavaScript** with reactive state architecture, ready to deploy serverlessly on **Cloudflare (D1 SQL, KV, R2)** or with **Laravel 11 REST API**.

---

## Key Features

1. **User & Staff Management (RBAC)**:
   - Clinical and operational roles: **Super Admin**, **Doctor / Addiction Psychiatrist**, **Clinical Nurse**, and **12-Step Addiction Counselor**.
   - One-click profile and role switcher for audit testing.
   - Comprehensive role permissions matrix.

2. **Patient / Resident Registry**:
   - Demographic profile, emergency contacts & designated next-of-kin with signed consents.
   - In-depth psychiatric and substance abuse evaluation (primary substance, duration, prior rehabs, suicide risk assessment, co-occurring diagnoses).
   - Resident photo capture and attachment.
   - Chronological daily clinical progress & counseling logs.
   - Daily vital signs tracker with toxicology drug screening results.

3. **Medication Administration Records (MAR) & Audio/Visual Reminders**:
   - Supervised scheduled dosing windows: Morning (08:00), Noon (12:00), Lunch (13:00), Dinner (18:00), Night (20:00).
   - Real-time notification daemon with pleasant Web Audio chime synthesizer.
   - Centered acceptance modals for nurse sign-off (`Administered`, `Refused`, `Missed`).
   - Active physician prescription orders.

4. **Interactive Recovery Dashboard**:
   - Key performance indicators: Bed Occupancy Rate, In-Recovery stages, Pending MAR doses today, Graduation candidates, and Pharmacy low-stock warnings.
   - Visual analytics powered by Chart.js:
     - Recovery Stage Breakdown (Donut Chart).
     - 6-Month Admissions & Graduations Trend (Bar Chart).

5. **Confidential Medical Dossier PDF Generator**:
   - Clinical-grade printable dossier for any resident with facility header, photo, vitals history, psychiatric evaluation, and official doctor signatures.

6. **Graduation & Release Certification**:
   - Sobriety milestone verification (sobriety days counter, 100% negative drug screen requirement).
   - Formal diploma certificate of release with gold/teal borders, rosette seal, and director signatures.

7. **Store & Pharmacy Inventory**:
   - Cataloging of prescription drugs, emergency Narcan supplies, drug test cups, and recovery literature.
   - Low-stock threshold alerts.
   - Transaction audit trails (Stock In, Dispensed).
   - Printable official Inventory Audit Report.

8. **Batch CSV Resident Intake**:
   - Drag-and-drop CSV file importer with downloadable starter template and client-side data validation.

9. **House Routine & Timetable Planner**:
   - Daily and weekly curriculum (Mindfulness, CBT groups, Big Book studies, Chores, Curfew).
   - Color-coded categories and printable facility schedule sheets.

10. **Custom Branding & Settings**:
    - Facility logo upload with real-time live preview.
    - Dynamic browser tab favicon upload.
    - Facility licensing and contact customization.

---

## Project Structure

```
Sobber/
├── index.html                   # Main SPA container & layout
├── css/
│   └── styles.css               # Medical palette, centered modal animations & print rules
├── js/
│   ├── app.js                   # Application router & navigation controller
│   ├── store.js                 # Central reactive state manager & observer bus
│   ├── auth.js                  # Authentication & RBAC permissions service
│   ├── components/
│   │   ├── modal.js             # Centered acceptance dialogs & decorated buttons
│   │   ├── reminders.js         # Web Audio chime & medication alert daemon
│   │   └── pdf-generator.js     # Patient dossier & certificate PDF generator
│   └── views/
│       ├── dashboard.js         # KPI metrics, recovery charts, schedule overview
│       ├── patients.js          # Patient register, psych history, vitals, daily notes
│       ├── medications.js       # Prescription records & MAR administration
│       ├── inventory.js         # Facility store, restock/dispense, printable reports
│       ├── timetable.js         # Daily/weekly house timetable planner
│       ├── certificates.js      # Graduation qualification & certificate issuer
│       ├── batch-upload.js      # CSV batch patient importer with template
│       ├── users.js             # User & staff management (Admin only)
│       └── settings.js          # Logo, favicon, facility settings
├── cloudflare/
│   ├── schema.sql               # Cloudflare D1 SQLite database schema
│   └── worker.js                # Cloudflare Worker / Pages API router (D1, KV, R2)
├── laravel/
│   ├── routes/api.php           # Laravel 11 REST API routes
│   ├── app/Http/Controllers/    # Resource controllers
│   └── database/migrations/     # Database migration schemas
├── assets/
│   ├── logo.svg                 # Clinical SerenityCare SVG logo
│   └── favicon.svg              # Medical cross & shield favicon
└── wrangler.toml                # Cloudflare deployment configuration
```

---

## How to Run & Authenticate

### Instant In-Browser Execution (Zero-Install)
1. Open `index.html` directly in any modern browser (Chrome, Edge, Firefox, Safari).
2. The **Production Login Panel** will appear.
3. Sign in with the default Administrator account:
   - **Email:** `admin@serenitycare.org`
   - **Password:** `Admin@Serenity2026!`
   *(Or click the **Autofill** button on the login screen for 1-click convenience)*
4. Once authenticated, you enter the clean production workspace. All dummy records have been removed so you can immediately admit real residents, prescribe medications, and catalog facility inventory.
5. To end your session, click the **Sign Out** button in the header or sidebar.

### Deploying to Cloudflare Pages with Workers KV
1. **Direct Upload via Cloudflare Dashboard**:
   - Go to [Cloudflare Dashboard](https://dash.cloudflare.com/) > **Workers & Pages** > **Create application** > **Pages** > **Upload assets**.
   - Upload the root directory containing `index.html`, `404.html`, `_redirects`, and the `functions/` folder.
   - Go to **Settings** > **Functions** > **KV namespace bindings**:
     - Variable name: `SOBBER_KV` -> Select your Cloudflare KV namespace.
     - Variable name: `KV` (optional fallback) -> Select your Cloudflare KV namespace.
   - Any change made by an administrator (admitting a resident, managing staff accounts, signing off MAR doses, adding inventory) now immediately replicates globally across all connected browsers!

2. **Deploy via Wrangler CLI**:
   ```bash
   # Create KV namespaces
   wrangler kv:namespace create "SOBBER_KV"
   wrangler kv:namespace create "KV"

   # Deploy directly to Cloudflare Pages
   wrangler pages deploy . --project-name serenitycare-sober-house
   ```

### Dedicated Cloudflare Pages REST API Endpoints
The application provides full serverless REST endpoints powered by Cloudflare Workers KV (`SOBBER_KV`):
- `GET /api/health` - Ping serverless operational status and KV connection.
- `GET /api/sync` & `POST /api/sync` - Full state snapshot synchronization across browsers.
- `GET /api/users`, `POST /api/users`, `DELETE /api/users` - Clinical staff & RBAC management.
- `GET /api/patients`, `POST /api/patients`, `DELETE /api/patients` - Resident intake, registry & batch CSV imports.
- `GET /api/medications` & `POST /api/medications` - Supervised MAR doses & prescription tracking.
- `GET /api/inventory` & `POST /api/inventory` - Pharmacy and logistics store inventory & dispensing.
- `GET /api/timetable` & `POST /api/timetable` - Daily & weekly house timetable schedules.

3. **Deploy as Cloudflare Worker**:
   ```bash
   wrangler d1 create serenitycare-db
   wrangler d1 execute serenitycare-db --file=./cloudflare/schema.sql
   wrangler deploy
   ```

### Deploying with Laravel 11
Copy the files in `laravel/` into your Laravel project directory:
```bash
php artisan migrate
php artisan serve
```
