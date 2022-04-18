const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs');
const md5 = require('md5');

const app = express();

app.use(bodyParser.raw({type: 'application/octet-stream', limit:'10gb'}));
app.use(bodyParser.json());

app.use(cors({origin: 'http://localhost:3000'}));

app.use('/uploads', express.static('uploads'));

// app.set('view engine', 'ejs');
// app.use(express.static("public"));

app.post('/upload', (req, res) => {
  const { chunk, ext, chunkIndex, totalChunks } = JSON.parse(req.body.toString());
  const chunkNum = (parseInt(chunkIndex) + 1);
  const progress = (chunkNum / parseInt(totalChunks)) * 100;

  const rawChunk = chunk.split(',')[1];
  const buffer = (Buffer.from(rawChunk, 'base64')); // console.log(buffer.length/1024);

  function addExt(fileName) { return `${fileName}.${ext}` }
  const tmpName = addExt('tmp_' + md5(req.ip + totalChunks));
  const finalName = addExt(md5(Date.now() + req.ip)); // console.log(tmpName, finalName);

  function uploadPath(fileName) { return `./uploads/${fileName}` }
  const tmpPath = uploadPath(tmpName);
  const finalPath = uploadPath(finalName); // console.log(tmpPath, finalPath);

  const firstChunk = (chunkIndex === 0);
  if (firstChunk) {
    if (fs.existsSync(tmpPath)) {
      console.log("Duplicate Deleted!");
      fs.unlinkSync(tmpPath); 
    }
    console.log("Downloading Document...");
  }

  fs.appendFileSync(tmpPath, buffer);
  // console.log(`Getting Chunk ${chunkNum} of ${totalChunks} || ${progress}%`);
  
  const lastChunk = (chunkNum === parseInt(totalChunks));
  if (lastChunk) {
    console.log("Document Received!");
    fs.renameSync(tmpPath, finalPath);
    res.json({finalName});
  } else { res.json({tmpName})}
});

app.delete('/upload', (req, res) => {
  const { fileName } = req.query;
  fs.unlinkSync("./uploads/" + fileName);
  res.json('deleted');
});

app.post('/pin', (req, res) => {
  const { fileName } = req.body;
  console.log(fileName);
  res.json('ok');
});


app.listen(process.env.PORT || 4001, () => { console.log("Server started"); });