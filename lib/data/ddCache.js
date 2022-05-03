const ddAbi = [
    {
        "inputs": [
            {"internalType": "string", "name": "", "type": "string"}
        ],
        "name": "expirationDates",
        "outputs": [
            {"internalType": "uint256", "name": "", "type": "uint256" }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {"internalType": "string", "name": "query", "type": "string"}
        ],
        "name": "getAddresses",
        "outputs": [
            {"internalType": "address", "name": "from", "type": "address"},
            {"internalType": "address", "name": "to", "type": "address"}
        ],
        "stateMutability": "view",
        "type": "function"
    }
];


ddAddresses = [
    { chainId: 31337, address: "0x5FbDB2315678afecb367f032d93F642f64180aa3" }
];


function checkDropAddress(address, chainId) {
    var valid = false;
    ddAddresses.forEach(entry => {
        const isMatch = (entry.address === address) && (entry.chainId === chainId);
        if (isMatch) valid = true;
    });
    return valid;
}


module.exports = { ddAbi, checkDropAddress }