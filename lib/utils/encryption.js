const CryptoJS = require("crypto-js");
const archiver = require('archiver');
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


function encryptFile(fileName, key) {
  const filePath = `./uploads/${fileName}`;

  const encryptedFilePath = `./uploads/encrypted/${fileName.split(".")[0]}.zip`
  const output = fs.createWriteStream(encryptedFilePath);
  output.on('close', function() {
    console.log(archive.pointer() + ' total bytes');
    console.log('archiver has been finalized and the output file descriptor has closed.');
  });
  output.on('end', function() {
    console.log('Data has been drained');
  });

  let archive = archiver.create('zip-encrypted', {zlib: {level: 8}, encryptionMethod: 'aes256', password: key});
  archive.on('warning', function(err) {
    if (err.code === 'ENOENT') { console.log(err) } 
    else { throw err }
  });
  archive.on('error', function(err) { throw err });

  archive.pipe(output);
  archive.file(filePath, { name: fileName.split(".")[0] });
  archive.finalize();
}

function decryptFile(encryptedFilePath, filePath, key) {
  const encrypted = fs.readFileSync(encryptedFilePath).toString();
  const file = quickDecrypt(encrypted, key);
  fs.appendFileSync(filePath, file);
  return file;
}

 module.exports = { makeKey, quickEncrypt, quickDecrypt, encryptFile, decryptFile };