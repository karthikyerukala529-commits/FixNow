import mongoose from 'mongoose'

export async function connectDB() {
  try {
    const uri = process.env.MONGO_URI
    if (!uri) { console.error('❌ MONGO_URI is missing from .env'); process.exit(1) }
    await mongoose.connect(uri)
    console.log(`✅ MongoDB connected: ${mongoose.connection.name}`)
  } catch (err) {
    console.error('❌ MongoDB connection error:', err.message)
    console.error('   Is the MongoDB service running? Try opening a terminal and typing "mongosh".')
    process.exit(1)
  }
}
