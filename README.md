# EduMatch

EduMatch is a student collaboration platform for Kisii University. Students can create collaboration profiles, discover potential teammates and academic groups, coordinate work, and communicate with group members.

This repository is a demonstration system. It uses a local seeded student registry and does not connect to Kisii University's student information systems. The application has Student and Admin roles; it does not have a lecturer role.

## Features currently implemented

- Student account registration, email verification, login/logout, session-based authentication, and password recovery.
- Student collaboration profiles with academic details, skills, interests, collaboration intentions, availability, and teammate preferences.
- Student matching and public student profile pages, subject to discoverability and profile eligibility rules.
- Group creation and discovery, membership requests, group invitations, and direct student collaboration requests.
- Group academic-year eligibility and a maximum group size of 15, including the owner.
- Group messaging with persisted messages and file attachments.
- Group tasks and progress tracking.
- Portfolios, skills, and assessment evidence.
- Profile and group pictures, notification preferences, in-app notifications, and account settings.
- A guided platform tour in the student workspace.

## Technology stack

| Area | Technologies |
| --- | --- |
| Frontend | React 19, React Router 7, Vite 8, Axios, Socket.IO Client, Tailwind CSS 4 and CSS |
| Backend | Node.js (ES modules), Express 5, Socket.IO, `pg`, Zod |
| Authentication and security | `express-session`, `connect-pg-simple`, bcrypt, CSRF middleware, Helmet, CORS, and rate limiting |
| Email | Nodemailer configured for Gmail |
| Database | PostgreSQL |

## Prerequisites

- Git.
- Node.js and npm. Node.js 24 is recommended: the server scripts use `--use-system-ca`, and Vite 8 requires Node.js 20.19+ or 22.12+.
- PostgreSQL 13 or later, including the `psql` command-line client. The schema uses PostgreSQL's `gen_random_uuid()` function.

## Clone the repository

```powershell
git clone https://github.com/Blessed-19592/EduMatch.git
Set-Location EduMatch
```

There is no root `package.json`; install and run the frontend and backend separately.

## Install dependencies

Run each install from its project directory:

```powershell
Set-Location client
npm ci
Set-Location ..\server
npm ci
Set-Location ..
```

If PowerShell blocks the `npm` script due to its execution policy, use `npm.cmd` in place of `npm` (for example, `npm.cmd ci`). Do not change the machine's execution policy just for this project.

## Create a PostgreSQL database

Create a database and an application role using your local PostgreSQL administrator account. Replace the placeholders with values you choose; the application role should own the database so it can create the session table on startup.

```powershell
psql -U postgres
```

At the `psql` prompt:

```sql
CREATE ROLE edumatch_app LOGIN PASSWORD '<DB_PASSWORD>';
CREATE DATABASE edumatch OWNER edumatch_app;
\q
```

The database connection settings used by the backend are supplied in `server/.env` below. The server also creates its `user_sessions` table automatically when it starts.

## Configure environment variables

No `.env.example` files are currently included. Create the following local files yourself. Use placeholders only in shared documentation; never commit real passwords, app passwords, or session secrets.

### `server/.env`

```dotenv
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:5173

DB_HOST=localhost
DB_PORT=5432
DB_NAME=<DB_NAME>
DB_USER=<DB_USER>
DB_PASSWORD=<DB_PASSWORD>

SESSION_SECRET=<RANDOM_SECRET_AT_LEAST_32_BYTES>

# Required for verification and password-reset emails to send successfully.
EMAIL_USER=<PROJECT_GMAIL_ADDRESS>
EMAIL_APP_PASSWORD=<GMAIL_APP_PASSWORD>
```

`CLIENT_URL`, `SESSION_SECRET`, and all `DB_*` values are required at startup. `SESSION_SECRET` must be at least 32 bytes. `PORT` defaults to `5000` if omitted. The email variables are not required to start the server, but email-dependent registration and password-recovery flows need valid Gmail credentials.

For local development, keep `CLIENT_URL` aligned with the frontend origin. If you change Vite's port or access the frontend through a different origin, update this value accordingly.

### `client/.env` (optional)

The Socket.IO client uses port `5000` by default during Vite development. Set this variable when the backend socket server uses a different URL:

```dotenv
VITE_SOCKET_URL=http://localhost:5000
```

## Apply database migrations and seed data

The repository does not include an automated migration command or migration-history runner. For a **new, empty database**, run every migration once, in this order, from the repository root. `psql` prompts for the database role's password if needed.

The two files prefixed `016` are independent of one another; both must be applied before the notification migration (`018`).

```powershell
$DbHost = "localhost"
$DbPort = "5432"
$DbName = "<DB_NAME>"
$DbUser = "<DB_USER>"

$migrations = @(
  "001_initial_schema.sql",
  "002_academic_structure.sql",
  "003_registry_verification_email.sql",
  "004_email_verification.sql",
  "005_registration_tokens.sql",
  "006_user_registration_number.sql",
  "007_password_reset.sql",
  "008_collaboration_and_assessment.sql",
  "009_student_collaboration_profiles.sql",
  "010_integrity_and_concurrency.sql",
  "011_group_objectives_and_expectations.sql",
  "012_protect_assessment_evidence_ownership.sql",
  "013_unique_self_reported_assessments.sql",
  "014_collaboration_intentions_and_group_capacity.sql",
  "015_group_year_eligibility.sql",
  "016_group_invitations.sql",
  "016_student_collaboration_requests.sql",
  "017_chat_message_attachments.sql",
  "018_user_settings_and_notifications.sql",
  "019_profile_and_group_pictures.sql"
)

foreach ($migration in $migrations) {
  & psql -h $DbHost -p $DbPort -U $DbUser -d $DbName `
    -v ON_ERROR_STOP=1 `
    -f ".\server\database\migrations\$migration"
  if ($LASTEXITCODE -ne 0) {
    throw "Migration failed: $migration"
  }
}
```

