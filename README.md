# Athenaeum — Library Management System

A production-deployed full-stack library management platform built around **transactional correctness, concurrency control, secure authentication, realtime synchronization, background processing, and production deployment**.

## Live Application

**Live Demo:**  
https://athenaeum-library-management-system.abhinavprasad286.workers.dev

> The backend runs on Render's free tier, so the first request after a period of inactivity may take a short time while the service starts.

---

## Engineering Highlights

Athenaeum goes beyond standard CRUD operations and handles several backend and distributed-system concerns found in production applications.

### Transaction & Concurrency Safety

- Transaction-safe checkout, return, renewal, reservation, and membership workflows
- Database row locking for operations that depend on concurrent state
- Serialized concurrent checkouts to enforce borrowing limits
- Concurrent renewal protection at renewal boundaries
- Reservation and renewal synchronization
- Reservation queue processing after book returns
- Transaction-safe authentication operations
- Realtime events emitted only after successful database commits

### Secure Session Management

- Short-lived JWT access tokens
- Rotating refresh tokens stored as cryptographic hashes
- Refresh-token reuse detection
- Session revocation after suspicious token reuse
- Encrypted refresh-rotation recovery window
- Recovery across rapid rotation chains such as `A → B → C`
- Protection against rapid browser-refresh authentication races
- Password changes and resets revoke active refresh sessions
- Explicit JWT algorithm validation
- Separate access and refresh secrets

### Realtime Architecture

- Authenticated Socket.IO connections
- User-specific, staff, and authenticated socket rooms
- Persistent user notifications
- Separate `notification` and `data_changed` event channels
- Resource-based realtime invalidation
- Live synchronization of loans, reservations, fines, books, inventory, users, reports, and profile data

### Background Processing

- BullMQ-based asynchronous email processing
- Redis/Valkey-backed job queues
- Scheduled overdue detection
- Due-soon reminders
- Automatic reservation-hold expiration
- Periodic maintenance sweeps
- Graceful HTTP server, worker, queue, Redis, Socket.IO, and database shutdown

### Security Hardening

- Role-based authorization
- Suspended-member enforcement
- bcrypt password hashing
- Refresh-token hashing
- Account login-attempt protection
- API rate limiting
- Helmet security headers
- Zod request validation
- Request body limits
- Audit logging
- Razorpay signature verification
- CSV formula-injection protection
- TLS database connectivity in production

### Reliability & Testing

- Integration testing with Jest and Supertest
- MySQL-backed test environment
- Redis-backed test environment
- Authentication and authorization regression tests
- Borrowing-rule regression tests
- Concurrency regression tests
- Refresh-token rotation and reuse tests
- GitHub Actions CI
- Automated backend linting
- Automated backend test execution
- Automated frontend production builds

### Production Architecture

```text
                         Browser
                            │
                            ▼
                Cloudflare Worker + React
                            │
                  REST API / Socket.IO
                            │
                            ▼
                    Node.js + Express
                            │
             ┌──────────────┼──────────────┐
             │              │              │
             ▼              ▼              ▼
        Aiven MySQL    Aiven Valkey     Socket.IO
                            │
                            ▼
                         BullMQ
                            │
                            ▼
                      Email Worker
                            │
                            ▼
                          Brevo
```

**Production stack:** Cloudflare Workers + Render + Aiven MySQL + Aiven Valkey

---

## Features

### Authentication & Account Security

- User registration and login
- Email verification
- Verification-email resend flow
- Password reset
- Password change
- JWT authentication
- Refresh-token rotation
- Refresh-token reuse detection
- Membership-status enforcement
- Role-based access control
- Session revocation

### Catalog & Inventory

- Browse library catalog
- Search books
- Book details
- Availability tracking
- Administrative book management
- Physical copy management
- Barcode-based inventory

Physical copies can be tracked through states including:

- Available
- Borrowed
- Reserved
- Damaged
- Under repair
- Lost

