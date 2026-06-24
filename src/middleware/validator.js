// ── Input Validation & Sanitization ────────────────────
// Uses express-validator to validate and sanitize incoming ticket data.

const { body, validationResult } = require('express-validator');

// Validation chain for public ticket creation
const validateTicketCreation = [
  body('customer_name')
    .trim()
    .notEmpty().withMessage('Customer name is required.')
    .isLength({ max: 255 }).withMessage('Customer name must be 255 characters or fewer.')
    .escape(),

  body('customer_email')
    .trim()
    .notEmpty().withMessage('Customer email is required.')
    .isEmail().withMessage('A valid email address is required.')
    .normalizeEmail(),

  body('customer_company')
    .trim()
    .notEmpty().withMessage('Company name is required.')
    .isLength({ max: 255 }).withMessage('Company name must be 255 characters or fewer.')
    .escape(),

  body('device_number')
    .trim()
    .notEmpty().withMessage('Device number is required.')
    .isLength({ max: 100 }).withMessage('Device number must be 100 characters or fewer.')
    .escape(),

  body('order_number')
    .trim()
    .notEmpty().withMessage('Order number is required.')
    .isLength({ max: 100 }).withMessage('Order number must be 100 characters or fewer.')
    .escape(),

  body('purchase_date')
    .trim()
    .notEmpty().withMessage('Purchase date is required.')
    .isISO8601({ strict: true }).withMessage('Purchase date must be a valid date (YYYY-MM-DD).'),

  body('issue_subject')
    .trim()
    .notEmpty().withMessage('Issue subject is required.')
    .isLength({ max: 255 }).withMessage('Issue subject must be 255 characters or fewer.')
    .escape(),

  body('issue_description')
    .trim()
    .notEmpty().withMessage('Issue description is required.')
    .isLength({ max: 10000 }).withMessage('Issue description must be 10,000 characters or fewer.'),
];

// Validation chain for internal ticket updates
const validateTicketUpdate = [
  body('priority')
    .optional()
    .isIn(['Low', 'Medium', 'High', 'Critical'])
    .withMessage('Priority must be one of: Low, Medium, High, Critical.'),

  body('status')
    .optional()
    .isIn(['Open', 'In Progress', 'Resolved', 'Closed'])
    .withMessage('Status must be one of: Open, In Progress, Resolved, Closed.'),
];

// Validation chain for adding ticket updates/notes
const validateTicketNote = [
  body('internal_user')
    .trim()
    .notEmpty().withMessage('Internal user name is required.')
    .isLength({ max: 255 }).withMessage('User name must be 255 characters or fewer.')
    .escape(),

  body('update_text')
    .trim()
    .notEmpty().withMessage('Update text is required.')
    .isLength({ max: 10000 }).withMessage('Update text must be 10,000 characters or fewer.'),
];

/**
 * Middleware to check validation results and return errors if any.
 */
function handleValidationErrors(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array().map(e => ({
        field: e.path,
        message: e.msg,
      })),
    });
  }
  next();
}

module.exports = {
  validateTicketCreation,
  validateTicketUpdate,
  validateTicketNote,
  handleValidationErrors,
};
