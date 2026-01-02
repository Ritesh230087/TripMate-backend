const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema({
  recipient: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },

  sender: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User' 
  },

  title: { 
    type: String, 
    required: true 
  },

  message: { 
    type: String, 
    required: true 
  },

  type: { 
    type: String, 
    enum: ['request', 'accept', 'reject', 'status_update', 'cancel', 'payment', 'kyc_update'],
    required: true 
  },

  rideId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Ride' 
  },

  isRead: { 
    type: Boolean, 
    default: false 
  }
}, { timestamps: true });

module.exports = mongoose.model('Notification', NotificationSchema);