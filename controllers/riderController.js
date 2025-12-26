const User = require('../models/UserModel');
const Ride = require('../models/RideModel');
const geolib = require('geolib');
const axios = require('axios');

const CONFIG = {
  MAX_DETOUR_BUDGET: 500,
  MAX_WALK_BUDGET: 500,
  PREFER_DETOUR_OVER_WALK: true,
  MAX_COMBINED_TOTAL: 600,
  ENABLE_SMART_FLEXIBILITY: true,
  FLEXIBILITY_MARGIN: 100,
};

const calculateIntermediatePoint = (anchor, target, detourDist, totalGap) => {
  if (detourDist >= totalGap) return target;
  if (detourDist <= 0) return anchor;
  const ratio = detourDist / totalGap;
  return {
    lat: anchor.lat + (target.lat - anchor.lat) * ratio,
    lng: anchor.lng + (target.lng - anchor.lng) * ratio
  };
};

const generateRoutePolyline = async (fromLat, fromLng, toLat, toLng) => {
  try {
    const response = await axios.get(
      `http://router.project-osrm.org/route/v1/driving/${fromLng},${fromLat};${toLng},${toLat}`,
      { params: { overview: 'full', geometries: 'geojson' } }
    );
    return response.data.routes[0].geometry.coordinates.map(c => ({ lat: c[1], lng: c[0] }));
  } catch (error) {
    return [];
  }
};

exports.publishRide = async (req, res) => {
  try {

    if (req.user.riderStatus !== 'approved') {
      return res.status(403).json({ 
        message: "Access Denied. Your rider account is not approved or is pending verification." 
      });
    }

    const { fromLocation, fromLatLng, toLocation, toLatLng, date, time, price } = req.body;
    const routePath = await generateRoutePolyline(fromLatLng.lat, fromLatLng.lng, toLatLng.lat, toLatLng.lng);

    const newRide = new Ride({
      rider: req.user.id,
      fromLocation, fromLatLng,
      toLocation, toLatLng,
      routePath,
      date, time, 
      price: price || 150,
      status: 'active'
    });

    await newRide.save();
    res.status(201).json({ message: "Ride Published", ride: newRide });
  } catch (error) {
    res.status(500).json({ message: "Server Error" });
  }
};

