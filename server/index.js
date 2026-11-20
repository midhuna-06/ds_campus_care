import bcrypt from "bcryptjs";
import cookieParser from "cookie-parser";
import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import rateLimit from "express-rate-limit";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

dotenv.config({ path: resolve(dirname(fileURLToPath(import.meta.url)), ".env") });

const app = express();
const port = process.env.PORT || 5000;
const mongoUri = process.env.MONGODB_URI;
const jwtSecret = process.env.JWT_SECRET;
const allowedOrigins = (process.env.CLIENT_ORIGIN || "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim());
const cookieName = "campuscare_session";
const cookieMaxAge = 7 * 24 * 60 * 60 * 1000;
const categories = ["Hostel", "Food", "Transport", "Infrastructure", "Other"];
const statuses = ["Pending", "In Progress", "Resolved"];

if (!mongoUri) {
  throw new Error("MONGODB_URI is required. Set it in server/.env before starting the API.");
}
if (!jwtSecret || jwtSecret.length < 32) {
  throw new Error("JWT_SECRET must be set to a random value at least 32 characters long.");
}

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 60 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
  },
  { timestamps: true },
);

const complaintSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 100 },
    description: { type: String, required: true, trim: true, maxlength: 2000 },
    category: { type: String, required: true, enum: categories },
    status: { type: String, required: true, enum: statuses, default: "Pending" },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  },
  { timestamps: true },
);

const User = mongoose.model("User", userSchema);
const Complaint = mongoose.model("Complaint", complaintSchema);

app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json({ limit: "20kb" }));
app.use(cookieParser());

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { message: "Too many sign-in attempts. Please try again in 15 minutes." },
});

function publicUser(user) {
  return { id: user.id, name: user.name, email: user.email };
}

function setSessionCookie(response, userId) {
  const token = jwt.sign({ sub: userId }, jwtSecret, { expiresIn: "7d" });
  response.cookie(cookieName, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: cookieMaxAge,
    path: "/api",
  });
}

function clearSessionCookie(response) {
  response.clearCookie(cookieName, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/api",
  });
}

async function requireAuth(request, response, next) {
  const token = request.cookies[cookieName];
  if (!token) {
    return response.status(401).json({ message: "Please sign in to continue." });
  }

  try {
    const payload = jwt.verify(token, jwtSecret);
    if (typeof payload === "string" || !payload.sub) {
      clearSessionCookie(response);
      return response.status(401).json({ message: "Your session has expired. Please sign in again." });
    }

    const user = await User.findById(payload.sub);
    if (!user) {
      clearSessionCookie(response);
      return response.status(401).json({ message: "Your session is no longer valid. Please sign in again." });
    }

    request.user = user;
    return next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError || error instanceof jwt.TokenExpiredError) {
      clearSessionCookie(response);
      return response.status(401).json({ message: "Your session has expired. Please sign in again." });
    }
    return next(error);
  }
}

function validateComplaint(body, { creating = false } = {}) {
  const errors = {};
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const description =
    typeof body.description === "string" ? body.description.trim() : "";

  if (!title) errors.title = "Please enter a title.";
  else if (title.length > 100) errors.title = "Title must be 100 characters or fewer.";

  if (!description) errors.description = "Please enter a description.";
  else if (description.length > 2000) {
    errors.description = "Description must be 2,000 characters or fewer.";
  }

  if (!categories.includes(body.category)) {
    errors.category = "Choose a valid category.";
  }

  if (!creating && !statuses.includes(body.status)) {
    errors.status = "Choose a valid status.";
  }

  return {
    errors,
    complaint: { title, description, category: body.category, status: body.status },
  };
}

app.post("/api/auth/register", authLimiter, async (request, response, next) => {
  try {
    const body = request.body ?? {};
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const errors = {};

    if (name.length < 2 || name.length > 60) errors.name = "Name must be between 2 and 60 characters.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
      errors.email = "Enter a valid email address.";
    }
    if (password.length < 8 || Buffer.byteLength(password, "utf8") > 72) {
      errors.password = "Password must be at least 8 characters and no more than 72 UTF-8 bytes.";
    }
    if (Object.keys(errors).length) {
      return response.status(400).json({ message: "Check the highlighted fields.", errors });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({ name, email, passwordHash });
    setSessionCookie(response, user.id);
    return response.status(201).json({ user: publicUser(user) });
  } catch (error) {
    if (error.code === 11000) {
      return response.status(409).json({ message: "An account with this email already exists." });
    }
    return next(error);
  }
});

