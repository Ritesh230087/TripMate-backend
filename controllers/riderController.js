// const User = require('../models/UserModel');
// const Ride = require('../models/RideModel');
// const geolib = require('geolib');
// const axios = require('axios');

// // ═══════════════════════════════════════════════════════════════
// // 🎯 CONFIGURATION
// // ═══════════════════════════════════════════════════════════════
// const CONFIG = {
//   MAX_DETOUR_BUDGET: 500,
//   MAX_WALK_BUDGET: 500,
//   PREFER_DETOUR_OVER_WALK: true,
//   MAX_COMBINED_TOTAL: 600,
//   ENABLE_SMART_FLEXIBILITY: true,
//   FLEXIBILITY_MARGIN: 100,
// };

// // ═══════════════════════════════════════════════════════════════
// // 🧮 HELPER: Calculate Intermediate Point
// // ═══════════════════════════════════════════════════════════════
// const calculateIntermediatePoint = (anchor, target, detourDist, totalGap) => {
//   if (detourDist >= totalGap) return target; // Rider goes all the way
//   if (detourDist <= 0) return anchor; // Rider doesn't move

//   const ratio = detourDist / totalGap;
//   return {
//     lat: anchor.lat + (target.lat - anchor.lat) * ratio,
//     lng: anchor.lng + (target.lng - anchor.lng) * ratio
//   };
// };

// // ═══════════════════════════════════════════════════════════════
// // HELPER FUNCTIONS
// // ═══════════════════════════════════════════════════════════════
// const generateRoutePolyline = async (fromLat, fromLng, toLat, toLng) => {
//   try {
//     const response = await axios.get(
//       `http://router.project-osrm.org/route/v1/driving/${fromLng},${fromLat};${toLng},${toLat}`,
//       { params: { overview: 'full', geometries: 'geojson' } }
//     );
//     return response.data.routes[0].geometry.coordinates.map(c => ({ lat: c[1], lng: c[0] }));
//   } catch (error) {
//     console.error('❌ Route generation failed:', error.message);
//     return generateStraightLinePolyline(fromLat, fromLng, toLat, toLng);
//   }
// };

// const generateStraightLinePolyline = (fromLat, fromLng, toLat, toLng) => {
//   const points = [];
//   const steps = 20;
//   for (let i = 0; i <= steps; i++) {
//     const ratio = i / steps;
//     points.push({
//       lat: fromLat + (toLat - fromLat) * ratio,
//       lng: fromLng + (toLng - fromLng) * ratio
//     });
//   }
//   return points;
// };

// // ═══════════════════════════════════════════════════════════════
// // 1. SUBMIT RIDER KYC
// // ═══════════════════════════════════════════════════════════════
// exports.submitRiderKyc = async (req, res) => {
//   try {
//     const userId = req.user.id;
//     const files = req.files || {};
//     const body = req.body;

//     const getPath = (fieldName) => {
//       return files[fieldName] ? files[fieldName][0].path.replace(/\\/g, "/") : null;
//     };

//     const kycData = {
//       citizenshipFront: getPath('citizenshipFront'),
//       citizenshipBack: getPath('citizenshipBack'),
//       licenseNumber: body.licenseNumber,
//       licenseExpiryDate: body.licenseExpiryDate,
//       licenseIssueDate: body.licenseIssueDate,
//       licenseImage: getPath('licenseImage'),
//       selfieWithLicense: getPath('selfieWithLicense'),
//       vehicleModel: body.vehicleModel,
//       vehicleProductionYear: body.vehicleProductionYear,
//       vehiclePlateNumber: body.vehiclePlateNumber,
//       vehiclePhoto: getPath('vehiclePhoto'),
//       billbookPage2: getPath('billbookPage2'),
//       billbookPage3: getPath('billbookPage3'),
//       submittedAt: new Date()
//     };

//     await User.findByIdAndUpdate(userId, {
//       riderStatus: 'pending',
//       kycDetails: kycData
//     });

//     res.status(200).json({ message: "KYC Submitted Successfully" });
//   } catch (error) {
//     console.error(error);
//     res.status(500).json({ message: "Server Error processing KYC" });
//   }
// };

// // ═══════════════════════════════════════════════════════════════
// // 2. PUBLISH RIDE
// // ═══════════════════════════════════════════════════════════════
// exports.publishRide = async (req, res) => {
//   try {
//     const { fromLocation, fromLatLng, toLocation, toLatLng, date, time, price } = req.body;
    
//     console.log(`🏍️  Publishing: ${fromLocation} → ${toLocation}`);
    
//     const routePath = await generateRoutePolyline(
//       fromLatLng.lat, fromLatLng.lng, toLatLng.lat, toLatLng.lng
//     );

//     console.log(`✅ Polyline: ${routePath.length} points`);

