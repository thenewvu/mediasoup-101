import { setGlobal, addReducer, getDispatch } from 'reactn'
import immer, { setAutoFreeze } from 'immer'
setAutoFreeze(false)
import ws, { request } from './ws'
import lodash from 'lodash'
import addReactNDevTools from 'reactn-devtools'
addReactNDevTools()
import MediasoupClient from './mediasoup'

setGlobal({
  roomCalls: {}
})

addReducer('mergeRoomCalls', (global, dispatch, roomCalls) => immer(global, draft => {
  lodash.merge(roomCalls, draft.roomCalls)
  draft.roomCalls = roomCalls
}))

addReducer('createRoomCall', (global, dispatch, roomId) => immer(global, draft => {
  lodash.set(draft, `roomCalls.${roomId}`, { peers: {}})
}))

addReducer('removeRoomCall', (global, dispatch, roomId) => immer(global, draft => {
  lodash.unset(draft, `roomCalls.${roomId}`)
}))

addReducer('createRoomCallPeer', (global, dispatch, roomId, peerId) => immer(global, draft => {
  lodash.set(draft, `roomCalls.${roomId}.peers.${peerId}`, {})
}))

addReducer('removeRoomCallPeer', (global, dispatch, roomId, peerId) => immer(global, draft => {
  lodash.unset(draft, `roomCalls.${roomId}.peers.${peerId}`)
}))

addReducer('loadRoomCalls', async (global, dispatch) => {
  const roomCalls = await request('getRoomCalls')
  await dispatch.mergeRoomCalls(roomCalls)
})

ws.on('room-call', async ({ roomId, state }) => {
  const dispatch = getDispatch()

  switch(state) {
    case 'new': {
      await dispatch.createRoomCall(roomId)
      break
    }
    case 'closed': {
      await dispatch.removeRoomCall(roomId)
      break
    }
  }
})

ws.on('room-call-peer', async ({ roomId, peerId, state }) => {
  const dispatch = getDispatch()

  switch(state) {
    case 'new': {
      await dispatch.createRoomCallPeer(roomId, peerId)
      break
    }
    case 'closed': {
      await dispatch.removeRoomCallPeer(roomId, peerId)
      break
    }
  }
})

export const mediasoupClients = {}

addReducer('joinRoomCall', async (global, dispatch, roomId) => {
  await request('joinRoomCall', { roomId })
  mediasoupClients[roomId] = await MediasoupClient.create(roomId)
})

addReducer('leaveRoomCall', async (global, dispatch, roomId) => {
  mediasoupClients[roomId].close()
  delete mediasoupClients[roomId]
  await request('leaveRoomCall', { roomId })
})

