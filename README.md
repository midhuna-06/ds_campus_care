# CampusCare — Smart Campus Complaint Management

CampusCare is a MERN application for students to register, sign in, and manage campus complaints. The React client uses an Express API, MongoDB stores accounts and complaints, and every complaint is scoped to its owner.

## Requirements

- Node.js 20.19 or newer
- npm 9 or newer
- MongoDB locally or a MongoDB Atlas connection URI

## Configure MongoDB and the API

1. Copy `server/.env.example` to `server/.env`.
2. Set `MONGODB_URI` to your local MongoDB URI or Atlas connection string.
3. Replace `JWT_SECRET` with a private, random secret of at least 32 characters. For example, generate one with `node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"`.
4. Set `CLIENT_ORIGIN` to the browser origin where the client runs (default `http://localhost:5173`).

Do not commit `server/.env` or share your database credentials. For MongoDB Atlas, create a database user and allow the development machine's IP in Atlas Network Access.

## Run locally

From the project root:

```powershell
npm install
npm run dev
```

Open the Vite URL, usually `http://localhost:5173`. The API listens on port `5000` and Vite proxies `/api` requests to it. MongoDB must be reachable before the API starts.

For production, build the client with `npm run build` and serve the client and API over HTTPS. Set `NODE_ENV=production`, use a strong JWT secret, and configure `CLIENT_ORIGIN` for the deployed client. The session cookie is HTTP-only, same-site, and secure in production.

## Accounts and privacy

- Create an account with a name, email, and password of at least 8 characters.
- Passwords are hashed with bcrypt; the browser never receives password hashes or session tokens.
- Sign-in state is held in an HTTP-only cookie and expires after seven days.
- Complaint list, view, update, and delete operations require a valid session and are restricted to the signed-in student's records.

## Complaint operations

- Create complaints with a title, description, and category: Hostel, Food, Transport, Infrastructure, or Other.
- View details and status progress.
- Edit the title, category, description, and status: Pending, In Progress, or Resolved.
- Delete complaints after confirming the action.
