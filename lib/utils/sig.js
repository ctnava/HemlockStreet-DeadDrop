const {ethers} = require("ethers");

const verifyMessage = async ({ message, address, signature }) => {
    try {
      const signerAddr = await ethers.utils.verifyMessage(message, signature);
      const isValid = (signerAddr === address);
      return isValid;
    } catch (err) {
      console.log(err);
      return false;
    }
};

module.exports = { verifyMessage }