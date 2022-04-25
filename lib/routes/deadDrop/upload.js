function decomposeUploadInput(chunk, chunkIndex, totalChunks) {
    const chunkIdx = parseInt(chunkIndex);
    const chunkNum = (chunkIdx + 1);
    const chunkTotal = parseInt(totalChunks);
    const percentProgress = (chunkNum / chunkTotal) * 100; 
    const isFirstChunk = (chunkIdx === 0 && chunkNum === 1);
    const isLastChunk = (chunkIdx === (chunkTotal - 1)) && (chunkNum === chunkTotal);

    const chunkData = chunk.split(',')[1];
    const chunkBuffer = (Buffer.from(chunkData, 'base64'));

    const decomposed = {
        idx: chunkIdx,
        num: chunkNum,
        tot: chunkTotal,

        isFirst: isFirstChunk,
        isLast: isLastChunk,

        percent: percentProgress,

        contents: chunkBuffer
    };
    return decomposed;
}

function showProgress(num, total, percent) {
    console.log(`Getting Chunk ${num} of ${total} || ${percent}%`);
}

module.exports = { decomposeUploadInput, showProgress }