### Circulation

- Staff circulation desk
- Book checkout
- Book return
- Member loan tracking
- Loan history
- Loan renewal
- Renewal limits
- Due-date enforcement
- Overdue detection
- Inventory synchronization

### Reservations

- Book reservation queue
- Waiting-list management
- Ready-for-pickup holds
- Reservation cancellation
- Hold expiration
- Automatic reservation processing after returns
- Concurrency-aware reservation operations

### Fine Management

- Fine creation
- Pending fine tracking
- Paid fine history
- Fine waiving
- Member fine visibility
- Staff fine management
- Razorpay payment integration
- Payment signature verification

### Member Management

Staff can:

- Search members
- View member profiles
- Review circulation activity
- View active loans
- View overdue loans
- View reservation activity
- View pending fine balance
- Activate memberships
- Suspend memberships
- Mark memberships as expired

### Staff Operations

Dedicated staff interfaces are available for:

- Circulation
- Loans
- Reservations
- Fines
- Members
- Books
- Book copies
- Reports

### Realtime Updates

Socket.IO keeps important application data synchronized without requiring manual page refreshes.

Realtime invalidation is supported for:

- Loans
- Reservations
- Fines
- Books
- Inventory
- Users
- Reports
- User profile data

Human-facing notifications are separated from application data-change events.

### Notifications

Persistent notifications are supported for events including:

- Book checkout
- Upcoming due dates
- Overdue books
- Reservation readiness
- Fine issuance

Notification state is synchronized in realtime.

### Reports

Administrative reporting includes:

- Library summary
- Circulation activity
- Inventory health
- Most borrowed books
- Overdue loans
- Fine revenue
- CSV report exports

---

## Technology Stack

### Frontend

- React
- Vite
- React Router
- Axios
- Tailwind CSS
- Socket.IO Client

### Backend

- Node.js
- Express.js
- Sequelize ORM
- MySQL
- Redis / Valkey
- BullMQ
- Socket.IO
- JSON Web Tokens
- bcrypt
- Zod
- Helmet
- Winston
- node-cron

### External Services

- Razorpay
- Brevo
- Aiven
- Render
- Cloudflare Workers

### Testing & Development

- Jest
- Supertest
- ESLint
- Sequelize CLI
- GitHub Actions

---

## System Architecture

```text
┌──────────────────────────────────────────────────────────────┐
│                         Browser                              │
│                                                              │
│                     React Application                        │
└────────────────────────────┬─────────────────────────────────┘
                             │
                             │ HTTPS
                             ▼
┌──────────────────────────────────────────────────────────────┐
│                    Cloudflare Worker                         │
│                                                              │
│            Static Assets + Same-Origin Proxy                 │
└────────────────────────────┬─────────────────────────────────┘
                             │
                 REST API + Socket.IO
                             │
                             ▼
┌──────────────────────────────────────────────────────────────┐
│                   Node.js / Express API                      │
│                                                              │
│  Authentication │ Catalog │ Circulation │ Reservations       │
│  Fines          │ Members │ Reports     │ Notifications      │
└───────────┬───────────────────┬───────────────────┬──────────┘
            │                   │                   │
            ▼                   ▼                   ▼
     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
     │ Aiven MySQL │     │Aiven Valkey │     │  Socket.IO  │
     └─────────────┘     └──────┬──────┘     └─────────────┘
                                │
                                ▼
                         ┌─────────────┐
                         │   BullMQ    │
                         └──────┬──────┘
                                │
                                ▼
                         ┌─────────────┐
                         │Email Worker │
                         └──────┬──────┘
                                │
                                ▼
                         ┌─────────────┐
                         │    Brevo    │
                         └─────────────┘
```

---

## Authentication Architecture

Athenaeum uses short-lived access tokens together with rotating refresh tokens.

Refresh tokens are stored as cryptographic hashes instead of plaintext values.

### Normal Rotation

