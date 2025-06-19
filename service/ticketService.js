const Ticket = require('../models/ticket');
const User = require('../models/user');
const nodemailer = require('nodemailer');

// Support team email - add your support team email here
const SUPPORT_TEAM_EMAIL = 'cursor.exo@gmail.com'; // Replace with your actual support email

// Configure email transporter with proper error handling
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER || 'support@yourgame.com',
        pass: process.env.EMAIL_PASSWORD || 'app-password-here'
    },
    tls: {
        rejectUnauthorized: false // For development environments with self-signed certificates
    }
});

// Verify transporter connection on startup
transporter.verify()
    .then(() => console.log('Email service connected successfully'))
    .catch(err => console.error('Email service connection error:', err));

class TicketService {
    /**
     * Create a new support ticket
     * @param {Object} ticketData - The ticket data
     * @returns {Promise<Object>} Created ticket
     */
    async createTicket(ticketData) {
        try {
            // Validate userName is provided
            if (!ticketData.userName) {
                throw new Error('userName is required');
            }

            // Create ticket with provided data
            const ticket = new Ticket({
                userId: ticketData.userId,
                userEmail: ticketData.userEmail || 'unknown@email.com',
                userName: ticketData.userName, // Use provided userName without any default
                category: ticketData.category,
                subcategory: ticketData.subcategory,
                subject: ticketData.subject || ticketData.subcategory,
                description: ticketData.description,
                priority: this._determinePriority(ticketData.category, ticketData.subcategory),
                responses: [{
                    message: ticketData.description,
                    sentBy: 'user',
                    senderId: ticketData.userId
                }]
            });
            
            // Save the ticket
            const savedTicket = await ticket.save();
            console.log(`Ticket created: ${savedTicket.ticketId} for user ${savedTicket.userId} with name ${savedTicket.userName}`);
            
            // Send confirmation email to user
            try {
                await this._sendConfirmationEmail(savedTicket);
                console.log(`Confirmation email sent for ticket ${savedTicket.ticketId}`);
            } catch (emailError) {
                console.error(`Failed to send confirmation email for ticket ${savedTicket.ticketId}:`, emailError);
                // Don't fail the ticket creation if email fails
            }
            
            // Send notification to support team
            try {
                await this._sendSupportTeamNotification(savedTicket);
                console.log(`Support team notification sent for ticket ${savedTicket.ticketId}`);
            } catch (emailError) {
                console.error(`Failed to send support team notification for ticket ${savedTicket.ticketId}:`, emailError);
                // Don't fail the ticket creation if email fails
            }
            
            return savedTicket;
        } catch (error) {
            console.error('Error creating ticket:', error);
            throw error;
        }
    }
    
    /**
     * Get ticket by ID
     * @param {string} ticketId - The ticket ID
     * @returns {Promise<Object>} Ticket
     */
    async getTicketById(ticketId) {
        try {
            const ticket = await Ticket.findOne({ ticketId });
            
            if (!ticket) {
                const error = new Error('Ticket not found');
                error.statusCode = 404;
                throw error;
            }
            
            return ticket;
        } catch (error) {
            console.error(`Error getting ticket ${ticketId}:`, error);
            throw error;
        }
    }
    
    /**
     * Get all tickets for a user
     * @param {string} userId - The user ID
     * @returns {Promise<Array>} User's tickets
     */
    async getUserTickets(userId) {
        try {
            const tickets = await Ticket.find({ userId }).sort({ createdAt: -1 });
            console.log(`Retrieved ${tickets.length} tickets for user ${userId}`);
            return tickets;
        } catch (error) {
            console.error(`Error getting tickets for user ${userId}:`, error);
            throw error;
        }
    }
    
    /**
     * Add response to ticket
     * @param {string} ticketId - The ticket ID
     * @param {string} message - Response message
     * @param {string} sentBy - Who sent the response ('user' or 'admin')
     * @param {string} senderId - ID of the sender
     * @returns {Promise<Object>} Updated ticket
     */
    async addResponse(ticketId, message, sentBy, senderId) {
        try {
            const ticket = await Ticket.findOne({ ticketId });
            
            if (!ticket) {
                const error = new Error('Ticket not found');
                error.statusCode = 404;
                throw error;
            }
            
            // Add response
            ticket.responses.push({
                message,
                sentBy,
                senderId,
                sentAt: new Date()
            });
            
            // Update ticket
            ticket.updatedAt = new Date();
            
            const updatedTicket = await ticket.save();
            console.log(`Response added to ticket ${ticketId} by ${sentBy} ${senderId}`);
            
            return updatedTicket;
        } catch (error) {
            console.error(`Error adding response to ticket ${ticketId}:`, error);
            throw error;
        }
    }
    
    /**
     * Determine ticket priority based on category and subcategory
     * @param {string} category - Ticket category
     * @param {string} subcategory - Ticket subcategory
     * @returns {string} Priority level
     * @private
     */
    _determinePriority(category, subcategory) {
        // Set priority based on category and subcategory
        if (category === 'Security Concerns') {
            return 'critical';
        } else if (category === 'Purchases and Billing Issues') {
            return 'high';
        } else if (category === 'Technical Issues' && 
                 (subcategory === 'Game won\'t launch or crashes' || 
                  subcategory === 'Can\'t download or update the client')) {
            return 'high';
        } else if (category === 'In-Game Issues' && 
                 (subcategory === 'Item or character missing' || 
                  subcategory === 'Progress lost after disconnect')) {
            return 'high';
        }
        
        return 'medium';
    }
    
