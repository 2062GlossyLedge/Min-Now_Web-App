# Min-Now Web App - Local Development Setup Guide

A full-stack web application with a Django backend and Next.js frontend for managing minimal inventory across multiple locations.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Backend Setup](#backend-setup)
- [Frontend Setup](#frontend-setup)
- [Running the Application](#running-the-application)
- [Environment Configuration](#environment-configuration)
- [Database Setup](#database-setup)
- [Common Commands](#common-commands)
- [Troubleshooting](#troubleshooting)

---

## Prerequisites

Before you begin, ensure you have the following installed on your machine:

- **Python 3.9+** - [Download Python](https://www.python.org/downloads/)
- **Node.js 18+** - [Download Node.js](https://nodejs.org/)
- **PostgreSQL 12+** - [Download PostgreSQL](https://www.postgresql.org/download/)
- **Git** - [Download Git](https://git-scm.com/)
- **pip** (comes with Python) and **npm** (comes with Node.js)

### Verify Installations

```bash
python --version
node --version
npm --version
psql --version
```

---

## Backend Setup

### 1. Navigate to Backend Directory

```bash
cd backend
```

### 2. Create a Python Virtual Environment

```bash
# Create virtual environment
python -m venv .venv

# Activate virtual environment
# On Windows:
.venv\Scripts\activate

# On macOS/Linux:
source .venv/bin/activate
```

### 3. Install Python Dependencies

Ensure the virtual environment is activated, then run:

```bash
pip install -r requirements.txt
```

### 4. Configure Environment Variables

Create a `.env` file in the `backend/` directory with the following variables:

```env
# Django Settings
PROD=False
DEBUG=True
django_secret_key=your-secret-key-here-change-in-production
ROOT_URLCONF=minNow.urls

# Database Configuration
PGDATABASE=minnow_dev
PGUSER=postgres
PGPASSWORD=your_db_password
PGHOST=localhost
PGPORT=5432

# Email Configuration (Optional for dev)
MAILERSEND_SMTP_USERNAME=your_email@example.com

# API Keys (Add as needed)
CLERK_SECRET_KEY=your_clerk_key_here
```

> **Note:** For local development with PostgreSQL, ensure the database `minnow_dev` is created and the credentials match your local PostgreSQL setup.

### 5. Set Up the Database

```bash
# Run migrations
python manage.py migrate

# Create a superuser for Django admin (optional)
python manage.py createsuperuser
```

### 6. Start the Backend Server

```bash
# Run the development server (default: http://localhost:8000)
python manage.py runserver

# Or specify a different port:
python manage.py runserver 0.0.0.0:8000
```

The backend API will be available at `http://localhost:8000/api/`

---

## Frontend Setup

### 1. Navigate to Frontend Directory

```bash
cd frontend
```

### 2. Install Node Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

Create a `.env.local` file in the `frontend/` directory with:

```env
# Backend API URL
NEXT_PUBLIC_API_URL=http://localhost:8000

# Clerk Authentication (if applicable)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
CLERK_SECRET_KEY=your_clerk_secret_key
```

### 4. Start the Frontend Development Server

```bash
# Run with turbopack (faster)
npm run dev

# Frontend will be available at http://localhost:3000
```

---


## Database Setup

### Create PostgreSQL Database Locally

```bash
# Connect to PostgreSQL
psql -U postgres

# Create the development database
CREATE DATABASE minnow_dev;

# Exit psql
\q
```

### Run Database Migrations

```bash
cd backend
python manage.py migrate
```

### (Optional) Load Sample Data

If sample data fixtures exist:

```bash
python manage.py loaddata fixture_name
```

---

## Common Commands

### Backend Commands

```bash
# Run development server
python manage.py runserver

# Run migrations
python manage.py migrate

# Create new migration
python manage.py makemigrations

# Run tests
python manage.py test
pytest

# Run specific test
pytest items/tests.py -v

# Access Django shell
python manage.py shell

# Create superuser
python manage.py createsuperuser

# Collect static files
python manage.py collectstatic
```

### Frontend Commands

```bash
# Development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run linting
npm run lint

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Run unit tests with coverage
npm run test:coverage

# Run end-to-end tests (Playwright)
npm run test:e2e

# Run E2E tests with UI
npm run test:e2e:ui
```

---

