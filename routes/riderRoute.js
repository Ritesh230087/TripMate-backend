const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/authMiddleware');
const upload = require('../middlewares/fileUpload'); 
const { submitRiderKyc, publishRide, getMyRides, searchRides, updateRideStatus, getPassengerUpcomingRides,
processRidePayment, confirmPaymentReceived, submitRideFeedback, deleteRide, editRide, cancelRide, getRiderHistory, getPassengerHistory, getSidebarCounts
 } = require('../controllers/riderController');

const kycUploads = upload.fields([
  { name: 'citizenshipFront', maxCount: 1 },
  { name: 'citizenshipBack', maxCount: 1 },
  { name: 'licenseImage', maxCount: 1 },
  { name: 'selfieWithLicense', maxCount: 1 },
  { name: 'vehiclePhoto', maxCount: 1 },
  { name: 'billbookPage2', maxCount: 1 },
  { name: 'billbookPage3', maxCount: 1 },
]);

router.post('/kyc', protect, kycUploads, submitRiderKyc);

router.post('/publish', protect, publishRide);
router.get('/my-rides', protect, getMyRides);
router.post('/search', protect, searchRides); 
router.delete('/delete/:id', protect, deleteRide); 


router.put('/status/:id', protect, updateRideStatus);
router.get('/passenger/upcoming', protect, getPassengerUpcomingRides);


router.put('/status/:id', async (req, res) => {
    const ride = await Ride.findByIdAndUpdate(req.params.id, { status: req.body.status }, { new: true });
    
    io.to(req.params.id).emit('status_updated', { status: ride.status });
    
    res.json({ message: "Status updated", ride });
});
router.post('/payment/process', protect, processRidePayment);
router.put('/payment/confirm/:id', protect, confirmPaymentReceived);
router.post('/feedback/submit', protect, submitRideFeedback);
router.put('/update/:id', protect, editRide);
router.put('/cancel/:id', protect, cancelRide);
router.get('/history/rider', protect, getRiderHistory);
router.get('/history/passenger', protect, getPassengerHistory);
router.get('/sidebar/counts', protect, getSidebarCounts);

module.exports = router;