const mediasoup = require('mediasoup')

const config = {
  worker: {
    rtcMinPort: 10000,
    rtcMaxPort: 10100,
    logLevel: 'warn',
    logTags: [
      'info',
      'ice',
      'dtls',
      'rtp',
      'srtp',
      'rtcp',
      // 'rtx',
      // 'bwe',
      // 'score',
      // 'simulcast',
      // 'svc'
    ],
  },
  router: {
    mediaCodecs:
    [
      {
        kind: 'audio',
        mimeType: 'audio/opus',
        clockRate: 48000,
        channels: 2
      },
      {
        kind: 'video',
        mimeType: 'video/VP8',
        clockRate: 90000,
        parameters:
        {
          'x-google-start-bitrate': 1000
        }
      },
    ]
  },
  webRtcTransport: {
    listenIps: [
      {
        ip: '127.0.0.1',
        announcedIp: null,
      }
    ],
    maxIncomingBitrate: 1500000,
    initialAvailableOutgoingBitrate: 1000000,
  }
}

let worker = null

async function createWorker() {
  const worker = await mediasoup.createWorker({
    logLevel: config.worker.logLevel,
    logTags: config.worker.logTags,
    rtcMinPort: config.worker.rtcMinPort,
    rtcMaxPort: config.worker.rtcMaxPort,
  })

  worker.on('died', () => {
    console.error('mediasoup worker died, exiting in 2 seconds... [pid:%d]', worker.pid)
  })

  return worker
}

function createRouter() {
  const mediaCodecs = config.router.mediaCodecs
  return worker.createRouter({ mediaCodecs })
}

async function createWebRtcTransport(router) {
  const {
    maxIncomingBitrate,
    initialAvailableOutgoingBitrate
  } = config.webRtcTransport

  const transport = await router.createWebRtcTransport({
    listenIps: config.webRtcTransport.listenIps,
    enableUdp: true,
    enableTcp: true,
    preferUdp: true,
    initialAvailableOutgoingBitrate,
  })

  if (maxIncomingBitrate) {
    try {
      await transport.setMaxIncomingBitrate(maxIncomingBitrate)
    } catch (error) {
    }
  }
  return transport
}

async function createConsumer(router, transport, producer, rtpCapabilities) {
  if (!router.canConsume({ producerId: producer.id, rtpCapabilities })) {
    console.error('can not consume')
    return
  }

  try {
    const consumer = await transport.consume({
      producerId: producer.id,
      rtpCapabilities,
      paused: producer.kind === 'video',
    })

    if (consumer.type === 'simulcast') {
      await consumer.setPreferredLayers({ spatialLayer: 2, temporalLayer: 2 })
    }

    return consumer
  } catch (error) {
    console.error('consume failed', error)
    return
  }
}

async function start() {
  worker = await createWorker()
}

async function stop() {
  await worker.close()
}

module.exports = {
  start,
  stop,
  createRouter,
  createWebRtcTransport,
  createConsumer,
}
