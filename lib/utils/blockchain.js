require('dotenv').config();
const { quickDecrypt } = require("./encryption.js");
const { findPin } = require("./pins.js");
const {ethers} = require("ethers");
const altKey = process.env.ALT_KEY;

function getProvider(chainId) {
  const isDev = (chainId === 31337 || chainId === 1337);
  // console.log(isDev);
  if (isDev) return new ethers.providers.JsonRpcProvider();
  else return new ethers.providers.JsonRpcProvider(/*FILL ME IN*/);
}

function getContract(address, abi, chainId) {
  const provider = getProvider(chainId);
  return new ethers.Contract(address, abi, provider);
}

async function getCachedContract(cipher) {
  const unhashed = quickDecrypt(cipher, altKey);
  const pin = await findPin(unhashed);
  // console.log(pin);
  const metadata = JSON.parse(pin.contract);
  // console.log(metadata);
  const provider = getProvider(metadata.chainId);
  const contract = new ethers.Contract(metadata.contract, metadata.abi, provider);
  return contract;
}

async function verifyMessage(cipher, signature) {
  const contract = await getCachedContract(cipher);
  const [from, to] = await contract.getAddresses(cipher);
  try {
    const signerAddr = await ethers.utils.verifyMessage(cipher, signature);
    const isValid = (signerAddr === from || signerAddr === to);
    return isValid;
  } catch (err) {
    console.log(err);
    return false;
  }
};


module.exports = { getProvider, getContract, verifyMessage }