//     const newRide = new Ride({
//       rider: req.user.id,
//       fromLocation, fromLatLng,
//       toLocation, toLatLng,
//       routePath,
//       date, time, 
//       price: price || 150
//     });

//     await newRide.save();
//     res.status(201).json({ message: "Ride Published", routePoints: routePath.length });
//   } catch (error) {
//     console.error('❌ Publish Error:', error);
//     res.status(500).json({ message: "Server Error" });
//   }
// };

// // ═══════════════════════════════════════════════════════════════
// // 3. GET MY RIDES
// // ═══════════════════════════════════════════════════════════════
// exports.getMyRides = async (req, res) => {
//   try {
//     const rides = await Ride.find({ rider: req.user.id })
//       .populate('passengers', 'fullName profilePic phone') 
//       .sort({ createdAt: -1 });
    
//     res.status(200).json(rides);
//   } catch (error) {
//     console.error("❌ Get Rides Error:", error);
//     res.status(500).json({ message: "Server Error" });
//   }
// };

// // ═══════════════════════════════════════════════════════════════
// // 4. SEARCH RIDES - FIXED LOGIC
// // ═══════════════════════════════════════════════════════════════
// exports.searchRides = async (req, res) => {
//   try {
//     const { pickupLat, pickupLng, dropoffLat, dropoffLng, date } = req.body;

//     const rides = await Ride.find({ status: 'active', date })
//       .populate('rider', 'fullName profilePic rating kycDetails');

//     const results = [];

//     for (const ride of rides) {
//       const polyline = ride.routePath;
//       if (!polyline || polyline.length === 0) continue;

//       // ─────────────────────────────────────────────────────────
//       // STEP 1: Find Closest Points on Polyline (Anchors)
//       // ─────────────────────────────────────────────────────────
//       let pickupAnchorIdx = -1;
//       let pickupGap = Infinity;

//       for (let i = 0; i < polyline.length; i++) {
//         const d = geolib.getDistance(
//           { latitude: pickupLat, longitude: pickupLng },
//           { latitude: polyline[i].lat, longitude: polyline[i].lng }
//         );
//         if (d < pickupGap) {
//           pickupGap = d;
//           pickupAnchorIdx = i;
//         }
//       }

//       // Dropoff must be after pickup
//       let dropAnchorIdx = -1;
//       let dropGap = Infinity;

//       for (let i = pickupAnchorIdx + 1; i < polyline.length; i++) {
//         const d = geolib.getDistance(
//           { latitude: dropoffLat, longitude: dropoffLng },
//           { latitude: polyline[i].lat, longitude: polyline[i].lng }
//         );
//         if (d < dropGap) {
//           dropGap = d;
//           dropAnchorIdx = i;
//         }
//       }

//       if (dropAnchorIdx <= pickupAnchorIdx) continue;

//       const totalGap = pickupGap + dropGap;

//       // ─────────────────────────────────────────────────────────
//       // STEP 2: Check Feasibility
//       // ─────────────────────────────────────────────────────────
//       const maxAllowed = CONFIG.MAX_DETOUR_BUDGET + CONFIG.MAX_WALK_BUDGET + CONFIG.FLEXIBILITY_MARGIN;
//       if (totalGap > maxAllowed) continue;

//       // ─────────────────────────────────────────────────────────
//       // STEP 3: Smart Allocation (Prioritize Rider Detour)
//       // ─────────────────────────────────────────────────────────
//       let riderPickupDist, riderDropDist, userPickupWalk, userDropWalk;
//       let pickupMeetingPoint, dropMeetingPoint;
//       let matchType;

//       if (totalGap <= CONFIG.MAX_DETOUR_BUDGET) {
//         // CASE 1: Pure Rider Detour (Best for User!)
//         matchType = 'detour';
//         riderPickupDist = pickupGap;
//         riderDropDist = dropGap;
//         userPickupWalk = 0;
//         userDropWalk = 0;

//         // Rider goes all the way to passenger locations
//         pickupMeetingPoint = { lat: pickupLat, lng: pickupLng };
//         dropMeetingPoint = { lat: dropoffLat, lng: dropoffLng };

//       } else {
//         // CASE 2: Hybrid (Split Detour + Walk)
//         matchType = 'smart';

//         // Allocate detour proportionally
//         const pickupRatio = pickupGap / totalGap;
//         riderPickupDist = Math.round(CONFIG.MAX_DETOUR_BUDGET * pickupRatio);
//         riderDropDist = CONFIG.MAX_DETOUR_BUDGET - riderPickupDist;

//         userPickupWalk = pickupGap - riderPickupDist;
//         userDropWalk = dropGap - riderDropDist;

//         // Check walk budget
//         if ((userPickupWalk + userDropWalk) > CONFIG.MAX_WALK_BUDGET + CONFIG.FLEXIBILITY_MARGIN) {
//           continue; // Exceeds walk limit
//         }

