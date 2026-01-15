const User = require('../models/UserModel');
const Ride = require('../models/RideModel');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const sendEmail = require('../utils/emailService');
const { OAuth2Client } = require('google-auth-library');

// Generate Token Helper
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' });
};

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// @desc    Register a new Passenger
// @route   POST /api/auth/register
// @access  Public
exports.registerUser = async (req, res) => {
  try {
    console.log("🔹 Register Request Body:", req.body); 
    if (!req.body || Object.keys(req.body).length === 0) {
      return res.status(400).json({ message: "Request body is empty. Ensure you are sending Multipart/Form-Data." });
    }

    const { fullName, email, phone, password, confirmPassword, gender, dob } = req.body;

    if (!fullName || !email || !phone || !password || !gender || !dob) {
      return res.status(400).json({ message: "All fields are required" });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ message: "Passwords do not match" });
    }

    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: "User already exists with this email" });
    }
    let profilePicUrl = "";
    if (req.file) {
      profilePicUrl = req.file.path.replace(/\\/g, "/"); 
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = await User.create({
      fullName,
      email,
      phone,
      password: hashedPassword, 
      gender,
      dob,
      profilePic: profilePicUrl,
      role: 'passenger',
      riderStatus: 'none'
    });

    if (user) {
      res.status(201).json({
        _id: user._id,
        fullName: user.fullName,
        email: user.email,
        profilePic: user.profilePic,
        token: generateToken(user._id),
        message: "Registration successful"
      });
    } else {
      res.status(400).json({ message: "Invalid user data" });
    }

  } catch (error) {
    console.error("❌ Register Error:", error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Login User
// @route   POST /api/auth/login
// @access  Public
exports.loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (!user.password) {
      return res.status(500).json({ message: "Account corrupted (No password). Please register again." });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid email or password" });
    }

    res.json({
      _id: user._id,
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
      profilePic: user.profilePic,
      role: user.role,
      riderStatus: user.riderStatus,
      token: generateToken(user._id)
    });

  } catch (error) {
    console.error("❌ Login Error:", error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get Current User Profile + Real Stats
// @route   GET /api/auth/me
exports.getCurrentUser = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId).select('-password');
    if (!user) return res.status(404).json({ message: "User not found" });

    const ridesAsPassenger = await Ride.find({ passengers: userId, status: 'completed' });
    const totalSpent = ridesAsPassenger.reduce((sum, ride) => sum + (ride.price || 0), 0);

    const ridesAsRider = await Ride.find({ rider: userId, status: 'completed' });
    const totalEarned = ridesAsRider.reduce((sum, ride) => sum + (ride.price || 0), 0);

    res.status(200).json({
      user,
      stats: {
        ridesTaken: ridesAsPassenger.length,
        totalSpent: totalSpent,
        ridesDone: ridesAsRider.length,
        totalEarned: totalEarned,
        // Pass both sets so the app can switch views dynamically
        riderRating: user.riderRating || 5.0,
        passengerRating: user.passengerRating || 5.0,
        riderFeedbackTags: user.riderFeedbackTags || [],
        passengerFeedbackTags: user.passengerFeedbackTags || []
      }
    });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Fetch existing user data first
    const existingUser = await User.findById(userId);
    if (!existingUser) return res.status(404).json({ message: "User not found" });

    const updateData = {};

    // 1. Map Basic Fields
    const { fullName, phone, gender, dob } = req.body;
    if (fullName) updateData.fullName = fullName;
    if (phone) updateData.phone = phone;
    if (gender) updateData.gender = gender;
    if (dob) updateData.dob = dob;

    // 2. Map KYC Text Fields (Using Dot Notation)
    const kycTextFields = [
      'licenseNumber', 'licenseExpiryDate', 'licenseIssueDate',
      'vehicleModel', 'vehicleProductionYear', 'vehiclePlateNumber'
    ];
    
    kycTextFields.forEach(field => {
      if (req.body[field] !== undefined && req.body[field] !== "") {
        updateData[`kycDetails.${field}`] = req.body[field];
      }
    });

    // 3. Map Files - ONLY UPDATE IF NEW FILE EXISTS
    const getPath = (name) => req.files[name] ? req.files[name][0].path.replace(/\\/g, "/") : null;

    if (req.files) {
      // Profile Picture
      const newProfilePic = getPath('profilePic');
      if (newProfilePic) {
        updateData.profilePic = newProfilePic;
      }
      
      // KYC Files - CRITICAL: Only update if new file is uploaded
      const kycFiles = [
        'licenseImage', 'selfieWithLicense', 'vehiclePhoto', 
        'billbookPage2', 'billbookPage3', 'citizenshipFront', 'citizenshipBack'
      ];
      
      kycFiles.forEach(field => {
        const newPath = getPath(field);
        // ✅ ONLY UPDATE IF NEW FILE EXISTS
        if (newPath) {
          updateData[`kycDetails.${field}`] = newPath;
        }
        // ✅ If no new file, the existing value remains unchanged
      });
    }

    // 4. Atomic Update using $set (preserves existing values)
    const updatedUser = await User.findByIdAndUpdate(
      userId, 
      { $set: updateData }, 
      { new: true }
    ).select('-password');

    res.status(200).json({ 
      message: "Profile updated successfully", 
      user: updatedUser 
    });
  } catch (error) {
    console.error("Update Profile Error:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    const updateData = {};
    let kycChanged = false;

    // 1. Map Basic Fields (Non-sensitive)
    const { fullName, phone, gender, dob } = req.body;
    if (fullName) updateData.fullName = fullName;
    if (phone) updateData.phone = phone;
    if (gender) updateData.gender = gender;
    if (dob) updateData.dob = dob;

    // 2. KYC Text Fields - Detection of change
    const kycTextFields = [
      'licenseNumber', 'licenseExpiryDate', 'licenseIssueDate',
      'vehicleModel', 'vehicleProductionYear', 'vehiclePlateNumber'
    ];
    
    kycTextFields.forEach(field => {
      if (req.body[field] !== undefined && req.body[field] !== "") {
        // If the new value is different from the old value, mark as changed
        if (user.kycDetails[field] !== req.body[field]) {
          kycChanged = true;
        }
        updateData[`kycDetails.${field}`] = req.body[field];
      }
    });

    // 3. Map Files & Detect Image Changes
    const getPath = (name) => req.files[name] ? req.files[name][0].path.replace(/\\/g, "/") : null;

    if (req.files) {
      if (req.files['profilePic']) updateData.profilePic = getPath('profilePic');
      
      const kycFiles = [
        'licenseImage', 'selfieWithLicense', 'vehiclePhoto', 
        'billbookPage2', 'billbookPage3', 'citizenshipFront', 'citizenshipBack'
      ];
      
      kycFiles.forEach(field => {
        const newPath = getPath(field);
        if (newPath) {
          kycChanged = true; // Any new KYC file upload triggers re-verification
          updateData[`kycDetails.${field}`] = newPath;
        }
      });
    }

    // 4. LOGIC: If KYC fields changed, reset status to pending and demote role
    if (kycChanged) {
      updateData.riderStatus = 'pending';
      updateData.role = 'passenger'; // User cannot act as Rider until re-approved
      updateData[`kycDetails.submittedAt`] = new Date();
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId, 
      { $set: updateData }, 
      { new: true }
    ).select('-password');

    res.status(200).json({ 
      message: kycChanged ? "Profile updated. Status reverted to pending for verification." : "Profile updated successfully", 
      user: updatedUser 
    });
  } catch (error) {
    res.status(500).json({ message: "Server Error" });
  }
};

exports.updateFcmToken = async (req, res) => {
  try {
    const { fcmToken } = req.body;

    if (!fcmToken) {
      return res.status(400).json({ message: "FCM token required" });
    }

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { fcmToken },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    console.log(`✅ FCM Token updated for user: ${user.fullName}`);

    res.status(200).json({
      message: "FCM token updated successfully",
      user: {
        id: user._id,
        fullName: user.fullName,
        fcmToken: user.fcmToken
      }
    });
  } catch (error) {
    console.error('FCM Token Update Error:', error);
    res.status(500).json({ message: "Server Error" });
  }
};

exports.forgotPassword = async (req, res) => {
  try {
    const user = await User.findOne({ email: req.body.email });
    if (!user) return res.status(404).json({ message: "User not found" });

    const resetToken = crypto.randomBytes(20).toString('hex');
    user.resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    user.resetPasswordExpires = Date.now() + 30 * 60 * 1000; 
    await user.save();

    const resetUrl = `tripmate://reset-password/${resetToken}`; 
    const htmlMessage = `
      <div style="background-color: #F9F5E9; padding: 40px; text-align: center; font-family: sans-serif;">
        <h1 style="color: #8B4513;">TripMate</h1>
        <p style="font-size: 16px; color: #333;">Please click the button below to reset your password.</p>
        <br/>
        <a href="${resetUrl}" 
           style="background-color: #8B4513; color: white; padding: 15px 30px; text-decoration: none; border-radius: 10px; font-weight: bold; display: inline-block;">
           RESET PASSWORD
        </a>
        <br/><br/>
        <p style="font-size: 12px; color: #999;">If the button above does not work, copy and paste this text into your browser:</p>
        <p style="font-size: 12px; color: #8B4513;">${resetUrl}</p>
      </div>
    `;

    try {
      await sendEmail({
        email: user.email,
        subject: 'Reset your TripMate Password',
        message: `Reset your password here: ${resetUrl}`, // Plain text fallback
        html: htmlMessage // THIS IS THE IMPORTANT PART
      });
      res.status(200).json({ message: "Email sent successfully" });
    } catch (err) {
      console.error("❌ NODEMAILER ERROR:", err);
      user.resetPasswordToken = undefined;
      user.resetPasswordExpires = undefined;
      await user.save();
      return res.status(500).json({ message: "Email could not be sent" });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Reset Password
exports.resetPassword = async (req, res) => {
  try {
    const hashedToken = crypto.createHash('sha256').update(req.params.token).digest('hex');

    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) return res.status(400).json({ message: "Invalid or expired token" });

    // Set new password
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(req.body.password, salt);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.status(200).json({ message: "Password reset successful" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


// @desc    Google Sign In / Sign Up
// @route   POST /api/auth/google-login
exports.googleLogin = async (req, res) => {
  try {
    const { idToken } = req.body;

    if (!idToken) {
        return res.status(400).json({ message: "Google ID Token is required" });
    }

    // 1. Verify the idToken with Google
    const ticket = await client.verifyIdToken({
      idToken: idToken,
      audience: process.env.GOOGLE_CLIENT_ID, 
    });

    const payload = ticket.getPayload();
    const { email, name, picture, sub } = payload; // sub is the googleId

    // 2. Check if user exists by email
    let user = await User.findOne({ email });

    if (user) {
      // Link Google ID if not already linked
      user.googleId = sub;
      user.authMethod = 'google';
      // If user was manual, we don't change their role, just log them in
      await user.save();
    } else {
      // 3. Create new user if they don't exist
      user = await User.create({
        fullName: name,
        email: email,
        profilePic: picture,
        googleId: sub,
        authMethod: 'google',
        password: crypto.randomBytes(16).toString('hex'), // satisfy schema
        // phone: "", 
        gender: "Other",
        // dob: "",
        role: 'passenger'
      });
    }

    // 4. Generate Backend JWT
    const token = generateToken(user._id);

    res.status(200).json({
      _id: user._id,
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
      profilePic: user.profilePic,
      role: user.role,
      riderStatus: user.riderStatus,
      token: token
    });

  } catch (error) {
    console.error("❌ Google Verification Error:", error);
    res.status(401).json({ message: "Google Authentication Failed" });
  }
};
