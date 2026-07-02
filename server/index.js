require('dotenv').config();

const path = require('path');
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');

const sessionsRouter = require('./routes/sessions');
const sectionsRouter = require('./routes/sections');
const gamesRouter = require('./routes/games');
const { router: gameAuthRouter } = require('./routes/gameAuth');
const gameClientsRouter = require('./routes/gameClients');
const adminPanelRouter = require('./routes/adminPanel');
const { setupSocket } = require('./socket');
const { getLocalIp } = require('./utils/network');
const { startGiftRefillScheduler } = require('./services/giftInventory');
const { requestLogger } = require('./middleware/requestLogger');
const { createLogger } = require('./utils/logger');

const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || '0.0.0.0';
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/weow';
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';
const isDev = process.env.NODE_ENV !== 'production';

const app = express();
const server = http.createServer(app);

if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

const io = new Server(server, {
  path: '/socket.io',
  cors: {
    origin: isDev ? true : [CLIENT_URL],
    methods: ['GET', 'POST'],
  },
  pingTimeout: 60000,
  pingInterval: 25000,
});

app.set('io', io);

app.use(cors({ origin: isDev ? true : [CLIENT_URL] }));
app.use(express.json());
app.use(requestLogger);

app.use('/api/sessions', sessionsRouter);
app.use('/api/sections', sectionsRouter);
app.use('/api/games', gamesRouter);
app.use('/api/game-auth', gameAuthRouter);
app.use('/api/game-clients', gameClientsRouter);
app.use('/api/admin-panel', adminPanelRouter);

app.get('/api/health', (_req, res) => {
  createLogger('Health').ok('health check');
  res.json({ status: 'OK', message: 'WeOW API 運行正常' });
});

app.use('/assets', express.static(path.join(__dirname, '../assets')));

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/dist')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/dist/index.html'));
  });
}

setupSocket(io);

async function start() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('MongoDB connected');
    createLogger('Server').ok('MongoDB connected', { uri: MONGODB_URI.replace(/\/\/.*@/, '//***@') });
    startGiftRefillScheduler();
  } catch (err) {
    console.warn('MongoDB connection failed — running without DB:', err.message);
  }

  server.listen(PORT, HOST, () => {
    const ip = getLocalIp();
    const boot = createLogger('Server');
    boot.ok(`listening on http://localhost:${PORT}`);
    if (ip) {
      boot.ok(`network http://${ip}:${PORT}`);
      const clientPort = process.env.CLIENT_PORT || '5173';
      boot.ok(`mobile test http://${ip}:${clientPort}/display`);
    }
  });
}

start();
