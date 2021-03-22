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

async function setupRoom(roomId) {
  const room = roomCalls[roomId] = {
    router: null,
    peers: {},
  }

  room.router = await mediasoup.createRouter()
  wsServer.emit('room-call', { roomId, state: 'new' })

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
    wsServer.emit('room-call', { roomId, state: 'closed' })

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
  wsServer.emit('room-call-peer', { roomId, peerId, state: 'new' })
}

function closePeer(roomId, peerId) {
  const room = roomCalls[roomId]
  if (room.peers[peerId]) {
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
    wsServer.emit('room-call-peer', { roomId, peerId, state: 'closed' })

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

  ws.on('joinRoomCall', async ({ roomId }) => {
    if (!roomCalls[roomId]) {
      await setupRoom(roomId)
    }

    setupPeer(roomId, ws.id)

    ws.on('disconnect', () => {
      closePeer(roomId, ws.id)
    })
  })

  ws.on('leaveRoomCall', ({ roomId }) => {
    closePeer(roomId, ws.id)
  })

  // ws.on('getRouterRtpCapabilities', (cb) => {
  //   cb(null, router.rtpCapabilities)
  // })

  // ws.on('createProducerTransport', async (cb) => {
  //   try {
  //     const transport = await mediasoup.createWebRtcTransport(router)
  //     setPeerProducerTransport(ws.id, transport)
  //     cb(null, {
  //       id: transport.id,
  //       iceParameters: transport.iceParameters,
  //       iceCandidates: transport.iceCandidates,
  //       dtlsParameters: transport.dtlsParameters
  //     })
  //   } catch (err) {
  //     console.error(err)
  //     cb(err)
  //   }
  // })

  // ws.on('createConsumerTransport', async (cb) => {
  //   try {
  //     const transport = await mediasoup.createWebRtcTransport(router)
  //     setPeerConsumerTransport(ws.id, transport)
  //     cb(null, {
  //       id: transport.id,
  //       iceParameters: transport.iceParameters,
  //       iceCandidates: transport.iceCandidates,
  //       dtlsParameters: transport.dtlsParameters
  //     })
  //   } catch (err) {
  //     console.error(err)
  //     cb(err)
  //   }
  // })

  // ws.on('connectProducerTransport', async ({ dtlsParameters }, cb) => {
  //   try {
  //     const transport = getPeerProducerTransport(ws.id)
  //     await transport.connect({ dtlsParameters })
  //     cb(null)
  //   } catch(err) {
  //     console.error(err)
  //     cb(err)
  //   }
  // })

  // ws.on('connectConsumerTransport', async ({ dtlsParameters }, cb) => {
  //   try {
  //     const transport = getPeerConsumerTransport(ws.id)
  //     await transport.connect({ dtlsParameters })
  //     cb(null)

  //   } catch(err) {
  //     console.error(err)
  //     cb(err)
  //   }
  // })

  // ws.on('createProducer', async ({ kind, rtpParameters }, cb) => {
  //   try {
  //     const transport = getPeerProducerTransport(ws.id)
  //     const producer = await transport.produce({ kind, rtpParameters })
  //     cb(null, { id: producer.id })

  //     ws.emit('producer', {
  //       peerId: ws.id,
  //       id: producer.id,
  //       state: 'new',
  //       kind,
  //     })

  //     producer.observer.on('close', () => {
  //       ws.emit('producer', {
  //         peerId: ws.id,
  //         id: producer.id,
  //         state: 'close',
  //         kind,
  //       })
  //     })

  //     producer.observer.on('pause', () => {
  //       ws.emit('producer', {
  //         peerId: ws.id,
  //         id: producer.id,
  //         state: 'pause',
  //         kind,
  //       })
  //     })

  //     producer.observer.on('resume', () => {
  //       ws.emit('producer', {
  //         peerId: ws.id,
  //         id: producer.id,
  //         state: 'resume',
  //         kind,
  //       })
  //     })

  //   } catch(err) {
  //     console.error(err)
  //     cb(err)
  //   }
  // })

  // ws.on('createConsumer', async ({ peerId, kind, rtpCapabilities }, cb) => {
  //   try {
  //     const transport = getPeerConsumerTransport(ws.id)
  //     const producer = getPeerProducer(peerId, kind)

  //     const consumer = await createConsumer(
  //       router, transport, producer, rtpCapabilities
  //     )

  //     setPeerConsumer(ws.id, consumer)

  //     cb(null, {
  //       producerId,
  //       id: consumer.id,
  //       kind: consumer.kind,
  //       rtpParameters: consumer.rtpParameters,
  //       type: consumer.type,
  //       producerPaused: consumer.producerPaused
  //     })

  //   } catch(err) {
  //     console.error(err)
  //     cb(err)
  //   }
  // })

  // ws.on('resumeConsumer', async ({ consumerId }, cb) => {
  //   try {
  //     const consumer = consumers[consumerId]
  //     await consumer.resume()
  //     cb(null)
  //   } catch(err) {
  //     console.error(err)
  //     cb(err)
  //   }
  // })
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
