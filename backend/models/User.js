const mongoose = require("mongoose");

// =========================
// USER MODEL (accounts + profiles + friendships)
// =========================
// Backend source-of-truth for login, profile edits, RSVPs (by user `_id`),
// friend graphs, messaging participants, etc.
//
// Frontend: Signup/login get a sanitized user (`safeUser` / `publicProfile`) without the password hash.
// Browsers typically cache the logged-in object in localStorage for UI — but admins/owners are
// still re-checked in Mongo (`role`, `creatorUsername`, etc.) before sensitive actions succeed.
//
// User model (field-level notes below)
// ---------------------------------------------------------------------------
// Beginner notes:
// - `username` keeps the casing the user typed (e.g. "AliceDemo"), but is
//   trimmed of leading/trailing whitespace.
// - `usernameLower` is an internal, always-lowercase copy of the username
//   that we use for fast, case-insensitive uniqueness checks and lookups.
//   We auto-fill it in a pre-validate hook so callers never have to set it.
// - `email` was already unique. Now `usernameLower` is unique too, so two
//   users can't share the same username (regardless of casing).
// - `password` is never returned in API responses (see `toJSON` below).
// - `displayName`, `profilePicture`, and `bio` are public profile fields
//   used by the username search route. They're optional with empty
//   defaults so existing signup code keeps working.
// - `profilePicture` can hold one of two things:
//     * the name/id of a built-in default avatar (e.g. "heart"), OR
//     * a Base64-encoded image string for an uploaded picture
//       (typically a data URL like "data:image/png;base64,iVBORw0K...").
//   `profilePictureType` tells the frontend which kind it is, so the
//   frontend knows whether to render a built-in avatar or the raw Base64.
const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },

  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },

  username: {
    type: String,
    required: true,
    trim: true,
  },
  usernameLower: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    index: true,
  },

  // Public profile fields (safe to return from the search route).
  displayName: { type: String, default: "", trim: true },

  // The actual picture value: either a default avatar id/name or a
  // Base64 image string (see profilePictureType below).
  profilePicture: { type: String, default: "" },

  // Tells the frontend how to interpret `profilePicture`:
  //   - "default"  : `profilePicture` is the id/name of a built-in
  //                  avatar (or empty string when the user has not
  //                  picked one yet).
  //   - "uploaded" : `profilePicture` is a Base64 image string the
  //                  user uploaded from their device.
  // Restricted to those two values via `enum` so we never accidentally
  // store a typo. Defaults to "default" for newly created accounts.
  profilePictureType: {
    type: String,
    enum: ["default", "uploaded"],
    default: "default",
  },

  bio: { type: String, default: "", trim: true },

  // Optional fields edited on the Profile page — stored in MongoDB so other
  // users can see them on the public profile (GET /api/users/:username).
  school: { type: String, default: "", trim: true },
  location: { type: String, default: "", trim: true },
  hobbies: {
    type: [String],
    default: [],
  },

  // Accepted friends. We store the *lowercased* username of each friend
  // (the same form as `usernameLower`) so case-insensitive checks like
  // `user.friends.includes(other)` are trivial. The friend routes always
  // normalize input to lowercase before reading/writing this array.
  friends: {
    type: [String],
    default: [],
  },

  // Who can see what on your public profile + messaging (Settings → Privacy).
  // All flags default to true so existing accounts behave like before until changed.
  privacy: {
    publicProfile: { type: Boolean, default: true },
    showHobbies: { type: Boolean, default: true },
    showAttendedEvents: { type: Boolean, default: true },
    allowMessages: { type: Boolean, default: true },
  },

  // Permission level for this user.
  // - "user"  : a normal account (the default for everyone who signs up).
  // - "admin" : unlocked by typing the secret ADMIN_KEY in Settings, which
  //             is verified server-side in /api/settings/admin-key.
  // The frontend reads this off the user object and only shows admin
  // controls (e.g. "Delete event") when role === "admin". The backend
  // ALSO re-checks role in the database before honoring any admin-only
  // operation, so the frontend can never grant itself admin powers.
  role: {
    type: String,
    enum: ["user", "admin"],
    default: "user",
  },

  password: { type: String, required: true },
});

// Keep `usernameLower` in sync with `username` automatically.
// Runs before validation so the `required` check on usernameLower passes
// as long as the caller supplied `username`.
//
// Note: Mongoose 8+ no longer passes a `next` callback to pre/post hooks.
// Hooks are now promise-based, so this function just mutates `this` and
// returns. (Calling a `next` argument here would throw
// "TypeError: next is not a function" on save.)
userSchema.pre("validate", function () {
  if (typeof this.username === "string") {
    this.usernameLower = this.username.trim().toLowerCase();
  }
});

// Strip internal fields (and the password!) from any JSON response.
userSchema.set("toJSON", {
  versionKey: false,
  transform: (_doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.password;
    delete ret.usernameLower;
    return ret;
  },
});

module.exports = mongoose.model("User", userSchema);
