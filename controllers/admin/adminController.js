const User = require('../../models/UserModel');
const Ride = require('../../models/RideModel');
const { sendNotification } = require('../../utils/notificationHelper');

exports.getDashboardStats = async (req, res) => {
  try {
    const totalRides = await Ride.countDocuments();
    const totalUsers = await User.countDocuments();
    
    // Total Earned: Sum of price only for COMPLETED rides
    const earningsData = await Ride.aggregate([
      { $match: { status: 'completed' } },
      { $group: { _id: null, total: { $sum: "$price" } } }
    ]);
    const totalEarned = earningsData.length > 0 ? earningsData[0].total : 0;

    // Status-specific counts
    const pendingCount = await Ride.countDocuments({ status: 'active' }); // Waiting for passenger
    const bookedCount = await Ride.countDocuments({ status: { $in: ['booked', 'heading_to_pickup', 'arrived'] } });
    const ongoingCount = await Ride.countDocuments({ status: 'ongoing' });
    const completedCount = await Ride.countDocuments({ status: 'completed' });
    const cancelledCount = await Ride.countDocuments({ status: 'cancelled' });

    res.json({
      totalRides,
      totalUsers,
      totalEarned,
      pendingCount,
      bookedCount,
      ongoingCount,
      completedCount,
      cancelledCount
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};



// 2. User Management
exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.find().select('-password').sort({ createdAt: -1 });
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


// @desc    Delete User
exports.deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Security: Prevent deleting admins
    if (user.role === 'admin') {
      return res.status(403).json({ message: "Cannot delete an administrator account" });
    }

    await User.findByIdAndDelete(req.params.id);
    res.json({ message: "User deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getAllRides = async (req, res) => {
  try {
    const rides = await Ride.find()
      .populate({
        path: 'rider',
        select: 'fullName profilePic phone riderRating kycDetails role email authMethod'
      })
      .populate({
        path: 'passengers',
        select: 'fullName profilePic phone passengerRating email'
      })
      .sort({ createdAt: -1 });
    res.json(rides);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


// 4. Pending Riders
exports.getPendingRiders = async (req, res) => {
  try {
    const riders = await User.find({ riderStatus: 'pending' }).select('-password');
    res.json(riders);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.verifyRider = async (req, res) => {
  try {
    const { status, reason } = req.body;
    const userId = req.params.id;
    const io = req.app.get('socketio');

    const updateData = { riderStatus: status };
    let title = "";
    let message = "";

    if (status === 'approved') {
      updateData.role = 'rider';
      updateData.kycRejectionReason = "";
      title = "KYC Approved! 🎉";
      message = "Congratulations! Your rider verification is complete. You can now start accepting rides.";
    } else {
      updateData.riderStatus = 'rejected';
      updateData.role = 'passenger'; // Revert to passenger
      updateData.kycRejectionReason = reason || "Documents invalid";
      title = "KYC Rejected ⚠️";
      message = `Your application was declined. Reason: ${updateData.kycRejectionReason}`;
    }

    const updatedUser = await User.findByIdAndUpdate(userId, updateData, { new: true });

    // --- REAL TIME NOTIFICATION & SOCKET ---
    // This sends: 1. DB Entry, 2. FCM Push, 3. Socket Event
    await sendNotification(
      io,
      userId,           // Recipient
      null,             // Sender (System/Admin)
      title,
      message,
      'kyc_update',     // Notification Type
      null              // No specific rideId
    );

    res.json({ message: `User ${status}`, user: updatedUser });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getDetailedAnalytics = async (req, res) => {
  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // Earnings by Day for the Chart
    const dailyStats = await Ride.aggregate([
      { $match: { createdAt: { $gte: sevenDaysAgo }, status: 'completed' } },
      { 
        $group: { 
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, 
          revenue: { $sum: "$price" }
        } 
      },
      { $sort: { "_id": 1 } }
    ]);

    // Payment Split: Rupees and User Count
    const paymentTotals = await Ride.aggregate([
      { $match: { status: 'completed' } },
      { 
        $group: { 
          _id: "$paymentMethod", 
          totalAmount: { $sum: "$price" },
          userCount: { $sum: 1 } 
        } 
      }
    ]);

    const matchTypeStats = await Ride.aggregate([
      { $group: { _id: "$matchType", count: { $sum: 1 } } }
    ]);

    const topRiders = await Ride.aggregate([
      { $match: { status: 'completed' } },
      { $group: { _id: "$rider", count: { $sum: 1 } } },
      { $sort: { count: -1 } }, { $limit: 5 },
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
      { $unwind: "$user" }
    ]);

    const topPassengers = await Ride.aggregate([
      { $match: { status: 'completed' } },
      { $unwind: "$passengers" },
      { $group: { _id: "$passengers", count: { $sum: 1 } } },
      { $sort: { count: -1 } }, { $limit: 5 },
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
      { $unwind: "$user" }
    ]);

    res.json({ dailyStats, matchTypeStats, topRiders, topPassengers, paymentTotals });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};