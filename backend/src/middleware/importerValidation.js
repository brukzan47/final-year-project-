import { body, validationResult } from "express-validator";

export const CONTACT_TITLES = [
  "Manager",
  "Director",
  "Owner",
  "Accountant",
  "Agent",
  "CEO",
  "CFO",
  "COO",
  "Representative",
  "Other",
];

export const SECTOR_TYPES = [
  "Manufacturing",
  "Trading",
  "Agriculture",
  "Services",
  "Construction",
  "Mining",
  "Logistics",
  "NGO",
  "Government",
  "Other",
];

export const validateImporter = [
  body("company_name").isString().trim().notEmpty().withMessage("company_name is required"),
  body("tin_number").isString().trim().matches(/^\d{7,15}$/).withMessage("tin_number must be 7-15 digits"),
  body("customs_registration_no").optional({ nullable: true, checkFalsy: true }).matches(/^CRN-\d{4}-\d{4,}$/).withMessage("customs_registration_no must match CRN-YYYY-####"),
  body("contact_email").optional({ nullable: true, checkFalsy: true }).isEmail().withMessage("contact_email must be valid"),
  body("contact_phone").optional({ nullable: true, checkFalsy: true }).matches(/^[0-9+\-()\s]{6,20}$/).withMessage("contact_phone must be a valid phone"),
  body("contact_title").optional({ nullable: true, checkFalsy: true }).isIn(CONTACT_TITLES).withMessage("contact_title invalid"),
  body("sector_type").optional({ nullable: true, checkFalsy: true }).isIn(SECTOR_TYPES).withMessage("sector_type invalid"),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: "Validation failed", errors: errors.array() });
    }
    next();
  },
];
