# Token Worker Authorization System

This is a Cloudflare Worker project that provides a lightweight, extremely fast UUID/License verification system, powered by Cloudflare D1 (Serverless SQLite).

## Features

- ⚡️ **High Performance**: Runs on Cloudflare's Edge network globally.
- 🗄️ **Cloudflare D1**: Uses serverless SQLite for storing and validating UUIDs.
- 🕒 **Dynamic Expiration & Usage Limits**: Supports custom quotas per UUID (e.g., limits per day, lifetime constraints).
- 🛡️ **Admin API**: Protected routes to quickly generate, add, and delete UUIDs.

## Project Structure

- `worker.js`: The main Cloudflare Worker script.
- `schema.sql`: The D1 database schema to create the necessary tables.
- `wrangler.toml`: Cloudflare configuration file.

## Prerequisites

- [Node.js](https://nodejs.org/) installed
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/) installed globally or via npx
- A Cloudflare account

## Setup & Deployment

### 1. Install Dependencies

```bash
npm install
```

### 2. Create D1 Database

Run the following command to create a D1 database on your Cloudflare account (requires logging in if you haven't already):

```bash
npm run db:create
```

This will output a `database_name` and `database_id`. Open `wrangler.toml` and update the `database_id` field with the ID provided in the console.

### 3. Initialize the Database

Apply the schema to your D1 database:

**For local development:**
```bash
npm run db:init:local
```

**For remote production:**
```bash
npm run db:init:remote
```

### 4. Configure Secrets

You must configure an `ADMIN_SECRET` used to authenticate requests to the `/admin/*` routes.

```bash
npx wrangler secret put ADMIN_SECRET
```
*(Enter your chosen secret key when prompted)*

### 5. Run Locally

You can test the worker locally:

```bash
npm run dev
```

### 6. Deploy to Cloudflare

Deploy your worker live to Cloudflare's Edge:

```bash
npm run deploy
```

## API Reference

### 1. Verify a UUID
- **Path:** `/verify?uuid={your-uuid}`
- **Method:** `GET`
- **Description:** Verifies the UUID, checks daily limits, and registers the usage.

### 2. Admin: Generate Multiple UUIDs
- **Path:** `/admin/generate`
- **Method:** `POST`
- **Headers:** `x-admin-key: {YOUR_ADMIN_SECRET}`
- **Description:** Bulk generates test UUIDs.

### 3. Admin: Add a Single UUID
- **Path:** `/admin/add`
- **Method:** `POST`
- **Headers:** `x-admin-key: {YOUR_ADMIN_SECRET}`
- **Description:** Adds a new random UUID.

### 4. Admin: Delete a UUID
- **Path:** `/admin/delete?uuid={your-uuid}`
- **Method:** `POST`
- **Headers:** `x-admin-key: {YOUR_ADMIN_SECRET}`
- **Description:** Deletes a specific UUID from the database.

## License

This project is licensed under the MIT License.