//         // Calculate exact meeting points
//         const pickupAnchor = polyline[pickupAnchorIdx];
//         const dropAnchor = polyline[dropAnchorIdx];

//         pickupMeetingPoint = calculateIntermediatePoint(
//           pickupAnchor,
//           { lat: pickupLat, lng: pickupLng },
//           riderPickupDist,
//           pickupGap
//         );

//         dropMeetingPoint = calculateIntermediatePoint(
//           dropAnchor,
//           { lat: dropoffLat, lng: dropoffLng },
//           riderDropDist,
//           dropGap
//         );
//       }

//       // ─────────────────────────────────────────────────────────
//       // STEP 4: Add to Results
//       // ─────────────────────────────────────────────────────────
//       results.push({
//         ...ride._doc,
        
//         // ✅ CRITICAL: These are the exact coordinates where rider stops
//         meetingPoint: pickupMeetingPoint,
//         dropPoint: dropMeetingPoint,

//         pickupDetour: riderPickupDist,
//         pickupWalk: userPickupWalk,
//         dropoffDetour: riderDropDist,
//         dropoffWalk: userDropWalk,
//         totalDetour: riderPickupDist + riderDropDist,
//         totalWalk: userPickupWalk + userDropWalk,

//         matchType,
//         explanation: matchType === 'detour' 
//           ? `🎉 Door-to-door! Rider detours ${riderPickupDist + riderDropDist}m total.`
//           : `Rider detours ${riderPickupDist + riderDropDist}m, you walk ${userPickupWalk + userDropWalk}m.`,
//         userFriendlyMessage: matchType === 'detour' 
//           ? '🎉 Perfect! No walking needed' 
//           : `🚶 Walk ${userPickupWalk + userDropWalk}m`
//       });
//     }

//     console.log(`✅ Found ${results.length} matching rides`);
//     res.status(200).json(results);

//   } catch (e) {
//     console.error('❌ Search Error:', e);
//     res.status(500).json({ message: 'Server error' });
//   }
// };

// // ═══════════════════════════════════════════════════════════════
// // 5. UPDATE RIDE STATUS
// // ═══════════════════════════════════════════════════════════════
// exports.updateRideStatus = async (req, res) => {
//   try {
//     const { status } = req.body;
    
//     const ride = await Ride.findOneAndUpdate(
//       { _id: req.params.id, rider: req.user.id },
//       { status: status },
//       { new: true }
//     );

//     if (!ride) return res.status(404).json({ message: "Ride not found" });

//     res.status(200).json({ message: "Status updated", ride });
//   } catch (error) {
//     res.status(500).json({ message: "Server Error" });
//   }
// };

















































// const User = require('../models/UserModel');
// const Ride = require('../models/RideModel');
// const geolib = require('geolib');
// const axios = require('axios');

// // ═══════════════════════════════════════════════════════════════
// // 🎯 CONFIGURATION
// // ═══════════════════════════════════════════════════════════════
// const CONFIG = {
//   MAX_DETOUR_BUDGET: 500,
//   MAX_WALK_BUDGET: 500,
//   PREFER_DETOUR_OVER_WALK: true,
//   MAX_COMBINED_TOTAL: 600,
//   ENABLE_SMART_FLEXIBILITY: true,
//   FLEXIBILITY_MARGIN: 100,
// };

// // ═══════════════════════════════════════════════════════════════
// // 🧮 HELPER: Calculate Intermediate Point
// // ═══════════════════════════════════════════════════════════════
// const calculateIntermediatePoint = (anchor, target, detourDist, totalGap) => {
//   if (detourDist >= totalGap) return target; // Rider goes all the way
//   if (detourDist <= 0) return anchor; // Rider doesn't move

//   const ratio = detourDist / totalGap;
//   return {
//     lat: anchor.lat + (target.lat - anchor.lat) * ratio,
//     lng: anchor.lng + (target.lng - anchor.lng) * ratio
//   };
// };

// // ═══════════════════════════════════════════════════════════════
// // HELPER FUNCTIONS
// // ═══════════════════════════════════════════════════════════════
// const generateRoutePolyline = async (fromLat, fromLng, toLat, toLng) => {
//   try {
//     const response = await axios.get(
//       `http://router.project-osrm.org/route/v1/driving/${fromLng},${fromLat};${toLng},${toLat}`,
//       { params: { overview: 'full', geometries: 'geojson' } }
//     );
//     return response.data.routes[0].geometry.coordinates.map(c => ({ lat: c[1], lng: c[0] }));
//   } catch (error) {
//     console.error('❌ Route generation failed:', error.message);
//     return generateStraightLinePolyline(fromLat, fromLng, toLat, toLng);
//   }
// };

// const generateStraightLinePolyline = (fromLat, fromLng, toLat, toLng) => {
//   const points = [];
//   const steps = 20;
//   for (let i = 0; i <= steps; i++) {
//     const ratio = i / steps;
//     points.push({
//       lat: fromLat + (toLat - fromLat) * ratio,
//       lng: fromLng + (toLng - fromLng) * ratio
//     });
//   }
//   return points;
// };

