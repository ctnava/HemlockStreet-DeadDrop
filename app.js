require('dotenv').config();
const fs = require('fs');
const md5 = require('md5');

const { initAll } = require("./lib/setup/all.js");
initAll();

const { app } = require("./lib/setup/app.js");
const { Pin, CID } = require("./lib/setup/mongoose.js");
const { ipfs } = require("./lib/setup/ipfs.js");

const { 
  makeKey, 
  quickEncrypt, 
  quickDecrypt, 
  encryptInputs,
  encryptFile, 
  decryptFile 
} = require("./lib/utils/encryption");


// PROCESS INCOMING FILES
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

// DELETE UPLOADED FILES AND TEMP FILES
app.delete('/upload', (req, res) => {
  const { fileName } = req.body;
  if (fileName === undefined) { res.json("failed/undefined") }

  const isTmp = (fileName.slice(0, 4) === "tmp_");
  const message = isTmp ? "Upload aborted!" : "Deletion requested!";
  console.log(message);

  const pathTo = `./uploads/${fileName}`;
  fs.unlinkSync(pathTo);
  if (!fs.existsSync(pathTo)) { res.json("success") }
  else { res.json("failed/deletion") }
});

// ENCRYPT THE FILE, UPLOAD TO IPFS, ENCRYPT THE CONTRACT INPUTS, DATABASE THE PIN, AND THEN RETURN THE ENCRYPTED DATA + PATH
app.post('/pin', (req, res) => {
  const { fileName, contractMetadata, contractInput } = req.body;
  const secret = makeKey(127);
  encryptFile(fileName, secret).then((pathToArchive) => {
    ipfs.add(fs.readFileSync(pathToArchive)).then((result) => {
      ipfs.pin.add(result.path).then(() => {
        fs.unlinkSync(pathToArchive);
        const encryptedInputs = encryptInputs(result.path, contractInput, secret);
  
        const pin = new Pin({ 
          plain: result.path, 
          contract: JSON.stringify(contractMetadata) 
        });
  
        const cid = new CID({ 
          cipher: encryptedInputs.hash, 
          secret: secret 
        });
  
        pin.save();
        cid.save();
  
        const response = { encryptedInputs: encryptedInputs, hash: result.path };
        res.json(response);
      });
    });
  });
});
// encryptFile("advancedapisecurity.pdf", "1234");
