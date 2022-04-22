const CryptoJS = require("crypto-js");
const fs = require('fs');

function makeKey(length) {
   var result           = '';
   var characters       = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*?';
   var charactersLength = characters.length;
   for ( var i = 0; i < length; i++ ) {
     result += characters.charAt(Math.floor(Math.random() * charactersLength));
   }
   return result;
}
 
function quickEncrypt(data, key) { return CryptoJS.AES.encrypt(data, key).toString() }

function quickDecrypt(data, secret) { return CryptoJS.AES.decrypt(data, secret).toString(CryptoJS.enc.Utf8); } 

function encryptFile(filePath, encryptedFilePath, key) {
  const file = fs.readFileSync(filePath).toString();
  const encrypted = quickEncrypt(file, key);
  fs.unlinkSync(filePath);
  fs.appendFileSync(encryptedFilePath, Buffer.from(encrypted));
  return encrypted;
}

function decryptFile(encryptedFilePath, filePath, key) {
  const encrypted = fs.readFileSync(encryptedFilePath).toString();
  const file = quickDecrypt(encrypted, key);
  fs.appendFileSync(filePath, file);
  return file;
}

 module.exports = { makeKey, quickEncrypt, quickDecrypt, encryptFile, decryptFile };