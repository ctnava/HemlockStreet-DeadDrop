require('dotenv').config();
const {create} = require("ipfs-http-client");


const ipfsCredentials = process.env.IPFS_PROJECT_ID+':'+process.env.IPFS_PROJECT_SECRET;

const ipfsAuth = 'Basic ' + Buffer.from(ipfsCredentials).toString('base64');

const ipfs = create({
    host: process.env.IPFS_HOST,
    port: process.env.IPFS_PORT,
    protocol: process.env.IPFS_PROTOCOL,
    headers: { authorization: ipfsAuth }
});


module.exports = {ipfs};