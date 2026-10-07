import React from 'react'
import { Check } from 'lucide-react'

// One tracker used by the customer's cards, the live-tracking screen and the
// technician's cards, so everyone sees the same stage names.
const STEPS = ['Requested', 'Quote', 'Confirmed', 'On the way', 'Work', 'Payment']

const STAGE_INDEX = {
  requested: 0, accepted: 0, quote_sent: 1, quote_accepted: 2,
  technician_arriving: 3, arrived: 3, in_progress: 4, completed: 5
}

export function stageFor(booking) {
  if (booking.status === 'completed' && (booking.paymentStatus === 'paid' || booking.paid)) return STEPS.length
  return STAGE_INDEX[booking.status] ?? 0
}

export default function BookingProgress({ booking, compact }) {
  if (booking.status === 'cancelled') return null
  const current = stageFor(booking)

  return (
    <div className={`flex items-start ${compact ? 'mt-3' : 'mt-4'}`}>
      {STEPS.map((label, i) => {
        const done = i < current
        const active = i === current
        return (
          <React.Fragment key={label}>
            <div className="flex flex-col items-center w-12 shrink-0">
              <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold transition-colors ${
                done ? 'bg-okgreen text-white' : active ? 'bg-signal text-white ring-4 ring-signal/20' : 'bg-ink-100 text-ink-400'
              }`}>
                {done ? <Check size={11} strokeWidth={3} /> : i + 1}
              </div>
              <span className={`text-[9px] mt-1 text-center leading-tight ${active ? 'text-ink font-semibold' : done ? 'text-ink-400' : 'text-ink-400/70'}`}>
                {label}
              </span>
            </div>
            {i < STEPS.length - 1 && <div className={`flex-1 h-0.5 mt-2.5 -mx-1 ${i < current ? 'bg-okgreen' : 'bg-ink-100'}`} />}
          </React.Fragment>
        )
      })}
    </div>
  )
}
