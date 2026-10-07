export function initSocket(io) {
  io.on('connection', (socket) => {
    console.log('🔌 socket connected:', socket.id)

    socket.on('booking:join', (bookingId) => { socket.join(`booking:${bookingId}`) })
    socket.on('technician:join', (technicianId) => { socket.join(`technician:${technicianId}`) })
    // A personal room per logged-in account (customer or technician) used to
    // deliver notifications instantly while the app is open — see utils/notify.js.
    socket.on('user:join', (userId) => { socket.join(`user:${userId}`) })

    // Relays either the simulated `progress` (0..1) or real GPS `lat`/`lng`.
    // Real maps (docs/GO_LIVE.md) send lat/lng; both shapes work side by side.
    socket.on('technician:location_update', ({ bookingId, progress, lat, lng }) => {
      io.to(`booking:${bookingId}`).emit('technician:location', { progress, lat, lng, at: Date.now() })
    })

    socket.on('disconnect', () => { console.log('🔌 socket disconnected:', socket.id) })
  })
}
