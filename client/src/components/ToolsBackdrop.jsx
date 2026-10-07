import React from 'react'
import { Wrench, Zap, Wind, Hammer, Paintbrush, Settings, Droplets } from 'lucide-react'

const icons = [Wrench, Zap, Wind, Hammer, Paintbrush, Settings, Droplets]

export default function ToolsBackdrop() {
  const items = Array.from({ length: 14 }).map((_, i) => {
    const Icon = icons[i % icons.length]
    const top = (i * 37) % 100
    const left = (i * 53) % 100
    const size = 22 + ((i * 11) % 30)
    const rotate = (i * 29) % 360
    return { Icon, top, left, size, rotate, key: i }
  })

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {items.map(({ Icon, top, left, size, rotate, key }) => (
        <Icon
          key={key}
          size={size}
          style={{ position: 'absolute', top: `${top}%`, left: `${left}%`, transform: `rotate(${rotate}deg)` }}
          className="text-white/5"
        />
      ))}
    </div>
  )
}