app.post("/api/auth/login", authLimiter, async (request, response, next) => {
  try {
    const body = request.body ?? {};
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";
    if (!email || !password) {
      return response.status(400).json({ message: "Enter your email and password." });
    }
    if (Buffer.byteLength(password, "utf8") > 72) {
      return response.status(400).json({ message: "Password must be no more than 72 UTF-8 bytes." });
    }

    const user = await User.findOne({ email }).select("+passwordHash");
    const passwordMatches = user && await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatches) {
      return response.status(401).json({ message: "Email or password is incorrect." });
    }

    setSessionCookie(response, user.id);
    return response.json({ user: publicUser(user) });
  } catch (error) {
    return next(error);
  }
});

app.post("/api/auth/logout", (_request, response) => {
  clearSessionCookie(response);
  return response.status(204).end();
});

app.get("/api/auth/me", requireAuth, (request, response) => {
  response.json({ user: publicUser(request.user) });
});

app.get("/api/complaints", requireAuth, async (request, response, next) => {
  try {
    const complaints = await Complaint.find({ owner: request.user.id }).sort({ createdAt: -1 });
    return response.json(complaints.map((complaint) => ({
      id: complaint.id,
      title: complaint.title,
      description: complaint.description,
      category: complaint.category,
      status: complaint.status,
      createdAt: complaint.createdAt,
      updatedAt: complaint.updatedAt,
    })));
  } catch (error) {
    return next(error);
  }
});

app.post("/api/complaints", requireAuth, async (request, response, next) => {
  try {
    const { errors, complaint } = validateComplaint(request.body ?? {}, { creating: true });
    if (Object.keys(errors).length) {
      return response.status(400).json({ message: "Check the highlighted fields.", errors });
    }

    const created = await Complaint.create({
      ...complaint,
      status: "Pending",
      owner: request.user.id,
    });
    return response.status(201).json({
      id: created.id,
      title: created.title,
      description: created.description,
      category: created.category,
      status: created.status,
      createdAt: created.createdAt,
      updatedAt: created.updatedAt,
    });
  } catch (error) {
    return next(error);
  }
});

app.get("/api/complaints/:id", requireAuth, async (request, response, next) => {
  try {
    if (!mongoose.isValidObjectId(request.params.id)) {
      return response.status(404).json({ message: "Complaint not found." });
    }
    const complaint = await Complaint.findOne({ _id: request.params.id, owner: request.user.id });
    if (!complaint) {
      return response.status(404).json({ message: "Complaint not found." });
    }
    return response.json({
      id: complaint.id,
      title: complaint.title,
      description: complaint.description,
      category: complaint.category,
      status: complaint.status,
      createdAt: complaint.createdAt,
      updatedAt: complaint.updatedAt,
    });
  } catch (error) {
    return next(error);
  }
});

app.put("/api/complaints/:id", requireAuth, async (request, response, next) => {
  try {
    if (!mongoose.isValidObjectId(request.params.id)) {
      return response.status(404).json({ message: "Complaint not found." });
    }
    const { errors, complaint } = validateComplaint(request.body ?? {});
    if (Object.keys(errors).length) {
      return response.status(400).json({ message: "Check the highlighted fields.", errors });
    }

    const updated = await Complaint.findOneAndUpdate(
      { _id: request.params.id, owner: request.user.id },
      { $set: complaint },
      { new: true, runValidators: true },
    );
    if (!updated) {
      return response.status(404).json({ message: "Complaint not found." });
    }
    return response.json({
      id: updated.id,
      title: updated.title,
      description: updated.description,
      category: updated.category,
      status: updated.status,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    });
  } catch (error) {
    return next(error);
  }
});

app.delete("/api/complaints/:id", requireAuth, async (request, response, next) => {
  try {
    if (!mongoose.isValidObjectId(request.params.id)) {
      return response.status(404).json({ message: "Complaint not found." });
    }
    const deleted = await Complaint.findOneAndDelete({
      _id: request.params.id,
      owner: request.user.id,
    });
    if (!deleted) {
      return response.status(404).json({ message: "Complaint not found." });
    }
    return response.status(204).end();
  } catch (error) {
    return next(error);
  }
});

app.use((error, _request, response, _next) => {
  if (error instanceof SyntaxError && "body" in error) {
    return response.status(400).json({ message: "Request body must be valid JSON." });
  }
  if (error.name === "ValidationError") {
    return response.status(400).json({ message: "The submitted data is invalid." });
  }
  console.error(error);
  return response.status(500).json({ message: "Something went wrong. Please try again." });
});

mongoose.connect(mongoUri)
  .then(() => {
    app.listen(port, () => {
      console.log(`CampusCare API listening on http://localhost:${port}`);
    });
  })
  .catch((error) => {
    console.error("Could not connect to MongoDB:", error.message);
    process.exitCode = 1;
  });
