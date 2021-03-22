import React from 'react'

export default function Audio({ src, ...props }) {
  const ref = useRef(null)

  useEffect(() => {
    if (!ref.current) return
    ref.current.srcObject = src
  }, [src])

  return <audio ref={ref} {...props} />
}
