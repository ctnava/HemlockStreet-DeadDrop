require('dotenv').config();
const fs = require('fs');
const { promises } = require('fs');
const { rmPin, addThenPin, createAndFetch } = require("./ipfs.js");
const { encryptInputs, encryptFile, quickEncrypt, quickDecrypt } = require("./encryption.js");
const { saveNewPin, findPin, updatePinExp, deletePin } = require("./pins.js");
const altKey = process.env.ALT_KEY;
const unzipper = require('unzipper');
const path = require('path');
// const AdmZip = require('adm-zip');

function decomposeFile(chunk, chunkIndex, totalChunks) {
    const chunkIdx = parseInt(chunkIndex);
    const chunkNum = (chunkIdx + 1);
    const chunkTotal = parseInt(totalChunks);
    const percentProgress = (chunkNum / chunkTotal) * 100; 
    const isFirstChunk = (chunkIdx === 0 && chunkNum === 1);
    const isLastChunk = (chunkIdx === (chunkTotal - 1)) && (chunkNum === chunkTotal);

    const chunkData = chunk.split(',')[1];
    const chunkBuffer = (Buffer.from(chunkData, 'base64'));

    const decomposed = {
        idx: chunkIdx,
        num: chunkNum,
        tot: chunkTotal,

        isFirst: isFirstChunk,
        isLast: isLastChunk,

        percent: percentProgress,

        contents: chunkBuffer
    };
    return decomposed;
}

async function uploadEncrypted(fileName, secret) {
    const pathToArchive = await encryptFile(fileName, secret);
    const buffer = await promises.readFile(pathToArchive);
    // console.log("buffer", buffer);
    // fs.appendFileSync("./uploads/encrypted/active/test.zip", buffer);
    const pinnedCid = await addThenPin(buffer);
    return pinnedCid;
}

function saveAndValidate(entry, res) {
    // console.log("Saving...");
    const [plain, contract, inputs, secret] = entry;
    const encryptedInputs = encryptInputs(plain, inputs, secret);
    const rehashed = quickEncrypt(encryptedInputs.hash, altKey);
    // console.log(encryptedInputs); // COMMENT ME BEFORE PROD
    console.log("plain", plain); // COMMENT ME BEFORE PROD
    console.log("cipher", encryptedInputs.hash); // COMMENT ME BEFORE PROD
    console.log("rehashed", rehashed); // COMMENT ME BEFORE PROD
    
    const data = { 
        encryptedInputs: {
            hash: rehashed,
            size: encryptedInputs.size,
            type: encryptedInputs.type,
            name: encryptedInputs.name,
            description: encryptedInputs.description,
            recipient: encryptedInputs.recipient
        }, 
        hash: plain 
    };

    const newPin = { 
        plain: plain, 
        cipher: encryptedInputs.hash, 
        secret: secret,
        contract: contract,
        expDate: (Math.floor(Date.now() / 1000) + 60)
    };
    const pin = saveNewPin(newPin);

    if (pin === null || pin === undefined) res.json("err: failed to save pin/cid");
    else {
        console.log("Saved!");
        res.json(data);
    }
}

async function unpin(hash, cipher) {
    const unhashed = quickDecrypt(cipher, altKey);
    const result = await deletePin(unhashed);

    if (result.deletedCount !== 1) return false;
    else return await rmPin(hash);
}

async function updatePin(cipher, expDate) {
    const unhashed = quickDecrypt(cipher, altKey);
    const result = await updatePinExp(unhashed, expDate);

    const success = (result.modifiedCount === 1);
    return success;
}

async function extractKey(cipher, res) {
    const unhashed = quickDecrypt(cipher, altKey);
    const pin = await findPin(unhashed);
    if (pin !== null && pin !== undefined) {
        const secret = pin.secret;
        res.json(secret);
    }
    else res.json("err: Pin.findOne @ app.post('/decipher')");
}

async function getFile(cipher) {
    const unhashed = quickDecrypt(cipher, altKey);
    console.log(unhashed);

    const pin = await findPin(unhashed);
    if (pin === null || pin === undefined) res.json("err: Pin.findOne @ app.post('/download')");
    
    const cid = pin.plain;
    const secret = pin.secret;

    const pathToZip = `./downloads/${cid}.zip`;
    if (fs.existsSync(pathToZip)) fs.unlinkSync(pathToZip);

    await createAndFetch(cid, pathToZip);
    console.log('opening');
    const zip = await unzipper.Open.file(pathToZip);
    console.log(zip);

    let desiredEntry;
    zip.files.forEach((file, idx) => {
        if (file.path !== 'garbage.trash') desiredEntry = zip.files[idx];
    });

    const exportDir = `./downloads/decrypted/${cid}`;
    if (fs.existsSync(exportDir)) fs.rmSync(exportDir, {recursive: true});
    fs.mkdirSync(exportDir);

    const extractedFile = await desiredEntry.buffer(secret);
    fs.appendFileSync(exportDir + 'desired.pdf', extractedFile);
}


module.exports = { decomposeFile, uploadEncrypted, saveAndValidate, updatePin, unpin, extractKey, getFile };