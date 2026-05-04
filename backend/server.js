require("dotenv").config({ path: require("path").join(__dirname, ".env") });

// Node.js + Express backend for the Live Event project.
// Persistent storage backed by MongoDB via Mongoose.

const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const path = require("path");
const fs = require("fs");

const User = require("./models/User");
const Event = require("./models/Event");
const RSVP = require("./models/RSVP");

const app = express();
const PORT = 3000;
const MONGO_URI = process.env.MONGO_URI;

app.use(cors());
app.use(express.json());

// ---------------------------------------------------------------------------
// MongoDB connection
// ---------------------------------------------------------------------------
if (!MONGO_URI) {
  const envPath = path.join(__dirname, ".env");
  console.error("MONGO_URI is not set.");
  console.error(`  Looked for env file at: ${envPath}`);
  if (fs.existsSync(envPath)) {
    const size = fs.statSync(envPath).size;
    console.error(`  File exists, size: ${size} bytes.`);
    if (size === 0) {
      console.error(
        "  The file is empty. Save your editor buffer and ensure it contains a line like:"
      );
      console.error("    MONGO_URI=mongodb+srv://...");
    } else {
      console.error("  The file has content but no MONGO_URI key was parsed.");
      console.error("  Make sure line 1 starts with: MONGO_URI=");
    }
  } else {
    console.error("  File does not exist. Create backend/.env with MONGO_URI=...");
  }
  process.exit(1);
}

mongoose
  .connect(MONGO_URI)
  .then(async () => {
    console.log("Connected to MongoDB.");
    await seedEvents();
  })
  .catch((err) => {
    console.error("Failed to connect to MongoDB:", err.message);
    process.exit(1);
  });

// Seed a handful of sample events on first run so GET /api/events isn't empty.
// Only inserts when the events collection has no documents.
async function seedEvents() {
  try {
    const count = await Event.estimatedDocumentCount();
    if (count > 0) return;

    const sampleEvents = [
      {
        title: "Campus Hack Night",
        date: "2026-05-15",
        location: "Engineering Building",
        description: "Build projects and meet other students.",
      },
      {
        title: "Spring Concert",
        date: "2026-06-01",
        location: "Main Quad",
        description: "Live music and food trucks.",
      },
      {
        title: "Career Fair",
        date: "2026-06-10",
        location: "Student Union Ballroom",
        description: "Meet recruiters from local tech companies.",
      },
    ];

    await Event.insertMany(sampleEvents);
    console.log(`Seeded ${sampleEvents.length} sample events.`);
  } catch (err) {
    console.error("Failed to seed sample events:", err.message);
  }
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

// GET /api/events
// Returns the full list of events from MongoDB.
app.get("/api/events", async (req, res) => {
  try {
    const events = await Event.find().sort({ date: 1 });
    res.json(events);
  } catch (err) {
    console.error("GET /api/events failed:", err);
    res.status(500).json({ error: "Failed to fetch events." });
  }
});

// POST /api/signup
// Registers a new user. Expects JSON body: { name, username, email, password }.
// - Hashes the password with bcrypt.
// - Rejects duplicate emails (409).
// - Rejects duplicate usernames, case-insensitively (400 "Username is already taken.").
// - Trims the username before saving and stores a normalized lowercase copy
//   (handled inside the User model).
app.post("/api/signup", async (req, res) => {
  try {
    const { name, username, email, password } = req.body;

    if (!name || !username || !email || !password) {
      return res.status(400).json({
        error: "Please provide name, username, email, and password.",
      });
    }

    const trimmedUsername = String(username).trim();
    if (trimmedUsername === "") {
      return res.status(400).json({ error: "Username cannot be empty." });
    }

    const normalizedEmail = email.toLowerCase();
    const normalizedUsername = trimmedUsername.toLowerCase();

    // Reject duplicate emails (existing behavior).
    const existingEmail = await User.findOne({ email: normalizedEmail });
    if (existingEmail) {
      return res.status(409).json({ error: "That email is already registered." });
    }

    // Reject duplicate usernames (case-insensitive thanks to usernameLower).
    const existingUsername = await User.findOne({
      usernameLower: normalizedUsername,
    });
    if (existingUsername) {
      return res.status(400).json({ error: "Username is already taken." });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = await User.create({
      name,
      username: trimmedUsername,
      email: normalizedEmail,
      password: hashedPassword,
    });

    // Note: we never include `password` in the response.
    res.status(201).json({
      message: "Signup successful.",
      user: {
        id: newUser.id,
        name: newUser.name,
        username: newUser.username,
        email: newUser.email,
      },
    });
  } catch (err) {
    // Race condition fallback: rely on the unique indexes if two requests
    // race past the findOne checks above.
    if (err && err.code === 11000) {
      const dupKey = err.keyPattern || {};
      if (dupKey.usernameLower) {
        return res.status(400).json({ error: "Username is already taken." });
      }
      if (dupKey.email) {
        return res.status(409).json({ error: "That email is already registered." });
      }
      // Unknown unique-index conflict — safest beginner-friendly default.
      return res.status(400).json({ error: "Username is already taken." });
    }
    console.error("POST /api/signup failed:", err);
    res.status(500).json({ error: "Signup failed." });
  }
});

// GET /api/users/search?username=...
// Case-insensitive, partial username search.
// Returns ONLY the safe public fields:
//   - profilePicture
//   - displayName
//   - username
//   - bio
// Returns an empty array if the query is missing/empty or nothing matches.
app.get("/api/users/search", async (req, res) => {
  try {
    const raw =
      typeof req.query.username === "string" ? req.query.username.trim() : "";

    // No query? Don't dump every user — return an empty array.
    if (raw === "") {
      return res.json([]);
    }

    // Escape regex metacharacters so a search like "a.b" matches the literal
    // string "a.b" and not "a" + any char + "b".
    const escaped = raw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    // The "i" flag makes the match case-insensitive. Searching the
    // pre-normalized `usernameLower` field would also work and is faster
    // for very large user tables; using the regex against `usernameLower`
    // gives us both correctness and a nicer indexed lookup.
    const pattern = new RegExp(escaped, "i");

    // .select() with `-_id` keeps the response to exactly the four fields
    // the spec asks for. .lean() returns plain JS objects (faster, and
    // skips the toJSON transform we don't need here).
    const matches = await User.find({ usernameLower: pattern })
      .select("username displayName profilePicture bio -_id")
      .limit(20)
      .lean();

    res.json(matches);
  } catch (err) {
    console.error("GET /api/users/search failed:", err);
    res.status(500).json({ error: "User search failed." });
  }
});

// POST /api/login
// Logs a user in. Expects JSON body: { email, password }.
// Compares the provided password against the stored bcrypt hash.
app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Please provide email and password." });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    const passwordMatches = await bcrypt.compare(password, user.password);
    if (!passwordMatches) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    res.json({
      message: "Login successful.",
      user: { id: user.id, name: user.name, email: user.email },
    });
  } catch (err) {
    console.error("POST /api/login failed:", err);
    res.status(500).json({ error: "Login failed." });
  }
});

