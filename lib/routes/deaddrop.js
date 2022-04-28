const { app } = require("../setup/app.js");

const { 
    decomposeFile, 
    uploadEncrypted, 
    saveAndValidate, 
    updatePin, 
    unpin, 
    extractKey 
} = require("../utils/deadDrop.js");

const { uploadPaths, uploadedPaths } = require("../utils/dirs.js");
const { uploadLabels, uploadedLabels } = require("../utils/labels.js");
const { garble } = require("../utils/encryption");
const { getContract, verifyMessage } = require("../utils/blockchain.js");
const { deleteFiles, performSweep } = require("../utils/cleanup.js");


var activeSweep = false; 
app.post('/deadDrop/sweep', (req, res) => {
if (activeSweep === true) res.json('err: already active');
else {
  activeSweep = true;
  performSweep().then((success)=>{
    activeSweep = false;
    if (success === true) res.json("success");
    else res.json("err: searchDB @ app.post('/deadDrop/sweep')"); 
  });
}
});

app.route('/deadDrop/upload')
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


app.route('/deadDrop/pin')
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
    else res.json("err: unpin @ app.post('/deadDrop/unpin')");
  });
});


// HANDLE TRANSACTION
app.post('/deadDrop/transaction', (req, res) => {
const { contractMetadata, hash, cipher } = req.body;
const contract = getContract(contractMetadata.contract, contractMetadata.abi, contractMetadata.chainId);

contract.expirationDates(cipher).then(rawExpDate => {
  const expDate = parseInt(rawExpDate.toString());
  if (expDate === 0) { 
    unpin(hash, cipher).then(success => {
      if (success === true) res.json("err: failure to pay");
      else res.json("err: unpin @ app.post('/deadDrop/unpin')");
    });
  } else {
    updatePin(cipher, expDate).then(success => {
      if (success === true) res.json("success");
      else res.json("err: updatePin @ app.post('/deadDrop/unpin')");
    });
  }
});
});


// DECRYPT CIPHER
app.post('/deadDrop/decipher', (req, res) => {
const { cipher, signature } = req.body;
if (cipher !== undefined && cipher !== null) {
  verifyMessage(cipher, signature).then((verdict) => {
    if (verdict === true) {
      extractKey(cipher, res);
    } else res.json("err: signature failure @ app.post('/deadDrop/decipher')");
  });
} else res.json("err: empty cipher @ app.post('/deadDrop/decipher')");
});


// BACKEND TODO 
// - batch message verification
// - unzip w/ pw
// - ipfs create error handling + ipfs close needed?
const { Pin } = require("../setup/mongoose.js");
const { createAndFetch } = require("../utils/ipfs.js");
const { quickDecrypt } = require("../utils/encryption.js");
const altKey = process.env.ALT_KEY;
const unzipper = require('unzipper');
// const AdmZip = require('adm-zip');
app.post('/deadDrop/download', (req, res) => {
const { cipher } = req.body;
// console.log(cipher);
if (cipher !== undefined && cipher !== null) {
  const unhashed = quickDecrypt(cipher, altKey);
  Pin.findOne({cipher: unhashed}, (err, foundPin) => {
    if (err) res.json("err: Pin.findOne @ app.post('/deadDrop/download')");
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
} else res.json("err: empty cipher @ app.post('/deadDrop/download')");
});