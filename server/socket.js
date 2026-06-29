const mongoose = require('mongoose');
const GameSession = require('./models/GameSession');
const { createLogger } = require('./utils/logger');

const log = createLogger('Socket');

function setupSocket(io) {
  io.on('connection', (socket) => {
    log.start('client connected', { socketId: socket.id });

    socket.on('disconnect', () => {
      log.step('client disconnected', {
        socketId: socket.id,
        role: socket.data.role,
        sessionId: socket.data.sessionId,
      });
    });

    socket.on('gameClient:join', async ({ sessionId, sectionId }) => {
      log.start('gameClient:join', { socketId: socket.id, sessionId, sectionId });
      if (sectionId) {
        socket.join(`section:${sectionId}`);
        socket.data.role = 'gameClient';
        socket.data.sectionId = sectionId;
        log.step('joined section room', { sectionId });
      }
      if (sessionId && mongoose.isValidObjectId(sessionId)) {
        socket.join(`session:${sessionId}`);
        socket.data.sessionId = sessionId;
        log.step('joined session room', { sessionId });
      }
      log.ok('gameClient:join complete', { socketId: socket.id });
    });

    socket.on('player:join', async ({ sessionId, sig, code }) => {
      log.start('player:join', { socketId: socket.id, sessionId, hasCode: !!code });
      if (!sessionId || !mongoose.isValidObjectId(sessionId)) {
        log.warn('player:join invalid sessionId', { sessionId });
        return;
      }

      try {
        const session = await GameSession.findById(sessionId);
        if (!session || session.expiresAt < new Date()) {
          log.warn('player:join session not found or expired', { sessionId });
          socket.emit('session:error', { error: 'Session not found or expired' });
          return;
        }

        if (code && String(session.socketCode) !== String(code)) {
          log.warn('player:join code mismatch', { sessionId });
          socket.emit('session:error', { error: 'Socket code mismatch' });
          return;
        }

        const wasCreated = session.status === 'created';

        if (wasCreated) {
          session.status = 'connected';
          session.playerConnectedAt = new Date();
          await session.save();
          log.step('player connected, status updated', { sessionId, status: 'connected' });
        }

        socket.join(`session:${sessionId}`);
        socket.data.role = 'player';
        socket.data.sessionId = sessionId;

        const boundPayload = {
          sessionId: String(session._id),
          socketCode: session.socketCode,
          status: session.status,
          playerConnectedAt: session.playerConnectedAt,
        };

        io.to(`session:${sessionId}`).emit('session:updated', boundPayload);

        if (wasCreated) {
          io.to(`session:${sessionId}`).emit('session:bound', boundPayload);
          if (session.gameHall) {
            io.to(`section:${session.gameHall}`).emit('session:bound', boundPayload);
          }
          log.ok('session:bound emitted', boundPayload);
        }

        log.ok('player:join complete', { sessionId, status: session.status });
      } catch (err) {
        log.error('player:join error', err);
        socket.emit('session:error', { error: 'Failed to join session' });
      }
    });
  });
}

module.exports = { setupSocket };