// POST /api/rsvp
// Records an RSVP. Expects JSON body: { userId, eventId } as ObjectId strings.
// Validates that the user and event both exist, and prevents duplicate RSVPs.
app.post("/api/rsvp", async (req, res) => {
  try {
    const { userId, eventId } = req.body;

    if (!userId || !eventId) {
      return res.status(400).json({ error: "Please provide userId and eventId." });
    }

    if (
      !mongoose.Types.ObjectId.isValid(userId) ||
      !mongoose.Types.ObjectId.isValid(eventId)
    ) {
      return res.status(400).json({ error: "Invalid userId or eventId." });
    }

    const userExists = await User.exists({ _id: userId });
    if (!userExists) return res.status(404).json({ error: "User not found." });

    const eventExists = await Event.exists({ _id: eventId });
    if (!eventExists) return res.status(404).json({ error: "Event not found." });

    const alreadyRsvped = await RSVP.findOne({ userId, eventId });
    if (alreadyRsvped) {
      return res
        .status(200)
        .json({ message: "You have already RSVP'd to this event." });
    }

    const newRsvp = await RSVP.create({ userId, eventId });

    res.status(201).json({
      message: "RSVP saved.",
      rsvp: {
        id: newRsvp.id,
        userId: newRsvp.userId.toString(),
        eventId: newRsvp.eventId.toString(),
      },
    });
  } catch (err) {
    // Race condition fallback: rely on the unique compound index.
    if (err && err.code === 11000) {
      return res
        .status(200)
        .json({ message: "You have already RSVP'd to this event." });
    }
    console.error("POST /api/rsvp failed:", err);
    res.status(500).json({ error: "RSVP failed." });
  }
});

// ---------------------------------------------------------------------------
// Start the server
// ---------------------------------------------------------------------------
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
