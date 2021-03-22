import React from 'react'

export default function Video({ src, ...props }) {
  const ref = useRef(null)

  useEffect(() => {
    if (!ref.current) return
    ref.current.srcObject = src
  }, [src])

  return <video ref={ref} {...props} />
}
