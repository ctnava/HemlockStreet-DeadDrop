const { ethers } = require("ethers");

class DStor {
    metadata = { address: undefined, abi: undefined, chainId: undefined }; 
    provider = undefined; contract = undefined;

    constructor(chainId) {
        const init = async () => {
            const endpoints = await import("../data/endpoints.json");
            const stored = await import(`../data/${chainid}/DStor-address.json`);
            const compiled = await import(`../data/${chainid}/DStor.json`);
    
            this.provider = new ethers.providers.JsonRpcProvider(endpoints[chainId]);
            this.contract = new ethers.Contract(stored.address, compiled.abi, provider);
            this.metadata = {
                address: stored.address,
                abi: compiled.abi,
                chainId: chainId
            }; 

            return `DStor initialized on chain ${this.metadata.chainId} at ${this.metadata.address}`;
        }
        init().then((message) => { console.log(message) });
    }

    get details() { return JSON.stringify(this.metadata) }

    async getExpiration(encryptedCID) {
        const expDate = await this.contract.expirationDates(encryptedCID);
        return expDate;
    }
}

module.exports.DStor;