// // ═══════════════════════════════════════════════════════════════
// // 1. SUBMIT RIDER KYC
// // ═══════════════════════════════════════════════════════════════
// exports.submitRiderKyc = async (req, res) => {
//   try {
//     const userId = req.user.id;
//     const files = req.files || {};
//     const body = req.body;

//     const getPath = (fieldName) => {
//       return files[fieldName] ? files[fieldName][0].path.replace(/\\/g, "/") : null;
//     };

//     const kycData = {
//       citizenshipFront: getPath('citizenshipFront'),
//       citizenshipBack: getPath('citizenshipBack'),
//       licenseNumber: body.licenseNumber,
//       licenseExpiryDate: body.licenseExpiryDate,
//       licenseIssueDate: body.licenseIssueDate,
//       licenseImage: getPath('licenseImage'),
//       selfieWithLicense: getPath('selfieWithLicense'),
//       vehicleModel: body.vehicleModel,
//       vehicleProductionYear: body.vehicleProductionYear,
//       vehiclePlateNumber: body.vehiclePlateNumber,
//       vehiclePhoto: getPath('vehiclePhoto'),
//       billbookPage2: getPath('billbookPage2'),
//       billbookPage3: getPath('billbookPage3'),
//       submittedAt: new Date()
//     };

//     await User.findByIdAndUpdate(userId, {
//       riderStatus: 'pending',
//       kycDetails: kycData
//     });

//     res.status(200).json({ message: "KYC Submitted Successfully" });
//   } catch (error) {
//     console.error(error);
//     res.status(500).json({ message: "Server Error processing KYC" });
//   }
// };

// // ═══════════════════════════════════════════════════════════════
// // 2. PUBLISH RIDE
// // ═══════════════════════════════════════════════════════════════
// exports.publishRide = async (req, res) => {
//   try {
//     const { fromLocation, fromLatLng, toLocation, toLatLng, date, time, price } = req.body;
    
//     console.log(`🏍️  Publishing: ${fromLocation} → ${toLocation}`);
    
//     const routePath = await generateRoutePolyline(
//       fromLatLng.lat, fromLatLng.lng, toLatLng.lat, toLatLng.lng
//     );

//     console.log(`✅ Polyline: ${routePath.length} points`);

//     const newRide = new Ride({
//       rider: req.user.id,
//       fromLocation, fromLatLng,
//       toLocation, toLatLng,
//       routePath,
//       date, time, 
//       price: price || 150
//     });

//     await newRide.save();
//     res.status(201).json({ message: "Ride Published", routePoints: routePath.length });
//   } catch (error) {
//     console.error('❌ Publish Error:', error);
//     res.status(500).json({ message: "Server Error" });
//   }
// };

// // ═══════════════════════════════════════════════════════════════
// // 3. GET MY RIDES
// // ═══════════════════════════════════════════════════════════════
// exports.getMyRides = async (req, res) => {
//   try {
//     const rides = await Ride.find({ rider: req.user.id })
//       .populate('passengers', 'fullName profilePic phone') 
//       .sort({ createdAt: -1 });
    
//     res.status(200).json(rides);
//   } catch (error) {
//     console.error("❌ Get Rides Error:", error);
//     res.status(500).json({ message: "Server Error" });
//   }
// };

// // ═══════════════════════════════════════════════════════════════
// // 4. SEARCH RIDES - FIXED LOGIC
// // ═══════════════════════════════════════════════════════════════
// exports.searchRides = async (req, res) => {
//   try {
//     const { pickupLat, pickupLng, dropoffLat, dropoffLng, date } = req.body;

//     const rides = await Ride.find({ status: 'active', date })
//       .populate('rider', 'fullName profilePic rating kycDetails');

//     const results = [];

//     for (const ride of rides) {
//       const polyline = ride.routePath;
//       if (!polyline || polyline.length === 0) continue;

//       // ─────────────────────────────────────────────────────────
//       // STEP 1: Find Closest Points on Polyline (Anchors)
//       // ─────────────────────────────────────────────────────────
//       let pickupAnchorIdx = -1;
//       let pickupGap = Infinity;

//       for (let i = 0; i < polyline.length; i++) {
//         const d = geolib.getDistance(
//           { latitude: pickupLat, longitude: pickupLng },
//           { latitude: polyline[i].lat, longitude: polyline[i].lng }
//         );
//         if (d < pickupGap) {
//           pickupGap = d;
//           pickupAnchorIdx = i;
//         }
//       }

//       // Dropoff must be after pickup
//       let dropAnchorIdx = -1;
//       let dropGap = Infinity;

