const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  fullName: { 
    type: String, 
    required: true 
  },

  email: { 
    type: String, 
    required: true, 
    unique: true 
  },

  phone: { 
    type: String, 
    required: true 
  },

  password: { 
    type: String, 
    required: true 
  },

  gender: { 
    type: String, 
    enum: ['Male', 'Female', 'Other'], 
    required: true 
  },

  dob: { 
    type: String, 
    required: true 
  },

  profilePic: { 
    type: String, 
    default: "" 
  },

  role: { 
    type: String, 
    enum: ['passenger', 'rider', 'admin'], 
    default: 'passenger' 
  },
  
  riderStatus: { 
    type: String, 
    enum: ['none', 'pending', 'approved', 'rejected'], 
    default: 'none' 
  },

  riderRating: { 
    type: Number, 
    default: 5.0 
  },

  riderReviewCount: { 
    type: Number, 
    default: 0 
  },

  riderFeedbackTags: [
    String
  ], 
  passengerRating: {
     type: Number,
      default: 5.0
  },

  passengerReviewCount: { 
    type: Number, 
    default: 0 
  },

  passengerFeedbackTags: [
    String
  ],

  kycRejectionReason: { 
    type: String,
     default: ""
  },
  kycDetails: {
    citizenshipFront: { type: String },
    citizenshipBack: { type: String },
    licenseNumber: { type: String },
    licenseExpiryDate: { type: String },
    licenseIssueDate: { type: String },
    licenseImage: { type: String },
    selfieWithLicense: { type: String },
    vehicleModel: { type: String },
    vehicleProductionYear: { type: String },
    vehiclePlateNumber: { type: String },
    vehiclePhoto: { type: String },
    billbookPage2: { type: String },
    billbookPage3: { type: String },
    submittedAt: { type: Date }
  }
}, { timestamps: true });

module.exports = mongoose.model('User', UserSchema);