```text
Refresh Token A
      │
      ▼
    Refresh
      │
      ├── A revoked
      │
      ▼
Refresh Token B
```

A used refresh token cannot normally be used again.

### Rapid-Refresh Recovery

Modern browsers can generate overlapping refresh requests during rapid reloads.

Athenaeum uses a short encrypted recovery window to distinguish legitimate overlapping requests from later token reuse.

```text
A → B → C

Stale request presents A
        │
        ▼
Validate recovery window
        │
        ▼
Follow replacement chain
        │
        ▼
Recover latest active C
```

The replacement refresh token is temporarily stored in encrypted form for recovery while the normal persistent token representation remains hashed.

Outside the recovery window, reuse of a rotated refresh token triggers reuse protection and revocation of active refresh sessions for that account.

---

## Transaction & Concurrency Design

Operations involving shared state use Sequelize transactions and row-level locking where correctness depends on concurrent activity.

### Checkout

Checkout operations protect against concurrent requests causing a member to exceed borrowing limits.

```text
Checkout Request
       │
       ▼
Begin Transaction
       │
       ▼
Lock Required Records
       │
       ▼
Validate Member + Loan Rules
       │
       ▼
Update Book Copy
       │
       ▼
Create Borrow Record
       │
       ▼
Commit
       │
       ▼
Emit Realtime Update
```

### Renewal

Renewal operations serialize access to the relevant loan and protect renewal-count boundaries.

They also check reservation state before allowing the renewal.

### Reservations

Reservation operations coordinate:

- Waiting queues
- Ready holds
- Book availability
- Returns
- Renewal eligibility

### Authentication

Transactions are also used for operations such as:

- Refresh-token rotation
- Login-attempt updates
- Password changes
- Password resets
- Email verification

Realtime events dependent on database changes are emitted after successful transaction commits.

---

## Realtime Architecture

Socket.IO connections are authenticated and organized into targeted rooms.

```text
Authenticated Connection
          │
          ▼
       Socket.IO
          │
          ├── user:<id>
          │
          ├── staff
          │
          └── authenticated
```

Athenaeum separates two types of realtime events.

### `notification`

Used for messages intended to be shown to a user.

### `data_changed`

Used to tell connected clients that application resources have changed.

Examples include:

```text
loans
fines
reservations
books
inventory
users
reports
profile
```

The frontend coalesces data-change events and refreshes the relevant state.

---

## Background Jobs

The application performs periodic maintenance using `node-cron`.

```text
Maintenance Sweep
       │
       ├── Detect overdue loans
       │
       ├── Expire stale reservation holds
       │
       └── Send due-soon reminders
```

Email delivery is processed asynchronously.

```text
Application
     │
     ▼
BullMQ Queue
     │
     ▼
Email Worker
     │
     ▼
Brevo
```

Redis/Valkey provides the queue infrastructure.

---

## Project Structure

```text
Athenaeum-Library-Management-System/
│
├── client/
│   └── src/
│       ├── api/
│       ├── components/
│       ├── features/
│       ├── pages/
│       ├── routes/
│       ├── App.jsx
│       ├── main.jsx
│       └── worker.js
│
├── server/
│   ├── src/
│   │   ├── config/
│   │   ├── database/
│   │   │   ├── migrations/
│   │   │   └── models/
│   │   ├── docs/
│   │   ├── jobs/
│   │   │   ├── queues/
│   │   │   └── workers/
│   │   ├── middlewares/
│   │   ├── modules/
│   │   │   ├── audit/
│   │   │   ├── auth/
│   │   │   ├── books/
│   │   │   ├── borrow/
│   │   │   ├── fines/
│   │   │   ├── members/
│   │   │   ├── notifications/
│   │   │   ├── reports/
│   │   │   ├── reservations/
│   │   │   └── users/
│   │   ├── routes/
│   │   ├── sockets/
│   │   ├── utils/
│   │   ├── app.js
│   │   └── server.js
│   │
│   └── tests/
│
└── .github/
    └── workflows/
        └── ci.yml
```

