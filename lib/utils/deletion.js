const fs = require('fs');
const { uploadedPaths } = require("./dirs.js");
const { uploadedLabels, isTemp } = require("./labels.js");


function deleteFiles(fileName, route, res) {
  console.log("Deletion requested...");
  if (fileName === undefined) res.json(`err: fileName undefined @ app.delete('/${route}')`);
  // file, trash, zip
  const pathTo = uploadedPaths(uploadedLabels(fileName));

  if (!fs.existsSync(pathTo.file)) res.json(`err: file not found @ app.delete('/${route}')`);
  fs.unlinkSync(pathTo.file);

  if (!isTemp(fileName)) {
    if (fs.existsSync(pathTo.trash)) fs.unlinkSync(pathTo.trash);
    if (fs.existsSync(pathTo.zip)) fs.unlinkSync(pathTo.zip);
  }

  const allDeleted = (
    !fs.existsSync(pathTo.file) && 
    !fs.existsSync(pathTo.trash) && 
    !fs.existsSync(pathTo.zip)
  );

  const response = !allDeleted ? "failed/deletion" : "success";
  res.json(response);
}


module.exports = { deleteFiles }