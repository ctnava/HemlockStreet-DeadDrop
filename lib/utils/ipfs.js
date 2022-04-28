require('dotenv').config();
const {create} = require("ipfs-http-client");


const ipfsCredentials = process.env.IPFS_PROJECT_ID+':'+process.env.IPFS_PROJECT_SECRET;

const ipfsAuth = 'Basic ' + Buffer.from(ipfsCredentials).toString('base64');

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


module.exports = {createIpfsClient};