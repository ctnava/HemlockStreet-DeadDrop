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


module.exports = { ddAbi }