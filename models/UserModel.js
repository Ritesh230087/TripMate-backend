const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  // Passenger Fields (Required)
  fullName: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  phone: { type: String, required: true },
  password: { type: String, required: true },
  
  gender: { 
    type: String, 
    enum: ['Male', 'Female', 'Other'], 
    required: true 
  },
  dob: { type: Date, required: true },
  
  // Optional Profile Picture
  profilePic: { type: String, default: "" },

  // System Fields
  role: { type: String, default: 'passenger' }, // Everyone starts here
  riderStatus: { type: String, default: 'none' }, // Future use

}, { timestamps: true });

module.exports = mongoose.model('User', UserSchema);