const User = require('../models/UserModel');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Generate Token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' });
};

// @desc    Register a new Passenger
// @route   POST /api/auth/register
// @access  Public
exports.registerUser = async (req, res) => {
  try {
    const { fullName, email, phone, password, confirmPassword, gender, dob } = req.body;

    // 1. Validation
    if (password !== confirmPassword) {
      return res.status(400).json({ message: "Passwords do not match" });
    }

    // 2. Check if User Exists
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: "User already exists with this email" });
    }

    // 3. Handle Optional Profile Picture
    let profilePicUrl = "";
    if (req.file) {
      // If user uploaded an image, save the path
      // Windows path fix: Replace backslashes if any
      profilePicUrl = req.file.path.replace(/\\/g, "/"); 
    }

    // 4. Hash Password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // 5. Create User
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

    // 6. Respond
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
    console.log(error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Login User
// @route   POST /api/auth/login
// @access  Public
exports.loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    // 1. Check User
    const user = await User.findOne({ email });

    // 2. Check Password
    if (user && (await bcrypt.compare(password, user.password))) {
      res.json({
        _id: user._id,
        fullName: user.fullName,
        email: user.email,
        phone: user.phone,
        profilePic: user.profilePic,
        role: user.role,         // Will be 'passenger'
        riderStatus: user.riderStatus, // Will be 'none'
        token: generateToken(user._id)
      });
    } else {
      res.status(401).json({ message: "Invalid email or password" });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};