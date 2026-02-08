# Twitch-Style Chat Simulator & Mock EventSub

**Source Code / Reference Implementation**

This repository contains the source code for a self-hosted chat application I built to simulate a Twitch chat environment. It is designed to test chatbots and EventSub integrations without needing a live Twitch channel.

**Note:** This code is open source for educational and reference purposes, but it is **not configured for immediate use**. The files contain hardcoded paths and domains specific to my  environment. 

## Overview

The project consists of two main parts:
1.  **Frontend**: A "Twitch-like" web interface that mimics the visual style of Twitch chat (Dark mode, badges, username colors).
2.  **Backend**: A Node.js server that handles the chat via Socket.IO and runs a **Mock EventSub WebSocket** to feed events to a chatbot.

## Hardcoded Configurations

If you intend to run this code, be aware that it is "hardwired" for a specific production environment (`chat.abdullah-darwish.com`). You will need to refactor the following if you want to run it locally:

### 1. SSL Certificates (`server.js`)
The server is set up to strictly require HTTPS using Let's Encrypt certificates located at specific Linux paths (`/etc/letsencrypt/live/...`).
- **Issue:** The server will crash on startup if these files do not exist on your machine.
- **Fix:** You would need to strip out the `httpsServer` logic and rely solely on the HTTP server for local testing.

### 2. Client Connection (`index.html`)
The frontend client is hardcoded to connect to my specific production domain:
```javascript
const socket = io('https://chat.abdullah-darwish.com:33003');
```

Even if you host the file locally, it will attempt to open a socket connection to the remote server.  
**Fix:** Change the connection string to `http://localhost:33000` (or your specific IP).

## Features

### Frontend (UI)

- **Twitch Replica**: Matches the font, colors, and layout of native Twitch chat.
    
- **Identity**: Custom username selection and generated user colors.
    
- **Bot Integration**: System messages are automatically badged as `BOT`.
    

## Mock API & EventSub

The backend includes a mock implementation of the Twitch Helix API to trick bots into thinking they are connected to Twitch.

|Port|Service|Description|
|---|---|---|
|`33000`|HTTP Server|Serves the web interface.|
|`33001`|Mock EventSub|WebSocket server that pushes `channel.chat.message` events.|
|`33003`|HTTPS Server|Secure version of the chat server (requires certs).|

## API Endpoints

- `POST /mock/helix/chat/messages`: Allows a bot to "speak" in the chat.
    
- `GET /mock/oauth2/validate`: Returns a valid mock token.
    
- `POST /mock/helix/eventsub/subscriptions`: Accepts subscription requests (always returns success).
    

## License

MIT

