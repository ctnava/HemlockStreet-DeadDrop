const fs = require('fs');
const { ipfs } = require("../../setup/ipfs.js");
const { encryptInputs, encryptFile } = require("../encryption.js");
const { Pin, Cid } = require("../../setup/mongoose.js");
const e = require('express');


async function uploadEncrypted(fileName, secret) {
    const pathToArchive = await encryptFile(fileName, secret);
    const file = fs.readFileSync(pathToArchive);
    const content = await ipfs.add(file); // breaks here
    await ipfs.pin.add(content.path);

    return (content.path);
}

async function saveNewEntry(plain, contract, inputs, secret) {
    const encryptedInputs = encryptInputs(plain, inputs, secret);
    console.log("plain", plain); // COMMENT ME BEFORE PROD
    console.log("cipher", encryptedInputs.hash); // COMMENT ME BEFORE PROD

    const data = { 
        encryptedInputs: encryptedInputs, 
        hash: plain 
    };

    const newPin = { 
        plain: plain, 
        cipher: encryptedInputs.hash, 
        contract: contract
    };
    
    const newCid = { 
        cipher: encryptedInputs.hash, 
        secret: secret 
    };

    const pin = await (new Pin(newPin)).save();
    const cid = await (new Cid(newCid)).save();

    return { data, pin, cid };
}

function saveAndValidate(entry, res) {
    console.log("Saving...");
    saveNewEntry(...entry).then((resulting) => {
        if (resulting.pin && resulting.cid && resulting.data) res.json(resulting.data);
        else res.json("err: failed to save pin/cid");
    });
}

async function unpin(hash, cipher, res) {
    const removed = await ipfs.pin.rm(hash);
    Pin.deleteOne({cipher: cipher}).then((err, result) => {
        if (result) res.json("err: failed to expunge Pin record"); 
    });
    Cid.deleteOne({cipher: cipher}).then((err, result) => {
        if (result) res.json("err: failed to expunge Cid record"); 
    });
    console.log("Removed Pin @ " + removed);
}


module.exports = { uploadEncrypted, saveAndValidate, unpin };