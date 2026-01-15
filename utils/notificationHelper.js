const admin = require('firebase-admin');
const Notification = require('../models/NotificationModel');
const User = require('../models/UserModel');

// Initialize Firebase Admin (make sure you have this in your main server file too)
if (!admin.apps.length) {
  const serviceAccount = require('../config/serviceAccountKey.json.json');
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

/**
 * Send push notification via FCM
 */
async function sendPushNotification(fcmToken, title, body, data = {}) {
  try {
    const message = {
      notification: { title, body },
      data: data,
      token: fcmToken,
    };

    const response = await admin.messaging().send(message);
    console.log('✅ FCM Notification sent:', response);
    return response;
  } catch (error) {
    console.error('❌ FCM Error:', error);
    return null;
  }
}

/**
 * Main notification handler: Saves to DB + Sends push notification + Emits socket
 */
async function sendNotification(io, recipientId, senderId, title, message, type, rideId) {
  try {
    // 1. Save to Database
    const notification = new Notification({
      recipient: recipientId,
      sender: senderId,
      title,
      message,
      type,
      rideId,
      read: false
    });
    await notification.save();

    // 2. Get recipient FCM token
    const recipient = await User.findById(recipientId);
    
    // 3. Send Push Notification
    if (recipient && recipient.fcmToken) {
      await sendPushNotification(
        recipient.fcmToken,
        title,
        message,
        { 
          type, 
          rideId: rideId ? rideId.toString() : '',
          notificationId: notification._id.toString()
        }
      );
    }

    // 4. Emit via Socket (for real-time in-app updates)
    if (io) {
      io.to(recipientId.toString()).emit('new_notification', {
        _id: notification._id,
        title,
        message,
        type,
        rideId,
        createdAt: notification.createdAt,
        read: false
      });
    }

    console.log(`📬 Notification sent to ${recipientId}: ${title}`);
    return notification;
  } catch (error) {
    console.error('❌ Notification Error:', error);
    return null;
  }
}

module.exports = {
  sendPushNotification,
  sendNotification
};