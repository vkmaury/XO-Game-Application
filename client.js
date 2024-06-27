const io = require('socket.io-client');
const readline = require('readline');

const socket = io('http://localhost:3000');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

let currentRoomId = null;
let currentUsername = null;

rl.question('Enter your username: ', (username) => {
    currentUsername = username;
    rl.question('Enter the room ID you want to join (leave blank to create a new room): ', (roomId) => {
        if (roomId) {
            currentRoomId = roomId;
            socket.emit('joinRoom', { roomId, username });
        } else {
            socket.emit('createRoom', { username });
        }
    });
});

socket.on('connect_error', (error) => {
    console.error('Failed to connect to the server. Make sure the server is running.');
    rl.close();
});

socket.on('roomFull', (message) => {
    console.log(message);
    rl.question('Enter a new room ID to create: ', (newRoomId) => {
        currentRoomId = newRoomId;
        socket.emit('createRoom', { username: currentUsername });
    });
});

socket.on('roomCreated', (roomId) => {
    console.log(`New room created with ID: ${roomId}. Waiting for another player to join...`);
    currentRoomId = roomId;
});

socket.on('message', (message) => {
    console.log(message);
});

socket.on('score', (score) => {
    console.log(score);
});

socket.on('board', (board) => {
    console.log(`
      ${board[0]} | ${board[1]} | ${board[2]}
     ---+---+---
      ${board[3]} | ${board[4]} | ${board[5]}
     ---+---+---
      ${board[6]} | ${board[7]} | ${board[8]}
    `);
});

socket.on('turn', (message) => {
    console.log(message);
    rl.question('Enter your move (0-8): ', (input) => {
        const index = parseInt(input, 10);
        if (index >= 0 && index <= 8) {
            socket.emit('move', { roomId: currentRoomId, index });
        } else {
            console.log('Invalid move. Try again.');
        }
    });
});

rl.on('close', () => {
    socket.close();
});
