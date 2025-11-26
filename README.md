# Prism DealFlow

A simple, colorful CRM for tracking deals and relationships.

## Features

- **Visual Pipeline**: Color-coded stages and priorities.
- **Deal Context**: Rich notes, next actions, and probability weighting.
- **Instant Stats**: Sticky footer showing nominal vs weighted pipeline value.
- **Demo Mode**: Works instantly in the browser using LocalStorage.

## Getting Started

### 1. Frontend Only (Demo Mode)

The project is configured to use `localStorage` by default so you can run it immediately without a backend.

1. `npm install`
2. `npm run dev`

### 2. Full Stack Setup (Optional)

If you want to use the persistent SQLite database:

1. **Configure Service**:
   Open `services/dealService.ts` and change:
   ```typescript
   const USE_LOCAL_STORAGE = false;
   ```

2. **Setup Backend**:
   - `npm install express @prisma/client cors`
   - `npm install -D prisma ts-node @types/express @types/cors`
   - Initialize DB: `npx prisma migrate dev --name init`

3. **Run Server**:
   - `npx ts-node server/index.ts`

4. **Run Frontend**:
   - In a separate terminal: `npm run dev`
   - Ensure `vite.config.ts` proxies `/api` to `http://localhost:3001` or configure CORS accordingly.

## Structure

- `src/components`: UI Components (Cards, Forms, Stats).
- `src/services`: Data fetching logic (abstracted to support Mock/Real).
- `prisma`: Database schema.
- `server`: Express API endpoints.

## Version Control (GitHub)

To push this project to GitHub:

1.  Initialize git:
    ```bash
    git init
    ```

2.  Add files (the `.gitignore` file will exclude `node_modules` and database files):
    ```bash
    git add .
    ```

3.  Commit your changes:
    ```bash
    git commit -m "Initial commit of Prism DealFlow"
    ```

4.  Add your remote repository:
    ```bash
    git remote add origin https://github.com/jgabriele321/SimpleCRM.git
    ```

5.  Push to main:
    ```bash
    git branch -M main
    git push -u origin main
    ```
