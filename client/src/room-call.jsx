import React, { useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useUnmount } from 'react-use'
import { request } from './ws'

function RoomCall() {
  const { roomId } = useParams()

  useEffect(async () => {
    await request('joinRoomCall', { roomId })
  }, [])

  useUnmount(async () => {
    await request('leaveRoomCall', { roomId })
  })

  return (
    <div>{roomId}</div>
  )
}

export default RoomCall
