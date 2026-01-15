const Request = require('../models/RequestModel');
const Ride = require('../models/RideModel');
const User = require('../models/UserModel');
const { sendNotification } = require('../utils/notificationHelper');

// Send Request
exports.sendRequest = async (req, res) => {
  try {
    const {
      rideId,
      riderId,
      meetingPoint,
      dropPoint,
      passengerActualPickup,
      passengerActualDropoff,
      pickupDetour,
      pickupWalk,
      dropoffDetour,
      dropoffWalk,
      matchType
    } = req.body;

    console.log('📥 Incoming Request Data:', {
      rideId,
      matchType,
      meetingPoint,
      dropPoint,
      passengerActualPickup,
      passengerActualDropoff
    });

    if (!meetingPoint || !dropPoint || !meetingPoint.lat || !meetingPoint.lng || !dropPoint.lat || !dropPoint.lng) {
      return res.status(400).json({
        message: "Missing meeting point coordinates",
        required: "meetingPoint: {lat, lng}, dropPoint: {lat, lng}"
      });
    }

    if (!passengerActualPickup || !passengerActualDropoff || !passengerActualPickup.lat || !passengerActualPickup.lng || !passengerActualDropoff.lat || !passengerActualDropoff.lng) {
      return res.status(400).json({
        message: "Missing passenger's actual search locations",
        required: "passengerActualPickup: {lat, lng}, passengerActualDropoff: {lat, lng}",
        hint: "These should come from your search form state (pickupLatLng, dropoffLatLng)"
      });
    }

    const existing = await Request.findOne({
      rideId,
      passengerId: req.user.id,
      status: 'pending'
    });

    if (existing) {
      return res.status(400).json({ message: "You already requested this ride." });
    }

    const newRequest = new Request({
      rideId,
      riderId,
      passengerId: req.user.id,
      pickupLat: meetingPoint.lat,
      pickupLng: meetingPoint.lng,
      dropoffLat: dropPoint.lat,
      dropoffLng: dropPoint.lng,
      passengerActualPickup: {
        lat: passengerActualPickup.lat,
        lng: passengerActualPickup.lng
      },
      passengerActualDropoff: {
        lat: passengerActualDropoff.lat,
        lng: passengerActualDropoff.lng
      },
      pickupDetour,
      pickupWalk,
      dropoffDetour,
      dropoffWalk,
      matchType
    });

    await newRequest.save();

    // Get passenger details for notification
    const passenger = await User.findById(req.user.id);
    const ride = await Ride.findById(rideId);

    // Send notification to rider
    const io = req.app.get('socketio');
    await sendNotification(
      io,
      riderId,
      req.user.id,
      '🚗 New Ride Request',
      `${passenger.fullName} requested to join your ride from ${ride.fromLocation} to ${ride.toLocation}`,
      'request',
      rideId,
      { requestId: newRequest._id.toString() }
    );

    if (matchType === 'detour') {
      console.log(`✅ DETOUR REQUEST Saved:
        Match Type: ${matchType}
        Meeting Point: (${meetingPoint.lat}, ${meetingPoint.lng})
        Passenger Search: (${passengerActualPickup.lat}, ${passengerActualPickup.lng})
        📌 Note: Meeting point = Passenger location (door-to-door)
        🎉 No walking needed!`);
    } else {
      console.log(`✅ SMART REQUEST Saved:
        Match Type: ${matchType}
        Passenger Searched: (${passengerActualPickup.lat}, ${passengerActualPickup.lng})
        Meeting Point (Rider stops): (${meetingPoint.lat}, ${meetingPoint.lng})
        🚶 Passenger walks: ${pickupWalk}m to meeting point
        Drop Point (Rider stops): (${dropPoint.lat}, ${dropPoint.lng})
        Passenger Destination: (${passengerActualDropoff.lat}, ${passengerActualDropoff.lng})
        🚶 Passenger walks: ${dropoffWalk}m from drop point`);
    }

    res.status(201).json({
      message: "Request Sent Successfully",
      request: newRequest
    });
  } catch (error) {
    console.error("❌ Request Error:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// Get Rider Requests
exports.getRiderRequests = async (req, res) => {
  try {
    const requests = await Request.find({
      riderId: req.user.id,
      status: 'pending'
    })
      .populate('passengerId', 'fullName phone profilePic passengerRating passengerFeedbackTags')
      .populate('rideId')
      .sort({ createdAt: -1 });

    res.status(200).json(requests);
  } catch (error) {
    console.error("❌ Get Requests Error:", error);
    res.status(500).json({ message: "Server Error" });
  }
};

// Respond to Request (Accept/Reject)
exports.respondToRequest = async (req, res) => {
  try {
    const { status } = req.body;
    const requestId = req.params.id;

    if (!['accepted', 'rejected'].includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const request = await Request.findById(requestId).populate('rideId');
    if (!request) return res.status(404).json({ message: "Request not found" });

    const ride = request.rideId;
    if (!ride) return res.status(404).json({ message: "Ride not found" });

    if (ride.rider.toString() !== req.user.id) {
      return res.status(403).json({ message: "Not authorized" });
    }

    const io = req.app.get('socketio');

    if (status === 'accepted') {
      const pickupMeetingPoint = {
        lat: request.pickupLat,
        lng: request.pickupLng
      };

      const dropMeetingPoint = {
        lat: request.dropoffLat,
        lng: request.dropoffLng
      };

      const passengerActualPickup = {
        lat: request.passengerActualPickup.lat,
        lng: request.passengerActualPickup.lng
      };

      const passengerActualDropoff = {
        lat: request.passengerActualDropoff.lat,
        lng: request.passengerActualDropoff.lng
      };

      await Ride.findByIdAndUpdate(ride._id, {
        status: 'booked',
        seats: 0,
        $push: { passengers: request.passengerId },
        pickupMeetingPoint: pickupMeetingPoint,
        dropMeetingPoint: dropMeetingPoint,
        passengerActualPickup: passengerActualPickup,
        passengerActualDropoff: passengerActualDropoff,
        matchType: request.matchType
      });

      request.status = 'accepted';
      await request.save();

      // Expire other pending requests
      await Request.updateMany(
        { rideId: ride._id, _id: { $ne: requestId }, status: 'pending' },
        { status: 'expired' }
      );

      // Get rider details
      const rider = await User.findById(req.user.id);

      // Send notification to passenger
      await sendNotification(
        io,
        request.passengerId,
        req.user.id,
        '✅ Request Accepted',
        `${rider.fullName} accepted your ride request. Get ready for your journey!`,
        'accept',
        ride._id,
        { requestId: requestId }
      );

      // Emit real-time update
      io.to(request.passengerId.toString()).emit('request_accepted', {
        requestId: requestId,
        rideId: ride._id
      });

      console.log(`✅ Ride Booked. Coordinates saved. Other requests marked as EXPIRED.`);

      return res.status(200).json({
        message: "Request accepted. Coordinates saved and others expired.",
        locations: {
          pickupMeetingPoint,
          dropMeetingPoint
        }
      });
    } else {
      request.status = 'rejected';
      await request.save();

      // Get rider details
      const rider = await User.findById(req.user.id);

      // Send notification to passenger
      await sendNotification(
        io,
        request.passengerId,
        req.user.id,
        '❌ Request Declined',
        `${rider.fullName} declined your ride request. Try searching for other rides.`,
        'reject',
        ride._id,
        { requestId: requestId }
      );

      // Emit real-time update
      io.to(request.passengerId.toString()).emit('request_rejected', {
        requestId: requestId
      });

      return res.status(200).json({ message: "Request rejected" });
    }
  } catch (error) {
    console.error('Response Error:', error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// Get Passenger Requests
exports.getPassengerRequests = async (req, res) => {
  try {
    const requests = await Request.find({
      passengerId: req.user.id,
      $or: [
        { status: 'pending' },
        { status: 'accepted' },
        { status: 'rejected', passengerViewed: false },
        { status: 'expired', passengerViewed: false }
      ]
    })
      .populate('riderId', 'fullName profilePic')
      .populate('rideId', 'fromLocation toLocation date time status')
      .sort({ createdAt: -1 });

    const activeRequests = requests.filter(req => {
      if (!req.rideId || ['completed', 'cancelled'].includes(req.rideId.status)) {
        return false;
      }
      return true;
    });

    res.status(200).json(activeRequests);
  } catch (error) {
    console.error("Fetch Requests Error:", error);
    res.status(500).json({ message: "Server Error" });
  }
};

// Mark Request as Viewed
exports.markRequestAsViewed = async (req, res) => {
  try {
    const request = await Request.findByIdAndUpdate(
      req.params.id,
      { passengerViewed: true },
      { new: true }
    );

    if (!request) {
      return res.status(404).json({ message: "Request not found" });
    }

    res.status(200).json({ message: "Cleared from list" });
  } catch (error) {
    console.error("Error marking as viewed:", error);
    res.status(500).json({ message: "Error updating request", error: error.message });
  }
};