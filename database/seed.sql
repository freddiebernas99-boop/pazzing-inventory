-- ============================================================
-- PAZINGS INVENTORY & SALES MANAGEMENT SYSTEM
-- Seed Data for Initial Setup
-- ============================================================

USE `pazings_db`;

-- Default Water Refilling Rates (From Excel Workbook)
INSERT INTO `services` (`id`, `category`, `service_code`, `service_name`, `default_rate`, `unit_label`, `display_order`) VALUES
(1, 'water', 'refill', 'Refill', 30.00, 'bottles', 1),
(2, 'water', 'delivered', 'Delivered', 35.00, 'bottles', 2),
(3, 'water', 'gallon_refill', 'Gallon w/ Refill', 210.00, 'gallons', 3),
(4, 'water', 'gallon_cover', 'Round Gallon Cover', 15.00, 'pcs', 4),
(5, 'water', 'half_gallon', 'Half Gallon Refill', 15.00, 'bottles', 5)
ON DUPLICATE KEY UPDATE `default_rate` = VALUES(`default_rate`);

-- Default Laundry Rates (From Excel Workbook)
INSERT INTO `services` (`id`, `category`, `service_code`, `service_name`, `default_rate`, `unit_label`, `display_order`) VALUES
(6, 'laundry', 'regular', 'Regular', 175.00, 'loads', 1),
(7, 'laundry', 'special', 'Special', 205.00, 'loads', 2),
(8, 'laundry', 'comforter', 'Comforter', 235.00, 'loads', 3),
(9, 'laundry', 'detergent', 'Detergent', 10.00, 'packs', 4),
(10, 'laundry', 'fabcon', 'Fab Con', 10.00, 'packs', 5)
ON DUPLICATE KEY UPDATE `default_rate` = VALUES(`default_rate`);

-- Business Settings
INSERT INTO `settings` (`setting_key`, `setting_value`, `description`) VALUES
('business_name', 'Pazings Laundry Shop & Water Refilling Station', 'Company trade name'),
('business_contact', '0912 345 6789', 'Official contact phone'),
('currency_symbol', '₱', 'Currency symbol used in displays and reports'),
('theme_color', 'blue_white', 'UI theme setting')
ON DUPLICATE KEY UPDATE `setting_value` = VALUES(`setting_value`);
