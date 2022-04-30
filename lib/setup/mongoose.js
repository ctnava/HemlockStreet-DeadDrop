require('dotenv').config();
const mongoose = require("mongoose");
const encrypt = require("mongoose-encryption");


async function connectMongoDB() { 
  await mongoose.connect(process.env.DB_URL + '/deadDropDB');
}

const decryptionKey = process.env.DECRYPTION_KEY;
const pinSchema = new mongoose.Schema({
  plain: { type: String, required: true },
  cipher: { type: String, required: true },
  secret: { type: String, required: true }, // decryption
  contract: { type: String, required: true }, // contractInteraction
  expDate: { type: Number, required: true } // sweeps
});
pinSchema.plugin(encrypt, { 
  secret: decryptionKey, 
  encryptedFields: ["secret"] 
});

const Pin = mongoose.model("pin", pinSchema);


module.exports = { connectMongoDB, Pin }