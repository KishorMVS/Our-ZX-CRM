let _io = null;

function init(io) {
    _io = io;
    io.on("connection", (socket) => {
        socket.on("join_workspace", (workspaceId) => {
            if (workspaceId) socket.join(`workspace:${workspaceId}`);
        });
    });
}

function getIO() {
    return _io;
}

function emitToWorkspace(workspaceId, event, data) {
    if (_io && workspaceId) {
        _io.to(`workspace:${workspaceId}`).emit(event, data);
    }
}

module.exports = { init, getIO, emitToWorkspace };
