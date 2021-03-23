import * as mediasoup from 'mediasoup-client'
import * as lodash from 'lodash'
import { request } from './ws'

export default class MediasoupClient {
  constructor(roomId) {
    this.roomId = roomId
  }

  static async create(roomId) {
    const client = new MediasoupClient(roomId)
    const routerRtpCapabilities = await request('getRouterRtpCapabilities', { roomId })
    const device = new mediasoup.Device()
    await device.load({ routerRtpCapabilities })
    client.device = device
    client.producers = {}
    client.consumers = {}
    return client
  }

  close() {
    if (this.sendTransport) {
      this.sendTransport.close()
    }
    if (this.recvTransport) {
      this.recvTransport.close()
    }

    Object.keys(this.producers).forEach(kind => {
      this.producers[kind].close()
    })

    Object.keys(this.consumers).forEach(peerId => {
      Object.keys(this.consumers[peerId]).forEach(kind => {
        this.consumers[peerId][kind].close()
      })
    })
  }

  async createSendTransport() {
    const params = await request('createProducerTransport', {
      roomId: this.roomId
    })

    const transport = this.device.createSendTransport(params)

    transport.on('connect', async ({ dtlsParameters }, callback, errback) => {
      request('connectProducerTransport', { roomId: this.roomId, dtlsParameters })
        .then(callback)
        .catch(errback)
    })

    transport.on('produce', async ({ kind, rtpParameters }, callback, errback) => {
      try {
        const { id } = await request('createProducer', {
          roomId: this.roomId,
          kind,
          rtpParameters
        })
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
          this.sendTransport = null
          break

        default: break
      }
    })

    this.sendTransport = transport
    return transport
  }

  async createRecvTransport() {
    const params = await request('createConsumerTransport', { roomId: this.roomId })
    const transport = this.device.createRecvTransport(params)

    transport.on('connect', async ({ dtlsParameters }, callback, errback) => {
      request('connectConsumerTransport', { roomId: this.roomId, dtlsParameters })
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
          this.recvTransport = null
          break

        default: break
      }
    })

    this.recvTransport = transport
    return transport
  }

  async createConsumer(peerId, kind) {
    if (!this.recvTransport) {
      await this.createProducerTransport()
    }

    const rtpCapabilities = this.device.rtpCapabilities
    const params = await request('createConsumer', {
      roomId: this.roomId, peerId, kind, rtpCapabilities,
    })

    const consumer = await this.recvTransport.consume(params)
    lodash.set(this.consumers, [peerId, kind], consumer)

    return consumer
  }

  async createVideoProducer() {
    if (!this.device.sendTransport) {
      await this.createSendTransport()
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 320 },
        height: { ideal: 240 },
        frameRate: { ideal: 10 },
      }
    })
    const track = stream.getVideoTracks()[0]
    const producer = await this.sendTransport.produce({ track })
    this.producers.video = producer
    return producer
  }

  async createAudioProducer() {
    if (!this.device.sendTransport) {
      await this.createSendTransport()
    }

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    const track = stream.getAudioTracks()[0]
    const producer = await this.sendTransport.produce({ track })
    this.producers.audio = producer
    return producer
  }
}

