require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs');
const md5 = require('md5');
const {create} = require("ipfs-http-client");
const mongoose = require("mongoose");
const encrypt = require("mongoose-encryption");


const ipfsCredentials = process.env.IPFS_PROJECT_ID+':'+process.env.IPFS_PROJECT_SECRET;
const ipfsAuth = 'Basic ' + Buffer.from(ipfsCredentials).toString('base64');
const ipfs = create({
  host: process.env.IPFS_HOST,
  port: process.env.IPFS_PORT,
  protocol: process.env.IPFS_PROTOCOL,
  headers: { authorization: ipfsAuth }
  });
ipfs.version().then((version) => { console.log(version, "IPFS Node Ready"); });

async function connectMongoDB() { await mongoose.connect(process.env.DB_URL + '/deadDropDB') }
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

app.use(cors({origin: process.env.CLIENT_URL}));

app.use('/uploads', express.static('uploads'));

// app.set('view engine', 'ejs');
// app.use(express.static("public"));

app.post('/upload', (req, res) => {
  const { chunk, ext, chunkIndex, totalChunks } = JSON.parse(req.body.toString());
  const chunkNum = (parseInt(chunkIndex) + 1);
  // const progress = (chunkNum / parseInt(totalChunks)) * 100;

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

const { makeKey, quickEncrypt, encryptFile, decryptFile, quickDecrypt } = require("./lib/utils/encryption");
app.post('/pin', (req, res) => {
  const { fileName, contractMetadata, contractInput } = req.body;
  const finalPath = `./uploads/encrypted/${fileName.split(".")[0]}`;
  const secret = makeKey(2048);
  encryptFile(`./uploads/${fileName}`, finalPath, secret);

  ipfs.add(fs.readFileSync(finalPath)).then((result) => {
    ipfs.pin.add(result.path).then(() => {
      fs.unlinkSync(finalPath);
      const encryptedInputs = {
        hash: quickEncrypt(result.path, secret),
        size: contractInput.size,
        type: quickEncrypt(contractInput.type, secret),
        name: quickEncrypt(contractInput.name, secret),
        description: quickEncrypt(contractInput.description, secret),
        recipient: contractInput.recipient
      };

      const pin = new Pin({ plain: result.path, contract: contractMetadata });
      const cid = new CID({ cipher: JSON.stringify(encryptedInputs.hash), secret: secret });

      const response = { encryptedInputs: encryptedInputs, hash: result.path };
      res.json(response);
      
    });
  });
});

const originalPdf = fs.readFileSync("./uploads/advancedapisecurity.pdf").toString();
const decryptedPdf = decryptFile("./uploads/encrypted/advancedapisecurity", "./uploads/decrypted/advancedapisecurity.pdf", "1234")
console.log(originalPdf ===  decryptedPdf)

app.listen(process.env.PORT || 4001, () => { console.log("Server started"); });