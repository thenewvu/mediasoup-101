import React, { useEffect, useState } from 'react'
import { useGlobal, useDispatch } from 'reactn'
import { useParams } from 'react-router-dom'
import { useUnmount } from 'react-use'
import { Button } from 'react-bootstrap'
import { request } from './ws'
import { mediasoupClients } from './state'

function RoomCall() {
  const { roomId } = useParams()
  const dispatch = useDispatch()
  const [enabledMic, setEnabledMic] = useState(false)
  const [enabledCam, setEnabledCam] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(async () => {
    await dispatch.joinRoomCall(roomId)
    setReady(true)
  }, [])

  useUnmount(async () => {
    await dispatch.leaveRoomCall(roomId)
  })

  toggleMic = async () => {
    if (!enabledMic) {
      await mediasoupClients[roomId].createAudioProducer()
    }
    setEnabledMic(!enabledMic)
  }

  toggleCam = async () => {
    if (!enabledCam) {
      await mediasoupClients[roomId].createVideoProducer()
    }
    setEnabledCam(!enabledCam)
  }

  if (!ready) {
    return null
  }

  return (<>
    <div>{roomId}</div>

    <input type="checkbox" name="mic" checked={enabledMic} onChange={toggleMic}/>
    <label htmlFor="mic">Mic</label>

    <input type="checkbox" name="cam" checked={enabledCam} onChange={toggleCam}/>
    <label htmlFor="cam">Cam</label>
  </>)
}

export default RoomCall
