require('dotenv').config();
const fs = require('fs');
const { initAll } = require("./lib/setup/all.js"); initAll();
const { app } = require("./lib/setup/app.js");
const { uploadPaths, uploadedPaths } = require("./lib/utils/dirs.js");
const { uploadLabels, uploadedLabels } = require("./lib/utils/labels.js");
const { garble } = require("./lib/utils/encryption");
const { decomposeFile, uploadEncrypted, saveAndValidate, updatePin, unpin, extractKey } = require("./lib/utils/deadDrop.js");
const { deleteFiles } = require("./lib/utils/deletion.js");
const { getContract, verifyMessage } = require("./lib/utils/blockchain.js");


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
      fs.unlinkSync(pathTo.trash);
      fs.unlinkSync(pathTo.file);
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


// HANDLE TRANSACTION
app.post('/transaction', (req, res) => {
  const { contractMetadata, hash, cipher } = req.body;
  const contract = getContract(contractMetadata.contract, contractMetadata.abi, contractMetadata.chainId);

  contract.expirationDates(cipher).then(rawExpDate => {
    const expDate = parseInt(rawExpDate.toString());
    if (expDate === 0) { 
      unpin(hash, cipher).then(success => {
        if (success === true) res.json("err: failure to pay");
        else res.json("err: unpin @ app.post('/unpin')");
      });
    } else {
      updatePin(cipher, expDate).then(success => {
        if (success === true) res.json("success");
        else res.json("err: updatePin @ app.post('/unpin')");
      });
    }
  });
});


// DECRYPT CIPHER
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
// - unzip w/ pw
// - ipfs create error handling + ipfs close needed?
const { Pin } = require("./lib/setup/mongoose.js");
const { createAndFetch } = require("./lib/utils/ipfs.js");
const { quickDecrypt } = require("./lib/utils/encryption.js");
const altKey = process.env.ALT_KEY;
const unzipper = require('unzipper');
// const AdmZip = require('adm-zip');
app.post('/download', (req, res) => {
  const { cipher } = req.body;
  // console.log(cipher);
  if (cipher !== undefined && cipher !== null) {
    const unhashed = quickDecrypt(cipher, altKey);
    Pin.findOne({cipher: unhashed}, (err, foundPin) => {
      if (err) res.json("err: Pin.findOne @ app.post('/download')");
      else {
        const cid = foundPin.plain;
        const secret = foundPin.secret;

        const pathToZip = `./downloads/${cid}.zip`;
        if (fs.existsSync(pathToZip)) fs.unlinkSync(pathToZip);

        const exportDir = `./downloads/decrypted/${cid}`;
        if (fs.existsSync(exportDir)) fs.rmSync(exportDir, {recursive: true});
        fs.mkdirSync(exportDir);

        async function decryptZip() {
          await createAndFetch(cid, pathToZip);
          const zip = await unzipper.Open.file(pathToZip);
          var desiredIdx = 0;
          zip.files.forEach((file, idx) => {if (file.path !== 'garbage.trash') desiredIdx = idx});
          const desiredEntry = zip.files[desiredIdx];

          // const extractedFile = await desiredEntry.buffer(secret);
          // fs.appendFileSync(exportDir + 'desired.pdf', extractedFile);
        }

        decryptZip().then(() => { 
          res.status(200).json("success");
        });
      }
    });
  } else res.json("err: empty cipher @ app.post('/download')");
});

var activeSweep = false; 
const { performSweep } = require("./lib/utils/cleanup.js");
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