After all migrations succeed, seed the academic catalogue first, then the demonstration registry records:

```powershell
& psql -h $DbHost -p $DbPort -U $DbUser -d $DbName `
  -v ON_ERROR_STOP=1 `
  -f ".\server\database\seeds\001_academic_data.sql"
if ($LASTEXITCODE -ne 0) { throw "Academic data seed failed." }

& psql -h $DbHost -p $DbPort -U $DbUser -d $DbName `
  -v ON_ERROR_STOP=1 `
  -f ".\server\database\seeds\002_registry_students.sql"
if ($LASTEXITCODE -ne 0) { throw "Registry data seed failed." }
```

The registry seed is demonstration data, not a feed from the University's systems. These SQL migrations are intended to build a fresh database in order; do not rerun them against an already migrated database.

## Run the application

Start the backend and frontend in separate terminals, from the repository root.

**Terminal 1 — backend**

```powershell
Set-Location server
npm run dev
```

The backend listens on port `5000` by default. Check `http://localhost:5000/api/health` for the API health response.

**Terminal 2 — frontend**

```powershell
Set-Location client
npm run dev
```

Open the Vite URL shown in the terminal (normally `http://localhost:5173`). Vite proxies `/api` requests to `http://localhost:5000`.

The backend also provides `npm start` for a non-watch run. The frontend scripts include `npm run build`, `npm run preview`, and `npm run lint`. Backend tests use Node's test runner: run `npm test` from `server`.

## Project structure

```text
EduMatch/
├── client/
│   ├── src/
│   │   ├── api/                 # Axios API and CSRF handling
│   │   ├── components/          # Shared UI components
│   │   ├── context/             # Authentication context
│   │   ├── pages/auth/          # Registration, login, and password flows
│   │   ├── pages/student/       # Student workspace pages
│   │   └── routes/              # Protected frontend routes
│   ├── package.json
│   └── vite.config.js
└── server/
    ├── database/
    │   ├── migrations/          # Ordered PostgreSQL schema changes
    │   └── seeds/               # Academic catalogue and demo registry data
    ├── src/
    │   ├── config/              # PostgreSQL and allowed-origin configuration
    │   ├── middleware/          # Authentication, authorization, CSRF, validation
    │   ├── routes/              # Express API route modules
    │   ├── services/            # Business logic and database operations
    │   ├── sockets/             # Socket.IO setup
    │   └── utils/               # Shared server utilities
    ├── storage/                 # Local uploaded files (not committed)
    ├── test/                    # Node.js tests
    └── package.json
```

The PostgreSQL schema covers accounts and student profiles; academic registry data; skills, interests, and portfolios; groups, membership, invitations, and collaboration requests; chat and attachments; tasks; notifications; and settings. Foreign keys, constraints, indexes, and database triggers support data integrity and group operations.

## Current limitations

- The Admin route authenticates an admin account but displays a “coming soon” page; a functional administrator workspace and dedicated admin APIs are not implemented.
- No admin account bootstrap or seed procedure is included; the public registration flow creates student accounts.
- Profile review status is represented in the database, and matching/public student visibility require approval. However, the current student profile page has no submit-for-review action and there is no implemented admin review flow. As a result, recommendations may be empty until an approved profile exists.
- Student registration checks against the locally seeded registry. There is no live university registry integration or automated registry-data refresh.
- Email is configured for Gmail through `EMAIL_USER` and `EMAIL_APP_PASSWORD`; another provider is not configurable through the current implementation.
- Uploaded pictures and chat attachments are stored locally under `server/storage/`. They are not shared across separate developer machines or persisted by a remote object-storage service.

## Troubleshooting

- **Backend exits with a missing environment-variable error:** Check that `server/.env` exists and has all required values, especially `CLIENT_URL`, `SESSION_SECRET`, and `DB_*`.
- **Invalid `SESSION_SECRET` error:** Use a secret containing at least 32 bytes.
- **Database connection fails:** Confirm PostgreSQL is running, the database and role exist, and the `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, and `DB_PASSWORD` values match your local setup. The configured database role needs permission to create the session table.
- **`gen_random_uuid()` is missing:** Use PostgreSQL 13 or later.
- **Registration or password-reset email does not arrive:** Configure valid Gmail credentials in `server/.env`. Check that the account is permitted to send mail with its app password.
- **The frontend cannot reach the API:** Run the backend on port `5000`, keep the frontend on port `5173`, and ensure `CLIENT_URL` matches the frontend origin.
- **Socket.IO cannot connect:** Check that the backend is running and that `VITE_SOCKET_URL`, if set, points to its socket server. Restart Vite after changing `client/.env`.
- **PowerShell reports that `npm` scripts are disabled:** Invoke `npm.cmd` instead, for example `npm.cmd run dev`.
- **Find Students shows no recommendations:** Matching only returns eligible, discoverable profiles that have been approved; see the profile-review limitation above.
