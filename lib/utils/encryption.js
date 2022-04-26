function garble(length) {
   const characters = 
   'ABCDEFGHIJKLMNOPQRSTUVWXYZ'+
   'abcdefghijklmnopqrstuvwxyz'+
   '0123456789!@#$%^&*?';
   const charactersLength = characters.length;

   var result = '';
   for ( var i = 0; i < length; i++ ) {
     const cidx = Math.floor(Math.random() * charactersLength);
     result += characters.charAt(cidx);
   }
   return result;
}

const CryptoJS = require("crypto-js");
function quickEncrypt(data, key) { 
  return CryptoJS.AES.encrypt(data, key).toString() 
}
function quickDecrypt(data, key) { 
  return CryptoJS.AES.decrypt(data, key).toString(CryptoJS.enc.Utf8)
} 

function encryptInputs(cid, contractInput, key) {
  const encryptedInputs = {
    hash: quickEncrypt(cid, key),
    size: contractInput.size,
    type: quickEncrypt(contractInput.type, key),
    name: quickEncrypt(contractInput.name, key),
    description: quickEncrypt(contractInput.description, key),
    recipient: contractInput.recipient
  };
  return encryptedInputs;
}

const archiver = require('archiver');
const fs = require('fs');
async function encryptFile(fileName, key) {
  const noExt = fileName.split(".")[0];
  const pathToFile = `./uploads/${fileName}`;
  const pathToGarbage = `./uploads/${noExt}.trash`;
  const pathToArchive = `./uploads/encrypted/${noExt}.zip`

  const garbage = garble(127);
  fs.writeFile(pathToGarbage, garbage, (err) => { if (err) throw err });

  // OUTPUT SETUP
  const output = fs.createWriteStream(pathToArchive);
  output.on('close', () => {
    console.log(archive.pointer() + ' total bytes');
    console.log('ARCHIVER: finalized and outFile descriptor closed.');
  });
  output.on('end', () => {
    console.log('ARCHIVER: data drained');
  });

  // ARCHIVE SETUP
  let archive = archiver.create('zip-encrypted', 
  {
    zlib: {level: 8}, 
    encryptionMethod: 'aes256', 
    password: key
  });
  archive.on('warning', (err) => {
    if (err.code === 'ENOENT') { console.log(err) } 
    else { throw err }
  });
  archive.on('error', (err) => { throw err });
  archive.pipe(output);

  // ADD TO ARCHIVE
  archive.file(pathToFile, { name: noExt });
  archive.file(pathToGarbage, { name: "garbage.trash" });

  // FINALIZE ARCHIVE
  await archive.finalize();

  return pathToArchive;
}

const unzipper = require('unzipper');
function decryptFile(fileName, ext, key) {
  const pathToArchive = `./downloads/encrypted/${fileName.split(".")[0]}.zip`;
  const pathToFile = `./uploads/decrypted/${fileName.split(".")[0]}.${ext}`
  fs.createReadStream(pathToArchive).pipe(unzipper.Extract({ path: pathToFile }));
  // var newFile = spawn('unzip', [ '-P', key, '-d', pathToFile, pathToArchive ])
}

module.exports = 
{ 
  garble, 
  quickEncrypt, 
  quickDecrypt, 
  encryptInputs,
  encryptFile, 
  decryptFile 
};