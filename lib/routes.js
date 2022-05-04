const fs = require('fs');

const { uploadPaths, uploadedPaths } = require("./utils/dirs.js");
const { uploadLabels, uploadedLabels } = require("./utils/labels.js");
const { getContract, verifyMessage, verifyMessages } = require("./utils/blockchain.js");
const { ddAbi } = require("./data/ddCache.js");

const { deleteFiles } = require("./utils/cleanup.js");
const { garble } = require("./utils/encryption");
const { createIpfsClient } = require('./utils/ipfs.js');
const { performSweep } = require("./utils/cleanup.js");

const { 
  decomposeFile, 
  uploadEncrypted, 
  saveAndValidate, 
  updatePin, 
  unpin, 
  extractKey, 
  extractKeys,
  getFile 
} = require("./utils/deadDrop.js");


function serviceRoutes(app) {
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
    }).delete((req, res) => { deleteFiles(req.body.fileName, "upload", res) });


    app.route('/pin')
    .post((req, res) => {
        const { fileName, contractMetadata, contractInput } = req.body;
        // console.log(contractInput);
        const nameOf = uploadedLabels(fileName);
        const pathTo = uploadedPaths(nameOf);
        const secret = garble(127);
        // console.log("secret", secret); // COMMENT ME BEFORE PROD
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
        // console.log(contractMetadata);
        const contract = getContract(contractMetadata.address, ddAbi, contractMetadata.chainId);
        const failure = (contract === "unsupported/address" || contract === "unsupported/chainId");
        if (failure === true) res.json("err: bad addr @ app.post('/transaction')");
        else {
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
        }
    });


    app.post('/extension', (req, res) => {
        const { contractMetadata, cipher } = req.body;
        // console.log(req.body);
        const contract = getContract(contractMetadata.address, ddAbi, contractMetadata.chainId);
        if (contract === "unsupported/address") res.json("err: bad addr @ app.post('/transaction')");
        else {
            contract.expirationDates(cipher).then(rawExpDate => {
                const expDate = parseInt(rawExpDate.toString());
                if (expDate !== 0) {
                // console.log(expDate);
                updatePin(cipher, expDate).then(success => {
                    if (success === true) res.json("success");
                    else res.json("err: updatePin @ app.post('/extension')");
                });
                }
            });
        }
    });


    app.post('/decipher', (req, res) => {
        const { cipher, signature } = req.body;
        // console.log(req.body);
        if (cipher !== undefined && cipher !== null
        && signature !== undefined && signature !== null) {
            verifyMessage(cipher, signature).then((verdict) => {
            if (verdict === true) {
                extractKey(cipher, res);
            } else res.json("err: signature failure @ app.post('/decipher')");
            });
        } else res.json("err: empty cipher @ app.post('/decipher')");
    });


    app.post('/batchDecipher', (req, res) => {
        const { ciphers, signature } = req.body;
        // console.log(req.body);
        if (ciphers !== undefined && ciphers !== null
        && signature !== undefined && signature !== null) {
            verifyMessages(ciphers, signature).then((verdict) => {
            if (verdict === true) {
                extractKeys(ciphers, res);
            } else res.json("err: signature failure @ app.post('/batchDecipher')");
            });
        } else res.json("err: empty cipher @ app.post('/batchDecipher')");
    });


    app.post('/download', (req, res) => {
        const { cipher, signature, fileName } = req.body;
        // console.log(req.body);
        const emptyInputs = (cipher === undefined || cipher === null) ||
        (signature === undefined || signature === null) ||
        (fileName === 'undefined.undefined' || fileName === undefined || fileName === null);
        if (emptyInputs) res.json("err: empty cipher @ app.post('/download')");
        else {
            verifyMessage(cipher, signature).then((verdict) => {
                if (verdict !== true) res.json("err: signature failure @ app.post('/download')");
                else {
                getFile(cipher, fileName).then(cid => {
                    if (cid !== false) res.status(200).json(`${cid}`);
                    else res.json("err: Pin.findOne @ app.post('/download')");
                });
                }
            });
        }
    });
}


function maintainenceRoutes(app) {
    app.post("/report", (req, res) => {
        createIpfsClient()
        .then(async (connection) => { 
            const version = await connection.version();
            const sitRep = {
                port: process.env.PORT,
                ipfs: version
            };
            res.json(sitRep);
        });
    });
      

    var activeSweep = false; 
    app.post("/sweep", (req, res) => {
        if (activeSweep === true) res.json('err: already active');
        else {
            activeSweep = true;
            performSweep()
            .then((success) => {
                activeSweep = false;
                if (success === true) res.json("success");
                else res.json("err: searchDB @ app.post('/sweep')"); 
            });
        }
    });
}


function routeServices(app) {
    serviceRoutes(app);
    maintainenceRoutes(app);
}


module.exports = { routeServices }