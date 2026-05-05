const mongoose = require("mongoose");

// Message model
// ---------------------------------------------------------------------------
// Stores one direct message from one user to another.
//
// Both usernames are stored in lowercase (same convention as FriendRequest
// and User.usernameLower) so lookups are always case-insensitive.
//
// The compound index on { senderUsername, receiverUsername, createdAt }
// makes the two most common queries fast:
//   - "all messages between A and B" (filter on sender+receiver pair)
//   - "conversation list for a user"  (filter on sender or receiver field)
// ---------------------------------------------------------------------------
const messageSchema = new mongoose.Schema({
  senderUsername: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    index: true,
  },

  receiverUsername: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    index: true,
  },

  text: {
    type: String,
    required: true,
    trim: true,
  },

  createdAt: {
    type: Date,
    default: Date.now,
  },

  read: {
    type: Boolean,
    default: false,
  },
});

messageSchema.index({ senderUsername: 1, receiverUsername: 1, createdAt: 1 });

messageSchema.set("toJSON", {
  versionKey: false,
  transform: (_doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    return ret;
  },
});

module.exports = mongoose.model("Message", messageSchema);
