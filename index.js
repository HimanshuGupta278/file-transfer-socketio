const express = require('express');
const { createServer } = require('node:http');
const { join } = require('node:path');
const { Server } = require('socket.io');
const fs = require('fs');

const app = express();
const server = createServer(app);
const io = new Server(server);

// Directory to save uploaded files
const filePath = join(__dirname, 'data');

// Ensure the directory exists
if (!fs.existsSync(filePath)) {
    fs.mkdirSync(filePath, { recursive: true });
}

// Serve the frontend
app.get('/', (req, res) => {
    res.sendFile(join(__dirname, 'index.html'));
});

// Socket.IO connection
io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    let writeStream;
    let totalChunks;

    // Start upload
    socket.on('uploadStart', (metadata) => {
        const { name: fileName, size: fileSize, maxChunkSize } = metadata;
        totalChunks = Math.ceil(fileSize / maxChunkSize);
        
        console.log(`Starting upload for file: ${fileName}, Total Chunks: ${totalChunks}`);
        
        // Create a write stream for the file
        const fullFilePath = join(filePath, fileName);
        writeStream = fs.createWriteStream(fullFilePath);

        // Handle errors in the write stream
        writeStream.on('error', (err) => {
            console.error(`Error writing to file ${fileName}:`, err);
            socket.emit('uploadError', { error: 'Failed to write to file.' });
        });
    });

    // Handle file chunks
    socket.on('uploadingChunk', (chunk) => {
        const { data, chunkNo } = chunk;

        // Write the chunk to the file
        writeStream.write(data, (err) => {
            if (err) {
                console.error(`Error writing chunk ${chunkNo}:`, err);
                socket.emit('uploadError', { error: `Chunk ${chunkNo} write failed.` });
                return;
            }
            console.log(`Chunk ${chunkNo} written successfully.`);

            // If this is the last chunk, close the stream
            if (chunkNo === totalChunks) {
                writeStream.end();
                console.log('File upload completed successfully.');
                socket.emit('uploadComplete', { message: 'File upload completed.' });
            }
        });
    });

    // Handle disconnection
    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);

        // If the upload was incomplete, clean up
        if (writeStream && !writeStream.destroyed) {
            writeStream.destroy();
        }
    });
});

// Start the server
server.listen(3000, () => {
    console.log('Server running at http://localhost:3000');
});
