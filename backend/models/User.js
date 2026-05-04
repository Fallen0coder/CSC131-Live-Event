const mongoose = require("mongoose");

// User model
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
  profilePicture: { type: String, default: "" },
  bio: { type: String, default: "", trim: true },

  password: { type: String, required: true },
});

// Keep `usernameLower` in sync with `username` automatically.
// Runs before validation so the `required` check on usernameLower passes
// as long as the caller supplied `username`.
userSchema.pre("validate", function (next) {
  if (typeof this.username === "string") {
    this.usernameLower = this.username.trim().toLowerCase();
  }
  next();
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
