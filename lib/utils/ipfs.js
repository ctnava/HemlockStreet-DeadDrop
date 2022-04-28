require('dotenv').config();
const ipfsCredentials = process.env.IPFS_PROJECT_ID+':'+process.env.IPFS_PROJECT_SECRET;
const ipfsAuth = 'Basic ' + Buffer.from(ipfsCredentials).toString('base64');


const {create} = require("ipfs-http-client");
async function createIpfsClient() {
    const ipfs = await create({
        host: process.env.IPFS_HOST,
        port: process.env.IPFS_PORT,
        protocol: process.env.IPFS_PROTOCOL,
        headers: { authorization: ipfsAuth }
    });
    const info = await ipfs.version();
    console.log("IPFS Node Ready || V" + info.version);
    // error handling needed
    return ipfs;
}

async function getAllPinsExcept(thisType) {
    const ipfs = await createIpfsClient();

    var remotePins = [];
    for await (const pin of ipfs.pin.ls()) if (pin.type !== thisType) remotePins.push(pin.cid.toString());
    
    console.log("remotePins:", remotePins.length);
    return remotePins;
}

async function getAllPinsOfType(thisType) {
    const ipfs = await createIpfsClient();

    var remotePins = [];
    for await (const pin of ipfs.pin.ls()) if (pin.type === thisType) remotePins.push(pin.cid.toString());
    
    console.log("remotePins:", remotePins.length);
    return remotePins;
}

async function getAllPins() {
    const ipfs = await createIpfsClient();

    var remotePins = [];
    for await (const pin of ipfs.pin.ls()) remotePins.push(pin.cid.toString());

    console.log("remotePins:", remotePins.length);
    return remotePins;
}

async function addThenPin(buffer) {
    const ipfs = await createIpfsClient();

    const content = await ipfs.add({content: buffer});
    const pinnedCid = await ipfs.pin.add(content.path.toString());

    return (pinnedCid.toString());
}

async function rmPin(cid) {
    const ipfs = await createIpfsClient();
    
    const removed = await ipfs.pin.rm(cid);
    
    console.log("Removed Pin @ " + removed);
    return (removed !== null && removed !== undefined);
}

async function rmPins(toRemove) {
    const ipfs = await createIpfsClient();

    var removed = [];
    toRemove.forEach(async (cid, index) => {
        const rmd = await ipfs.pin.rm(cid);
        console.log((index + 1) + " || Removed Pin @ " + rmd);
        removed.push(rmd);
    });

    console.log("removedPins:", removed.length);
    return (toRemove === removed);
}


const makeIpfsFetch = require('js-ipfs-fetch');
const fs = require('fs');
async function createAndFetch(cid, pathTo) {
    const ipfs = await createIpfsClient();
    const fetch = await makeIpfsFetch({ipfs});
    const fakeResponse = await fetch(`ipfs://${cid}`, {method: 'GET'});
    for await (const itr of fakeResponse.body) fs.appendFileSync(pathTo, Buffer.from(itr));
}


module.exports = {
    createIpfsClient, 

    getAllPins,
    getAllPinsExcept,
    getAllPinsOfType,

    addThenPin,

    rmPin,
    rmPins,
    
    createAndFetch
};