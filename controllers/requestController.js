const Request = require('../models/RequestModel');
const Ride = require('../models/RideModel');

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
    if (!meetingPoint || !dropPoint || 
        !meetingPoint.lat || !meetingPoint.lng || 
        !dropPoint.lat || !dropPoint.lng) {
      return res.status(400).json({ 
        message: "Missing meeting point coordinates",
        required: "meetingPoint: {lat, lng}, dropPoint: {lat, lng}"
      });
    }
    if (!passengerActualPickup || !passengerActualDropoff || 
        !passengerActualPickup.lat || !passengerActualPickup.lng ||
        !passengerActualDropoff.lat || !passengerActualDropoff.lng) {
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
    res.status(500).json({ 
      message: "Server Error", 
      error: error.message 
    });
  }
};

exports.getRiderRequests = async (req, res) => {
  try {
    const requests = await Request.find({ 
      riderId: req.user.id, 
      status: 'pending' 
    })
      .populate('passengerId', 'fullName phone profilePic rating')
      .populate('rideId')
      .sort({ createdAt: -1 });

    res.status(200).json(requests);
  } catch (error) {
    console.error("❌ Get Requests Error:", error);
    res.status(500).json({ message: "Server Error" });
  }
};

// exports.respondToRequest = async (req, res) => {
//   try {
//     const { status } = req.body; 
//     const requestId = req.params.id;

//     if (!['accepted', 'rejected'].includes(status)) {
//       return res.status(400).json({ message: "Invalid status" });
//     }

//     const request = await Request.findById(requestId).populate('rideId');
//     if (!request) return res.status(404).json({ message: "Request not found" });

//     const ride = request.rideId;
//     if (!ride) return res.status(404).json({ message: "Ride not found" });

//     if (ride.rider.toString() !== req.user.id) {
//       return res.status(403).json({ message: "Not authorized" });
//     }

//     if (status === 'accepted') {
//       const pickupMeetingPoint = {
//         lat: request.pickupLat,
//         lng: request.pickupLng
//       };

//       const dropMeetingPoint = {
//         lat: request.dropoffLat,
//         lng: request.dropoffLng
//       };

//       const passengerActualPickup = {
//         lat: request.passengerActualPickup.lat,
//         lng: request.passengerActualPickup.lng
//       };

//       const passengerActualDropoff = {
//         lat: request.passengerActualDropoff.lat,
//         lng: request.passengerActualDropoff.lng
//       };

//       console.log('🔍 DEBUG - About to save matchType:', request.matchType);
//       await Ride.findByIdAndUpdate(ride._id, {
//         status: 'booked',
//         seats: 0,
//         $push: { passengers: request.passengerId },
        
//         pickupMeetingPoint: pickupMeetingPoint,
//         dropMeetingPoint: dropMeetingPoint,
//         passengerActualPickup: passengerActualPickup,
//         passengerActualDropoff: passengerActualDropoff,

//         matchType: request.matchType
//       });

//       request.status = 'accepted';
//       await request.save();
//       await Request.updateMany(
//         { rideId: ride._id, _id: { $ne: requestId }, status: 'pending' },
//         { status: 'rejected' }
//       );
//       if (request.matchType === 'detour') {
//         console.log(`✅ DETOUR Request Accepted:
//           ┌─ MEETING POINTS (Rider stops here):
//           │  Pickup: (${pickupMeetingPoint.lat}, ${pickupMeetingPoint.lng})
//           │  Dropoff: (${dropMeetingPoint.lat}, ${dropMeetingPoint.lng})
//           └─ PASSENGER LOCATIONS (Same as meeting points):
//              Pickup: (${passengerActualPickup.lat}, ${passengerActualPickup.lng})
//              Dropoff: (${passengerActualDropoff.lat}, ${passengerActualDropoff.lng})
          
//           📌 Door-to-door service - No walking needed!`);
//       } else {
//         console.log(`✅ SMART Request Accepted:
//           ┌─ MEETING POINTS (Rider stops here):
//           │  Pickup: (${pickupMeetingPoint.lat}, ${pickupMeetingPoint.lng})
//           │  Dropoff: (${dropMeetingPoint.lat}, ${dropMeetingPoint.lng})
//           └─ PASSENGER ACTUAL LOCATIONS (For dotted lines):
//              Pickup: (${passengerActualPickup.lat}, ${passengerActualPickup.lng})
//              Dropoff: (${passengerActualDropoff.lat}, ${passengerActualDropoff.lng})
          
//           🚶 Passenger walks: ${request.pickupWalk}m pickup, ${request.dropoffWalk}m dropoff
          
