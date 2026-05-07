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
//
// `eventImage` holds a Base64 data URL string from the frontend (what you
// get from FileReader.readAsDataURL), e.g. "data:image/png;base64,..." .
// MongoDB BSON documents max out around 16MB — very large uploads may fail,
// which is acceptable for coursework; production apps use object storage.
//
// `eventImageType` is "uploaded" when the user supplied an image, or ""
// when there is no image.
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
    eventImage: { type: String, default: "" },
    eventImageType: { type: String, default: "", trim: true },
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
