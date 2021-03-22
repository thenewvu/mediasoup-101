import React, { useEffect, useState } from 'react'
import { useGlobal, useDispatch } from 'reactn'

function Rooms() {
  const dispatch = useDispatch()
  const [roomCalls] = useGlobal('roomCalls')

  useEffect(async () => {
    await dispatch.loadRoomCalls()
  }, [])

  return (
    <div>
      {Object.keys(roomCalls).map(roomId => (
        <div key={roomId}>{roomId}</div>
      ))}
    </div>
  )
}

export default Rooms
