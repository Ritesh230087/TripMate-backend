// const mongoose = require('mongoose');

// const UserSchema = new mongoose.Schema({
//   // Passenger Fields (Required)
//   fullName: { type: String, required: true },
//   email: { type: String, required: true, unique: true },
//   phone: { type: String, required: true },
//   password: { type: String, required: true },
  
//   gender: { 
//     type: String, 
//     enum: ['Male', 'Female', 'Other'], 
//     required: true 
//   },
//   dob: { type: Date, required: true },
  
//   // Optional Profile Picture
//   profilePic: { type: String, default: "" },

//   // System Fields
//   role: { type: String, default: 'passenger' }, // Everyone starts here
//   riderStatus: { type: String, default: 'none' }, // Future use

// }, { timestamps: true });

// module.exports = mongoose.model('User', UserSchema);




















































const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  // ==========================
  // 1. BASIC USER DETAILS (Required for Register)
  // ==========================
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

  // ==========================
  // 2. SYSTEM ROLES
  // ==========================
  role: { 
    type: String, 
    enum: ['passenger', 'rider', 'admin'], 
    default: 'passenger' 
  },
  
  // ==========================
  // 3. RIDER SPECIFIC
  // ==========================
  riderStatus: { 
    type: String, 
    enum: ['none', 'pending', 'approved', 'rejected'], 
    default: 'none' 
  },

  kycRejectionReason: { type: String, default: "" },

  // KYC Details (For when they apply to be a rider)
  kycDetails: {
    // Citizenship
    citizenshipFront: { type: String },
    citizenshipBack: { type: String },

    // License
    licenseNumber: { type: String },
    licenseExpiryDate: { type: String },
    licenseIssueDate: { type: String },
    licenseImage: { type: String },
    selfieWithLicense: { type: String },

    // Vehicle
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