const express = require('express');
const subscriptionController = require('../controllers/subscriptionController');

const router = express.Router();

router.post('/music/subscribe', subscriptionController.subscribe_post);
router.post('/music/unsubscribe', subscriptionController.unsubscribe_post);
router.post('/music/subscribed', subscriptionController.subscribed_post);

module.exports = router;