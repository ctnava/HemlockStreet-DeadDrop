require('dotenv').config();
const { promises } = require('fs');
const { rmPin, addThenPin } = require("./ipfs.js");
const { encryptInputs, encryptFile, quickEncrypt, quickDecrypt } = require("./encryption.js");
const { Pin } = require("../setup/mongoose.js");
const altKey = process.env.ALT_KEY;

async function uploadEncrypted(fileName, secret) {
    const pathToArchive = await encryptFile(fileName, secret);
    const buffer = await promises.readFile(pathToArchive); 
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
    const pin = (new Pin(newPin)).save();

    if (pin === null || pin === undefined) res.json("err: failed to save pin/cid");
    else {
        console.log("Saved!");
        res.json(data);
    }
}

async function unpin(hash, cipher) {
    const unhashed = quickDecrypt(cipher, altKey);
    // console.log("rehashed", cipher); // COMMENT ME BEFORE PROD
    // console.log("unhashed", unhashed); // COMMENT ME BEFORE PROD

    const pinRes = await Pin.deleteOne({cipher: unhashed});
    console.log("Pin.deleteOne", pinRes);

    if (pinRes.deletedCount !== 1) return false;
    else return await rmPin(hash);
}

async function updatePin(cipher, expDate) {
    const unhashed = quickDecrypt(cipher, altKey);
    // console.log("rehashed", cipher); // COMMENT ME BEFORE PROD
    // console.log("unhashed", unhashed); // COMMENT ME BEFORE PROD

    const result = await Pin.updateOne({ cipher: unhashed}, { $set: {expDate:expDate} })
    console.log("Pin.updateOne", result);
    if (result.modifiedCount === 1) return true;
    else return false;
}

function extractKey(cipher, res) {
    const unhashed = quickDecrypt(cipher, altKey);
    Pin.findOne({cipher: unhashed}).then((found, err) => {
        if (err) res.json("err: Pin.findOne @ app.post('/decipher')");
        else {
          const secret = found.secret;
          res.json(secret);
        }
    });
}


module.exports = { uploadEncrypted, saveAndValidate, updatePin, unpin, extractKey };