//       for (let i = pickupAnchorIdx + 1; i < polyline.length; i++) {
//         const d = geolib.getDistance(
//           { latitude: dropoffLat, longitude: dropoffLng },
//           { latitude: polyline[i].lat, longitude: polyline[i].lng }
//         );
//         if (d < dropGap) {
//           dropGap = d;
//           dropAnchorIdx = i;
//         }
//       }

//       if (dropAnchorIdx <= pickupAnchorIdx) continue;

//       const totalGap = pickupGap + dropGap;

//       // ─────────────────────────────────────────────────────────
//       // STEP 2: Check Feasibility
//       // ─────────────────────────────────────────────────────────
//       const maxAllowed = CONFIG.MAX_DETOUR_BUDGET + CONFIG.MAX_WALK_BUDGET + CONFIG.FLEXIBILITY_MARGIN;
//       if (totalGap > maxAllowed) continue;

//       // ─────────────────────────────────────────────────────────
//       // STEP 3: Smart Allocation (Prioritize Rider Detour)
//       // ─────────────────────────────────────────────────────────
//       let riderPickupDist, riderDropDist, userPickupWalk, userDropWalk;
//       let pickupMeetingPoint, dropMeetingPoint;
//       let matchType;

//       if (totalGap <= CONFIG.MAX_DETOUR_BUDGET) {
//         // CASE 1: Pure Rider Detour (Best for User!)
//         matchType = 'detour';
//         riderPickupDist = pickupGap;
//         riderDropDist = dropGap;
//         userPickupWalk = 0;
//         userDropWalk = 0;

//         // Rider goes all the way to passenger locations
//         pickupMeetingPoint = { lat: pickupLat, lng: pickupLng };
//         dropMeetingPoint = { lat: dropoffLat, lng: dropoffLng };

//       } else {
//         // CASE 2: Hybrid (Split Detour + Walk)
//         matchType = 'smart';

//         // Allocate detour proportionally
//         const pickupRatio = pickupGap / totalGap;
//         riderPickupDist = Math.round(CONFIG.MAX_DETOUR_BUDGET * pickupRatio);
//         riderDropDist = CONFIG.MAX_DETOUR_BUDGET - riderPickupDist;

//         userPickupWalk = pickupGap - riderPickupDist;
//         userDropWalk = dropGap - riderDropDist;

//         // Check walk budget
//         if ((userPickupWalk + userDropWalk) > CONFIG.MAX_WALK_BUDGET + CONFIG.FLEXIBILITY_MARGIN) {
//           continue; // Exceeds walk limit
//         }

//         // Calculate exact meeting points
//         const pickupAnchor = polyline[pickupAnchorIdx];
//         const dropAnchor = polyline[dropAnchorIdx];

//         pickupMeetingPoint = calculateIntermediatePoint(
//           pickupAnchor,
//           { lat: pickupLat, lng: pickupLng },
//           riderPickupDist,
//           pickupGap
//         );

//         dropMeetingPoint = calculateIntermediatePoint(
//           dropAnchor,
//           { lat: dropoffLat, lng: dropoffLng },
//           riderDropDist,
//           dropGap
//         );
//       }

//       // ─────────────────────────────────────────────────────────
//       // STEP 4: Add to Results
//       // ─────────────────────────────────────────────────────────
//       results.push({
//         ...ride._doc,
        
//         // ✅ CRITICAL: These are the exact coordinates where rider stops
//         meetingPoint: pickupMeetingPoint,
//         dropPoint: dropMeetingPoint,

//         pickupDetour: riderPickupDist,
//         pickupWalk: userPickupWalk,
//         dropoffDetour: riderDropDist,
//         dropoffWalk: userDropWalk,
//         totalDetour: riderPickupDist + riderDropDist,
//         totalWalk: userPickupWalk + userDropWalk,

//         matchType,
//         explanation: matchType === 'detour' 
//           ? `🎉 Door-to-door! Rider detours ${riderPickupDist + riderDropDist}m total.`
//           : `Rider detours ${riderPickupDist + riderDropDist}m, you walk ${userPickupWalk + userDropWalk}m.`,
//         userFriendlyMessage: matchType === 'detour' 
//           ? '🎉 Perfect! No walking needed' 
//           : `🚶 Walk ${userPickupWalk + userDropWalk}m`
//       });
//     }

//     console.log(`✅ Found ${results.length} matching rides`);
//     res.status(200).json(results);

//   } catch (e) {
//     console.error('❌ Search Error:', e);
//     res.status(500).json({ message: 'Server error' });
//   }
// };

// // ═══════════════════════════════════════════════════════════════
// // 5. UPDATE RIDE STATUS
// // ═══════════════════════════════════════════════════════════════
// exports.updateRideStatus = async (req, res) => {
//   try {
//     const { status } = req.body;
//     const rideId = req.params.id;

//     const ride = await Ride.findOneAndUpdate(
//       { _id: rideId, rider: req.user.id },
//       { status: status },
//       { new: true }
//     );

//     if (!ride) return res.status(404).json({ message: "Ride not found" });

