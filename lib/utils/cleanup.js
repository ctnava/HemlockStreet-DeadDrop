const { ipfs } = require("../setup/ipfs.js");
const { Pin } = require("../setup/mongoose.js");
const fs = require('fs');
// const { getContract } = require("../utils/blockchain.js");


async function sweepDB() {
    console.log("Sweeping DB...");
    const now = Math.floor(Date.now() / 1000);
    const expiredPins = await Pin.find({ expDate: { $lte: now } });
    // console.log(expiredPins);
    console.log("expiredPins", expiredPins.length);

    const result = await Pin.deleteMany({ expDate: { $lte: now } });
    console.log("deleteMany", result);
    const successDelete = (expiredPins.length === result.deletedCount);
    if (successDelete === false) return false;
    else { 
        console.log("Successful DB Sweep!");
        if (result.deletedCount === 0) return true;
        else console.log("Sweeping Pins...");
    }

    const remainingPins = await Pin.find({});
    console.log("remainingPins", remainingPins.length);

    var remotePins = [];
    for await (const pin of ipfs.pin.ls()) {
        remotePins.push(pin.cid.toString());
    }
    console.log("remotePins:", remotePins.length);
    console.log("unmatchedPins:", remotePins.length - remainingPins.length);

    var toKeep = [];
    remainingPins.forEach(entry => {toKeep.push(entry.plain)});
    console.log("keeping:", toKeep.length);

    var toRemove = [];
    remotePins.forEach(pin => {
        if (!toKeep.includes(pin)) toRemove.push(pin)
    });
    console.log("removing:", toRemove.length);

    async function rmPins() {
        var rmd = [];
        toRemove.forEach(async (pin, index) => {
            const removed = await ipfs.pin.rm(pin);
            console.log((index + 1) + " || Removed Pin @ " + removed);
            rmd.push(removed);
        }) 
        return rmd;
    }
    rmPins().then(removedPins => {
        return (toRemove === removedPins);
    });
}

function sweepDownloads() {
    const withEnc = fs.readdirSync('./uploads');
    const downloads = withEnc.filter(e => {return e != 'encrypted'});
    console.log(downloads);
    downloads.forEach(file => {
        try {
            const stats = fs.statSync('./uploads/' + file);
            // console.log(stats.mtime);
            let seconds = (new Date().getTime() - stats.mtime) / 1000;
            const isExpired = (file.slice(0,4) === 'tmp_' && seconds > 5) || 
            (file.slice(file.index("."), file.length - 1) === 'trash' && seconds > 60) || 
            (seconds > 300);
            if (isExpired) fs.unlinkSync('./uploads/' + file);
        } catch(e) {console.log(e)}
    });

    const encrypted = fs.readdirSync('./uploads/encrypted');
    console.log(encrypted);
    encrypted.forEach(file => {
        try {
            const stats = fs.statSync('./uploads/encrypted/' + file);
            // console.log(stats.mtime);
            let seconds = (new Date().getTime() - stats.mtime) / 1000;
            if (seconds > 60) fs.unlinkSync('./uploads/encrypted/' + file);
        } catch(e) {console.log(e)}
    });
}


module.exports = { sweepDB, sweepDownloads }