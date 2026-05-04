const mongoose = require("mongoose");

// FriendRequest model
// ---------------------------------------------------------------------------
// Tracks one user asking another to be their friend.
//
// Beginner notes:
// - We identify users by their (lowercased) username instead of ObjectId.
//   That keeps the friend routes simple — the frontend can just send the
//   username the user typed and we normalize it.
// - `status` is one of:
//     - "pending":  request was sent and is waiting for the receiver.
//     - "accepted": the receiver accepted; both users are now friends
//                   (the friends array on each User document is updated
//                   in the accept route).
//     - "denied":   the receiver rejected the request. The friends arrays
//                   are NOT touched.
// - We keep `createdAt` so the frontend can sort requests by newest first.
// - We never store passwords or any private info here. This collection is
//   safe to read for friend-request UIs.
// ---------------------------------------------------------------------------
const friendRequestSchema = new mongoose.Schema({
  // Who clicked "Add Friend" (always stored lowercase).
  senderUsername: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    index: true,
  },

  // Who will see this in their incoming requests (always stored lowercase).
  receiverUsername: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    index: true,
  },

  status: {
    type: String,
    enum: ["pending", "accepted", "denied"],
    default: "pending",
    index: true,
  },

  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Hide `_id` / `__v` from JSON responses; expose `id` instead.
friendRequestSchema.set("toJSON", {
  versionKey: false,
  transform: (_doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    return ret;
  },
});

module.exports = mongoose.model("FriendRequest", friendRequestSchema);
