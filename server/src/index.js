const https = require('https')
const wsServer = require('socket.io')()
const fs = require('fs')
const mediasoup = require('./mediasoup')

const roomCalls = {
  // [roomId]: {
  //   router,
  //   peers: {
  //     [peerId]: {
  //       producerTransport,
  //       consumerTransport,
  //       producers: {
  //         [kind]: producer
  //       },
  //       consumers: {
  //         [id]: consumer
  //       },
  //     }
  //   }
  // }
}

function broadcastRoomCallState(roomId, state) {
  wsServer.emit('room-call', { roomId, state })
}

function broadcastRoomCallPeerState(roomId, peerId, state) {
  wsServer.emit('room-call-peer', { roomId, peerId, state })
}

async function setupRoom(roomId) {
  const room = roomCalls[roomId] = {
    router: null,
    peers: {},
  }

  room.router = await mediasoup.createRouter()
  broadcastRoomCallState(roomId, 'new')

  return room
}

function closeRoom(roomId) {
  const room = roomCalls[roomId]
  if (room) {
    room.router.close()

    Object.keys(room.peers).forEach(peerId => {
      closePeer(roomId, peerId)
    })

    delete roomCalls[roomId]
    broadcastRoomCallState(roomId, 'closed')

    // TODO: broadcast room closed
  }
}

function setupPeer(roomId, peerId) {
  const room = roomCalls[roomId]
  room.peers[peerId] = {
    producerTransport: null,
    consumerTransport: null,
    producers: {},
    consumers: {},
  }
  broadcastRoomCallPeerState(roomId, peerId, 'new')
}

function closePeer(roomId, peerId) {
  const room = roomCalls[roomId]
  if (room && room.peers[peerId]) {
    const {
      producers,
      consumers,
      producerTransport,
      consumerTransport
    } = room.peers[peerId]

    Object.keys(producers).forEach(kind => {
      producers[kind].close()
    })

    Object.keys(consumers).forEach(id => {
      consumers[id].close()
    })

    if (producerTransport) {
      producerTransport.close()
    }

    if (consumerTransport) {
      consumerTransport.close()
    }

    delete room.peers[peerId]
    broadcastRoomCallPeerState(roomId, peerId, 'closed')

    // TODO: broadcast peer closed

    if (Object.keys(room.peers).length === 0) {
      closeRoom(roomId)
    }
  }
}

wsServer.on('connection', ws => {

  ws.on('getRoomCalls', (cb) => {
    const res = {}
    Object.keys(roomCalls).forEach(roomId => {
      const room = roomCalls[roomId]
      res[roomId] = { peers: {} }
      Object.keys(room.peers).forEach(peerId => {
        res[roomId].peers[peerId] = { producers: {} }
        const peer = room.peers[peerId]
        Object.keys(peer.producers).forEach(kind => {
          res[roomId].peers[peerId].producers[kind] = {
            id: peer.producers[kind].id,
            paused: peer.producers[kind].paused,
          }
        })
      })
    })
    cb(null, res)
  })

  ws.on('joinRoomCall', async ({ roomId }, cb) => {
    if (!roomCalls[roomId]) {
      await setupRoom(roomId)
    }

    setupPeer(roomId, ws.id)

    ws.on('disconnect', () => {
      closePeer(roomId, ws.id)
    })

    cb(null)
  })

  ws.on('leaveRoomCall', ({ roomId }, cb) => {
    closePeer(roomId, ws.id)
    cb(null)
  })

  ws.on('getRouterRtpCapabilities', ({ roomId }, cb) => {
    const room = roomCalls[roomId]
    cb(null, room.router.rtpCapabilities)
  })

  ws.on('createProducerTransport', async ({ roomId }, cb) => {
    try {
      const room = roomCalls[roomId]
      const transport = await mediasoup.createWebRtcTransport(room.router)
      room.peers[ws.id].producerTransport = transport
      cb(null, {
        id: transport.id,
        iceParameters: transport.iceParameters,
        iceCandidates: transport.iceCandidates,
        dtlsParameters: transport.dtlsParameters
      })
    } catch (err) {
      console.error(err)
      cb(err)
    }
  })

  ws.on('createConsumerTransport', async ({ roomId }, cb) => {
    try {
      const room = roomCalls[roomId]
      const transport = await mediasoup.createWebRtcTransport(room.router)
      room.peers[ws.id].consumerTransport = transport
      cb(null, {
        id: transport.id,
        iceParameters: transport.iceParameters,
        iceCandidates: transport.iceCandidates,
        dtlsParameters: transport.dtlsParameters
      })
    } catch (err) {
      console.error(err)
      cb(err)
    }
  })

  ws.on('connectProducerTransport', async ({ roomId, dtlsParameters }, cb) => {
    try {
      const room = roomCalls[roomId]
      const transport = room.peers[ws.id].producerTransport
      await transport.connect({ dtlsParameters })
      cb(null)
    } catch(err) {
      console.error(err)
      cb(err)
    }
  })

  ws.on('connectConsumerTransport', async ({ roomId, dtlsParameters }, cb) => {
    try {
      const room = roomCalls[roomId]
      const transport = room.peers[ws.id].consumerTransport
      await transport.connect({ dtlsParameters })
      cb(null)

    } catch(err) {
      console.error(err)
      cb(err)
    }
  })

  ws.on('createProducer', async ({ roomId, kind, rtpParameters }, cb) => {
    try {
      const room = roomCalls[roomId]
      const transport = room.peers[ws.id].producerTransport
      const producer = await transport.produce({ kind, rtpParameters })
      room.peers[ws.id].producers[kind] = producer
      cb(null, { id: producer.id })

      ws.emit('room-call-peer-producer', {
        roomId,
        peerId: ws.id,
        id: producer.id,
        state: 'new',
        kind,
      })

      producer.observer.on('close', () => {
        ws.emit('room-call-peer-producer', {
          roomId,
          peerId: ws.id,
          id: producer.id,
          state: 'close',
          kind,
        })
      })

      producer.observer.on('pause', () => {
        ws.emit('room-call-peer-producer', {
          roomId,
          peerId: ws.id,
          id: producer.id,
          state: 'pause',
          kind,
        })
      })

      producer.observer.on('resume', () => {
        ws.emit('room-call-peer-producer', {
          roomId,
          peerId: ws.id,
          id: producer.id,
          state: 'resume',
          kind,
        })
      })

    } catch(err) {
      console.error(err)
      cb(err)
    }
  })

  ws.on('createConsumer', async ({ peerId, kind, rtpCapabilities }, cb) => {
    try {
      const room = roomCalls[roomId]
      const transport = room.peers[ws.id].consumerTransport
      const producer = room.peers[peerId].producers[kind]

      const consumer = await createConsumer(
        room.router, transport, producer, rtpCapabilities
      )

      setPeerConsumer(ws.id, consumer)

      cb(null, {
        producerId,
        id: consumer.id,
        kind: consumer.kind,
        rtpParameters: consumer.rtpParameters,
        type: consumer.type,
        producerPaused: consumer.producerPaused
      })

    } catch(err) {
      console.error(err)
      cb(err)
    }
  })
})

async function start() {
  const httpServer = https.createServer({
    key: fs.readFileSync('key.pem'),
    cert: fs.readFileSync('cert.pem')
  })

  wsServer.attach(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST']
    }
  })

  await mediasoup.start()
  router = await mediasoup.createRouter()

  httpServer.listen(8080, () => {
    console.log('Listening on 8080')
  })
}

start()
  .then(() => console.log('Started'))
  .catch(err => console.error(err))
