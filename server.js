import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { WebSocketServer } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());

const httpServer = createServer(app);
const io = new SocketIOServer(httpServer);
const botWss = new WebSocketServer({ port: 8080 });

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

  // We simply broadcast it as "Bot" to the UI.
  // The UI adds the purple badge so users know it's the system.
  io.emit('chat message', {
    user: "Bot",
    text: message,
    isBot: true,
    color: '#9147ff'
  });

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

// --- SOCKET HANDLERS ---

io.on('connection', (socket) => {

  // Handle Incoming Message from Guest
  socket.on('chat message', (data) => {
    // data = { user: "Bob", text: "Hello", color: "..." }

    // 1. Show to everyone on website
    io.emit('chat message', {
      user: data.user,
      text: data.text,
      color: data.color,
      isBot: false
    });

    // 2. Send to Bot (Fake Twitch Event)
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

          // CRITICAL: Pass the Guest Username to your bot
          chatter_user_id: "guest_" + Math.floor(Math.random() * 1000),
          chatter_user_login: data.user,
          chatter_user_name: data.user,

          message: { text: data.text }
        }
      }
    };

    // Broadcast to connected Bot(s)
    botWss.clients.forEach((client) => {
      if (client.readyState === 1) client.send(JSON.stringify(fakePayload));
    });
  });
});

botWss.on('connection', (ws) => {
  console.log('🔌 Bot connected to Mock EventSub');
  ws.send(JSON.stringify({
    metadata: { message_type: "session_welcome" },
    payload: { session: { id: "mock_session_id", reconnect_url: null } }
  }));
});

httpServer.listen(3000, () => {
  console.log('✅ Chat Server: http://localhost:3000');
});
