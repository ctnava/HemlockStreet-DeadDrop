require('dotenv').config();
const mongoose = require("mongoose");
const encrypt = require("mongoose-encryption");


async function connectMongoDB() { await mongoose.connect(process.env.DB_URL + '/deadDropDB') }

const pinSchema = new mongoose.Schema({
  plain: { type: String, required: true },
  contract: { type: String, required: true }, // DStor.js
  expDate: { type: Number } // DStor.js
});

const cidSchema = new mongoose.Schema({
  cipher: { type: String, required: true },
  secret: { type: String, required: true }
});

pinSchema.plugin(encrypt, { secret: process.env.DECRYPTION_KEY, encryptedFields: ["contract", "expDate"] });
cidSchema.plugin(encrypt, { secret: process.env.DECRYPTION_KEY, encryptedFields: ["secret"] });

const Pin = mongoose.model("pin", pinSchema);
const CID = mongoose.model("cid", cidSchema);


module.exports = { connectMongoDB, Pin, CID }