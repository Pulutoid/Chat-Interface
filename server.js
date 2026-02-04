import express from 'express';
import { createServer } from 'http';
import { createServer as createHttpsServer } from 'https';
import { Server as SocketIOServer } from 'socket.io';
import { WebSocketServer } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());

// HTTP Server (port 33000 - unchanged)
const httpServer = createServer(app);

// HTTPS Server (port 33003 - NEW)
const httpsServer = createHttpsServer({
  key: fs.readFileSync('/etc/letsencrypt/live/chat.yourdomain.com/privkey.pem'),
  cert: fs.readFileSync('/etc/letsencrypt/live/chat.yourdomain.com/fullchain.pem')
}, app);

// Socket.IO on BOTH servers
const io = new SocketIOServer(httpServer, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});
const ioHttps = new SocketIOServer(httpsServer, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

// Bot WebSocket (port 33001 - unchanged)
const botWss = new WebSocketServer({ port: 33001 });

const MOCK_CHANNEL_ID = "12345";

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

// --- MOCK API ENDPOINTS ---

app.get('/mock/oauth2/validate', (req, res) => {
  res.json({ login: "bot_user", user_id: "999", scopes: [] });
});

app.post('/mock/helix/eventsub/subscriptions', (req, res) => {
  const { condition } = req.body;
  res.status(202).json({ data: [{ id: "mock_sub_id", status: "enabled", condition }] });
});

// HANDLES BOT REPLIES
app.post('/mock/helix/chat/messages', (req, res) => {
  const { message } = req.body;

  const botMessage = {
    user: "Bot",
    text: message,
    isBot: true,
    color: '#9147ff'
  };

  // Emit to BOTH HTTP and HTTPS clients
  io.emit('chat message', botMessage);
  ioHttps.emit('chat message', botMessage);

  console.log(`🤖 Bot said: ${message}`);
  res.json({ data: [{ message_id: "msg_" + Date.now(), is_sent: true }] });
});

app.get('/mock/helix/streams', (req, res) => res.json({ data: [] }));

app.get('/mock/helix/users', (req, res) => {
  const loginName = req.query.login || "test_user";
  res.json({
    data: [{
      id: MOCK_CHANNEL_ID,
      login: loginName,
      display_name: loginName,
      profile_image_url: ""
    }]
  });
});

// --- SOCKET HANDLERS (for both HTTP and HTTPS) ---
function setupSocketHandlers(socketServer) {
  socketServer.on('connection', (socket) => {
    socket.on('chat message', (data) => {
      const message = {
        user: data.user,
        text: data.text,
        color: data.color,
        isBot: false
      };

      // Broadcast to BOTH servers
      io.emit('chat message', message);
      ioHttps.emit('chat message', message);

      // Send to Bot
      const fakePayload = {
        metadata: {
          message_id: "evt_" + Date.now(),
          message_type: 'notification',
          subscription_type: 'channel.chat.message',
          message_timestamp: new Date().toISOString()
        },
        payload: {
          subscription: { type: 'channel.chat.message' },
          event: {
            broadcaster_user_id: MOCK_CHANNEL_ID,
            broadcaster_user_login: "MyStream",
            chatter_user_id: "guest_" + Math.floor(Math.random() * 1000),
            chatter_user_login: data.user,
            chatter_user_name: data.user,
            message: { text: data.text }
          }
        }
      };

      botWss.clients.forEach((client) => {
        if (client.readyState === 1) client.send(JSON.stringify(fakePayload));
      });
    });
  });
}

setupSocketHandlers(io);
setupSocketHandlers(ioHttps);

botWss.on('connection', (ws) => {
  console.log('🔌 Bot connected to Mock EventSub');
  ws.send(JSON.stringify({
    metadata: { message_type: "session_welcome" },
    payload: { session: { id: "mock_session_id", reconnect_url: null } }
  }));
});

// Start both servers
httpServer.listen(33000, () => {
  console.log('✅ HTTP Chat Server: http://localhost:33000');
});

httpsServer.listen(33003, () => {
  console.log('✅ HTTPS Chat Server: https://localhost:33003');
});
