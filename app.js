require('dotenv').config();
const fs = require('fs');
const { initAll } = require("./lib/setup/all.js"); initAll();
const { app } = require("./lib/setup/app.js");
const { uploadPaths, uploadedPaths } = require("./lib/utils/dirs.js");
const { uploadLabels, uploadedLabels } = require("./lib/utils/labels.js");
const { garble } = require("./lib/utils/encryption");

const { 
  decomposeFile, 
  uploadEncrypted, 
  saveAndValidate, 
  updatePin, 
  unpin, 
  extractKey, 
  getFile 
} = require("./lib/utils/deadDrop.js");

const { getContract, verifyMessage } = require("./lib/utils/blockchain.js");
const { deleteFiles, performSweep } = require("./lib/utils/cleanup.js");

var activeSweep = false; 
app.post("/sweep", (req, res) => {
  if (activeSweep === true) res.json('err: already active');
  else {
    activeSweep = true;
    performSweep().then((success)=>{
      activeSweep = false;
      if (success === true) res.json("success");
      else res.json("err: searchDB @ app.post('/sweep')"); 
    });
  }
});


app.route('/upload')
  .post((req, res) => {
    const { ext, chunk, chunkIndex, totalChunks } = JSON.parse(req.body.toString());
    // idx, num, tot, isFirst, isLast, percent, contents
    const dataChunk = decomposeFile(chunk, chunkIndex, totalChunks);
    // console.log(`Getting Chunk ${dataChunk.num} of ${dataChunk.total} || ${dataChunk.percent}%`);

    // tmp, prev, trash, zip
    const nameFor = uploadLabels(ext, req.ip, totalChunks); 
    const pathTo = uploadPaths(nameFor);
    
    const shouldDelete = (dataChunk.isFirst && fs.existsSync(pathTo.tmp));
    if (shouldDelete === true) fs.unlinkSync(pathTo.tmp);
    fs.appendFileSync(pathTo.tmp, dataChunk.contents);

    if (dataChunk.isLast) {
      fs.renameSync(pathTo.tmp, pathTo.prev);
      res.json({finalName: nameFor.prev});
    } else res.json({tmpName: nameFor.tmp});
  })
  .delete((req, res) => {deleteFiles(req.body.fileName, "upload", res)});


app.route('/pin')
  .post((req, res) => {
    const { fileName, contractMetadata, contractInput } = req.body;
    console.log(contractInput);
    const nameOf = uploadedLabels(fileName);
    const pathTo = uploadedPaths(nameOf);
    const secret = garble(127);
    console.log("secret", secret); // COMMENT ME BEFORE PROD
    uploadEncrypted(fileName, secret).then(cid => {
      if (fs.existsSync(pathTo.trash)) fs.unlinkSync(pathTo.trash);
      if (fs.existsSync(pathTo.file)) fs.unlinkSync(pathTo.file);
      const entry = [cid, JSON.stringify(contractMetadata), contractInput, secret];
      saveAndValidate(entry, res);
    });
  })
  .delete((req, res) => {
    const { hash, cipher } = req.body;
    // console.log(req.body);
    unpin(hash, cipher).then(success => {
      if (success === true) res.json("success");
      else res.json("err: unpin @ app.post('/unpin')");
    });
  });


app.post('/transaction', (req, res) => {
  const { contractMetadata, hash, cipher } = req.body;
  const contract = getContract(contractMetadata.contract, contractMetadata.abi, contractMetadata.chainId);

  contract.expirationDates(cipher).then(rawExpDate => {
    const expDate = parseInt(rawExpDate.toString());
    if (expDate === 0) { 
      unpin(hash, cipher).then(success => {
        if (success === true) res.json("err: failure to pay");
        else res.json("err: unpin @ app.post('/transaction')");
      });
    } else {
      updatePin(cipher, expDate).then(success => {
        if (success === true) res.json("success");
        else res.json("err: updatePin @ app.post('/transaction')");
      });
    }
  });
});


app.post('/decipher', (req, res) => {
  const { cipher, signature } = req.body;
  if (cipher !== undefined && cipher !== null) {
    verifyMessage(cipher, signature).then((verdict) => {
      if (verdict === true) {
        extractKey(cipher, res);
      } else res.json("err: signature failure @ app.post('/decipher')");
    });
  } else res.json("err: empty cipher @ app.post('/decipher')");
});


// BACKEND TODO 
// - batch message verification
// - unzip w/ pw ADD SIG VERIFICATION
// - ipfs close needed?
// - ipfs/rmPins resolves too quickly
app.post('/download', (req, res) => {
  const { cipher, signature, fileName } = req.body;
  console.log(req.body);
  const emptyInputs = (cipher === undefined || cipher === null) ||
  (signature === undefined || signature === null) ||
  (fileName === 'undefined.undefined' || fileName === undefined || fileName === null);
  if (emptyInputs) res.json("err: empty cipher @ app.post('/download')");
  else {
    verifyMessage(cipher, signature).then((verdict) => {
        if (verdict !== true) res.json("err: signature failure @ app.post('/download')");
        else {
          getFile(cipher, fileName).then(success => {
            if (success === true) res.status(200).json("success");
            else res.json("err: Pin.findOne @ app.post('/download')");
          });
        }
    });
  }
});