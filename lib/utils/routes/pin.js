const fs = require('fs');
const { ipfs } = require("../../setup/ipfs.js");
const { encryptInputs, encryptFile } = require("../encryption.js");
const { Pin, Cid } = require("../../setup/mongoose.js");


async function uploadEncrypted(fileName, secret) {
    const pathToArchive = await encryptFile(fileName, secret);
    const file = fs.readFileSync(pathToArchive);
    const content = await ipfs.add(file); // breaks here
    await ipfs.pin.add(content.path);

    return (content.path);
}

function saveNewEntry(plain, contract, inputs, secret) {
    const encryptedInputs = encryptInputs(plain, inputs, secret);
    console.log(plain); // COMMENT ME BEFORE PROD
    console.log(encryptedInputs.hash); // COMMENT ME BEFORE PROD

    const pin = new Pin({ 
        plain: plain, 
        cipher: encryptedInputs.hash, 
        contract: contract
    });

    const cid = new Cid({ 
        cipher: encryptedInputs.hash, 
        secret: secret 
    });

    pin.save();
    cid.save();

    const response = { 
        encryptedInputs: encryptedInputs, 
        hash: plain 
    };

    return {response, pin, cid};
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


module.exports = { uploadEncrypted, saveNewEntry, unpin };