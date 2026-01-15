const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/authMiddleware');
// const { sendRequest, getRiderRequests, respondToRequest } = require('../controllers/requestController');
const {
  sendRequest,
  getRiderRequests,
//   acceptRideRequest,
  respondToRequest,
  getPassengerRequests,
  markRequestAsViewed
} = require('../controllers/requestController');


router.post('/send', protect, sendRequest);
router.get('/rider/incoming', protect, getRiderRequests);
router.put('/respond/:id', protect, respondToRequest);
// router.put('/accept/:requestId', protect, acceptRideRequest);
router.get('/passenger/my-requests', protect, getPassengerRequests);
router.put('/viewed/:id', protect, markRequestAsViewed); 


module.exports = router;