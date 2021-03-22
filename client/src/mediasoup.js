import * as mediasoup from 'mediasoup-client'
import * as lodash from 'lodash'
import ws from './ws'

export async function request(...req) {
  return new Promise((resolve, reject) => {
    ws.emit(...req, (err, res) => {
      err ? reject(err) : resolve(res)
    })
  })
}

export async function start(client) {
  await createDevice(client)
}

export async function stop(client) {
  if (client.sendTransport) {
    client.sendTransport.close()
  }
  if (client.recvTransport) {
    client.recvTransport.close()
  }
  if (client.producers.video) {
    client.producers.video.close()
  }
  if (client.producers.audio) {
    client.producers.audio.close()
  }
  Object.keys(client.consumers).forEach(peerId => {
    Object.keys(client.consumers[peerId]).forEach(kind => {
      client.consumers[peerId][kind].close()
    })
  })
}

export async function createDevice(client) {
  const routerRtpCapabilities = await request('getRouterRtpCapabilities')
  client.device = new mediasoup.Device()
  await client.device.load({ routerRtpCapabilities })
  return client.device
}

export async function createSendTransport(client) {
  const params = await request('createProducerTransport')
  const transport = client.device.createSendTransport(params)

  transport.on('connect', async ({ dtlsParameters }, callback, errback) => {
    request('connectProducerTransport', { dtlsParameters })
      .then(callback)
      .catch(errback)
  })

  transport.on('produce', async ({ kind, rtpParameters }, callback, errback) => {
    try {
      const { id } = await request('createProducer', { kind, rtpParameters })
      callback({ id })
    } catch (err) {
      errback(err)
    }
  })

  transport.on('connectionstatechange', (state) => {
    switch (state) {
      case 'connecting':
        console.log('send transport %s connecting', transport.id)
        break

      case 'connected':
        console.log('send transport %s connected', transport.id)
        break

      case 'failed':
        console.log('send transport %s failed', transport.id)
        transport.close()
        break

      default: break
    }
  })

  client.sendTransport = transport
  return transport
}

export async function createRecvTransport(client) {
  const params = await request('createConsumerTransport')
  const transport = client.device.createRecvTransport(params)

  transport.on('connect', async ({ dtlsParameters }, callback, errback) => {
    request('connectConsumerTransport', { dtlsParameters })
      .then(callback)
      .catch(errback)
  })

  transport.on('connectionstatechange', (state) => {
    switch (state) {
      case 'connecting':
        console.log('recv transport %s connecting', transport.id)
        break

      case 'connected':
        console.log('recv transport %s connected', transport.id)
        break

      case 'failed':
        console.log('recv transport %s failed', transport.id)
        transport.close()
        break

      default: break
    }
  })

  client.recvTransport = transport
  return transport
}

export async function consume(client, peerId, kind) {
  const rtpCapabilities = client.device.rtpCapabilities
  const params = await request('createConsumer', {
    peerId, kind, rtpCapabilities,
  })

  const consumer = await client.recvTransport.consume(params)
  lodash.set(client.consumers, [peerId, kind], consumer)

  return consumer
}

export async function startVideoProducer(client) {
  if (!device.sendTransport) {
    await createSendTransport(client)
  }

  const stream = await navigator.mediaDevices.getUserMedia({
    video: {
      width: { ideal: 320 },
      height: { ideal: 240 },
      frameRate: { ideal: 10 },
    }
  })
  const track = stream.getVideoTracks()[0]
  const producer = await client.sendTransport.produce({ track })
  client.producers.video = producer
  return producer
}

export async function startAudioProducer(client) {
  if (!device.sendTransport) {
    await createSendTransport(client)
  }

  const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
  const track = stream.getAudioTracks()[0]
  const producer = await client.sendTransport.produce({ track })
  client.producers.audio = producer
  return producer
}