//     // ✅ FETCH IO from the app object
//     const io = req.app.get('socketio');
    
//     // ✅ BROADCAST to the ride room (Passenger will receive this)
//     io.to(rideId).emit('status_updated', { 
//         status: ride.status,
//         rideId: rideId
//     });

//     console.log(`📡 Status for ${rideId} updated to: ${status}`);

//     res.status(200).json({ message: "Status updated", ride });
//   } catch (error) {
//     console.error("❌ Status Update Error:", error);
//     res.status(500).json({ message: "Server Error" });
//   }
// };


// // Add this to riderController.js
// exports.getPassengerUpcomingRides = async (req, res) => {
//   try {
//     // Find rides where the current user's ID exists in the passengers array
//     const rides = await Ride.find({ passengers: req.user.id })
//       .populate('rider', 'fullName profilePic rating kycDetails phone')
//       .sort({ date: 1 });
    
//     res.status(200).json(rides);
//   } catch (error) {
//     console.error(error);
//     res.status(500).json({ message: "Server Error fetching passenger rides" });
//   }
// };













































































const User = require('../models/UserModel');
const Ride = require('../models/RideModel');
const geolib = require('geolib');
const axios = require('axios');

// ═══════════════════════════════════════════════════════════════
// 🎯 CONFIGURATION
// ═══════════════════════════════════════════════════════════════
const CONFIG = {
  MAX_DETOUR_BUDGET: 500,
  MAX_WALK_BUDGET: 500,
  PREFER_DETOUR_OVER_WALK: true,
  MAX_COMBINED_TOTAL: 600,
  ENABLE_SMART_FLEXIBILITY: true,
  FLEXIBILITY_MARGIN: 100,
};

// ═══════════════════════════════════════════════════════════════
// 🧮 HELPER: Calculate Intermediate Point
// ═══════════════════════════════════════════════════════════════
const calculateIntermediatePoint = (anchor, target, detourDist, totalGap) => {
  if (detourDist >= totalGap) return target; // Rider goes all the way
  if (detourDist <= 0) return anchor; // Rider doesn't move

  const ratio = detourDist / totalGap;
  return {
    lat: anchor.lat + (target.lat - anchor.lat) * ratio,
    lng: anchor.lng + (target.lng - anchor.lng) * ratio
  };
};

// ═══════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════
const generateRoutePolyline = async (fromLat, fromLng, toLat, toLng) => {
  try {
    const response = await axios.get(
      `http://router.project-osrm.org/route/v1/driving/${fromLng},${fromLat};${toLng},${toLat}`,
      { params: { overview: 'full', geometries: 'geojson' } }
    );
    return response.data.routes[0].geometry.coordinates.map(c => ({ lat: c[1], lng: c[0] }));
  } catch (error) {
    console.error('❌ Route generation failed:', error.message);
    return generateStraightLinePolyline(fromLat, fromLng, toLat, toLng);
  }
};

const generateStraightLinePolyline = (fromLat, fromLng, toLat, toLng) => {
  const points = [];
  const steps = 20;
  for (let i = 0; i <= steps; i++) {
    const ratio = i / steps;
    points.push({
      lat: fromLat + (toLat - fromLat) * ratio,
      lng: fromLng + (toLng - fromLng) * ratio
    });
  }
  return points;
};

// ═══════════════════════════════════════════════════════════════
// 1. SUBMIT RIDER KYC
// ═══════════════════════════════════════════════════════════════
exports.submitRiderKyc = async (req, res) => {
  try {
    const userId = req.user.id;
    const files = req.files || {};
    const body = req.body;

    const getPath = (fieldName) => {
      return files[fieldName] ? files[fieldName][0].path.replace(/\\/g, "/") : null;
    };

    const kycData = {
      citizenshipFront: getPath('citizenshipFront'),
      citizenshipBack: getPath('citizenshipBack'),
      licenseNumber: body.licenseNumber,
      licenseExpiryDate: body.licenseExpiryDate,
      licenseIssueDate: body.licenseIssueDate,
      licenseImage: getPath('licenseImage'),
      selfieWithLicense: getPath('selfieWithLicense'),
      vehicleModel: body.vehicleModel,
      vehicleProductionYear: body.vehicleProductionYear,
      vehiclePlateNumber: body.vehiclePlateNumber,
      vehiclePhoto: getPath('vehiclePhoto'),
      billbookPage2: getPath('billbookPage2'),
      billbookPage3: getPath('billbookPage3'),
      submittedAt: new Date()
    };

    await User.findByIdAndUpdate(userId, {
      riderStatus: 'pending',
      kycDetails: kycData
    });

    res.status(200).json({ message: "KYC Submitted Successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error processing KYC" });
  }
};

