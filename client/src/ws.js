import { io as createWebsocket } from 'socket.io-client'

const ws = createWebsocket('wss://localhost:8080')

export function request(...req) {
  return new Promise((onres, onerr) => {
    ws.emit(...req, (err, ...res) => err ? onerr(err) : onres(...res))
  })
}

export default ws
