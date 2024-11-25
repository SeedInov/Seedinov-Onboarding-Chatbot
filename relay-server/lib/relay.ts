import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage, Server } from 'http'
import { RealtimeClient } from '@openai/realtime-api-beta';

type WebSocketWithId = WebSocket & { id: string }

interface WSConnection {
  socket: WebSocketWithId
  connectedWith?: WebSocketWithId
  connected: boolean
}

export class RealtimeRelay {
  public apiKey: string
  public sockets: Map<string, WSConnection>
  public wss: WebSocketServer | null
  public connections: number

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.sockets = new Map();
    this.wss = null;
    this.connections = 0
  }

  listen(server: Server) {
    this.wss = new WebSocketServer({ server: server , path: '/socket' });
    this.wss.on('connection', this.connectionHandler.bind(this));
    this.log(`Websocket Server started.`);
  }

  async connectionHandler(ws: WebSocketWithId, req: IncomingMessage) {
    const id = `User ${this.connections++}`
    ws.id = id
    this.sockets.set(id, {
      socket: ws,
      connected: false
    })

    if (!req.url) {
      this.log('No URL provided, closing connection.');
      ws.close();
      return;
    }

    const url = new URL(req.url, `ws://${req.headers.host}`);
    const pathname = url.pathname;

    if (pathname !== '/socket') {
      this.log(`Invalid pathname: "${pathname}"`);
      ws.close();
      return;
    }

    // Instantiate new client
    this.log(`Connecting with key "${this.apiKey.slice(0, 3)}..."`);
    const client = new RealtimeClient({ apiKey: this.apiKey });

    // Relay: OpenAI Realtime API Event -> Browser Event
    client.realtime.on('server.*', (event) => {
      const socket = this.sockets.get(ws.id)!

      // console.log(JSON.stringify(event, null, 2))
      if (socket?.connected) {
        this.log(`Relaying "${event.type}" to Client`);
        socket.connectedWith!.send(JSON.stringify(event));
      }
    });
    client.realtime.on('close', () => ws.close());

    // Relay: Browser Event -> OpenAI Realtime API Event
    // We need to queue data waiting for the OpenAI connection
    const messageQueue: any[] = [];
    const messageHandler = (data) => {
      try {
        const event = JSON.parse(data);
        // console.log(JSON.stringify(event, null, 2))
        this.log(`Relaying "${event.type}" to OpenAI`);
        client.realtime.send(event.type, event);
      } catch (e) {
        console.error(e.message);
        this.log(`Error parsing event from client: ${data}`);
      }
    };
    ws.on('message', (data) => {
      if (!client.isConnected()) {
        messageQueue.push(data);
      } else if (this.sockets.get(ws.id)?.connected) {
        messageHandler(data);
      }
    });
    ws.on('close', () => {
      client.disconnect()
      const connectedWith = this.sockets.get(ws.id)?.connectedWith
      if (connectedWith) {
        const connectedWithRecord = this.sockets.get(connectedWith.id)!
        delete connectedWithRecord.connectedWith
        connectedWithRecord.connected = false
      }
      this.sockets.delete(ws.id)
      this.log(`${ws.id} disconnected.`)
    });

    // Connect to OpenAI Realtime API
    try {
      this.log(`Connecting to OpenAI...`);
      await client.connect();
      ws.send(JSON.stringify({ type: ws.id }))
    } catch (e) {
      this.log(`Error connecting to OpenAI: ${e.message}`);
      ws.close();
      return;
    }
    this.log(`Connected to OpenAI successfully!`);

    while (messageQueue.length) {
      messageHandler(messageQueue.shift());
    }
  }

  log(...args) {
    console.log(`[RealtimeRelay]`, ...args);
  }
}
