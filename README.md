# Koko Backend Server

This is the backend server for the Koko application. It provides the API endpoints and database functionality.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Set up your environment variables:
- Copy `.env.example` to `.env` (if not already present)
- Update the environment variables with your configuration

3. Set up the database:
```bash
npx prisma generate
npx prisma db push
```

## Running the Server

Development mode:
```bash
npm run dev
```

Production build:
```bash
npm run build
npm start
```

## API Documentation

The API documentation will be available at `/api-docs` when the server is running. 