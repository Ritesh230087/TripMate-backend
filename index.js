const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const connectDB = require('./config/db');
const authRoute = require('./routes/authRoute');

dotenv.config();
connectDB();

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // Needed for form-data

// Make the uploads folder static so images are accessible via URL
// e.g., http://localhost:5000/uploads/profiles/image.jpg
app.use('/uploads', express.static('uploads'));

// Routes
app.use('/api/auth', authRoute);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));