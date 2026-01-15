const mongoose = require('mongoose');

const RideSchema = new mongoose.Schema({
  rider: { 
    type: mongoose.Schema.Types.ObjectId,
     ref: 'User',
    required: true 
  },
  
  fromLocation: { 
    type: String, 
    required: true 
  },

  fromLatLng: { 
    lat: Number, 
    lng: Number 
  },

  toLocation: { 
    type: String, 
    required: true 
  },

  toLatLng: { 
    lat: Number, 
    lng: Number 
  },

  routePath: [{ 
    lat: Number, 
    lng: Number 
  }],

  date: { 
    type: String, 
    required: true 
  },

  time: { 
    type: String, 
    required: true 
  },

  price: { 
    type: Number, 
    required: true 
  },

  seats: { 
    type: Number, 
    default: 1 
  },

  passengers: [{ 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User' 
  }],

  pickupMeetingPoint: { 
    lat: Number, 
    lng: Number 
  },

  dropMeetingPoint: { 
    lat: Number, 
    lng: Number 
  },

  passengerActualPickup: { 
    lat: Number, 
    lng: Number 
  },

  passengerActualDropoff: { 
    lat: Number, 
    lng: Number 
  },

  paymentMethod: { 
    type: String, 
    enum: ['cash', 'esewa', 'pending'], 
    default: 'pending' 
  },

  paymentStatus: { 
    type: String, 
    enum: ['unpaid', 'paid'], 
    default: 'unpaid' 
  },

  feedbackForRider: {
    rating: Number,
    tags: [String],
    comment: String
  },

  feedbackForPassenger: {
    rating: Number,
    tags: [String],
    comment: String
  },

  cancellationReason: { 
    type: String, default: "" 
  },

  cancelledBy: { 
    type: mongoose.Schema.Types.ObjectId,  
    ref: 'User' 
  },

  matchType: { 
    type: String, 
    enum: ['detour', 'smart'], 
    default: 'detour' 
  },

  status: { 
    type: String, 
    enum: ['active', 'booked', 'heading_to_pickup', 'arrived', 'ongoing', 'completed', 'cancelled'], 
    default: 'active' 
  }
}, { timestamps: true });

module.exports = mongoose.model('Ride', RideSchema);