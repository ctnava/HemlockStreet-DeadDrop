const CryptoJS = require("crypto-js");


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

 module.exports = { makeKey, quickEncrypt, quickDecrypt };