    /**
     * Send confirmation email to user
     * @param {Object} ticket - The ticket
     * @returns {Promise<void>}
     * @private
     */
    async _sendConfirmationEmail(ticket) {
        try {
            // Skip sending email if no email address or it looks like a test/example email
            if (!ticket.userEmail || 
                ticket.userEmail.includes('example.com') || 
                ticket.userEmail === 'unknown@email.com') {
                console.log(`Skipping email for ticket ${ticket.ticketId}: Invalid or test email address`);
                return;
            }
            
            const mailOptions = {
                from: `"Game Support" <${process.env.EMAIL_USER || 'support@yourgame.com'}>`,
                to: ticket.userEmail,
                subject: `[${ticket.ticketId}] Your Support Ticket Has Been Received`,
                html: `
                <h2>Your Support Ticket Has Been Received</h2>
                <p>Dear Player,</p>
                <p>We have received your support request for "${ticket.category} - ${ticket.subcategory}".</p>
                <p><strong>Ticket ID:</strong> ${ticket.ticketId}</p>
                <p><strong>Issue:</strong> ${ticket.category} - ${ticket.subcategory}</p>
                <p><strong>Status:</strong> ${ticket.status}</p>
                <p>Our support team will review your request and respond as soon as possible.</p>
                <p>Thank you for your patience.</p>
                <p>Best regards,<br>The Support Team</p>
                `,
                text: `
                Your Support Ticket Has Been Received
                
                Dear Player,
                
                We have received your support request for "${ticket.category} - ${ticket.subcategory}".
                
                Ticket ID: ${ticket.ticketId}
                Issue: ${ticket.category} - ${ticket.subcategory}
                Status: ${ticket.status}
                
                Our support team will review your request and respond as soon as possible.
                
                Thank you for your patience.
                
                Best regards,
                The Support Team
                `
            };
            
            const info = await transporter.sendMail(mailOptions);
            console.log(`Email sent successfully to ${ticket.userEmail} for ticket ${ticket.ticketId}`);
            return info;
        } catch (error) {
            console.error(`Error sending confirmation email to ${ticket.userEmail}:`, error);
            // Don't throw error, just log it - this prevents email errors from breaking ticket creation
            return null;
        }
    }
    
    /**
     * Send notification email to support team
     * @param {Object} ticket - The ticket
     * @returns {Promise<void>}
     * @private
     */
    async _sendSupportTeamNotification(ticket) {
        try {
            // Skip if support team email is not configured
            if (!SUPPORT_TEAM_EMAIL || SUPPORT_TEAM_EMAIL === 'your-support-email@gmail.com') {
                console.log(`Skipping support team notification: Support email not configured`);
                return null;
            }
            
            const priorityColors = {
                'low': '#28a745',
                'medium': '#ffc107',
                'high': '#fd7e14',
                'critical': '#dc3545'
            };
            
            const priorityColor = priorityColors[ticket.priority] || priorityColors.medium;
            
            const mailOptions = {
                from: `"Game Support System" <${process.env.EMAIL_USER || 'support@yourgame.com'}>`,
                to: SUPPORT_TEAM_EMAIL,
                subject: `[${ticket.priority.toUpperCase()}] New Support Ticket: ${ticket.ticketId}`,
                html: `
                <h2>New Support Ticket Received</h2>
                <p><strong>Ticket ID:</strong> ${ticket.ticketId}</p>
                <p><strong>User ID:</strong> ${ticket.userId}</p>
                <p><strong>Email:</strong> ${ticket.userEmail}</p>
                <p><strong>Issue:</strong> ${ticket.category} - ${ticket.subcategory}</p>
                <p><strong>Priority:</strong> <span style="color: ${priorityColor}; font-weight: bold;">${ticket.priority.toUpperCase()}</span></p>
                <p><strong>Created:</strong> ${new Date(ticket.createdAt).toLocaleString()}</p>
                
                <h3>Description:</h3>
                <p style="background-color: #f8f9fa; padding: 15px; border-radius: 5px;">${ticket.description}</p>
                
                <p>Please respond to this ticket as soon as possible.</p>
                `,
                text: `
                New Support Ticket Received
                
                Ticket ID: ${ticket.ticketId}
                User ID: ${ticket.userId}
                Email: ${ticket.userEmail}
                Issue: ${ticket.category} - ${ticket.subcategory}
                Priority: ${ticket.priority.toUpperCase()}
                Created: ${new Date(ticket.createdAt).toLocaleString()}
                
                Description:
                ${ticket.description}
                
                Please respond to this ticket as soon as possible.
                `
            };
            
            const info = await transporter.sendMail(mailOptions);
            console.log(`Support team notification sent to ${SUPPORT_TEAM_EMAIL} for ticket ${ticket.ticketId}`);
            return info;
        } catch (error) {
            console.error(`Error sending support team notification:`, error);
            // Don't throw error, just log it
            return null;
        }
    }
}

module.exports = new TicketService();