exports.searchRides = async (req, res) => {
  try {
    const { pickupLat, pickupLng, dropoffLat, dropoffLng, date } = req.body;
    const rides = await Ride.find({ status: 'active', date })
      .populate('rider', 'fullName profilePic riderRating riderReviewCount feedbackTags kycDetails');

    const results = [];
    for (const ride of rides) {
      const polyline = ride.routePath;
      if (!polyline || polyline.length === 0) continue;

      let pickupAnchorIdx = -1, pickupGap = Infinity;
      for (let i = 0; i < polyline.length; i++) {
        const d = geolib.getDistance({ latitude: pickupLat, longitude: pickupLng }, { latitude: polyline[i].lat, longitude: polyline[i].lng });
        if (d < pickupGap) { pickupGap = d; pickupAnchorIdx = i; }
      }

      let dropAnchorIdx = -1, dropGap = Infinity;
      for (let i = pickupAnchorIdx + 1; i < polyline.length; i++) {
        const d = geolib.getDistance({ latitude: dropoffLat, longitude: dropoffLng }, { latitude: polyline[i].lat, longitude: polyline[i].lng });
        if (d < dropGap) { dropGap = d; dropAnchorIdx = i; }
      }

      if (dropAnchorIdx <= pickupAnchorIdx) continue;
      const totalGap = pickupGap + dropGap;
      if (totalGap > (CONFIG.MAX_DETOUR_BUDGET + CONFIG.MAX_WALK_BUDGET + CONFIG.FLEXIBILITY_MARGIN)) continue;

      let matchType, rPickDist, rDropDist, uPickWalk, uDropWalk, pickMP, dropMP;
      if (totalGap <= CONFIG.MAX_DETOUR_BUDGET) {
        matchType = 'detour';
        rPickDist = pickupGap; rDropDist = dropGap;
        uPickWalk = 0; uDropWalk = 0;
        pickMP = { lat: pickupLat, lng: pickupLng };
        dropMP = { lat: dropoffLat, lng: dropoffLng };
      } else {
        matchType = 'smart';
        const ratio = pickupGap / totalGap;
        rPickDist = Math.round(CONFIG.MAX_DETOUR_BUDGET * ratio);
        rDropDist = CONFIG.MAX_DETOUR_BUDGET - rPickDist;
        uPickWalk = pickupGap - rPickDist;
        uDropWalk = dropGap - rDropDist;
        pickMP = calculateIntermediatePoint(polyline[pickupAnchorIdx], { lat: pickupLat, lng: pickupLng }, rPickDist, pickupGap);
        dropMP = calculateIntermediatePoint(polyline[dropAnchorIdx], { lat: dropoffLat, lng: dropoffLng }, rDropDist, dropGap);
      }

      results.push({
        ...ride._doc,
        pickupMeetingPoint: pickMP,
        dropMeetingPoint: dropMP,
        passengerActualPickup: { lat: pickupLat, lng: pickupLng },
        passengerActualDropoff: { lat: dropoffLat, lng: dropoffLng },
        pickupDetour: rPickDist, pickupWalk: uPickWalk,
        dropoffDetour: rDropDist, dropoffWalk: uDropWalk,
        matchType,
        riderRating: ride.rider.riderRating,
        riderTags: ride.rider.feedbackTags ? ride.rider.feedbackTags.slice(0, 3) : []
      });
    }
    res.status(200).json(results);
  } catch (e) {
    res.status(500).json({ message: 'Search failure' });
  }
};

exports.updateRideStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const rideId = req.params.id;

    const ride = await Ride.findOneAndUpdate(
      { _id: rideId, rider: req.user.id },
      { status: status },
      { new: true }
    );

    if (!ride) return res.status(404).json({ message: "Ride not found" });
    const io = req.app.get('socketio');
    io.to(rideId).emit('status_updated', { status: ride.status, rideId });

    res.status(200).json({ message: "Status updated", ride });
  } catch (error) {
    res.status(500).json({ message: "Server Error" });
  }
};

