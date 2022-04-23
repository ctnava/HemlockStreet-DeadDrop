require('dotenv').config();
const fs = require('fs');
const { initAll } = require("./lib/setup/all.js"); initAll();
const { uploadPaths } = require("./lib/utils/dirs.js");
const { uploadLabels } = require("./lib/utils/labels.js");
const { deleteFiles } = require("./lib/utils/deletion.js");
const { app } = require("./lib/setup/app.js");


// PROCESS INCOMING FILES
const { decomposeUploadInput, showProgress } = require("./lib/utils/routes/upload.js");
app.route('./upload')
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
const { garble } = require("./lib/utils/encryption");
const { uploadEncrypted, saveNewEntry, unpin } = require("./lib/utils/routes/pin.js");
app.route('/pin')
  .post((req, res) => {
    const { fileName, contractMetadata, contractInput } = req.body;
    const secret = garble(127);
    console.log(secret); // COMMENT ME BEFORE PROD
    uploadEncrypted(fileName, secret).then(pathTo => {
      const entry = [
        pathTo, 
        JSON.stringify(contractMetadata), 
        JSON.stringify(contractInput), 
        secret
      ];
      const { response, pin, cid } = saveNewEntry(...entry);
      res.json(response);
    });
  })
  .delete((req, res) => {
    const { hash, cipher } = req.body;
    console.log(req.body);
    unpin(hash, cipher, res)
      .then(() => {res.json("success")})
      .catch(err => {
        console.log(err);
        res.json("err: unpin @ app.post('/unpin')");
    });
  });

const { ipfs } = require("./lib/setup/ipfs.js");
const { Pin, Cid } = require("./lib/setup/mongoose.js");
const { ethers } = require("ethers");
// HANDLE TRANSACTION
app.post('/transaction', (req, res) => {
  const { contractMetadata, hash, cipher } = req.body;

  const chainId = parseInt(contractMetadata.chainId, 16);
  const isDev = (chainId === 31337 || chainId === 1337);
  const provider = isDev ? 
    new ethers.providers.JsonRpcProvider() : 
    new ethers.providers.JsonRpcProvider(/*FILL ME IN*/);

  const contract = new ethers.Contract(contractMetadata.contract, contractMetadata.abi, provider);

  const query = { plain: hash, cipher: cipher, contract: JSON.stringify(contractMetadata) };
  contract.expirationDates(cipher).then(expBigNum => {
    const expDate = parseInt(expBigNum.toString());
    if (expDate === 0) { 
      ipfs.pin.rm(hash).then(pin => { 
        console.log("Removed Pin @ " + pin);
        Pin.deleteOne({cipher: cipher}).then(() => {
          Cid.deleteOne({cipher: cipher}).then(() => {
            res.json("err: failure to pay");
          }).catch((err) => {res.json("err: Cid.deleteOne @ app.post('/transaction') || ", err)});
        }).catch((err) => {res.json("err: Pin.deleteOne @ app.post('/transaction') || ", err)});
      });
    } else {
      Pin.updateOne(query, {expDate: expDate}, (err) => {
        if (err) { res.json("err: Pin.updateOne @ app.post('/transaction') || ", err) } 
        else { res.json("success") }
      });
    }
  });
});

// TODO 
// FRONTEND - add extensions for time
// BACKEND 
// - implement message verification
// - File corrupts just before upload to IPFS is complete (delay deletion?)
// - Figure out Download from IPFS
// - implement clientside decryption

// const { verifyMessage } = require('./lib/utils/blockchain.js');
app.post('/decipher', (req, res) => {
  const { cipher } = req.body;
  function returnSecret() {
    Cid.findOne({cipher: cipher}, (err, foundCid) => {
      if (err) res.json("err: Cid.findOne @ app.post('/decipher') || ", err);
      else res.json(foundCid.secret);
    });
  }
  returnSecret();
  // verifyMessage({ cipher, address, signature }).then((verdict) => {
  //   if (verdict !== true) { res.json("failure") }
  //   else {

  //   }
  // });
});

// DECRYPT CIPHER
const { CID } = require("multiformats/cid");
app.post('/download', (req, res) => {
  const { cipher } = req.body;
  Pin.findOne({cipher: cipher}, (err, foundPin) => {
    if (err) res.json("err: Pin.findOne @ app.post('/download') || ", err);
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
})