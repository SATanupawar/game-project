const express = require('express');
const router = express.Router();

// Example route for buildings
router.get('/', (req, res) => {
    res.json({ message: 'Building routes are working!' });
});

module.exports = router;
