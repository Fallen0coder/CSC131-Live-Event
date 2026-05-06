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
const Message = require("./models/Message");
const GroupChat = require("./models/GroupChat");
const GroupChatMessage = require("./models/GroupChatMessage");

const app = express();
const PORT = Number(process.env.PORT) || 3000;
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

// ---------------------------------------------------------------------------
// Event ownership / permission helpers
// ---------------------------------------------------------------------------
// Both PUT and DELETE on /api/events/:id share the same auth flow:
//   1. Look up the requester by username (or email) in MongoDB.
//   2. Re-read their actual role from the DB — we NEVER trust a `role`
//      value sent from the frontend, because anyone could change it in
//      DevTools. localStorage is for UI hints only.
//   3. Allow the action if the DB role is "admin", OR if the event's
//      stored creatorUsername matches the requester's username
//      (case-insensitive).
//   4. Otherwise return 403 with the exact wording the spec asks for.
//
// This helper does steps 1–3 and returns either:
//   { ok: true,  user, event }                — caller may proceed
//   { ok: false, status, error }              — caller should respond
async function authorizeEventChange(eventId, body) {
  if (!mongoose.Types.ObjectId.isValid(eventId)) {
    return { ok: false, status: 400, error: "Invalid event id." };
  }

  // Accept any of the field names the spec or the older code may use.
  // The spec sample shows { username, role, ... } in the body; we also
  // accept email so this works seamlessly with users who only have an
  // email saved in localStorage.
  const identifier =
    (body && (body.username || body.email)) ||
    (body && (body.requesterUsername || body.requesterEmail)) ||
    "";

  if (!identifier) {
    return {
      ok: false,
      status: 400,
      error: "Please provide your username (or email) in the request body.",
    };
  }

  const requester = await findUserByEmailOrUsername(identifier);
  if (!requester) {
    // 401 (not 403) so the client knows it's an auth problem, not an
    // ownership problem — they're not logged in as a real user.
    return { ok: false, status: 401, error: "Requester not found." };
  }

  const eventDoc = await Event.findById(eventId);
  if (!eventDoc) {
    return { ok: false, status: 404, error: "Event not found." };
  }

  // ----- Permission check ----------------------------------------------
  // Admins (per the live DB role) can edit/delete anything.
  const dbRole = requester.role || "user";
  if (dbRole === "admin") {
    return { ok: true, user: requester, event: eventDoc };
  }

  // Otherwise the requester must be the creator of this specific event.
  // Compare case-insensitively to match the rest of the app's username
  // conventions (signup stores usernameLower, friends use lowercase).
  const creator = (eventDoc.creatorUsername || "").trim().toLowerCase();
  const me = (requester.username || "").trim().toLowerCase();
  if (creator && creator === me) {
    return { ok: true, user: requester, event: eventDoc };
  }

  return {
    ok: false,
    status: 403,
    error: "You can only modify events you created.",
  };
}

// PUT /api/events/:id
// Updates an existing event. Anyone may try to call this, but the
// permission check above limits actual updates to:
//   - the event's creator (matched on creatorUsername), OR
//   - any user whose live MongoDB role is "admin".
//
// Body fields that may be updated (all optional — only provided ones change):
//   title, date, time, location, category, description
// Body must also include the requester identity:
//   { username | email, role }    (role is informational; backend re-verifies)
app.put("/api/events/:id", async (req, res) => {
  try {
    const auth = await authorizeEventChange(req.params.id, req.body || {});
    if (!auth.ok) {
      return res.status(auth.status).json({ error: auth.error });
    }

    const { title, date, time, location, category, description } =
      req.body || {};

    // Whitelist the editable fields. Anything else in the body is
    // ignored — we never let callers patch creatorUsername, _id, etc.
    const updates = {};
    if (typeof title === "string" && title.trim() !== "") {
      updates.title = title.trim();
    }
    if (typeof date === "string" && date.trim() !== "") {
      updates.date = date.trim();
    }
    if (typeof time === "string") {
      updates.time = time.trim();
    }
    if (typeof location === "string" && location.trim() !== "") {
      updates.location = location.trim();
    }
    if (typeof category === "string") {
      updates.category = category.trim();
    }
    if (typeof description === "string" && description.trim() !== "") {
      updates.description = description.trim();
    }

    if (Object.keys(updates).length === 0) {
      return res
        .status(400)
        .json({ error: "Please provide at least one field to update." });
    }

    Object.assign(auth.event, updates);
    const saved = await auth.event.save();

    res.json({ message: "Event updated.", event: saved });
  } catch (err) {
    console.error("PUT /api/events/:id failed:", err);
    res.status(500).json({ error: "Could not update event." });
  }
});

