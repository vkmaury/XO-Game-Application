const http = require('http');
const socketio = require('socket.io');

const server = http.createServer();
const io = socketio(server);

const rooms = {}; // Store room information
let roomCounter = 0; // Room counter to generate unique room IDs

io.on('connection', (socket) => {
    console.log(`Player connected: ${socket.id}`);

    // Handle creating a new room
    socket.on('createRoom', ({ username }) => {
        const roomId = `room-${++roomCounter}`;
        rooms[roomId] = {
            players: [],
            board: Array(9).fill(null),
            currentPlayer: 0
        };

        const room = rooms[roomId];
        room.players.push({ id: socket.id, username, points: 0 });
        socket.join(roomId);
        socket.emit('roomCreated', roomId);
    });

    // Handle joining an existing room
    socket.on('joinRoom', ({ roomId, username }) => {
        if (!rooms[roomId]) {
            socket.emit('message', `Room ${roomId} does not exist.`);
            return;
        }

        const room = rooms[roomId];

        if (room.players.length < 2) {
            room.players.push({ id: socket.id, username, points: 0 });
            socket.join(roomId);
            socket.emit('message', `Welcome ${username} to room ${roomId}`);

            if (room.players.length === 2) {
                io.to(roomId).emit('message', `Both players connected: ${room.players[0].username} and ${room.players[1].username}. Let the game begin!`);
                io.to(roomId).emit('board', getBoardWithSymbols(room.board));
                io.to(roomId).emit('turn', `${room.players[room.currentPlayer].username}'s turn`);
            } else {
                socket.emit('message', `Waiting for another player to join room ${roomId}...`);
            }
        } else {
            socket.emit('message', `Room ${roomId} is full.`);
        }
    });

    // Handle player moves
    socket.on('move', ({ roomId, index }) => {
        const room = rooms[roomId];

        // if (!room) {
        //     socket.emit('message', 'Invalid room ID.');
        //     return;
        // }

        if (room.players.length === 2) {
            const currentPlayer = room.currentPlayer;
            if (socket.id !== room.players[currentPlayer].id) {
                socket.emit('message', 'It\'s not your turn!');
                return;
            }
            if (index < 0 || index > 8 || room.board[index] !== null) {
                io.to(roomId).emit('message', 'Invalid move. The game will restart.');
                resetGame(roomId);
                return;
            }
            room.board[index] = currentPlayer === 0 ? 'X' : 'O';
            io.to(roomId).emit('board', getBoardWithSymbols(room.board));

            if (checkWin(room.board)) {
                room.players[currentPlayer].points++;
                io.to(roomId).emit('message', `${room.players[currentPlayer].username} wins!`);
                io.to(roomId).emit('score', getScore(room.players));
                resetGame(roomId);
            } else if (room.board.every(cell => cell !== null)) {
                io.to(roomId).emit('message', 'It\'s a draw!');
                resetGame(roomId);
            } else {
                room.currentPlayer = 1 - room.currentPlayer;
                io.to(roomId).emit('turn', `${room.players[room.currentPlayer].username}'s turn`);
            }
        }
    });

    // Handle player disconnection
    socket.on('disconnect', () => {
        console.log(`Player disconnected: ${socket.id}`);
        for (const roomId in rooms) {
            const room = rooms[roomId];
            const playerIndex = room.players.findIndex(player => player.id === socket.id);
            if (playerIndex !== -1) {
                room.players.splice(playerIndex, 1);
                if (room.players.length === 0) {
                    delete rooms[roomId];
                } else {
                    io.to(roomId).emit('message', `Player disconnected. Waiting for a new player to join...`);
                    resetGame(roomId);
                }
                break;
            }
        }
    });
});

// Reset game function
function resetGame(roomId) {
    const room = rooms[roomId];
    if (room) {
        room.board = Array(9).fill(null);
        room.currentPlayer = 0;
        if (room.players.length === 2) {
            io.to(roomId).emit('board', getBoardWithSymbols(room.board));
            io.to(roomId).emit('turn', `${room.players[room.currentPlayer].username}'s turn`);
        }
    }
}

// Check win function
function checkWin(board) {
    const winningCombinations = [
        [0, 1, 2], [3, 4, 5], [6, 7, 8],
        [0, 3, 6], [1, 4, 7], [2, 5, 8],
        [0, 4, 8], [2, 4, 6]
    ];
    return winningCombinations.some(combination =>
        combination.every(index => board[index] !== null && board[index] === board[combination[0]])
    );
}

// Get board with symbols function
function getBoardWithSymbols(board) {
    return board.map(cell => cell === null ? ' ' : cell);
}

// Get score function
function getScore(players) {
    return `Current Score: ${players[0].username}: ${players[0].points} - ${players[1].username}: ${players[1].points}`;
}

server.listen(3000, () => {
    console.log('Server listening on port 3000');
});
