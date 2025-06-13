const express = require('express');
const router = express.Router();
const Offer = require('../models/offer');

// Create a new offer (admin/dev only)
router.post('/create', async (req, res) => {
    try {
        const { userId, offer_type, offer_data, expires_at } = req.body;
        if (!userId || !offer_type || !offer_data) {
            return res.status(400).json({ success: false, message: 'Missing required fields' });
        }
        const offer = new Offer({
            userId,
            offer_type,
            offer_data,
            expires_at: expires_at ? new Date(expires_at) : undefined
        });
        await offer.save();
        res.status(201).json({ success: true, offer });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// List all active offers for a user
router.get('/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const offers = await Offer.find({ userId, status: { $in: ['active', 'shown'] } });
        res.json({ success: true, offers });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Mark an offer as shown
router.post('/:offerId/show', async (req, res) => {
    try {
        const { offerId } = req.params;
        const offer = await Offer.findById(offerId);
        if (!offer) return res.status(404).json({ success: false, message: 'Offer not found' });
        offer.status = 'shown';
        offer.shown_count += 1;
        await offer.save();
        res.json({ success: true, offer });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Mark an offer as claimed
router.post('/:offerId/claim', async (req, res) => {
    try {
        const { offerId } = req.params;
        const offer = await Offer.findById(offerId);
        if (!offer) return res.status(404).json({ success: false, message: 'Offer not found' });
        offer.status = 'claimed';
        offer.claimed_at = new Date();
        await offer.save();
        res.json({ success: true, offer });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Mark an offer as expired
router.post('/:offerId/expire', async (req, res) => {
    try {
        const { offerId } = req.params;
        const offer = await Offer.findById(offerId);
        if (!offer) return res.status(404).json({ success: false, message: 'Offer not found' });
        offer.status = 'expired';
        await offer.save();
        res.json({ success: true, offer });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = router; 