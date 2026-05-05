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
const FriendRequest = require("./models/FriendRequest");

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
        time: "18:00",
        location: "Engineering Building",
        category: "tech",
        description: "Build projects and meet other students.",
        creatorUsername: "",
      },
      {
        title: "Spring Concert",
        date: "2026-06-01",
        time: "19:30",
        location: "Main Quad",
        category: "music",
        description: "Live music and food trucks.",
        creatorUsername: "",
      },
      {
        title: "Career Fair",
        date: "2026-06-10",
        time: "10:00",
        location: "Student Union Ballroom",
        category: "career",
        description: "Meet recruiters from local tech companies.",
        creatorUsername: "",
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
// Returns every event in the database, newest first.
// "Newest" means the most recently *created* event (createdAt desc), so a
// brand-new event a user just submitted shows up at the top of the list.
app.get("/api/events", async (req, res) => {
  try {
    const events = await Event.find().sort({ createdAt: -1 });
    res.json(events);
  } catch (err) {
    console.error("GET /api/events failed:", err);
    res.status(500).json({ error: "Failed to fetch events." });
  }
});

// POST /api/events
// Creates a new event and saves it permanently to MongoDB so every user
// (and every future server restart) can still see it.
//
// Expected JSON body:
//   {
//     title:           string  (required)
//     date:            string  (required, e.g. "2026-05-15")
//     time:            string  (required, e.g. "18:00")
//     location:        string  (required)
//     description:     string  (required)
//     category:        string  (optional, e.g. "tech", "music")
//     creatorUsername: string  (optional, who created the event)
//   }
//
// Validation: title, date, time, location, and description must all be
// non-empty strings. Anything else returns 400 with a friendly message.
app.post("/api/events", async (req, res) => {
  try {
    const {
      title,
      date,
      time,
      location,
      category,
      description,
      creatorUsername,
    } = req.body || {};

    // Helper: true only if the value is a non-empty string after trimming.
    function isFilled(value) {
      return typeof value === "string" && value.trim() !== "";
    }

    // The five fields the assignment marks as required.
    if (
      !isFilled(title) ||
      !isFilled(date) ||
      !isFilled(time) ||
      !isFilled(location) ||
      !isFilled(description)
    ) {
      return res.status(400).json({
        error:
          "Please provide title, date, time, location, and description.",
      });
    }

    // Build the document. We trim every string so we don't store stray
    // whitespace, and we default the optional fields to empty strings so
    // the response shape is always predictable.
    const newEvent = await Event.create({
      title: title.trim(),
      date: date.trim(),
      time: time.trim(),
      location: location.trim(),
      category: typeof category === "string" ? category.trim() : "",
      description: description.trim(),
      creatorUsername:
        typeof creatorUsername === "string" ? creatorUsername.trim() : "",
    });

    // 201 Created + the saved event (including its id and createdAt).
    res.status(201).json(newEvent);
  } catch (err) {
    console.error("POST /api/events failed:", err);
    res.status(500).json({ error: "Could not create event." });
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

// ---------------------------------------------------------------------------
// Friend request helpers
// ---------------------------------------------------------------------------
// All friend routes work with usernames. To keep checks case-insensitive
// (so "Alice" == "alice"), we always trim and lowercase before doing any
// comparison or storing anything in the database.

// Returns a normalized lowercase username, or null if the input is missing
// or only whitespace.
function normalizeUsername(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed === "") return null;
  return trimmed.toLowerCase();
}

// Looks up a User document by their lowercased username. Returns null if
// no such user exists.
async function findUserByUsername(lowerUsername) {
  return User.findOne({ usernameLower: lowerUsername });
}

// Builds the safe public profile payload we return for friend-related routes.
// Never includes passwords, emails, or other private fields.
function publicProfile(user) {
  return {
    username: user.username,
    displayName: user.displayName || "",
    profilePicture: user.profilePicture || "",
    bio: user.bio || "",
  };
}

// ---------------------------------------------------------------------------
// Friend routes
// ---------------------------------------------------------------------------

// POST /api/friends/request
// Body: { senderUsername, receiverUsername }
// Sends a friend request from sender → receiver. Validates that:
//   - both usernames are provided,
//   - sender is not the same person as receiver,
//   - both users exist,
//   - the two are not already friends,
//   - there isn't already a pending request from sender → receiver.
app.post("/api/friends/request", async (req, res) => {
  try {
    const sender = normalizeUsername(req.body.senderUsername);
    const receiver = normalizeUsername(req.body.receiverUsername);

    if (!sender || !receiver) {
      return res.status(400).json({
        error: "Please provide senderUsername and receiverUsername.",
      });
    }

    if (sender === receiver) {
      return res
        .status(400)
        .json({ error: "You cannot send a friend request to yourself." });
    }

    // Confirm both users exist before doing anything else.
    const senderUser = await findUserByUsername(sender);
    if (!senderUser) {
      return res.status(404).json({ error: "Sender user not found." });
    }
    const receiverUser = await findUserByUsername(receiver);
    if (!receiverUser) {
      return res.status(404).json({ error: "Receiver user not found." });
    }

    // Already friends? (Either side's array is enough — we keep them in
    // sync inside the accept route.)
    const alreadyFriends =
      Array.isArray(senderUser.friends) &&
      senderUser.friends.includes(receiver);
    if (alreadyFriends) {
      return res
        .status(400)
        .json({ error: "You are already friends with this user." });
    }

    // No duplicate pending request from the same sender → receiver pair.
    const existingPending = await FriendRequest.findOne({
      senderUsername: sender,
      receiverUsername: receiver,
      status: "pending",
    });
    if (existingPending) {
      return res.status(400).json({
        error: "A pending friend request to this user already exists.",
      });
    }

    const created = await FriendRequest.create({
      senderUsername: sender,
      receiverUsername: receiver,
      status: "pending",
    });

    res.status(201).json({
      message: "Friend request sent.",
      request: {
        id: created.id,
        senderUsername: created.senderUsername,
        receiverUsername: created.receiverUsername,
        status: created.status,
        createdAt: created.createdAt,
      },
    });
  } catch (err) {
    console.error("POST /api/friends/request failed:", err);
    res.status(500).json({ error: "Could not send friend request." });
  }
});

// GET /api/friends/requests/:username
// Returns this user's *pending incoming* friend requests, newest first.
// Each entry is enriched with the sender's safe public profile fields so
// the frontend can render a card without making a second request.
app.get("/api/friends/requests/:username", async (req, res) => {
  try {
    const username = normalizeUsername(req.params.username);
    if (!username) {
      return res.status(400).json({ error: "Invalid username." });
    }

    const requests = await FriendRequest.find({
      receiverUsername: username,
      status: "pending",
    })
      .sort({ createdAt: -1 })
      .lean();

    if (requests.length === 0) {
      return res.json([]);
    }

    // One round-trip lookup of every sender's public profile.
    const senderUsernames = requests.map((r) => r.senderUsername);
    const senders = await User.find({
      usernameLower: { $in: senderUsernames },
    })
      .select("username displayName profilePicture bio usernameLower -_id")
      .lean();

    // Build a lookup map: lowercased username → safe public profile.
    const senderMap = new Map();
    senders.forEach((s) => {
      senderMap.set(s.usernameLower, {
        username: s.username,
        displayName: s.displayName || "",
        profilePicture: s.profilePicture || "",
        bio: s.bio || "",
      });
    });

    const enriched = requests.map((r) => ({
      id: r._id.toString(),
      senderUsername: r.senderUsername,
      status: r.status,
      createdAt: r.createdAt,
      // Public sender info if the user still exists; safe defaults otherwise.
      sender: senderMap.get(r.senderUsername) || {
        username: r.senderUsername,
        displayName: "",
        profilePicture: "",
        bio: "",
      },
    }));

    res.json(enriched);
  } catch (err) {
    console.error("GET /api/friends/requests/:username failed:", err);
    res.status(500).json({ error: "Could not load friend requests." });
  }
});

// POST /api/friends/accept
// Body: { senderUsername, receiverUsername }
// Marks the matching pending request as "accepted" and adds each user to
// the other's friends array. Uses $addToSet so the same friend can never
// be added twice.
app.post("/api/friends/accept", async (req, res) => {
  try {
    const sender = normalizeUsername(req.body.senderUsername);
    const receiver = normalizeUsername(req.body.receiverUsername);

    if (!sender || !receiver) {
      return res.status(400).json({
        error: "Please provide senderUsername and receiverUsername.",
      });
    }

    const request = await FriendRequest.findOne({
      senderUsername: sender,
      receiverUsername: receiver,
      status: "pending",
    });
    if (!request) {
      return res
        .status(404)
        .json({ error: "No pending friend request found for those users." });
    }

    request.status = "accepted";
    await request.save();

    // Make sure both users have each other in their friends list.
    await Promise.all([
      User.updateOne(
        { usernameLower: sender },
        { $addToSet: { friends: receiver } }
      ),
      User.updateOne(
        { usernameLower: receiver },
        { $addToSet: { friends: sender } }
      ),
    ]);

    res.json({
      message: "Friend request accepted.",
      request: {
        id: request.id,
        senderUsername: request.senderUsername,
        receiverUsername: request.receiverUsername,
        status: request.status,
        createdAt: request.createdAt,
      },
    });
  } catch (err) {
    console.error("POST /api/friends/accept failed:", err);
    res.status(500).json({ error: "Could not accept friend request." });
  }
});

// POST /api/friends/deny
// Body: { senderUsername, receiverUsername }
// Marks the matching pending request as "denied". Does NOT touch the
// friends arrays — the two users do not become friends.
app.post("/api/friends/deny", async (req, res) => {
  try {
    const sender = normalizeUsername(req.body.senderUsername);
    const receiver = normalizeUsername(req.body.receiverUsername);

    if (!sender || !receiver) {
      return res.status(400).json({
        error: "Please provide senderUsername and receiverUsername.",
      });
    }

    const request = await FriendRequest.findOne({
      senderUsername: sender,
      receiverUsername: receiver,
      status: "pending",
    });
    if (!request) {
      return res
        .status(404)
        .json({ error: "No pending friend request found for those users." });
    }

    request.status = "denied";
    await request.save();

    res.json({
      message: "Friend request denied.",
      request: {
        id: request.id,
        senderUsername: request.senderUsername,
        receiverUsername: request.receiverUsername,
        status: request.status,
        createdAt: request.createdAt,
      },
    });
  } catch (err) {
    console.error("POST /api/friends/deny failed:", err);
    res.status(500).json({ error: "Could not deny friend request." });
  }
});

// GET /api/friends/:username
// Returns the user's accepted friends as an array of public profile objects
// (safe to render on the frontend without further fetching). Returns [] if
// the user has no friends yet, and 404 if the user does not exist.
app.get("/api/friends/:username", async (req, res) => {
  try {
    const username = normalizeUsername(req.params.username);
    if (!username) {
      return res.status(400).json({ error: "Invalid username." });
    }

    const user = await findUserByUsername(username);
    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    const friendUsernames = Array.isArray(user.friends) ? user.friends : [];
    if (friendUsernames.length === 0) {
      return res.json([]);
    }

    const friends = await User.find({
      usernameLower: { $in: friendUsernames },
    })
      .select("username displayName profilePicture bio -_id")
      .lean();

    // Map to the safe public shape (in case any extra fields slipped in).
    res.json(friends.map(publicProfile));
  } catch (err) {
    console.error("GET /api/friends/:username failed:", err);
    res.status(500).json({ error: "Could not load friends." });
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
      user: {
        id: user.id,
        name: user.name,
        username: user.username,
        email: user.email,
      },
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
