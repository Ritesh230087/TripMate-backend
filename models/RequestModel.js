const mongoose = require('mongoose');

const RequestSchema = new mongoose.Schema({
  rideId: { type: mongoose.Schema.Types.ObjectId, ref: 'Ride', required: true },
  passengerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  riderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  
  // Locations (From Smart Search)
  pickupLat: { type: Number, required: true },
  pickupLng: { type: Number, required: true },
  dropoffLat: { type: Number, required: true },
  dropoffLng: { type: Number, required: true },


    passengerActualPickup: {
    lat: { type: Number, required: true },
    lng: { type: Number, required: true }
  },
  passengerActualDropoff: {
    lat: { type: Number, required: true },
    lng: { type: Number, required: true }
  },



  // Smart Matching Data (So Rider knows)
  pickupDetour: { type: Number, default: 0 },
  pickupWalk: { type: Number, default: 0 },
  dropoffDetour: { type: Number, default: 0 },
  dropoffWalk: { type: Number, default: 0 },
  matchType: { type: String, required: true }, // 'detour', 'walk', 'hybrid'


    meetingPoint: {
    lat: Number,
    lng: Number
  },
  dropPoint: {
    lat: Number,
    lng: Number
  },

  
  
  status: { 
    type: String, 
    enum: ['pending', 'accepted', 'rejected', 'completed', 'cancelled'], 
    default: 'pending' 
  }
}, { timestamps: true });

module.exports = mongoose.model('Request', RequestSchema);