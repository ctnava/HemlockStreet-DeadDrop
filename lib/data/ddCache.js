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
    { chainId: 4, address: "0xeE6dCD764bF1dad23609864CdC219A400FfcB5De" }
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