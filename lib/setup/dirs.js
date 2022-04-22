const fs = require('fs');


function initTempDirs() {
    if (!fs.existsSync("./uploads/encrypted")) { 
        fs.mkdirSync("./uploads/encrypted", { recursive: true }) 
    }

    if (!fs.existsSync("./downloads/decrypted")) { 
        fs.mkdirSync("./uploads/decrypted", { recursive: true }) 
    }
}


module.exports = { initTempDirs }