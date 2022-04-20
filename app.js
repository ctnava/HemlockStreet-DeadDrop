require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs');
const md5 = require('md5');
const IPFS = require('ipfs-core');
const mongoose = require("mongoose");
const encrypt = require("mongoose-encryption");
const CryptoJS = require("crypto-js");

const ipfs = IPFS.create().then((res) => {return res});
async function connectMongoDB() { await mongoose.connect('mongodb://localhost:27017/dstorDB') }
connectMongoDB().catch(err => console.log(err));

const pinSchema = new mongoose.Schema({
  plain: { type: String, required: true },
  contract: { type: String, required: true }, // DStor.js
  expDate: { type: Number } // DStor.js
});
pinSchema.plugin(encrypt, { secret: process.env.DECRYPTION_KEY, encryptedFields: ["contract", "expDate"] });
const Pin = mongoose.model("pin", pinSchema);

const cidSchema = new mongoose.Schema({
  cipher: { type: String, required: true },
  secret: { type: String, required: true }
});
cidSchema.plugin(encrypt, { secret: process.env.DECRYPTION_KEY, encryptedFields: ["secret"] });
const CID = mongoose.model("cid", cidSchema);

const app = express();

app.use(bodyParser.raw({type: 'application/octet-stream', limit:'10gb'}));
app.use(bodyParser.json());

app.use(cors({origin: 'http://localhost:3000'}));

app.use('/uploads', express.static('uploads'));

// app.set('view engine', 'ejs');
// app.use(express.static("public"));

app.post('/upload', (req, res) => {
  const { chunk, ext, chunkIndex, totalChunks } = JSON.parse(req.body.toString());
  const chunkNum = (parseInt(chunkIndex) + 1);
  const progress = (chunkNum / parseInt(totalChunks)) * 100;

  const rawChunk = chunk.split(',')[1];
  const buffer = (Buffer.from(rawChunk, 'base64')); // console.log(buffer.length/1024);

  function addExt(fileName) { return `${fileName}.${ext}` }
  const tmpName = addExt('tmp_' + md5(req.ip + totalChunks));
  const finalName = addExt(md5(Date.now() + req.ip)); // console.log(tmpName, finalName);

  function uploadPath(fileName) { return `./uploads/${fileName}` }
  const tmpPath = uploadPath(tmpName);
  const finalPath = uploadPath(finalName); // console.log(tmpPath, finalPath);

  const firstChunk = (chunkIndex === 0);
  if (firstChunk) {
    if (fs.existsSync(tmpPath)) {
      console.log("Duplicate Deleted!");
      fs.unlinkSync(tmpPath); 
    }
    console.log("Downloading Document...");
  }

  fs.appendFileSync(tmpPath, buffer);
  // console.log(`Getting Chunk ${chunkNum} of ${totalChunks} || ${progress}%`);
  
  const lastChunk = (chunkNum === parseInt(totalChunks));
  if (lastChunk) {
    console.log("Document Received!");
    fs.renameSync(tmpPath, finalPath);
    res.json({finalName});
  } else {res.json({tmpName})}
});

app.delete('/upload', (req, res) => {
  const { fileName } = req.body;
  if (fileName === undefined) { res.json("failed/undefined") }
  else {
    if (fileName.slice(0, 3) === "tmp") { console.log("Upload aborted! Clearing artifacts...") }
    else { console.log("Deletion requested! Removing file..."); }
  }
  const pathTo = `./uploads/${fileName}`
  if (!fs.existsSync(pathTo)) { 
    const altPath = `./pinned/${fileName.split(".")[0]}`;
    if (!fs.existsSync(altPath)) { res.json("failed/notFound") }
    else {
      fs.unlinkSync(altPath);
      if (!fs.existsSync(altPath)) { res.json("success") }
      else { res.json("failed/deletion"); }
    }
    
  } else {
    fs.unlinkSync(pathTo);
    if (!fs.existsSync(pathTo)) { res.json("success") }
    else { res.json("failed/deletion") }
  }
});

app.post('/pin', (req, res) => {
  const { fileName, contractMetadata, contractInput } = req.body;
  const finalPath = `./pinned/${fileName.split(".")[0]}`;
  fs.renameSync(`./uploads/${fileName}`, finalPath);
  const fileObject = {
    path: finalPath,
    contents: fs.readFileSync(finalPath)
  };

  function makeKey(length) {
    var result           = '';
    var characters       = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*?';
    var charactersLength = characters.length;
    for ( var i = 0; i < length; i++ ) {
      result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
  }
  function quickEncrypt(data, key) { return CryptoJS.AES.encrypt(data, key).toString() }

  ipfs.add(fileObject, { pin: true}).then((upload) => {
    const secret = makeKey(2048);
    const encryptedInputs = {
      hash: quickEncrypt(upload.cid, secret),
      size: contractInput.size,
      type: quickEncrypt(contractInput.type, secret),
      name: quickEncrypt(contractInput.name, secret),
      description: quickEncrypt(contractInput.description, secret),
      recipient: contractInput.recipient
    };
    const pin = new Pin({ plain: upload.cid, contract: contractMetadata });
    const cid = new CID({ cipher: JSON.stringify(encryptedInputs.hash), secret: secret });
    res.json(encryptedInputs);
  });
});

  // const lSecret = makeKey(2048);
  // const eData = quickEncrypt("hash", lSecret);
  // const dData = CryptoJS.AES.decrypt(eData, lSecret).toString(CryptoJS.enc.Utf8);


app.listen(process.env.PORT || 4001, () => { console.log("Server started"); });