exports.processRidePayment = async (req, res) => {
  try {
    const { rideId, method, transactionId } = req.body;
    const ride = await Ride.findById(rideId);

    if (!ride) return res.status(404).json({ message: "Ride not found" });

    if (method === 'esewa') {
      console.log(`🛡️ Verifying eSewa ID: ${transactionId} for Ride: ${rideId}`);

      const verificationUrl = `${process.env.ESEWA_VERIFY_URL}?txnRefId=${transactionId}`;
      
      try {
        const response = await axios.get(verificationUrl, {
          headers: {
            'merchantId': process.env.ESEWA_MERCHANT_ID,
            'merchantSecret': process.env.ESEWA_SECRET_KEY,
            'Content-Type': 'application/json'
          }
        });
        const txnDetails = response.data[0];

        if (txnDetails && txnDetails.transactionDetails.status === "COMPLETE") {
          const esewaAmt = Math.round(parseFloat(txnDetails.totalAmount));
          const dbAmt = Math.round(ride.price);

          if (esewaAmt === dbAmt) {
            ride.paymentStatus = 'paid';
            ride.paymentMethod = 'esewa';
            ride.transactionId = transactionId;
            await ride.save();

            const io = req.app.get('socketio');
            io.to(rideId).emit('payment_confirmed', { status: 'paid', method: 'esewa' });

            return res.status(200).json({ message: "Verified", ride });
          } else {
            console.log(`Price Mismatch: eSewa(${esewaAmt}) vs DB(${dbAmt})`);
            return res.status(400).json({ message: "Verification failed: Amount mismatch" });
          }
        } else {
          return res.status(400).json({ message: "Verification failed: Transaction not complete" });
        }
      } catch (err) {
        console.error("eSewa Server Error:", err.message);
        return res.status(400).json({ message: "Verification failed at eSewa" });
      }
    }
    ride.paymentMethod = 'cash';
    await ride.save();
    const io = req.app.get('socketio');
    io.to(rideId).emit('payment_initiated', { method: 'cash' });
    res.status(200).json({ message: "Cash selected", ride });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

exports.confirmPaymentReceived = async (req, res) => {
  try {
    const ride = await Ride.findOneAndUpdate(
      { _id: req.params.id, rider: req.user.id },
      { paymentStatus: 'paid' },
      { new: true }
    );

    const io = req.app.get('socketio');
    io.to(req.params.id).emit('rider_confirmed_payment', { status: 'paid' });

    res.status(200).json({ message: "Payment confirmed", ride });
  } catch (error) {
    res.status(500).json({ message: "Server Error" });
  }
};

exports.submitRideFeedback = async (req, res) => {
  try {
    const { rideId, rating, tags, targetRole } = req.body;
    const ride = await Ride.findById(rideId);
    if (!ride) return res.status(404).json({ message: "Ride not found" });
    const targetUserId = targetRole === 'rider' ? ride.rider : ride.passengers[0];
    const user = await User.findById(targetUserId);

    if (!user) return res.status(404).json({ message: "User not found" });
    if (targetRole === 'rider') {
      ride.feedbackForRider = { rating, tags };
    } else {
      ride.feedbackForPassenger = { rating, tags };
    }
    await ride.save();
    if (rating) {
      const roleRatingField = targetRole === 'rider' ? 'riderRating' : 'passengerRating';
      const roleCountField = targetRole === 'rider' ? 'riderReviewCount' : 'passengerReviewCount';
      const roleTagsField = targetRole === 'rider' ? 'riderFeedbackTags' : 'passengerFeedbackTags';
      const currentCount = user[roleCountField] || 0;
      const currentRating = user[roleRatingField] || 5.0;
      
      const newCount = currentCount + 1;
      const newAverage = ((currentRating * currentCount) + rating) / newCount;

      user[roleRatingField] = Number(newAverage.toFixed(1)); 
      user[roleCountField] = newCount;
      if (tags && tags.length > 0) {
        const updatedTags = [...new Set([...(user[roleTagsField] || []), ...tags])];
        user[roleTagsField] = updatedTags;
      }

      await user.save();
    }

    res.status(200).json({ 
      message: "Feedback submitted successfully", 
      newRating: rating ? user[targetRole === 'rider' ? 'riderRating' : 'passengerRating'] : null 
    });
  } catch (error) {
    res.status(500).json({ message: "Server error during rating" });
  }
};

exports.getMyRides = async (req, res) => {
  try {
    const rides = await Ride.find({ rider: req.user.id })
      .populate('passengers', 'fullName profilePic phone passengerRating feedbackTags') 
      .sort({ createdAt: -1 });
    res.status(200).json(rides);
  } catch (error) {
    res.status(500).json({ message: "Server Error" });
  }
};

exports.getPassengerUpcomingRides = async (req, res) => {
  try {
    const rides = await Ride.find({ passengers: req.user.id })
      .populate('rider', 'fullName profilePic riderRating feedbackTags kycDetails phone')
      .sort({ date: 1 });
    res.status(200).json(rides);
  } catch (error) {
    res.status(500).json({ message: "Server Error" });
  }
};
exports.deleteRide = async (req, res) => {
  try {
    const ride = await Ride.findOne({ _id: req.params.id, rider: req.user.id });
    
    if (!ride) return res.status(404).json({ message: "Ride not found or unauthorized" });
    const restrictedStatuses = ['heading_to_pickup', 'arrived', 'ongoing', 'completed'];
    if (restrictedStatuses.includes(ride.status)) {
      return res.status(400).json({ message: "Cannot delete an active or completed ride" });
    }
    await Ride.findOneAndDelete({ _id: req.params.id, rider: req.user.id });
    
    res.status(200).json({ message: "Ride deleted successfully" });
  } catch (error) {
    console.error("Delete Error:", error);
    res.status(500).json({ message: "Delete failed", error: error.message });
  }
};

exports.submitRiderKyc = async (req, res) => {
  try {
    const userId = req.user.id;
    const files = req.files || {};
    const body = req.body;

    const getPath = (fieldName) => 
      files[fieldName] ? files[fieldName][0].path.replace(/\\/g, "/") : null;

    const updateData = {
      riderStatus: 'pending'
    };

    const fields = [
      'licenseNumber', 'licenseExpiryDate', 'licenseIssueDate',
      'vehicleModel', 'vehicleProductionYear', 'vehiclePlateNumber'
    ];
    fields.forEach(f => {
      if (body[f]) updateData[`kycDetails.${f}`] = body[f];
    });

    const kycFiles = [
      'citizenshipFront', 'citizenshipBack', 'licenseImage', 
      'selfieWithLicense', 'vehiclePhoto', 'billbookPage2', 'billbookPage3'
    ];
    kycFiles.forEach(f => {
      const path = getPath(f);
      if (path) updateData[`kycDetails.${f}`] = path;
    });

    updateData[`kycDetails.submittedAt`] = new Date();

    await User.findByIdAndUpdate(userId, { $set: updateData });

    res.status(200).json({ message: "KYC Submitted" });

  } catch (error) {
    console.error("KYC Submission Error:", error);
    res.status(500).json({ message: "KYC Error", error: error.message });
  }
};



exports.editRide = async (req, res) => {
  try {
    const { date, time, price } = req.body;
    const ride = await Ride.findOne({ _id: req.params.id, rider: req.user.id });

    if (!ride) return res.status(404).json({ message: "Ride not found or unauthorized" });

    const restrictedStatuses = ['heading_to_pickup', 'arrived', 'ongoing', 'completed', 'cancelled'];
    if (restrictedStatuses.includes(ride.status)) {
      return res.status(400).json({ message: "Cannot edit ride after it has started" });
    }

    if (date) ride.date = date;
    if (time) ride.time = time;
    if (price !== undefined) ride.price = price;
    await ride.save();

    res.status(200).json({ message: "Ride updated successfully", ride });
  } catch (error) {
    console.error("Edit Error:", error);
    res.status(500).json({ message: "Edit failed", error: error.message });
  }
};


exports.cancelRide = async (req, res) => {
  try {
    const { reason } = req.body;
    const ride = await Ride.findById(req.params.id);

    if (!ride) return res.status(404).json({ message: "Ride not found" });
    if (['ongoing', 'completed'].includes(ride.status)) {
      return res.status(400).json({ message: "Cannot cancel an ongoing or completed ride." });
    }

    ride.status = 'cancelled';
    ride.cancellationReason = reason || "No reason provided";
    ride.cancelledBy = req.user.id;
    await ride.save();

    res.status(200).json({ message: "Ride cancelled successfully", ride });
  } catch (error) {
    res.status(500).json({ message: "Server Error" });
  }
};

exports.getRiderHistory = async (req, res) => {
  try {
    const history = await Ride.find({
      rider: req.user.id,
      status: { $in: ['completed', 'cancelled'] }
    }).sort({ createdAt: -1 });
    res.status(200).json(history);
  } catch (error) {
    res.status(500).json({ message: "Error fetching history" });
  }
};

exports.getPassengerHistory = async (req, res) => {
  try {
    const history = await Ride.find({
      passengers: req.user.id,
      status: { $in: ['completed', 'cancelled'] }
    }).populate('rider', 'fullName profilePic').sort({ createdAt: -1 });
    res.status(200).json(history);
  } catch (error) {
    res.status(500).json({ message: "Error fetching history" });
  }
};