//           MAP INSTRUCTIONS:
//           🔵 Draw dotted: (${passengerActualPickup.lat}, ${passengerActualPickup.lng}) → (${pickupMeetingPoint.lat}, ${pickupMeetingPoint.lng})
//           🔵 Draw solid: (${pickupMeetingPoint.lat}, ${pickupMeetingPoint.lng}) → (${dropMeetingPoint.lat}, ${dropMeetingPoint.lng})
//           🔵 Draw dotted: (${dropMeetingPoint.lat}, ${dropMeetingPoint.lng}) → (${passengerActualDropoff.lat}, ${passengerActualDropoff.lng})`);
//       }

//       return res.status(200).json({ 
//         message: "Request accepted",
//         locations: {
//           pickupMeetingPoint,
//           dropMeetingPoint,
//           passengerActualPickup,
//           passengerActualDropoff
//         },
//         matchType: request.matchType,
//         walkingDistances: {
//           pickup: request.pickupWalk,
//           dropoff: request.dropoffWalk
//         }
//       });
//     } 
//     else {
//       request.status = 'rejected';
//       await request.save();
      
//       console.log(`❌ Request Rejected: ${requestId}`);
      
//       return res.status(200).json({ message: "Request rejected" });
//     }

//   } catch (error) {
//     console.error('Response Error:', error);
//     res.status(500).json({ 
//       message: "Server Error", 
//       error: error.message 
//     });
//   }
// };








// 1. RESPOND TO REQUEST (Rider Action)
exports.respondToRequest = async (req, res) => {
  try {
    const { status } = req.body; // 'accepted' or 'rejected'
    const requestId = req.params.id;

    if (!['accepted', 'rejected'].includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const request = await Request.findById(requestId).populate('rideId');
    if (!request) return res.status(404).json({ message: "Request not found" });

    const ride = request.rideId;
    if (!ride) return res.status(404).json({ message: "Ride not found" });

    // Check ownership
    if (ride.rider.toString() !== req.user.id) {
      return res.status(403).json({ message: "Not authorized" });
    }

    if (status === 'accepted') {
      // ─────────────────────────────────────────────────────────
      // 1. PREPARE COORDINATES (Crucial to fix the Flutter crash)
      // ─────────────────────────────────────────────────────────
      const pickupMeetingPoint = { lat: request.pickupLat, lng: request.pickupLng };
      const dropMeetingPoint = { lat: request.dropoffLat, lng: request.dropoffLng };
      const passengerActualPickup = { 
          lat: request.passengerActualPickup.lat, 
          lng: request.passengerActualPickup.lng 
      };
      const passengerActualDropoff = { 
          lat: request.passengerActualDropoff.lat, 
          lng: request.passengerActualDropoff.lng 
      };

      // ─────────────────────────────────────────────────────────
      // 2. UPDATE RIDE DOCUMENT (Saves everything needed for UI)
      // ─────────────────────────────────────────────────────────
      await Ride.findByIdAndUpdate(ride._id, {
        status: 'booked',
        seats: 0,
        $push: { passengers: request.passengerId },
        
        // Save these so Flutter widget.ride.pickupMeetingPoint is NOT NULL
        pickupMeetingPoint: pickupMeetingPoint,
        dropMeetingPoint: dropMeetingPoint,
        passengerActualPickup: passengerActualPickup,
        passengerActualDropoff: passengerActualDropoff,
        matchType: request.matchType
      });

      // 3. Mark THIS request as accepted
      request.status = 'accepted';
      await request.save();

      // ─────────────────────────────────────────────────────────
      // 4. LOGIC: EXPIRE ALL OTHER PENDING REQUESTS
      // ─────────────────────────────────────────────────────────
      await Request.updateMany(
        { 
          rideId: ride._id, 
          _id: { $ne: requestId }, 
          status: 'pending' 
        },
        { status: 'expired' } // Set to expired as per your requirement
      );

      console.log(`✅ Ride Booked. Coordinates saved. Other requests marked as EXPIRED.`);

      return res.status(200).json({ 
        message: "Request accepted. Coordinates saved and others expired.",
        locations: { pickupMeetingPoint, dropMeetingPoint }
      });

    } else {
      // ─────────────────────────────────────────────────────────
      // REJECTED LOGIC
      // ─────────────────────────────────────────────────────────
      request.status = 'rejected';
      await request.save();
      return res.status(200).json({ message: "Request rejected" });
    }
  } catch (error) {
    console.error('Response Error:', error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// 2. GET PASSENGER REQUESTS (Passenger View)
// GET PASSENGER REQUESTS (Passenger View)
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
    // Crucial: Populate 'status' from rideId to check if the ride is finished
    .populate('rideId', 'fromLocation toLocation date time status') 
    .sort({ createdAt: -1 });

    // FILTER LOGIC: Remove requests where the Ride itself is already completed or cancelled
    const activeRequests = requests.filter(req => {
      // If the ride doesn't exist (deleted) or is completed/cancelled, hide it
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

// 3. MARK AS VIEWED (Passenger clear notification)
// Add/Verify this function in requestController.js
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