const mongoose = require('mongoose');

const RideSchema = new mongoose.Schema({
  rider: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  fromLocation: { type: String, required: true },
  fromLatLng: { 
    lat: { type: Number, required: true }, 
    lng: { type: Number, required: true } 
  },
  toLocation: { type: String, required: true },
  toLatLng: { 
    lat: { type: Number, required: true }, 
    lng: { type: Number, required: true } 
  },
  routePath: [
    {
      lat: Number,
      lng: Number
    }
  ],
  date: { type: String, required: true },
  time: { type: String, required: true },
  price: { type: Number, required: true },
  seats: { type: Number, default: 1 },
  status: { type: String, enum: ['active', 'completed', 'cancelled'], default: 'active' }
}, { timestamps: true });

module.exports = mongoose.model('Ride', RideSchema);