// ═══════════════════════════════════════════════════════════════
// 2. PUBLISH RIDE
// ═══════════════════════════════════════════════════════════════
exports.publishRide = async (req, res) => {
  try {
    const { fromLocation, fromLatLng, toLocation, toLatLng, date, time, price } = req.body;
    
    console.log(`🏍️  Publishing: ${fromLocation} → ${toLocation}`);
    
    const routePath = await generateRoutePolyline(
      fromLatLng.lat, fromLatLng.lng, toLatLng.lat, toLatLng.lng
    );

    console.log(`✅ Polyline: ${routePath.length} points`);

    const newRide = new Ride({
      rider: req.user.id,
      fromLocation, fromLatLng,
      toLocation, toLatLng,
      routePath,
      date, time, 
      price: price || 150
    });

    await newRide.save();
    res.status(201).json({ message: "Ride Published", routePoints: routePath.length });
  } catch (error) {
    console.error('❌ Publish Error:', error);
    res.status(500).json({ message: "Server Error" });
  }
};

// ═══════════════════════════════════════════════════════════════
// 3. GET MY RIDES
// ═══════════════════════════════════════════════════════════════
exports.getMyRides = async (req, res) => {
  try {
    const rides = await Ride.find({ rider: req.user.id })
      .populate('passengers', 'fullName profilePic phone') 
      .sort({ createdAt: -1 });
    
    res.status(200).json(rides);
  } catch (error) {
    console.error("❌ Get Rides Error:", error);
    res.status(500).json({ message: "Server Error" });
  }
};