// DELETE /api/events/:id
// Removes an event from MongoDB. Permission rules match PUT above:
//   - admins (per the live DB role) may delete any event
//   - regular users may delete only events they created
// We also clean up any RSVPs that referenced this event so we don't
// leave orphaned records in the RSVP collection.
//
// Body must include the requester identity:
//   { username | email, role }    (role is informational; backend re-verifies)
app.delete("/api/events/:id", async (req, res) => {
  try {
    const auth = await authorizeEventChange(req.params.id, req.body || {});
    if (!auth.ok) {
      return res.status(auth.status).json({ error: auth.error });
    }

    await Event.deleteOne({ _id: auth.event._id });
    await RSVP.deleteMany({ eventId: auth.event._id });

    res.json({ message: "Event deleted." });
  } catch (err) {
    console.error("DELETE /api/events/:id failed:", err);
    res.status(500).json({ error: "Could not delete event." });
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

    // Note: we never include `password` in the response. New accounts
    // always start with role "user"; admins are unlocked later through
    // /api/settings/admin-key.
    res.status(201).json({
      message: "Signup successful.",
      user: safeUser(newUser),
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

// DELETE /api/friend-requests/cancel
// Body: { senderUsername, receiverUsername }
// Deletes the pending FriendRequest from sender → receiver. 200 if a row
// was removed, 404 if no matching pending request exists.
app.delete("/api/friend-requests/cancel", async (req, res) => {
  try {
    const sender = normalizeUsername(req.body.senderUsername);
    const receiver = normalizeUsername(req.body.receiverUsername);

    if (!sender || !receiver) {
      return res.status(400).json({
        error: "Please provide senderUsername and receiverUsername.",
      });
    }

    const result = await FriendRequest.deleteOne({
      senderUsername: sender,
      receiverUsername: receiver,
      status: "pending",
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({
        error: "No pending friend request found for those users.",
      });
    }

    res.status(200).json({ message: "Friend request canceled." });
  } catch (err) {
    console.error("DELETE /api/friend-requests/cancel failed:", err);
    res.status(500).json({ error: "Could not cancel friend request." });
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

// DELETE /api/friends/remove
// Body: { usernameA, usernameB }
// Removes the friendship in both users' friends arrays (if linked) and
// deletes any FriendRequest documents between the pair in either direction.
// 200 on success, 404 if the users are not linked as friends (or a user is
// missing).
app.delete("/api/friends/remove", async (req, res) => {
  try {
    const a = normalizeUsername(req.body.usernameA);
    const b = normalizeUsername(req.body.usernameB);

    if (!a || !b) {
      return res.status(400).json({
        error: "Please provide usernameA and usernameB.",
      });
    }

    if (a === b) {
      return res.status(400).json({
        error: "usernameA and usernameB must be different users.",
      });
    }

    const userA = await findUserByUsername(a);
    const userB = await findUserByUsername(b);

    if (!userA || !userB) {
      return res.status(404).json({ error: "Users are not friends." });
    }

    const friendsA = Array.isArray(userA.friends) ? userA.friends : [];
    const friendsB = Array.isArray(userB.friends) ? userB.friends : [];
    const linked = friendsA.includes(b) || friendsB.includes(a);

    if (!linked) {
      return res.status(404).json({ error: "Users are not friends." });
    }

    await Promise.all([
      User.updateOne({ usernameLower: a }, { $pull: { friends: b } }),
      User.updateOne({ usernameLower: b }, { $pull: { friends: a } }),
    ]);

    await FriendRequest.deleteMany({
      $or: [
        { senderUsername: a, receiverUsername: b },
        { senderUsername: b, receiverUsername: a },
      ],
    });

    res.status(200).json({ message: "Friendship removed." });
  } catch (err) {
    console.error("DELETE /api/friends/remove failed:", err);
    res.status(500).json({ error: "Could not remove friendship." });
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

    // Include `role` so the frontend knows whether to show admin
    // controls right after login (without an extra round-trip).
    res.json({
      message: "Login successful.",
      user: safeUser(user),
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

// DELETE /api/rsvp
// Cancels an existing RSVP. Body: { userId, eventId } — same shape as
// POST /api/rsvp so the frontend only has to swap the HTTP method.
//
// This route is intentionally idempotent: if there's no matching RSVP
// to delete, we still respond with 200 success. That way the UI ends up
// in the "not RSVP'd" state regardless, and a user double-clicking the
// Cancel button can never get stuck on a confusing error.
app.delete("/api/rsvp", async (req, res) => {
  try {
    const { userId, eventId } = req.body || {};

    if (!userId || !eventId) {
      return res
        .status(400)
        .json({ error: "Please provide userId and eventId." });
    }

    if (
      !mongoose.Types.ObjectId.isValid(userId) ||
      !mongoose.Types.ObjectId.isValid(eventId)
    ) {
      return res.status(400).json({ error: "Invalid userId or eventId." });
    }

    // deleteOne returns { acknowledged, deletedCount }. We treat 0 and 1
    // both as success — see the comment above about idempotence.
    const result = await RSVP.deleteOne({ userId, eventId });

    if (result.deletedCount === 0) {
      return res
        .status(200)
        .json({ message: "No RSVP to cancel — already removed." });
    }

    res.json({ message: "RSVP canceled." });
  } catch (err) {
    console.error("DELETE /api/rsvp failed:", err);
    res.status(500).json({ error: "Could not cancel RSVP." });
  }
});

// GET /api/rsvps/:username
// Returns the full Event details for every event the given user has
// RSVP'd to. Useful for "events I'm going to" lists on the profile or
// events page.
//
// How it works (two simple queries, easy to read):
//   1. Look up the user by username (case-insensitive, via the same
//      helpers used by the friend routes). 404 if no such user.
//   2. Find every RSVP record where userId matches this user.
//   3. Fetch the matching Event documents in one batched query and
//      return them sorted by date (earliest first).
//
// Privacy: this route only returns *event* data (title, date, time,
// location, category, description, creator username, createdAt). It
// never exposes the user's password, email, hashed password, or any
// other private field on the User document.
app.get("/api/rsvps/:username", async (req, res) => {
  try {
    // Normalize the URL parameter so "Alice" and "alice" both work.
    const username = normalizeUsername(req.params.username);
    if (!username) {
      return res.status(400).json({ error: "Invalid username." });
    }

    // Make sure the user actually exists. We need their ObjectId to
    // search the RSVP collection (RSVPs link a userId → eventId).
    const user = await findUserByUsername(username);
    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    // Step 1: every RSVP this user has made.
    const rsvps = await RSVP.find({ userId: user._id }).lean();
    if (rsvps.length === 0) {
      // No RSVPs yet — return an empty array (NOT a 404). The frontend
      // can render an "you haven't RSVP'd to anything yet" empty state.
      return res.json([]);
    }

    // Step 2: pull the matching events in one batched query. Using $in
    // is much faster than a loop of individual lookups.
    const eventIds = rsvps.map((rsvp) => rsvp.eventId);
    const events = await Event.find({ _id: { $in: eventIds } })
      .sort({ date: 1 })
      .lean();

    // .lean() skips the Event model's toJSON transform, so we shape the
    // public event payload explicitly here. This also doubles as a
    // whitelist — only fields listed below are ever sent to the client.
    const safeEvents = events.map((event) => ({
      id: event._id.toString(),
      title: event.title || "",
      date: event.date || "",
      time: event.time || "",
      location: event.location || "",
      category: event.category || "",
      description: event.description || "",
      creatorUsername: event.creatorUsername || "",
      createdAt: event.createdAt || null,
    }));

    res.json(safeEvents);
  } catch (err) {
    console.error("GET /api/rsvps/:username failed:", err);
    res.status(500).json({ error: "Could not load RSVP'd events." });
  }
});

// ---------------------------------------------------------------------------
// Account settings routes
// ---------------------------------------------------------------------------
// These routes are called from the Settings page on the frontend. They
// always work against the live MongoDB user (not localStorage), and they
// always use bcrypt to verify any password the user types in.

// Builds the safe user object we send back to the frontend after auth or
// settings actions. Includes `role` so the frontend knows whether to show
// admin-only controls. NEVER includes the password (or its hash).
function safeUser(user) {
  return {
    id: user.id,
    name: user.name,
    username: user.username,
    email: user.email,
    role: user.role || "user",
  };
}

// Helper used by the settings routes below: looks up a user by email OR
// username. Returns the User document (with password hash) or null.
async function findUserByEmailOrUsername(emailOrUsername) {
  if (typeof emailOrUsername !== "string") return null;
  const trimmed = emailOrUsername.trim();
  if (trimmed === "") return null;
  const lower = trimmed.toLowerCase();
  // Try email first (matches signup behavior of storing lowercase email),
  // then fall back to a case-insensitive username lookup.
  const byEmail = await User.findOne({ email: lower });
  if (byEmail) return byEmail;
  return User.findOne({ usernameLower: lower });
}

// POST /api/settings/change-password
// Body: { email | username, currentPassword, newPassword, confirmPassword }
// - Looks up the logged-in user by email OR username.
// - Verifies currentPassword against the stored bcrypt hash.
// - Validates newPassword length (>= 8) and that confirmPassword matches.
// - Hashes the new password with bcrypt and saves it.
// - Never returns the password (or its hash) in the response.
app.post("/api/settings/change-password", async (req, res) => {
  try {
    const {
      email,
      username,
      currentPassword,
      newPassword,
      confirmPassword,
    } = req.body || {};

    const identifier = email || username;
    if (!identifier || !currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({
        error:
          "Please provide email (or username), currentPassword, newPassword, and confirmPassword.",
      });
    }

    if (newPassword !== confirmPassword) {
      return res
        .status(400)
        .json({ error: "New password and confirmation do not match." });
    }

    if (typeof newPassword !== "string" || newPassword.length < 8) {
      return res
        .status(400)
        .json({ error: "New password must be at least 8 characters long." });
    }

    const user = await findUserByEmailOrUsername(identifier);
    if (!user) {
      // Use the same generic error wording as login so we don't leak which
      // accounts exist.
      return res
        .status(401)
        .json({ error: "Current password is incorrect." });
    }

    const matches = await bcrypt.compare(currentPassword, user.password);
    if (!matches) {
      return res
        .status(401)
        .json({ error: "Current password is incorrect." });
    }

    // Same cost factor as signup so all hashes look consistent.
    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    res.json({
      message: "Password updated successfully.",
      user: safeUser(user),
    });
  } catch (err) {
    console.error("POST /api/settings/change-password failed:", err);
    res.status(500).json({ error: "Could not update password." });
  }
});

// ---------------------------------------------------------------------------
// Admin key routes
// ---------------------------------------------------------------------------
// The admin key itself lives in backend/.env as ADMIN_KEY. The frontend
// only ever sends the key the user typed — it never knows the real value.
// We compare the typed key to process.env.ADMIN_KEY here, on the server,
// and ONLY then promote the user's role to "admin" in MongoDB.

// POST /api/settings/admin-key
// Body: { email | username, adminKey }
// - Looks up the logged-in user.
// - Compares adminKey against process.env.ADMIN_KEY.
// - If it matches, sets user.role = "admin" and returns the safe user.
// - Otherwise returns 403 "Invalid admin key."
app.post("/api/settings/admin-key", async (req, res) => {
  try {
    const { email, username, adminKey } = req.body || {};

    const identifier = email || username;
    if (!identifier || typeof adminKey !== "string" || adminKey === "") {
      return res.status(400).json({
        error: "Please provide email (or username) and adminKey.",
      });
    }

    const expectedKey = process.env.ADMIN_KEY;
    if (!expectedKey) {
      // Fail loudly in the server log but stay vague for the client so we
      // don't leak the fact that the env file is misconfigured.
      console.error(
        "ADMIN_KEY is not set in backend/.env — admin unlock disabled."
      );
      return res.status(500).json({
        error: "Admin key feature is not configured on the server.",
      });
    }

    const user = await findUserByEmailOrUsername(identifier);
    if (!user) {
      // Use a generic 401 so we don't reveal whether the account exists.
      return res.status(401).json({ error: "User not found." });
    }

    // Strict equality — the typed key has to match the env value exactly.
    if (adminKey !== expectedKey) {
      return res.status(403).json({ error: "Invalid admin key." });
    }

    user.role = "admin";
    await user.save();

    res.json({
      message: "Admin mode unlocked.",
      user: safeUser(user),
    });
  } catch (err) {
    console.error("POST /api/settings/admin-key failed:", err);
    res.status(500).json({ error: "Could not unlock admin mode." });
  }
});

// POST /api/settings/exit-admin
// Body: { email | username }
// - Looks up the user and sets user.role = "user".
// - Returns the updated safe user.
// - This does NOT log the user out — it only removes admin privileges.
app.post("/api/settings/exit-admin", async (req, res) => {
  try {
    const { email, username } = req.body || {};

    const identifier = email || username;
    if (!identifier) {
      return res.status(400).json({
        error: "Please provide email (or username).",
      });
    }

    const user = await findUserByEmailOrUsername(identifier);
    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    user.role = "user";
    await user.save();

    res.json({
      message: "Admin mode turned off.",
      user: safeUser(user),
    });
  } catch (err) {
    console.error("POST /api/settings/exit-admin failed:", err);
    res.status(500).json({ error: "Could not exit admin mode." });
  }
});

// DELETE /api/settings/delete-account
// Body: { email | username, password }
// - Looks up the user and verifies their password with bcrypt.
// - Removes the user from MongoDB along with their related data:
//     * incoming + outgoing friend requests
//     * direct messages they sent or received
//     * RSVPs they made
//     * their username from every other user's `friends` array
//     * events they created get their creatorUsername blanked out so the
//       event itself is not lost (other users may have RSVP'd to it).
// - Never returns the password or the password hash in the response.
app.delete("/api/settings/delete-account", async (req, res) => {
  try {
    const { email, username, password } = req.body || {};

    const identifier = email || username;
    if (!identifier || !password) {
      return res.status(400).json({
        error: "Please provide email (or username) and password.",
      });
    }

    const user = await findUserByEmailOrUsername(identifier);
    if (!user) {
      return res
        .status(401)
        .json({ error: "Password is incorrect." });
    }

    const matches = await bcrypt.compare(password, user.password);
    if (!matches) {
      return res
        .status(401)
        .json({ error: "Password is incorrect." });
    }

    const lowerUsername = user.usernameLower;
    const userId = user._id;

    // Cascade cleanup. Each step is independent, so we run them in
    // parallel for speed.
    await Promise.all([
      // Friend requests where this user was sender OR receiver.
      FriendRequest.deleteMany({
        $or: [
          { senderUsername: lowerUsername },
          { receiverUsername: lowerUsername },
        ],
      }),
      // Direct messages they sent or received.
      Message.deleteMany({
        $or: [
          { senderUsername: lowerUsername },
          { receiverUsername: lowerUsername },
        ],
      }),
      // RSVPs they made.
      RSVP.deleteMany({ userId: userId }),
      // Pull this user from every other user's `friends` array.
      User.updateMany(
        { friends: lowerUsername },
        { $pull: { friends: lowerUsername } }
      ),
      // Events they created: keep them (other users may have RSVP'd) but
      // mark the creator as removed so we don't keep showing a name that
      // no longer exists.
      Event.updateMany(
        { creatorUsername: user.username },
        { $set: { creatorUsername: "[deleted user]" } }
      ),
    ]);

    // Finally remove the user document itself.
    await User.deleteOne({ _id: userId });

    res.json({
      message: "Account deleted successfully.",
    });
  } catch (err) {
    console.error("DELETE /api/settings/delete-account failed:", err);
    res.status(500).json({ error: "Could not delete account." });
  }
});

// ---------------------------------------------------------------------------
// Messaging routes
// ---------------------------------------------------------------------------

// POST /api/messages
// Sends a direct message from one user to another.
// Body: { senderUsername, receiverUsername, text }
//
// Validation:
//   - All three fields must be non-empty strings.
//   - Sender cannot message themselves.
//   - Both users must exist.
//   - The two users must already be friends (messaging is friends-only).
//   - Respects the receiver's "allow messages" preference if stored on the
//     User document in the future (no-op for now; structure is in place).
app.post("/api/messages", async (req, res) => {
  try {
    const sender = normalizeUsername(req.body.senderUsername);
    const receiver = normalizeUsername(req.body.receiverUsername);
    const text =
      typeof req.body.text === "string" ? req.body.text.trim() : "";

    if (!sender || !receiver || text === "") {
      return res.status(400).json({
        error: "Please provide senderUsername, receiverUsername, and text.",
      });
    }

    if (sender === receiver) {
      return res
        .status(400)
        .json({ error: "You cannot send a message to yourself." });
    }

    const senderUser = await findUserByUsername(sender);
    if (!senderUser) {
      return res.status(404).json({ error: "Sender user not found." });
    }

    const receiverUser = await findUserByUsername(receiver);
    if (!receiverUser) {
      return res.status(404).json({ error: "Receiver user not found." });
    }

    // Only friends can message each other.
    const areFriends =
      Array.isArray(senderUser.friends) &&
      senderUser.friends.includes(receiver);
    if (!areFriends) {
      return res.status(403).json({
        error: "You can only message users who are your friends.",
      });
    }

    const newMessage = await Message.create({
      senderUsername: sender,
      receiverUsername: receiver,
      text,
    });

    res.status(201).json({
      message: "Message sent.",
      data: newMessage,
    });
  } catch (err) {
    console.error("POST /api/messages failed:", err);
    res.status(500).json({ error: "Could not send message." });
  }
});

// GET /api/messages/:userA/:userB
// Returns every message exchanged between userA and userB, oldest first.
// Both directions (A→B and B→A) are included so the frontend can render a
// continuous thread. Usernames are normalized before the query so casing
// in the URL doesn't matter.
app.get("/api/messages/:userA/:userB", async (req, res) => {
  try {
    const userA = normalizeUsername(req.params.userA);
    const userB = normalizeUsername(req.params.userB);

    if (!userA || !userB) {
      return res.status(400).json({ error: "Invalid username(s)." });
    }

    if (userA === userB) {
      return res
        .status(400)
        .json({ error: "userA and userB must be different users." });
    }

    // Fetch both directions in one query using $or so the result is a
    // single chronological thread rather than two separate half-threads.
    const messages = await Message.find({
      $or: [
        { senderUsername: userA, receiverUsername: userB },
        { senderUsername: userB, receiverUsername: userA },
      ],
    })
      .sort({ createdAt: 1 })
      .lean();

    // .lean() skips toJSON, so shape the payload explicitly.
    res.json(
      messages.map((m) => ({
        id: m._id.toString(),
        senderUsername: m.senderUsername,
        receiverUsername: m.receiverUsername,
        text: m.text,
        createdAt: m.createdAt,
        read: m.read,
      }))
    );
  } catch (err) {
    console.error("GET /api/messages/:userA/:userB failed:", err);
    res.status(500).json({ error: "Could not load messages." });
  }
});

// GET /api/conversations/:username
// Returns an inbox summary: one entry per friend the user has exchanged at
// least one message with, including the most recent message in that thread.
// Sorted newest-last-message first so the inbox feels natural.
//
// Implementation uses an aggregation pipeline:
//   1. Match all messages where this user is sender or receiver.
//   2. Add a "partner" field (the other participant's username).
//   3. Sort within the pipeline (needed before $group picks $last).
//   4. Group by partner, keeping the last message fields.
//   5. Sort the groups by the last message date descending.
app.get("/api/conversations/:username", async (req, res) => {
  try {
    const username = normalizeUsername(req.params.username);
    if (!username) {
      return res.status(400).json({ error: "Invalid username." });
    }

    const conversations = await Message.aggregate([
      // Step 1: only messages involving this user.
      {
        $match: {
          $or: [
            { senderUsername: username },
            { receiverUsername: username },
          ],
        },
      },
      // Step 2: tag each message with who the "other" participant is.
      {
        $addFields: {
          partner: {
            $cond: {
              if: { $eq: ["$senderUsername", username] },
              then: "$receiverUsername",
              else: "$senderUsername",
            },
          },
        },
      },
      // Step 3: sort oldest→newest so $last picks the most recent message.
      { $sort: { createdAt: 1 } },
      // Step 4: one document per partner, keeping the latest message fields.
      {
        $group: {
          _id: "$partner",
          lastMessageText: { $last: "$text" },
          lastMessageAt: { $last: "$createdAt" },
          lastMessageSender: { $last: "$senderUsername" },
          lastMessageRead: { $last: "$read" },
        },
      },
      // Step 5: most recent conversation first.
      { $sort: { lastMessageAt: -1 } },
    ]);

    // Shape the response to a clean array.
    res.json(
      conversations.map((c) => ({
        partner: c._id,
        lastMessage: {
          text: c.lastMessageText,
          createdAt: c.lastMessageAt,
          senderUsername: c.lastMessageSender,
          read: c.lastMessageRead,
        },
      }))
    );
  } catch (err) {
    console.error("GET /api/conversations/:username failed:", err);
    res.status(500).json({ error: "Could not load conversations." });
  }
});

// PATCH /api/messages/read
// Marks all messages sent FROM senderUsername TO receiverUsername as read.
// Body: { senderUsername, receiverUsername }
// Idempotent: calling it when messages are already read is a no-op (200).
app.patch("/api/messages/read", async (req, res) => {
  try {
    const sender = normalizeUsername(req.body.senderUsername);
    const receiver = normalizeUsername(req.body.receiverUsername);

    if (!sender || !receiver) {
      return res.status(400).json({
        error: "Please provide senderUsername and receiverUsername.",
      });
    }

    const result = await Message.updateMany(
      { senderUsername: sender, receiverUsername: receiver, read: false },
      { $set: { read: true } }
    );

    res.json({
      message: "Messages marked as read.",
      updatedCount: result.modifiedCount,
    });
  } catch (err) {
    console.error("PATCH /api/messages/read failed:", err);
    res.status(500).json({ error: "Could not mark messages as read." });
  }
});

// ---------------------------------------------------------------------------
// Group chat routes
// ---------------------------------------------------------------------------

// POST /api/groupchats
// Body: { name, creatorUsername, members }
// Creates a group; creator is always included in members. Every member must
// exist as a User.
app.post("/api/groupchats", async (req, res) => {
  try {
    const rawName = req.body.name;
    const creator = normalizeUsername(req.body.creatorUsername);
    const rawMembers = req.body.members;

    if (typeof rawName !== "string" || rawName.trim() === "") {
      return res.status(400).json({ error: "Please provide a non-empty name." });
    }

    if (!creator) {
      return res.status(400).json({
        error: "Please provide creatorUsername.",
      });
    }

    if (!Array.isArray(rawMembers)) {
      return res.status(400).json({
        error: "members must be an array of usernames.",
      });
    }

    const memberSet = new Set();
    memberSet.add(creator);
    for (let i = 0; i < rawMembers.length; i++) {
      const n = normalizeUsername(rawMembers[i]);
      if (n) memberSet.add(n);
    }

    const memberList = Array.from(memberSet);
    for (let i = 0; i < memberList.length; i++) {
      const u = await findUserByUsername(memberList[i]);
      if (!u) {
        return res.status(404).json({
          error: "User not found: " + memberList[i],
        });
      }
    }

    const created = await GroupChat.create({
      name: rawName.trim(),
      creatorUsername: creator,
      members: memberList,
    });

    res.status(201).json(created);
  } catch (err) {
    console.error("POST /api/groupchats failed:", err);
    res.status(500).json({ error: "Could not create group chat." });
  }
});

// GET /api/groupchats/:username
// All group chats where this user appears in members (newest first).
app.get("/api/groupchats/:username", async (req, res) => {
  try {
    const username = normalizeUsername(req.params.username);
    if (!username) {
      return res.status(400).json({ error: "Invalid username." });
    }

    const chats = await GroupChat.find({ members: username })
      .sort({ createdAt: -1 })
      .lean();

    res.json(
      chats.map((c) => ({
        id: c._id.toString(),
        name: c.name,
        creatorUsername: c.creatorUsername,
        members: c.members,
        createdAt: c.createdAt,
      }))
    );
  } catch (err) {
    console.error("GET /api/groupchats/:username failed:", err);
    res.status(500).json({ error: "Could not load group chats." });
  }
});

// POST /api/groupchats/:id/messages
// Body: { senderUsername, text } — sender must be a member of the group.
app.post("/api/groupchats/:id/messages", async (req, res) => {
  try {
    const id = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid group id." });
    }

    const sender = normalizeUsername(req.body.senderUsername);
    const text =
      typeof req.body.text === "string" ? req.body.text.trim() : "";

    if (!sender || text === "") {
      return res.status(400).json({
        error: "Please provide senderUsername and text.",
      });
    }

    const group = await GroupChat.findById(id);
    if (!group) {
      return res.status(404).json({ error: "Group chat not found." });
    }

    const members = Array.isArray(group.members) ? group.members : [];
    if (!members.includes(sender)) {
      return res.status(403).json({
        error: "Only group members can post messages.",
      });
    }

    const senderUser = await findUserByUsername(sender);
    if (!senderUser) {
      return res.status(404).json({ error: "Sender user not found." });
    }

    const newMessage = await GroupChatMessage.create({
      groupChatId: id,
      senderUsername: sender,
      text,
    });

    res.status(201).json({
      message: "Group message sent.",
      data: {
        id: newMessage.id,
        groupChatId: String(newMessage.groupChatId),
        senderUsername: newMessage.senderUsername,
        text: newMessage.text,
        createdAt: newMessage.createdAt,
      },
    });
  } catch (err) {
    console.error("POST /api/groupchats/:id/messages failed:", err);
    res.status(500).json({ error: "Could not send group message." });
  }
});

// GET /api/groupchats/:id/messages
// All messages in the group, oldest first.
app.get("/api/groupchats/:id/messages", async (req, res) => {
  try {
    const id = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid group id." });
    }

    const groupExists = await GroupChat.exists({ _id: id });
    if (!groupExists) {
      return res.status(404).json({ error: "Group chat not found." });
    }

    const messages = await GroupChatMessage.find({ groupChatId: id })
      .sort({ createdAt: 1 })
      .lean();

    res.json(
      messages.map((m) => ({
        id: m._id.toString(),
        groupChatId: String(m.groupChatId),
        senderUsername: m.senderUsername,
        text: m.text,
        createdAt: m.createdAt,
      }))
    );
  } catch (err) {
    console.error("GET /api/groupchats/:id/messages failed:", err);
    res.status(500).json({ error: "Could not load group messages." });
  }
});

// DELETE /api/groupchats/:id
// Body: { username } — only the group's creator can delete the group.
// Deletes the group chat row and all messages tied to it.
app.delete("/api/groupchats/:id", async (req, res) => {
  try {
    const id = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid group id." });
    }

    const username = normalizeUsername(req.body.username);
    if (!username) {
      return res.status(400).json({ error: "Please provide username." });
    }

    const group = await GroupChat.findById(id);
    if (!group) {
      return res.status(404).json({ error: "Group chat not found." });
    }

    if (group.creatorUsername !== username) {
      return res.status(403).json({
        error: "Only the group creator can delete this group.",
      });
    }

    await Promise.all([
      GroupChat.deleteOne({ _id: id }),
      GroupChatMessage.deleteMany({ groupChatId: id }),
    ]);

    res.status(200).json({ message: "Group chat deleted." });
  } catch (err) {
    console.error("DELETE /api/groupchats/:id failed:", err);
    res.status(500).json({ error: "Could not delete group chat." });
  }
});

// DELETE /api/groupchats/:id/members
// Body: { username } — removes a member from the group.
app.delete("/api/groupchats/:id/members", async (req, res) => {
  try {
    const id = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid group id." });
    }

    const username = normalizeUsername(req.body.username);
    if (!username) {
      return res.status(400).json({ error: "Please provide username." });
    }

    const group = await GroupChat.findById(id);
    if (!group) {
      return res.status(404).json({ error: "Group chat not found." });
    }

    if (group.creatorUsername === username) {
      return res.status(400).json({
        error: "The creator cannot be removed. Delete the group instead.",
      });
    }

    await GroupChat.updateOne({ _id: id }, { $pull: { members: username } });
    const updated = await GroupChat.findById(id).lean();

    res.status(200).json({
      message: "Member removed.",
      group: {
        id: updated._id.toString(),
        name: updated.name,
        creatorUsername: updated.creatorUsername,
        members: updated.members,
        createdAt: updated.createdAt,
      },
    });
  } catch (err) {
    console.error("DELETE /api/groupchats/:id/members failed:", err);
    res.status(500).json({ error: "Could not remove group member." });
  }
});

// POST /api/groupchats/:id/members
// Body: { username } — adds an existing user to members.
app.post("/api/groupchats/:id/members", async (req, res) => {
  try {
    const id = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid group id." });
    }

    const username = normalizeUsername(req.body.username);
    if (!username) {
      return res.status(400).json({ error: "Please provide username." });
    }

    const group = await GroupChat.findById(id);
    if (!group) {
      return res.status(404).json({ error: "Group chat not found." });
    }

    const members = Array.isArray(group.members) ? group.members : [];
    if (members.includes(username)) {
      return res.status(400).json({
        error: "User is already a member of this group.",
      });
    }

    const user = await findUserByUsername(username);
    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    await GroupChat.updateOne({ _id: id }, { $addToSet: { members: username } });

    const updated = await GroupChat.findById(id).lean();
    res.status(201).json({
      message: "Member added.",
      group: {
        id: updated._id.toString(),
        name: updated.name,
        creatorUsername: updated.creatorUsername,
        members: updated.members,
        createdAt: updated.createdAt,
      },
    });
  } catch (err) {
    console.error("POST /api/groupchats/:id/members failed:", err);
    res.status(500).json({ error: "Could not add group member." });
  }
});

// ---------------------------------------------------------------------------
// Start the server
// ---------------------------------------------------------------------------
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
