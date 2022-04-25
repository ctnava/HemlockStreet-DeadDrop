const fs = require('fs');
const { ipfs } = require("../setup/ipfs.js");
const { encryptInputs, encryptFile } = require("./encryption.js");
const { Pin } = require("../setup/mongoose.js");


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
        secret: secret,
        contract: contract
    };

    const pin = await (new Pin(newPin)).save();

    return { data, pin };
}

function saveAndValidate(entry, res) {
    console.log("Saving...");
    saveNewEntry(...entry).then((resulting) => {
        if (resulting.pin && resulting.data) res.json(resulting.data);
        else res.json("err: failed to save pin/cid");
    });
}

async function updatePin(cipher, expDate) {
    const result = await Pin.updateOne({ cipher: cipher}, { $set: {expDate:expDate} })
    console.log("Pin.updateOne", result);
    if (result.modifiedCount === 1) return true;
    else return false;

}

async function unpin(hash, cipher) {
    const removed = await ipfs.pin.rm(hash);
    console.log("Removed Pin @ " + removed);

    const pinRes = await Pin.deleteOne({cipher: cipher});
    console.log("Pin.deleteOne", pinRes);

    const success = (pinRes.deletedCount === 1);
    return success;
}


module.exports = { uploadEncrypted, saveAndValidate, updatePin, unpin };