// ═══════════════════════════════════════════════════════════════
// 4. SEARCH RIDES - COMPLETE LOGIC WITH PASSENGER ACTUAL LOCATIONS
// ═══════════════════════════════════════════════════════════════
exports.searchRides = async (req, res) => {
  try {
    const { pickupLat, pickupLng, dropoffLat, dropoffLng, date } = req.body;

    console.log(`🔍 Search Request:
      Pickup: (${pickupLat}, ${pickupLng})
      Dropoff: (${dropoffLat}, ${dropoffLng})
      Date: ${date}`);

    const rides = await Ride.find({ status: 'active', date })
      .populate('rider', 'fullName profilePic rating kycDetails');

    const results = [];

    for (const ride of rides) {
      const polyline = ride.routePath;
      if (!polyline || polyline.length === 0) continue;

      // ─────────────────────────────────────────────────────────
      // STEP 1: Find Closest Points on Polyline (Anchors)
      // ─────────────────────────────────────────────────────────
      let pickupAnchorIdx = -1;
      let pickupGap = Infinity;

      for (let i = 0; i < polyline.length; i++) {
        const d = geolib.getDistance(
          { latitude: pickupLat, longitude: pickupLng },
          { latitude: polyline[i].lat, longitude: polyline[i].lng }
        );
        if (d < pickupGap) {
          pickupGap = d;
          pickupAnchorIdx = i;
        }
      }

      // Dropoff must be after pickup
      let dropAnchorIdx = -1;
      let dropGap = Infinity;

      for (let i = pickupAnchorIdx + 1; i < polyline.length; i++) {
        const d = geolib.getDistance(
          { latitude: dropoffLat, longitude: dropoffLng },
          { latitude: polyline[i].lat, longitude: polyline[i].lng }
        );
        if (d < dropGap) {
          dropGap = d;
          dropAnchorIdx = i;
        }
      }

      if (dropAnchorIdx <= pickupAnchorIdx) continue;

      const totalGap = pickupGap + dropGap;

      // ─────────────────────────────────────────────────────────
      // STEP 2: Check Feasibility
      // ─────────────────────────────────────────────────────────
      const maxAllowed = CONFIG.MAX_DETOUR_BUDGET + CONFIG.MAX_WALK_BUDGET + CONFIG.FLEXIBILITY_MARGIN;
      if (totalGap > maxAllowed) continue;

      // ─────────────────────────────────────────────────────────
      // STEP 3: Smart Allocation (Prioritize Rider Detour)
      // ─────────────────────────────────────────────────────────
      let riderPickupDist, riderDropDist, userPickupWalk, userDropWalk;
      let pickupMeetingPoint, dropMeetingPoint;
      let matchType;

      // ✅ ALWAYS store passenger's original search locations
      const passengerActualPickup = { lat: pickupLat, lng: pickupLng };
      const passengerActualDropoff = { lat: dropoffLat, lng: dropoffLng };

      if (totalGap <= CONFIG.MAX_DETOUR_BUDGET) {
        // ═════════════════════════════════════════════════════════
        // CASE 1: DETOUR MATCH - Rider goes all the way
        // ═════════════════════════════════════════════════════════
        matchType = 'detour';
        riderPickupDist = pickupGap;
        riderDropDist = dropGap;
        userPickupWalk = 0;
        userDropWalk = 0;

        // ✅ Rider goes EXACTLY to passenger's search locations
        // So meeting points ARE the passenger's actual locations
        pickupMeetingPoint = { lat: pickupLat, lng: pickupLng };
        dropMeetingPoint = { lat: dropoffLat, lng: dropoffLng };

        console.log(`  ✅ DETOUR Match Found:
          Rider detours: ${riderPickupDist + riderDropDist}m total
          Meeting point = Passenger location (door-to-door)`);

      } else {
        // ═════════════════════════════════════════════════════════
        // CASE 2: SMART MATCH - Hybrid (Detour + Walk)
        // ═════════════════════════════════════════════════════════
        matchType = 'smart';

        // Allocate detour proportionally
        const pickupRatio = pickupGap / totalGap;
        riderPickupDist = Math.round(CONFIG.MAX_DETOUR_BUDGET * pickupRatio);
        riderDropDist = CONFIG.MAX_DETOUR_BUDGET - riderPickupDist;

        userPickupWalk = pickupGap - riderPickupDist;
        userDropWalk = dropGap - riderDropDist;

        // Check walk budget
        if ((userPickupWalk + userDropWalk) > CONFIG.MAX_WALK_BUDGET + CONFIG.FLEXIBILITY_MARGIN) {
          continue; // Exceeds walk limit
        }

        // ✅ Calculate MEETING POINTS (where rider will stop)
        // These are DIFFERENT from passenger's search locations
        const pickupAnchor = polyline[pickupAnchorIdx];
        const dropAnchor = polyline[dropAnchorIdx];

        pickupMeetingPoint = calculateIntermediatePoint(
          pickupAnchor,
          { lat: pickupLat, lng: pickupLng },
          riderPickupDist,
          pickupGap
        );

        dropMeetingPoint = calculateIntermediatePoint(
          dropAnchor,
          { lat: dropoffLat, lng: dropoffLng },
          riderDropDist,
          dropGap
        );

        console.log(`  ✅ SMART Match Found:
          Passenger searches: (${pickupLat}, ${pickupLng})
          Meeting point: (${pickupMeetingPoint.lat}, ${pickupMeetingPoint.lng})
          Passenger walks: ${userPickupWalk}m to meeting point`);
      }

      // ─────────────────────────────────────────────────────────
      // STEP 4: Add to Results with ALL location data
      // ─────────────────────────────────────────────────────────
      results.push({
        ...ride._doc,
        
        // ✅ MEETING POINTS - Where rider will physically stop
        meetingPoint: pickupMeetingPoint,
        dropPoint: dropMeetingPoint,

        // ✅ PASSENGER ACTUAL LOCATIONS - What user searched for
        // This is CRITICAL for drawing dotted walking lines
        passengerActualPickup: passengerActualPickup,
        passengerActualDropoff: passengerActualDropoff,

        // Metrics
        pickupDetour: riderPickupDist,
        pickupWalk: userPickupWalk,
        dropoffDetour: riderDropDist,
        dropoffWalk: userDropWalk,
        totalDetour: riderPickupDist + riderDropDist,
        totalWalk: userPickupWalk + userDropWalk,

        matchType,
        explanation: matchType === 'detour' 
          ? `🎉 Door-to-door! Rider detours ${riderPickupDist + riderDropDist}m total.`
          : `Rider detours ${riderPickupDist + riderDropDist}m, you walk ${userPickupWalk + userDropWalk}m.`,
        userFriendlyMessage: matchType === 'detour' 
          ? '🎉 Perfect! No walking needed' 
          : `🚶 Walk ${userPickupWalk + userDropWalk}m`
      });
    }

    console.log(`✅ Found ${results.length} matching rides`);
    res.status(200).json(results);

  } catch (e) {
    console.error('❌ Search Error:', e);
    res.status(500).json({ message: 'Server error' });
  }
};

// ═══════════════════════════════════════════════════════════════
// 5. UPDATE RIDE STATUS
// ═══════════════════════════════════════════════════════════════
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

    // ✅ FETCH IO from the app object
    const io = req.app.get('socketio');
    
    // ✅ BROADCAST to the ride room (Passenger will receive this)
    io.to(rideId).emit('status_updated', { 
        status: ride.status,
        rideId: rideId
    });

    console.log(`📡 Status for ${rideId} updated to: ${status}`);

    res.status(200).json({ message: "Status updated", ride });
  } catch (error) {
    console.error("❌ Status Update Error:", error);
    res.status(500).json({ message: "Server Error" });
  }
};

// ═══════════════════════════════════════════════════════════════
// 6. GET PASSENGER UPCOMING RIDES
// ═══════════════════════════════════════════════════════════════
exports.getPassengerUpcomingRides = async (req, res) => {
  try {
    // Find rides where the current user's ID exists in the passengers array
    const rides = await Ride.find({ passengers: req.user.id })
      .populate('rider', 'fullName profilePic rating kycDetails phone')
      .sort({ date: 1 });
    
    res.status(200).json(rides);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error fetching passenger rides" });
  }
};