---

## API

The REST API is versioned under:

```text
/api/v1
```

| Module | Endpoint |
|---|---|
| Authentication | `/api/v1/auth` |
| Books | `/api/v1/books` |
| Borrowing | `/api/v1/borrow` |
| Reservations | `/api/v1/reservations` |
| Fines | `/api/v1/fines` |
| Reports | `/api/v1/reports` |
| Notifications | `/api/v1/notifications` |
| Audit | `/api/v1/audit` |
| Users | `/api/v1/users` |
| Members | `/api/v1/members` |

### Health Check

```text
/health
```

### API Documentation

Swagger UI:

```text
/api-docs
```

Raw OpenAPI specification:

```text
/api-docs.json
```

---

## Security

Security measures implemented in the project include:

- bcrypt password hashing
- JWT signature verification
- Explicit JWT algorithms
- Separate access and refresh secrets
- Refresh-token hashing
- Refresh-token rotation
- Refresh-token reuse detection
- Encrypted rotation recovery
- Role-based authorization
- Account suspension enforcement
- Login-attempt protection
- API rate limiting
- Helmet HTTP security headers
- Input validation
- Request body size limits
- Razorpay payment signature verification
- Audit logging
- CSV formula-injection protection
- TLS database connectivity in production

---

## Local Development

### Requirements

Install:

- Node.js
- npm
- MySQL
- Redis

### Clone

```bash
git clone https://github.com/Abhinav2955/Athenaeum-Library-Management-System.git

cd Athenaeum-Library-Management-System
```

### Backend

```bash
cd server
npm install
```

Configure the required environment variables for:

- MySQL
- Redis
- JWT secrets
- Frontend origin
- Email provider
- Razorpay

Run database migrations:

```bash
npx sequelize-cli db:migrate
```

Start the backend:

```bash
npm run dev
```

### Frontend

Open another terminal:

```bash
cd client
npm install
npm run dev
```

Vite will display the local frontend development URL.

---

## Testing

### Backend Test Suite

```bash
cd server
npm test
```

### Backend Lint

```bash
npm run lint
```

### Frontend Production Build

```bash
cd client
npm run build
```

### Frontend Lint

```bash
npm run lint
```

---

## Continuous Integration

GitHub Actions runs on pushes and pull requests targeting `main`.

### Backend CI

```text
Checkout
   │
   ▼
Node.js 20
   │
   ├── MySQL 8
   └── Redis
   │
   ▼
npm ci
   │
   ▼
ESLint
   │
   ▼
Jest Integration Tests
```

### Frontend CI

```text
Checkout
   │
   ▼
Node.js 20
   │
   ▼
npm ci
   │
   ▼
Vite Production Build
```

---

## Production Deployment

```text
                       Production
                           │
             ┌─────────────┴─────────────┐
             │                           │
             ▼                           ▼
    Cloudflare Workers                 Render
     React + Proxy                   Express API
                                           │
                               ┌───────────┴───────────┐
                               │                       │
                               ▼                       ▼
                          Aiven MySQL             Aiven Valkey
```

The Cloudflare Worker serves the frontend and proxies API and Socket.IO traffic to the backend.

This provides the browser with a same-origin production interface while the backend remains independently deployed.

---

## Continuous Improvement

Potential future extensions include:

- Database-backed idempotency for scheduled reminder generation
- Payment-order idempotency for highly concurrent payment requests
- Expanded frontend automated testing
- Production metrics and observability
- Advanced catalog filtering and full-text search
- More granular administrative permissions

---

## Author

**Abhinav Prasad**

GitHub:  
https://github.com/Abhinav2955

Project Repository:  
https://github.com/Abhinav2955/Athenaeum-Library-Management-System

**Live Application:**  
https://athenaeum-library-management-system.abhinavprasad286.workers.dev