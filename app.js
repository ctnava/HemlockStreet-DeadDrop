require('dotenv').config();
const fs = require('fs');
const { initAll } = require("./lib/setup/all.js"); initAll();
const { uploadPaths, uploadedPaths } = require("./lib/utils/dirs.js");
const { uploadLabels, uploadedLabels } = require("./lib/utils/labels.js");
const { garble } = require("./lib/utils/encryption");
const { uploadEncrypted, saveAndValidate, updatePin, unpin } = require("./lib/routes/deadDrop/models.js");
const { decomposeUploadInput, showProgress } = require("./lib/routes/deadDrop/upload.js");
const { deleteFiles } = require("./lib/utils/deletion.js");
const { app } = require("./lib/setup/app.js");


// PROCESS INCOMING FILES
app.route('/upload')
  .post((req, res) => {
    const { ext, chunk, chunkIndex, totalChunks } = JSON.parse(req.body.toString());
    // idx, num, tot, isFirst, isLast, percent, contents
    const dataChunk = decomposeUploadInput(chunk, chunkIndex, totalChunks);
    // showProgress(dataChunk.num, dataChunk.idx, dataChunk.percent);

    // tmp, prev, trash, zip
    const nameFor = uploadLabels(ext, req.ip, totalChunks); 
    const pathTo = uploadPaths(nameFor);
    
    if (dataChunk.isFirst) {
      if (fs.existsSync(pathTo.tmp)) {
        // console.log("Duplicate Deleted!");
        fs.unlinkSync(pathTo.tmp); 
      }
      // console.log("Downloading Document...");
    }

    fs.appendFileSync(pathTo.tmp, dataChunk.contents);

    if (dataChunk.isLast) {
      // console.log("Document Downloaded!");
      fs.renameSync(pathTo.tmp, pathTo.prev);
    }
    
    // clientside needs update here to fix
    if (dataChunk.isLast) {
      const finalName = nameFor.prev;
      res.json({finalName});
    } else {
      const tmpName = nameFor.tmp;
      res.json({tmpName});
    }
  })
  .delete((req, res) => {deleteFiles(req.body.fileName, "upload", res)});


// ENCRYPT THE FILE, UPLOAD TO IPFS, ENCRYPT THE CONTRACT INPUTS, DATABASE THE PIN, AND THEN RETURN THE ENCRYPTED DATA + PATH
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
const { Pin, Cid } = require("./lib/setup/mongoose.js");
const { ethers } = require("ethers");
app.post('/transaction', (req, res) => {
  const { contractMetadata, hash, cipher } = req.body;

  const chainId = parseInt(contractMetadata.chainId, 16);
  const isDev = (chainId === 31337 || chainId === 1337);
  const provider = isDev ? 
    new ethers.providers.JsonRpcProvider() : 
    new ethers.providers.JsonRpcProvider(/*FILL ME IN*/);

  const contract = new ethers.Contract(contractMetadata.contract, contractMetadata.abi, provider);

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

// TODO 
// - implement message verification
// BACKEND 
// - implement bcrypt on ciphers
// - File corrupts just before upload to IPFS is complete (delay deletion?)
// - Figure out Download from IPFS

// DECRYPT CIPHER
const { verifyMessage } = require('./lib/utils/blockchain.js');
app.post('/decipher', (req, res) => {
  const { cipher } = req.body;
  
  if (cipher !== undefined && cipher !== null) {
  // verifyMessage({ cipher, address, signature }).then((verdict) => {
  //   if (verdict !== true) { res.json("err: signature failure @ app.post('/decipher')") }
  //   else {
      Cid.findOne({cipher: cipher}).then((found, err) => {
        if (err) res.json("err: Cid.findOne @ app.post('/decipher')");
        else {
          const secret = found.secret;
          res.json(secret);
        }
      });
  //   }
  // });
  } else res.json("err: empty cipher @ app.post('/decipher')");
});


const { ipfs } = require("./lib/setup/ipfs.js");
const { CID } = require("multiformats/cid");
app.post('/download', (req, res) => {
  const { cipher } = req.body;
  if (cipher !== undefined && cipher !== null) {
    Pin.findOne({cipher: cipher}, (foundPin, err) => {
      if (err) res.json("err: Pin.findOne @ app.post('/download')");
      else {
        const cidString = foundPin.plain;
        console.log(cidString); // COMMENT ME BEFORE PROD
        const cid = CID.parse(cidString);

        if (fs.existsSync(`./downloads/${cidString}.zip`)) fs.unlinkSync(`./downloads/${cidString}.zip`);

        async function getData() {
          let asyncitr = ipfs.get(cid);
          for await (const itr of asyncitr) {
            console.log(itr);
            fs.appendFileSync(`./downloads/${cidString}.zip`, Buffer.from(itr));
          }
        }
        
        getData().then(() => {res.json("success")});
      }
    });
  } else res.json("err: empty cipher @ app.post('/download')");
})