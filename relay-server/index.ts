import { RealtimeRelay } from './lib/relay.js';
import dotenv from 'dotenv';

import { createServer } from 'http';
import express from 'express'
import { z } from 'zod';
import cors from 'cors'

const app = express()
app.use(cors())
app.use(express.json())

const server = createServer(app)

dotenv.config({ override: true });

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!OPENAI_API_KEY) {
  console.error(
    `Environment variable "OPENAI_API_KEY" is required.\n` +
      `Please set it in your .env file.`
  );
  process.exit(1);
}

const PORT = parseInt(process.env.PORT!) || 8081;

const relay = new RealtimeRelay(OPENAI_API_KEY);
server.listen(PORT, () => console.log(`Server started on http://localhost:${PORT}`))
relay.listen(server)


app.get('/api/connections', (req, res) => {
  const connections: any[] = []
  for (const [name, value] of relay.sockets) {
    connections.push({
      name: name,
      connectedTo: value.connectedWith?.id,
      connected: value.connected
    })
  }

  return res.send(connections)
})

const ConnectDto = z.object({
  connectSocketName: z.string(),
  connectWithName: z.string(),
  connect: z.boolean()
})

app.post('/api/connect', async (req, res) => {
  const connectDto = await ConnectDto.parseAsync(req.body)

  if (connectDto.connectSocketName == connectDto.connectWithName) {
    return res.status(400).send({ message: 'Cannot connect with itself.' })
  }

  const socket = relay.sockets.get(connectDto.connectSocketName)!
  const connectWith = relay.sockets.get(connectDto.connectWithName)!

  if (!socket || !connectWith) {
    return res.status(400).send({ message: 'Socket not found.' })
  }

  if (connectDto.connect) {
    socket.connectedWith = connectWith.socket
    socket.connected = true

    connectWith.connectedWith = socket.socket
    connectWith.connected = true

    // const connectionMessage = `${socket.socket.id} and ${connectWith.socket.id} are now connected.`

    // const socketMessage = JSON.stringify({ type: connectionMessage })

    // socket.socket.send()
    // connectWith.socket.send()
  } else {
    delete socket.connectedWith
    socket.connected = false

    delete connectWith.connectedWith
    connectWith.connected = false
  }

  return res.send({ message: 'Success' })
})