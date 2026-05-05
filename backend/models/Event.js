const mongoose = require("mongoose");

// ---------------------------------------------------------------------------
// Event model
// ---------------------------------------------------------------------------
// One document per event in the database. The required fields below match
// what POST /api/events validates on the server. `time`, `category`, and
// `creatorUsername` are optional so older records (and the seeded samples)
// stay valid even if they were created before those fields existed.
//
// `createdAt` is filled in automatically by Mongoose because we set
// `timestamps: { createdAt: true, updatedAt: false }` on the schema. That
// gives us a real Date we can sort by ("newest first") in GET /api/events.
// ---------------------------------------------------------------------------
const eventSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    date: { type: String, required: true, trim: true },
    time: { type: String, default: "", trim: true },
    location: { type: String, required: true, trim: true },
    category: { type: String, default: "", trim: true },
    description: { type: String, required: true, trim: true },
    creatorUsername: { type: String, default: "", trim: true },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

eventSchema.set("toJSON", {
  versionKey: false,
  transform: (_doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    return ret;
  },
});

module.exports = mongoose.model("Event", eventSchema);
