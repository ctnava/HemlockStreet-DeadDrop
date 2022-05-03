require('dotenv').config();
const { quickDecrypt } = require("../utils/encryption.js");
const { findPin } = require("../utils/pins.js");
const { ethers } = require("ethers");
const { ddAbi, checkDropAddress } = require("../data/ddCache.js");
const mNodeKey = process.env.MORALIS_KEY;
const aMNodeKey = process.env.ALCHEMY_OPTM_KEY;
const aTNodeKey = process.env.ALCHEMY_OPTT_KEY;
const messageKey = process.env.BC_KEY;


const invalidChain = "unsupported/chainId";
function getProvider(chainId) {
  const isDev = (chainId === 31337 || chainId === 1337);
  // console.log(isDev); // COMMENT ME BEFORE PROD
  if (isDev) return new ethers.providers.JsonRpcProvider();
  else {
    const mRegions = ["speedy-nodes-nyc"];
    const mUrl = `https://${mRegions[0]}.moralis.io/${mNodeKey}/`;
    const aUrl = `g.alchemy.com/v2/`;
    var endpoint;
    switch (chainId) {
      case 1:
        endpoint = mUrl + "eth/mainnet";
      case 3:
        endpoint = mUrl + "eth/ropsten";
      case 4:
        endpoint = mUrl + "eth/rinkeby";
      case 42:
        endpoint = mUrl + "eth/kovan";
      case 420:
        endpoint = mUrl + "eth/goerli";
      case 10:
        endpoint = "https://opt-mainnet." + aUrl + aMNodeKey;
      case 69:
        endpoint = "https://opt-kovan." + aUrl + aTNodeKey;
      case 56:
        endpoint = mUrl + "bsc/mainnet";
      case 97:
        endpoint = mUrl + "bsc/testnet";
      case 137:
        endpoint = mUrl + "polygon/mainnet";
      case 80001:
        endpoint = mUrl + "polygon/mumbai";  
      case 42161:
        endpoint = mUrl + "arbitrum/mainnet";
      case 421611:
        endpoint = mUrl + "arbitrum/testnet";
      case 43114:
        endpoint = mUrl + "avalanche/mainnet";
      case 43113:
        endpoint = mUrl + "avalanche/testnet";
      case 250:
        endpoint = mUrl + "fantom/mainnet";
      default:
        endpoint = invalidChain;
    }
    const rpcUrl = mUrl + endpoint;
    // console.log("rpcUrl", rpcUrl); // COMMENT ME BEFORE PROD
    if (endpoint === invalidChain) return endpoint;
    else return new ethers.providers.JsonRpcProvider(rpcUrl);
  }
}


function getContract(address, abi, chainId) {
  const isValid = checkDropAddress(address, chainId);
  if (isValid === false) return "unsupported/address"; 
  const provider = getProvider(chainId);
  if (provider === invalidChain) return invalidChain;
  else return new ethers.Contract(address, abi, provider);
}


async function getCachedContract(cipher) {
  const unhashed = quickDecrypt(cipher, messageKey);
  const pin = await findPin(unhashed);
  // console.log(pin);
  const metadata = JSON.parse(pin.contract);
  // console.log(metadata);
  const provider = getProvider(metadata.chainId);
  if (provider === invalidChain) return invalidChain;
  else return new ethers.Contract(metadata.address, ddAbi, provider);
}


async function verifyMessage(cipher, signature) {
  const contract = await getCachedContract(cipher);
  if (contract === invalidChain) return false;
  try {
    const [from, to] = await contract.getAddresses(cipher);
    const signerAddr = await ethers.utils.verifyMessage(cipher, signature);
    const isValid = (signerAddr === from || signerAddr === to);
    return isValid;
  } catch (err) {
    console.log(err);
    return false;
  }
}


async function verifyMessages(ciphers, signature) {
  const signerAddr = await ethers.utils.verifyMessage(ciphers, signature);
  var integrity = [];
  for await (const cipher of cipher) {
    const contract = await getCachedContract(cipher);
    if (contract === invalidChain) integrity.push(false);
    else {
      try {
        const [from, to] = await contract.getAddresses(cipher);
        const isValid = (signerAddr === from || signerAddr === to);
        integrity.push(isValid);
      } catch (err) {
        console.log(err);
        integrity.push(false);
      }
    }
  }
  const allValid = !integrity.includes(false);
  return allValid;
}


module.exports = { getProvider, getContract, verifyMessage, verifyMessages }