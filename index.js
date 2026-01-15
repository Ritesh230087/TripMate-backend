const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const { Types } = require('mongoose');
const connectDB = require('./config/db');

// Models
const Message = require('./models/Message');
const Ride = require('./models/RideModel');
const User = require('./models/UserModel');
const Request = require('./models/RequestModel');
const Notification = require('./models/NotificationModel');
const adminRoute = require('./routes/admin/adminRoute');

// Helpers
const { sendPushNotification } = require('./utils/notificationHelper');

dotenv.config();
connectDB();

const app = express();
const server = http.createServer(app);
const io = new Server(server, { 
    cors: { origin: "*" },
    pingTimeout: 60000,
});

// Make socketio accessible in controllers (e.g., riderController, requestController)
app.set('socketio', io); 

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads'));

// Routes
app.use('/api/auth', require('./routes/authRoute'));
app.use('/api/admin', require('./routes/admin/adminRoute'));
app.use('/api/rider', require('./routes/riderRoute'));
app.use('/api/request', require('./routes/requestRoute'));
app.use('/api/notifications', require('./routes/notificationRoute'));

app.use('/api/admin', adminRoute);

io.on('connection', (socket) => {
  console.log('⚡ User Connected:', socket.id);

  // --- 1. USER IDENTIFICATION (For Sidebar Badges) ---
  // Users join a room named after their userId to receive private badge updates
  socket.on('identify_user', (userId) => {
    if (Types.ObjectId.isValid(userId)) {
      socket.join(userId.toString());
      console.log(`User ${userId} joined their private Notification Room`);
    }
  });

  // --- 2. RIDE ROOM MANAGEMENT ---
  socket.on('join_room', async (rideId) => {
    if (rideId) {
      socket.join(rideId.toString());
      console.log(`Socket ${socket.id} joined Ride Room: ${rideId}`);
      
      // Send chat history upon joining
      const history = await Message.find({ rideId }).sort({ timestamp: 1 });
      socket.emit('chat_history', history);
    }
  });

  // --- 3. CHAT MESSAGING & PUSH ---
  socket.on('send_message', async (data) => {
    try {
      const { rideId, senderId, message } = data;

      if (!Types.ObjectId.isValid(senderId) || !Types.ObjectId.isValid(rideId)) {
        return console.log(`Blocked message: Invalid ID format`);
      }

      const newMessage = new Message({ rideId, senderId, message });
      await newMessage.save();

      // Update Chat UI instantly
      io.to(rideId.toString()).emit('receive_message', newMessage);

      const ride = await Ride.findById(rideId);
      const sender = await User.findById(senderId);
      if (!ride || !sender) return;

      const isSenderRider = ride.rider.toString() === senderId.toString();
      const recipientId = isSenderRider ? ride.passengers[0] : ride.rider;
      const recipient = await User.findById(recipientId);

      if (recipient && recipient.fcmToken) {
        await sendPushNotification(
          recipient.fcmToken,
          `Message from ${sender.fullName}`,
          message,
          { type: 'chat', rideId: rideId.toString() }
        );
        
        // Update the recipient's Sidebar Badge for notifications
        io.to(recipientId.toString()).emit('sidebar_update', { type: 'notification' });
        console.log(`Chat Push & Badge update sent to: ${recipient.fullName}`);
      }
    } catch (error) {
      console.error("Socket Chat Error:", error.message);
    }
  });

  // --- 4. PASSENGER ARRIVAL (SMART MATCH) ---
  socket.on('passenger_ready', async (data) => {
    try {
      const { rideId } = data;
      if (!Types.ObjectId.isValid(rideId)) return;

      // Update Rider's map instantly
      io.to(rideId.toString()).emit('passenger_ready_update', { ready: true });

      const ride = await Ride.findById(rideId).populate('rider passengers');
      if (!ride) return;

      const rider = ride.rider;
      const passenger = ride.passengers[0];

      if (rider && rider.fcmToken) {
        await sendPushNotification(
          rider.fcmToken,
          "📍 Passenger is waiting!",
          `${passenger.fullName} has reached the meeting point.`,
          { type: 'status_update', rideId: rideId.toString() }
        );
        
        // Notify Rider's sidebar
        io.to(rider._id.toString()).emit('sidebar_update', { type: 'notification' });
      }
    } catch (e) { console.error("Passenger Ready Error:", e); }
  });

  // --- 5. PAYMENT FLOW ---
  socket.on('payment_initiated', (data) => {
    const { rideId, method } = data;
    console.log(`Payment initiated for ride ${rideId}: ${method}`);
    io.to(rideId.toString()).emit('payment_initiated', { rideId, method });
  });

  socket.on('payment_confirmed', (data) => {
    const { rideId } = data;
    console.log(`eSewa Payment confirmed for ride ${rideId}`);
    io.to(rideId.toString()).emit('payment_confirmed', { rideId, status: 'paid' });
  });

socket.on('rider_confirmed_payment', (data) => {
  const { rideId } = data;
  if (!rideId) return;
  
  console.log(`Rider confirmed payment for ride: ${rideId}`);
  
  // Use io.to(rideId) to ensure only the people in that ride room get it
  io.to(rideId.toString()).emit('rider_confirmed_payment', { 
    rideId: rideId.toString(),
    status: 'paid' 
  });
});

  // --- 6. LOCATION & STATUS SYNC ---
  socket.on('rider_location_updated', (data) => {
    // Broadcast to the passenger in the room
    io.to(data.rideId.toString()).emit('rider_location_updated', data);
  });

  socket.on('status_updated', (data) => {
    // Broadcast status change (Arrived, Ongoing, etc.)
    io.to(data.rideId.toString()).emit('status_updated', data);
    
    // If status changed, update upcoming rides count in sidebars
    io.emit('sidebar_update', { type: 'upcoming' }); 
  });

  // --- 7. DISCONNECT ---
  socket.on('disconnect', () => {
    console.log('User Disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));