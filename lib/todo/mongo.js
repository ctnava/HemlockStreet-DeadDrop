const mongoose = require("mongoose");
async function main() { await mongoose.connect('mongodb://localhost:27017/dstorDB'); }
main().catch(err => console.log(err));

const cidSchema = {
  plain: { type: String, required: true },
  encrypted: { type: String, required: true },
  decKey: { type: String, required: true },
  contract: { type: String }, // DStor.js
  expDate: { type: Number } // DStor.js
};
const CID = mongoose.model("cid", cidSchema);