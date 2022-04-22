require('dotenv').config();
const mongoose = require("mongoose");
const encrypt = require("mongoose-encryption");


async function connectMongoDB() { await mongoose.connect(process.env.DB_URL + '/deadDropDB') }

const decryptionKey = process.env.DECRYPTION_KEY;

const pinSchema = new mongoose.Schema({
  plain: { type: String, required: true },
  // encrypted
  contract: { type: String, required: true }, // DStor.js
  expDate: { type: Number } // DStor.js
});
pinSchema.plugin(encrypt, { 
  secret: decryptionKey, 
  encryptedFields: ["contract", "expDate"] 
});

const cidSchema = new mongoose.Schema({
  cipher: { type: String, required: true },
  // encrypted
  secret: { type: String, required: true }
});
cidSchema.plugin(encrypt, { 
  secret: decryptionKey, 
  encryptedFields: ["secret"] 
});

const Pin = mongoose.model("pin", pinSchema);
const CID = mongoose.model("cid", cidSchema);


module.exports = { connectMongoDB, Pin, CID }