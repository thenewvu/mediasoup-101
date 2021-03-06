import React, { useEffect, useState } from 'react'
import { useGlobal, useDispatch } from 'reactn'
import { useParams } from 'react-router-dom'
import { useUnmount } from 'react-use'
import { Button } from 'react-bootstrap'
import { request } from './ws'
import { mediasoupClients } from './state'
import Video from './video'

function RoomCall() {
  const { roomId } = useParams()
  const dispatch = useDispatch()
  const [enabledMic, setEnabledMic] = useState(false)
  const [enabledCam, setEnabledCam] = useState(false)
  const [enabledScreen, setEnabledScreen] = useState(false)
  const [ready, setReady] = useState(false)
  const client = mediasoupClients[roomId] 

  useEffect(async () => {
    await dispatch.joinRoomCall(roomId)
    setReady(true)
  }, [])

  useUnmount(async () => {
    await dispatch.leaveRoomCall(roomId)
  })

  toggleMic = async () => {
    if (!enabledMic) {
      await client.createAudioProducer()
    }
    setEnabledMic(!enabledMic)
  }

  toggleCam = async () => {
    if (!enabledCam) {
      await client.createVideoProducer()
    }
    setEnabledCam(!enabledCam)
  }

  toggleScreen = async () => {
    if (!enabledScreen) {
      await client.createDisplayProducer()
    }
    setEnabledScreen(!enabledScreen)
  }

  if (!ready) {
    return null
  }

  let localVideoStream = null
  if (client.producers.video) {
    localVideoStream = new MediaStream()
    localVideoStream.addTrack(client.producers.video.track)
  }

  return (<>
    <div>{roomId}</div>

    <input type="checkbox" name="mic" checked={enabledMic} onChange={toggleMic}/>
    <label htmlFor="mic">Mic</label>

    <input type="checkbox" name="cam" checked={enabledCam} onChange={toggleCam}/>
    <label htmlFor="cam">Cam</label>

    <input type="checkbox" name="screen" checked={enabledScreen} onChange={toggleScreen}/>
    <label htmlFor="screen">Screen</label>

    {localVideoStream && (
      <Video src={localVideoStream} autoPlay={true}/>
    )}
  </>)
}

export default RoomCall
