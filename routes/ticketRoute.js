const express = require('express');
const router = express.Router();
const ticketService = require('../service/ticketService');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const TicketCategory = require('../models/ticketCategory');

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: function(req, file, cb) {
        const uploadDir = path.join(__dirname, '../uploads/tickets');
        
        // Create directory if it doesn't exist
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        
        cb(null, uploadDir);
    },
    filename: function(req, file, cb) {
        // Generate unique filename
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB limit
    },
    fileFilter: function(req, file, cb) {
        // Allow only certain file types
        const allowedFileTypes = /jpeg|jpg|png|gif|pdf|txt|doc|docx/;
        const extname = allowedFileTypes.test(path.extname(file.originalname).toLowerCase());
        
        if (extname) {
            return cb(null, true);
        } else {
            cb(new Error('Only image, PDF, text, and document files are allowed'));
        }
    }
});

/**
 * @route POST /api/tickets
 * @description Create a new support ticket
 * @access Public
 */
router.post('/', upload.array('attachments', 5), async (req, res) => {
    try {
        const { category, subcategory, description, userId, userEmail, userName, subject } = req.body;
        
        // Validate required fields
        if (!category || !subcategory || !description || !userId) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields: category, subcategory, description, userId'
            });
        }
        
        // Validate email format if provided
        if (userEmail) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(userEmail)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid email format'
                });
            }
        }
        
        // Process attachments if any
        const attachments = [];
        if (req.files && req.files.length > 0) {
            for (const file of req.files) {
                attachments.push({
                    fileName: file.originalname,
                    fileUrl: `/uploads/tickets/${file.filename}`,
                    fileType: file.mimetype,
                    uploadDate: new Date()
                });
            }
        }
        
        // Create ticket data
        const ticketData = {
            userId,
            userEmail,
            userName,
            category,
            subcategory,
            subject,
            description,
            attachments
        };
        
        // Create ticket
        const ticket = await ticketService.createTicket(ticketData);
        
        res.status(201).json({
            success: true,
            message: 'Thank you for your ticket. Our support team will review your request and respond as soon as possible.',
            data: {
                ticketId: ticket.ticketId,
                status: ticket.status,
                createdAt: ticket.createdAt
            }
        });
    } catch (error) {
        console.error('Error creating ticket:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create ticket',
            error: error.message
        });
    }
});

/**
 * @route GET /api/tickets
 * @description Get all tickets for a user
 * @access Public
 */
router.get('/', async (req, res) => {
    try {
        const { userId } = req.query;
        
        if (!userId) {
            return res.status(400).json({
                success: false,
                message: 'Missing required query parameter: userId'
            });
        }
        
        const tickets = await ticketService.getUserTickets(userId);
        
        res.status(200).json({
            success: true,
            count: tickets.length,
            data: tickets.map(ticket => ({
                ticketId: ticket.ticketId,
                category: ticket.category,
                subcategory: ticket.subcategory,
                subject: ticket.subject,
                status: ticket.status,
                createdAt: ticket.createdAt,
                updatedAt: ticket.updatedAt
            }))
        });
    } catch (error) {
        console.error('Error getting user tickets:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get tickets',
            error: error.message
        });
    }
});

/**
 * @route GET /api/tickets/:ticketId
 * @description Get a specific ticket by ID
 * @access Public
 */
router.get('/:ticketId', async (req, res) => {
    try {
        const { ticketId } = req.params;
        const { userId } = req.query;
        
        if (!userId) {
            return res.status(400).json({
                success: false,
                message: 'Missing required query parameter: userId'
            });
        }
        
        const ticket = await ticketService.getTicketById(ticketId);
        
        // Check if user owns this ticket
        if (ticket.userId !== userId) {
            return res.status(403).json({
                success: false,
                message: 'You do not have permission to access this ticket'
            });
        }
        
        res.status(200).json({
            success: true,
            data: ticket
        });
    } catch (error) {
        console.error('Error getting ticket:', error);
        res.status(error.message === 'Ticket not found' ? 404 : 500).json({
            success: false,
            message: error.message === 'Ticket not found' ? 'Ticket not found' : 'Failed to get ticket',
            error: error.message
        });
    }
});

/**
 * @route POST /api/tickets/:ticketId/responses
 * @description Add a response to a ticket
 * @access Public
 */
router.post('/:ticketId/responses', async (req, res) => {
    try {
        const { ticketId } = req.params;
        const { message, userId } = req.body;
        
        if (!message || !userId) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields: message, userId'
            });
        }
        
        // Get ticket to check ownership
        const ticket = await ticketService.getTicketById(ticketId);
        
        // Check if user owns this ticket
        if (ticket.userId !== userId) {
            return res.status(403).json({
                success: false,
                message: 'You do not have permission to respond to this ticket'
            });
        }
        
        // Add response
        const updatedTicket = await ticketService.addResponse(
            ticketId,
            message,
            'user',
            userId
        );
        
        res.status(200).json({
            success: true,
            message: 'Response added successfully',
            data: {
                ticketId: updatedTicket.ticketId,
                status: updatedTicket.status,
                updatedAt: updatedTicket.updatedAt
            }
        });
    } catch (error) {
        console.error('Error adding response:', error);
        res.status(error.message === 'Ticket not found' ? 404 : 500).json({
            success: false,
            message: error.message === 'Ticket not found' ? 'Ticket not found' : 'Failed to add response',
            error: error.message
        });
    }
});

/**
 * @route GET /api/tickets/categories
 * @description Get all ticket categories and subcategories
 * @access Public
 */
router.get('/categories', async (req, res) => {
    try {
        const categories = await TicketCategory.find({ active: true }).sort({ name: 1 });
        
        res.status(200).json({
            success: true,
            count: categories.length,
            data: categories
        });
    } catch (error) {
        console.error('Error getting ticket categories:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get ticket categories',
            error: error.message
        });
    }
});

module.exports = router; 