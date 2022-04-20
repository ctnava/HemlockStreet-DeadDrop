const IPFS = require('ipfs-core');

async function dev() {
    const ipfs = await IPFS.create();
    const config = await ipfs.config.getAll();
    console.log(config);
}
  
dev();