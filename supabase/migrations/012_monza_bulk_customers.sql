-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
-- MONZA CRM â€” Bulk customer + sales_order INSERT
-- Creates missing customers and links them to their cars
-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

BEGIN;

-- ABDEL KARIM FANJ
WITH new_customer AS (
  INSERT INTO customers (first_name, last_name, phone_primary, lead_status, lead_source, created_at, updated_at)
  VALUES ('Abdel', 'Karim Fanj', 'N/A', 'converted', 'walk_in', NOW(), NOW())
  RETURNING id
)
INSERT INTO sales_orders (car_id, customer_id, status, created_at)
SELECT c.id, n.id, 'confirmed', NOW()
FROM cars c, new_customer n WHERE c.vin = 'LDP29H925RM500334';

-- ADEL WAKIM / KITCHEN AVENUE
WITH new_customer AS (
  INSERT INTO customers (first_name, last_name, phone_primary, lead_status, lead_source, created_at, updated_at)
  VALUES ('Adel', 'Wakim / Kitchen Avenue', 'N/A', 'converted', 'walk_in', NOW(), NOW())
  RETURNING id
)
INSERT INTO sales_orders (car_id, customer_id, status, created_at)
SELECT c.id, n.id, 'confirmed', NOW()
FROM cars c, new_customer n WHERE c.vin = 'LDP95H962RE301863';

-- ALAA BOURJI
WITH new_customer AS (
  INSERT INTO customers (first_name, last_name, phone_primary, lead_status, lead_source, created_at, updated_at)
  VALUES ('Alaa', 'Bourji', 'N/A', 'converted', 'walk_in', NOW(), NOW())
  RETURNING id
)
INSERT INTO sales_orders (car_id, customer_id, status, created_at)
SELECT c.id, n.id, 'confirmed', NOW()
FROM cars c, new_customer n WHERE c.vin = 'LDP29H92XSM520018';

-- ALI KOBEISSY
WITH new_customer AS (
  INSERT INTO customers (first_name, last_name, phone_primary, lead_status, lead_source, created_at, updated_at)
  VALUES ('Ali', 'Kobeissy', 'N/A', 'converted', 'walk_in', NOW(), NOW())
  RETURNING id
)
INSERT INTO sales_orders (car_id, customer_id, status, created_at)
SELECT c.id, n.id, 'confirmed', NOW()
FROM cars c, new_customer n WHERE c.vin = 'LDP29H923SM520023';

-- ANTHONY HAJJAR
WITH new_customer AS (
  INSERT INTO customers (first_name, last_name, phone_primary, lead_status, lead_source, created_at, updated_at)
  VALUES ('Anthony', 'Hajjar', 'N/A', 'converted', 'walk_in', NOW(), NOW())
  RETURNING id
)
INSERT INTO sales_orders (car_id, customer_id, status, created_at)
SELECT c.id, n.id, 'confirmed', NOW()
FROM cars c, new_customer n WHERE c.vin = 'LDP95H960RE301859';

-- ANTOINE HRAOUI
WITH new_customer AS (
  INSERT INTO customers (first_name, last_name, phone_primary, lead_status, lead_source, created_at, updated_at)
  VALUES ('Antoine', 'Hraoui', 'N/A', 'converted', 'walk_in', NOW(), NOW())
  RETURNING id
)
INSERT INTO sales_orders (car_id, customer_id, status, created_at)
SELECT c.id, n.id, 'confirmed', NOW()
FROM cars c, new_customer n WHERE c.vin = 'LDP29H925RM520003';

-- ASSAAD HLAIHEL
WITH new_customer AS (
  INSERT INTO customers (first_name, last_name, phone_primary, lead_status, lead_source, created_at, updated_at)
  VALUES ('Assaad', 'Hlaihel', 'N/A', 'converted', 'walk_in', NOW(), NOW())
  RETURNING id
)
INSERT INTO sales_orders (car_id, customer_id, status, created_at)
SELECT c.id, n.id, 'confirmed', NOW()
FROM cars c, new_customer n WHERE c.vin = 'LDP95H968RE301897';

-- ASSAAD OBEID
WITH new_customer AS (
  INSERT INTO customers (first_name, last_name, phone_primary, lead_status, lead_source, created_at, updated_at)
  VALUES ('Assaad', 'Obeid', 'N/A', 'converted', 'walk_in', NOW(), NOW())
  RETURNING id
)
INSERT INTO sales_orders (car_id, customer_id, status, created_at)
SELECT c.id, n.id, 'confirmed', NOW()
FROM cars c, new_customer n WHERE c.vin = 'LDP95H960SE900265';

-- ASSAAD ZOOROB
WITH new_customer AS (
  INSERT INTO customers (first_name, last_name, phone_primary, lead_status, lead_source, created_at, updated_at)
  VALUES ('Assaad', 'Zoorob', 'N/A', 'converted', 'walk_in', NOW(), NOW())
  RETURNING id
)
INSERT INTO sales_orders (car_id, customer_id, status, created_at)
SELECT c.id, n.id, 'confirmed', NOW()
FROM cars c, new_customer n WHERE c.vin = 'LDP95H968RE302337';

-- CARINE ANTOINE FRENN
WITH new_customer AS (
  INSERT INTO customers (first_name, last_name, phone_primary, lead_status, lead_source, created_at, updated_at)
  VALUES ('Carine', 'Antoine Frenn', 'N/A', 'converted', 'walk_in', NOW(), NOW())
  RETURNING id
)
INSERT INTO sales_orders (car_id, customer_id, status, created_at)
SELECT c.id, n.id, 'confirmed', NOW()
FROM cars c, new_customer n WHERE c.vin = 'LDP95H96XSE900273';

-- CARMEN EL HAWA
WITH new_customer AS (
  INSERT INTO customers (first_name, last_name, phone_primary, lead_status, lead_source, created_at, updated_at)
  VALUES ('Carmen', 'El Hawa', 'N/A', 'converted', 'walk_in', NOW(), NOW())
  RETURNING id
)
INSERT INTO sales_orders (car_id, customer_id, status, created_at)
SELECT c.id, n.id, 'confirmed', NOW()
FROM cars c, new_customer n WHERE c.vin = 'LDP95H969SE900250';

-- CHAHINE KORJIAN
WITH new_customer AS (
  INSERT INTO customers (first_name, last_name, phone_primary, lead_status, lead_source, created_at, updated_at)
  VALUES ('Chahine', 'Korjian', 'N/A', 'converted', 'walk_in', NOW(), NOW())
  RETURNING id
)
INSERT INTO sales_orders (car_id, customer_id, status, created_at)
SELECT c.id, n.id, 'confirmed', NOW()
FROM cars c, new_customer n WHERE c.vin = 'LDP95H969RE301858';

-- CHAKIB JAAFAR
WITH new_customer AS (
  INSERT INTO customers (first_name, last_name, phone_primary, lead_status, lead_source, created_at, updated_at)
  VALUES ('Chakib', 'Jaafar', 'N/A', 'converted', 'walk_in', NOW(), NOW())
  RETURNING id
)
INSERT INTO sales_orders (car_id, customer_id, status, created_at)
SELECT c.id, n.id, 'confirmed', NOW()
FROM cars c, new_customer n WHERE c.vin = 'LDP95H967SE900263';

-- CHAKIB WAHAB
WITH new_customer AS (
  INSERT INTO customers (first_name, last_name, phone_primary, lead_status, lead_source, created_at, updated_at)
  VALUES ('Chakib', 'Wahab', 'N/A', 'converted', 'walk_in', NOW(), NOW())
  RETURNING id
)
INSERT INTO sales_orders (car_id, customer_id, status, created_at)
SELECT c.id, n.id, 'confirmed', NOW()
FROM cars c, new_customer n WHERE c.vin = 'LDP95H961RE300655';

-- CHRISTINE SAAD
WITH new_customer AS (
  INSERT INTO customers (first_name, last_name, phone_primary, lead_status, lead_source, created_at, updated_at)
  VALUES ('Christine', 'Saad', 'N/A', 'converted', 'walk_in', NOW(), NOW())
  RETURNING id
)
INSERT INTO sales_orders (car_id, customer_id, status, created_at)
SELECT c.id, n.id, 'confirmed', NOW()
FROM cars c, new_customer n WHERE c.vin = 'LDP29H924TM520081';

-- CHRISTOPHER AL HADI
WITH new_customer AS (
  INSERT INTO customers (first_name, last_name, phone_primary, lead_status, lead_source, created_at, updated_at)
  VALUES ('Christopher', 'Al Hadi', 'N/A', 'converted', 'walk_in', NOW(), NOW())
  RETURNING id
)
INSERT INTO sales_orders (car_id, customer_id, status, created_at)
SELECT c.id, n.id, 'confirmed', NOW()
FROM cars c, new_customer n WHERE c.vin = 'LDP95C960SY890094';

-- DALIA TAREK KHODOR
WITH new_customer AS (
  INSERT INTO customers (first_name, last_name, phone_primary, lead_status, lead_source, created_at, updated_at)
  VALUES ('Dalia', 'Tarek Khodor', 'N/A', 'converted', 'walk_in', NOW(), NOW())
  RETURNING id
)
INSERT INTO sales_orders (car_id, customer_id, status, created_at)
SELECT c.id, n.id, 'confirmed', NOW()
FROM cars c, new_customer n WHERE c.vin = 'LDP91E962SE100268';

-- DANY HERMEZ
WITH new_customer AS (
  INSERT INTO customers (first_name, last_name, phone_primary, lead_status, lead_source, created_at, updated_at)
  VALUES ('Dany', 'Hermez', 'N/A', 'converted', 'walk_in', NOW(), NOW())
  RETURNING id
)
INSERT INTO sales_orders (car_id, customer_id, status, created_at)
SELECT c.id, n.id, 'confirmed', NOW()
FROM cars c, new_customer n WHERE c.vin = 'LDP95H962RE302351';

-- DAOUD KAHI BY KAREEM
WITH new_customer AS (
  INSERT INTO customers (first_name, last_name, phone_primary, lead_status, lead_source, created_at, updated_at)
  VALUES ('Daoud', 'Kahi By Kareem', 'N/A', 'converted', 'walk_in', NOW(), NOW())
  RETURNING id
)
INSERT INTO sales_orders (car_id, customer_id, status, created_at)
SELECT c.id, n.id, 'confirmed', NOW()
FROM cars c, new_customer n WHERE c.vin = 'LDP95H968RE302211';

-- DIAB HICHAM NAHED
WITH new_customer AS (
  INSERT INTO customers (first_name, last_name, phone_primary, lead_status, lead_source, created_at, updated_at)
  VALUES ('Diab', 'Hicham Nahed', 'N/A', 'converted', 'walk_in', NOW(), NOW())
  RETURNING id
)
INSERT INTO sales_orders (car_id, customer_id, status, created_at)
SELECT c.id, n.id, 'confirmed', NOW()
FROM cars c, new_customer n WHERE c.vin = 'LDP95H963RE300365';

-- DR YOLANDE SALEM
WITH new_customer AS (
  INSERT INTO customers (first_name, last_name, phone_primary, lead_status, lead_source, created_at, updated_at)
  VALUES ('Dr', 'Yolande Salem', 'N/A', 'converted', 'walk_in', NOW(), NOW())
  RETURNING id
)
INSERT INTO sales_orders (car_id, customer_id, status, created_at)
SELECT c.id, n.id, 'confirmed', NOW()
FROM cars c, new_customer n WHERE c.vin = 'LDP95H961SE900274';

-- ELHAM KORKOMAZ
WITH new_customer AS (
  INSERT INTO customers (first_name, last_name, phone_primary, lead_status, lead_source, created_at, updated_at)
  VALUES ('Elham', 'Korkomaz', 'N/A', 'converted', 'walk_in', NOW(), NOW())
  RETURNING id
)
INSERT INTO sales_orders (car_id, customer_id, status, created_at)
SELECT c.id, n.id, 'confirmed', NOW()
FROM cars c, new_customer n WHERE c.vin = 'LDP95C967PE900581';

-- ELIE MEOUCHI
WITH new_customer AS (
  INSERT INTO customers (first_name, last_name, phone_primary, lead_status, lead_source, created_at, updated_at)
  VALUES ('Elie', 'Meouchi', 'N/A', 'converted', 'walk_in', NOW(), NOW())
  RETURNING id
)
INSERT INTO sales_orders (car_id, customer_id, status, created_at)
SELECT c.id, n.id, 'confirmed', NOW()
FROM cars c, new_customer n WHERE c.vin = 'LDP91C96XPE203420';

-- FADI ADRA / DARINE DANDACHLI
WITH new_customer AS (
  INSERT INTO customers (first_name, last_name, phone_primary, lead_status, lead_source, created_at, updated_at)
  VALUES ('Fadi', 'Adra / Darine Dandachli', 'N/A', 'converted', 'walk_in', NOW(), NOW())
  RETURNING id
)
INSERT INTO sales_orders (car_id, customer_id, status, created_at)
SELECT c.id, n.id, 'confirmed', NOW()
FROM cars c, new_customer n WHERE c.vin = 'LDP95H964SE900270';

-- FADI ASSI
WITH new_customer AS (
  INSERT INTO customers (first_name, last_name, phone_primary, lead_status, lead_source, created_at, updated_at)
  VALUES ('Fadi', 'Assi', 'N/A', 'converted', 'walk_in', NOW(), NOW())
  RETURNING id
)
INSERT INTO sales_orders (car_id, customer_id, status, created_at)
SELECT c.id, n.id, 'confirmed', NOW()
FROM cars c, new_customer n WHERE c.vin = 'LDP95H961RE300364';

-- FADI JIJI
WITH new_customer AS (
  INSERT INTO customers (first_name, last_name, phone_primary, lead_status, lead_source, created_at, updated_at)
  VALUES ('Fadi', 'Jiji', 'N/A', 'converted', 'walk_in', NOW(), NOW())
  RETURNING id
)
INSERT INTO sales_orders (car_id, customer_id, status, created_at)
SELECT c.id, n.id, 'confirmed', NOW()
FROM cars c, new_customer n WHERE c.vin = 'LDP95H966SE900254';

-- FAYEZ IMAD HAMOUDI
WITH new_customer AS (
  INSERT INTO customers (first_name, last_name, phone_primary, lead_status, lead_source, created_at, updated_at)
  VALUES ('Fayez', 'Imad Hamoudi', 'N/A', 'converted', 'walk_in', NOW(), NOW())
  RETURNING id
)
INSERT INTO sales_orders (car_id, customer_id, status, created_at)
SELECT c.id, n.id, 'confirmed', NOW()
FROM cars c, new_customer n WHERE c.vin = 'LDP95H961RE300963';

-- FAYSAL ABDALLAH
WITH new_customer AS (
  INSERT INTO customers (first_name, last_name, phone_primary, lead_status, lead_source, created_at, updated_at)
  VALUES ('Faysal', 'Abdallah', 'N/A', 'converted', 'walk_in', NOW(), NOW())
  RETURNING id
)
INSERT INTO sales_orders (car_id, customer_id, status, created_at)
SELECT c.id, n.id, 'confirmed', NOW()
FROM cars c, new_customer n WHERE c.vin = 'LDP91E967RE201901';

-- FOUAD FAHES
WITH new_customer AS (
  INSERT INTO customers (first_name, last_name, phone_primary, lead_status, lead_source, created_at, updated_at)
  VALUES ('Fouad', 'Fahes', 'N/A', 'converted', 'walk_in', NOW(), NOW())
  RETURNING id
)
INSERT INTO sales_orders (car_id, customer_id, status, created_at)
SELECT c.id, n.id, 'confirmed', NOW()
FROM cars c, new_customer n WHERE c.vin = 'LDP95H961TE900020';

-- FOUAD HALBAWI
WITH new_customer AS (
  INSERT INTO customers (first_name, last_name, phone_primary, lead_status, lead_source, created_at, updated_at)
  VALUES ('Fouad', 'Halbawi', 'N/A', 'converted', 'walk_in', NOW(), NOW())
  RETURNING id
)
INSERT INTO sales_orders (car_id, customer_id, status, created_at)
SELECT c.id, n.id, 'confirmed', NOW()
FROM cars c, new_customer n WHERE c.vin = 'LDP29H927RM520004';

-- GALINA ANATOLY SETSOKFISH / ALI JAMMAL
WITH new_customer AS (
  INSERT INTO customers (first_name, last_name, phone_primary, lead_status, lead_source, created_at, updated_at)
  VALUES ('Galina', 'Anatoly Setsokfish / Ali Jammal', 'N/A', 'converted', 'walk_in', NOW(), NOW())
  RETURNING id
)
INSERT INTO sales_orders (car_id, customer_id, status, created_at)
SELECT c.id, n.id, 'confirmed', NOW()
FROM cars c, new_customer n WHERE c.vin = 'LDP95H962RE300812';

-- GEORGES MAJDALANI
WITH new_customer AS (
  INSERT INTO customers (first_name, last_name, phone_primary, lead_status, lead_source, created_at, updated_at)
  VALUES ('Georges', 'Majdalani', 'N/A', 'converted', 'walk_in', NOW(), NOW())
  RETURNING id
)
INSERT INTO sales_orders (car_id, customer_id, status, created_at)
SELECT c.id, n.id, 'confirmed', NOW()
FROM cars c, new_customer n WHERE c.vin = 'LDP95H965TE900019';

-- H. E. SAQR GHOBASH SAED GHOBASH
WITH new_customer AS (
  INSERT INTO customers (first_name, last_name, phone_primary, lead_status, lead_source, created_at, updated_at)
  VALUES ('H.', 'E. Saqr Ghobash Saed Ghobash', 'N/A', 'converted', 'walk_in', NOW(), NOW())
  RETURNING id
)
INSERT INTO sales_orders (car_id, customer_id, status, created_at)
SELECT c.id, n.id, 'confirmed', NOW()
FROM cars c, new_customer n WHERE c.vin = 'LDP95H963RE104961';

-- HANADI ZORKTA
WITH new_customer AS (
  INSERT INTO customers (first_name, last_name, phone_primary, lead_status, lead_source, created_at, updated_at)
  VALUES ('Hanadi', 'Zorkta', 'N/A', 'converted', 'walk_in', NOW(), NOW())
  RETURNING id
)
INSERT INTO sales_orders (car_id, customer_id, status, created_at)
SELECT c.id, n.id, 'confirmed', NOW()
FROM cars c, new_customer n WHERE c.vin = 'LDP95C961SY890010';

-- HELMI HAREB
WITH new_customer AS (
  INSERT INTO customers (first_name, last_name, phone_primary, lead_status, lead_source, created_at, updated_at)
  VALUES ('Helmi', 'Hareb', 'N/A', 'converted', 'walk_in', NOW(), NOW())
  RETURNING id
)
INSERT INTO sales_orders (car_id, customer_id, status, created_at)
SELECT c.id, n.id, 'confirmed', NOW()
FROM cars c, new_customer n WHERE c.vin = 'LDP29H929SM520026';
INSERT INTO sales_orders (car_id, customer_id, status, created_at)
SELECT c.id, (SELECT id FROM customers WHERE first_name = 'Helmi' AND last_name = 'Hareb' ORDER BY created_at DESC LIMIT 1), 'confirmed', NOW()
FROM cars c WHERE c.vin = 'LDP95C964SY890096';

-- HILAL SAAB
WITH new_customer AS (
  INSERT INTO customers (first_name, last_name, phone_primary, lead_status, lead_source, created_at, updated_at)
  VALUES ('Hilal', 'Saab', 'N/A', 'converted', 'walk_in', NOW(), NOW())
  RETURNING id
)
INSERT INTO sales_orders (car_id, customer_id, status, created_at)
SELECT c.id, n.id, 'confirmed', NOW()
FROM cars c, new_customer n WHERE c.vin = 'LDP91E966SE100256';

-- HOUSSAM KHANJI
WITH new_customer AS (
  INSERT INTO customers (first_name, last_name, phone_primary, lead_status, lead_source, created_at, updated_at)
  VALUES ('Houssam', 'Khanji', 'N/A', 'converted', 'walk_in', NOW(), NOW())
  RETURNING id
)
INSERT INTO sales_orders (car_id, customer_id, status, created_at)
SELECT c.id, n.id, 'confirmed', NOW()
FROM cars c, new_customer n WHERE c.vin = 'LDP29H924SM520029';

-- HSEIN HOTEIT
WITH new_customer AS (
  INSERT INTO customers (first_name, last_name, phone_primary, lead_status, lead_source, created_at, updated_at)
  VALUES ('Hsein', 'Hoteit', 'N/A', 'converted', 'walk_in', NOW(), NOW())
  RETURNING id
)
INSERT INTO sales_orders (car_id, customer_id, status, created_at)
SELECT c.id, n.id, 'confirmed', NOW()
FROM cars c, new_customer n WHERE c.vin = 'LDP95H963RE300902';

-- HUSSEIN RAMADAN
WITH new_customer AS (
  INSERT INTO customers (first_name, last_name, phone_primary, lead_status, lead_source, created_at, updated_at)
  VALUES ('Hussein', 'Ramadan', 'N/A', 'converted', 'walk_in', NOW(), NOW())
  RETURNING id
)
INSERT INTO sales_orders (car_id, customer_id, status, created_at)
SELECT c.id, n.id, 'confirmed', NOW()
FROM cars c, new_customer n WHERE c.vin = 'LDP95H964SE900253';

-- ISSAM HELOU / NOUJOUD YAZIGI
WITH new_customer AS (
  INSERT INTO customers (first_name, last_name, phone_primary, lead_status, lead_source, created_at, updated_at)
  VALUES ('Issam', 'Helou / Noujoud Yazigi', 'N/A', 'converted', 'walk_in', NOW(), NOW())
  RETURNING id
)
INSERT INTO sales_orders (car_id, customer_id, status, created_at)
SELECT c.id, n.id, 'confirmed', NOW()
FROM cars c, new_customer n WHERE c.vin = 'LDP95H968SE900272';

-- JAAFAR HAMED
WITH new_customer AS (
  INSERT INTO customers (first_name, last_name, phone_primary, lead_status, lead_source, created_at, updated_at)
  VALUES ('Jaafar', 'Hamed', 'N/A', 'converted', 'walk_in', NOW(), NOW())
  RETURNING id
)
INSERT INTO sales_orders (car_id, customer_id, status, created_at)
SELECT c.id, n.id, 'confirmed', NOW()
FROM cars c, new_customer n WHERE c.vin = 'LDP95H966SE900268';

-- JABER JAFAR
WITH new_customer AS (
  INSERT INTO customers (first_name, last_name, phone_primary, lead_status, lead_source, created_at, updated_at)
  VALUES ('Jaber', 'Jafar', 'N/A', 'converted', 'walk_in', NOW(), NOW())
  RETURNING id
)
INSERT INTO sales_orders (car_id, customer_id, status, created_at)
SELECT c.id, n.id, 'confirmed', NOW()
FROM cars c, new_customer n WHERE c.vin = 'LDP95H962RE104949';

-- JAD AL ZAYLAA
WITH new_customer AS (
  INSERT INTO customers (first_name, last_name, phone_primary, lead_status, lead_source, created_at, updated_at)
  VALUES ('Jad', 'Al Zaylaa', 'N/A', 'converted', 'walk_in', NOW(), NOW())
  RETURNING id
)
INSERT INTO sales_orders (car_id, customer_id, status, created_at)
SELECT c.id, n.id, 'confirmed', NOW()
FROM cars c, new_customer n WHERE c.vin = 'LDP29H923TM520248';

-- JEAN ABI HAYDAR
WITH new_customer AS (
  INSERT INTO customers (first_name, last_name, phone_primary, lead_status, lead_source, created_at, updated_at)
  VALUES ('Jean', 'Abi Haydar', 'N/A', 'converted', 'walk_in', NOW(), NOW())
  RETURNING id
)
INSERT INTO sales_orders (car_id, customer_id, status, created_at)
SELECT c.id, n.id, 'confirmed', NOW()
FROM cars c, new_customer n WHERE c.vin = 'LDP95C962SY890095';

-- JIHAD EL KHOURY
WITH new_customer AS (
  INSERT INTO customers (first_name, last_name, phone_primary, lead_status, lead_source, created_at, updated_at)
  VALUES ('Jihad', 'El Khoury', 'N/A', 'converted', 'walk_in', NOW(), NOW())
  RETURNING id
)
INSERT INTO sales_orders (car_id, customer_id, status, created_at)
SELECT c.id, n.id, 'confirmed', NOW()
FROM cars c, new_customer n WHERE c.vin = 'LDP95H968SE900269';

-- JOANNA KHANJI
WITH new_customer AS (
  INSERT INTO customers (first_name, last_name, phone_primary, lead_status, lead_source, created_at, updated_at)
  VALUES ('Joanna', 'Khanji', 'N/A', 'converted', 'walk_in', NOW(), NOW())
  RETURNING id
)
INSERT INTO sales_orders (car_id, customer_id, status, created_at)
SELECT c.id, n.id, 'confirmed', NOW()
FROM cars c, new_customer n WHERE c.vin = 'LDP95H960RE302378';

-- JULIEN MICHEL HANNOUCH
WITH new_customer AS (
  INSERT INTO customers (first_name, last_name, phone_primary, lead_status, lead_source, created_at, updated_at)
  VALUES ('Julien', 'Michel Hannouch', 'N/A', 'converted', 'walk_in', NOW(), NOW())
  RETURNING id
)
INSERT INTO sales_orders (car_id, customer_id, status, created_at)
SELECT c.id, n.id, 'confirmed', NOW()
FROM cars c, new_customer n WHERE c.vin = 'LDP95H962SE900266';

-- KAREEM GEBARA
WITH new_customer AS (
  INSERT INTO customers (first_name, last_name, phone_primary, lead_status, lead_source, created_at, updated_at)
  VALUES ('Kareem', 'Gebara', 'N/A', 'converted', 'walk_in', NOW(), NOW())
  RETURNING id
)
INSERT INTO sales_orders (car_id, customer_id, status, created_at)
SELECT c.id, n.id, 'confirmed', NOW()
FROM cars c, new_customer n WHERE c.vin = 'LDP95H960RE300906';

-- KARIM SOUBRA
WITH new_customer AS (
  INSERT INTO customers (first_name, last_name, phone_primary, lead_status, lead_source, created_at, updated_at)
  VALUES ('Karim', 'Soubra', 'N/A', 'converted', 'walk_in', NOW(), NOW())
  RETURNING id
)
INSERT INTO sales_orders (car_id, customer_id, status, created_at)
SELECT c.id, n.id, 'confirmed', NOW()
FROM cars c, new_customer n WHERE c.vin = 'LDP95H965RE301744';

-- LEYLA SOUBRA
WITH new_customer AS (
  INSERT INTO customers (first_name, last_name, phone_primary, lead_status, lead_source, created_at, updated_at)
  VALUES ('Leyla', 'Soubra', 'N/A', 'converted', 'walk_in', NOW(), NOW())
  RETURNING id
)
INSERT INTO sales_orders (car_id, customer_id, status, created_at)
SELECT c.id, n.id, 'confirmed', NOW()
FROM cars c, new_customer n WHERE c.vin = 'LDP95H969SE900264';

-- LYNN HASSAN ATTIEH
WITH new_customer AS (
  INSERT INTO customers (first_name, last_name, phone_primary, lead_status, lead_source, created_at, updated_at)
  VALUES ('Lynn', 'Hassan Attieh', 'N/A', 'converted', 'walk_in', NOW(), NOW())
  RETURNING id
)
INSERT INTO sales_orders (car_id, customer_id, status, created_at)
SELECT c.id, n.id, 'confirmed', NOW()
FROM cars c, new_customer n WHERE c.vin = 'LDP95H963SE900261';

-- MAJED EID
WITH new_customer AS (
  INSERT INTO customers (first_name, last_name, phone_primary, lead_status, lead_source, created_at, updated_at)
  VALUES ('Majed', 'Eid', 'N/A', 'converted', 'walk_in', NOW(), NOW())
  RETURNING id
)
INSERT INTO sales_orders (car_id, customer_id, status, created_at)
SELECT c.id, n.id, 'confirmed', NOW()
FROM cars c, new_customer n WHERE c.vin = 'LDP29H920SM520030';

-- MAKRAM BOU HABIB
WITH new_customer AS (
  INSERT INTO customers (first_name, last_name, phone_primary, lead_status, lead_source, created_at, updated_at)
  VALUES ('Makram', 'Bou Habib', 'N/A', 'converted', 'walk_in', NOW(), NOW())
  RETURNING id
)
INSERT INTO sales_orders (car_id, customer_id, status, created_at)
SELECT c.id, n.id, 'confirmed', NOW()
FROM cars c, new_customer n WHERE c.vin = 'LDP29H927SM520011';

-- MARIANNE KHALAF
WITH new_customer AS (
  INSERT INTO customers (first_name, last_name, phone_primary, lead_status, lead_source, created_at, updated_at)
  VALUES ('Marianne', 'Khalaf', 'N/A', 'converted', 'walk_in', NOW(), NOW())
  RETURNING id
)
INSERT INTO sales_orders (car_id, customer_id, status, created_at)
SELECT c.id, n.id, 'confirmed', NOW()
FROM cars c, new_customer n WHERE c.vin = 'LDP95C964SY890017';

-- MARTAN BEIROUTI
WITH new_customer AS (
  INSERT INTO customers (first_name, last_name, phone_primary, lead_status, lead_source, created_at, updated_at)
  VALUES ('Martan', 'Beirouti', 'N/A', 'converted', 'walk_in', NOW(), NOW())
  RETURNING id
)
INSERT INTO sales_orders (car_id, customer_id, status, created_at)
SELECT c.id, n.id, 'confirmed', NOW()
FROM cars c, new_customer n WHERE c.vin = 'LDP29H928SM520017';

-- MARWAN JEHA
WITH new_customer AS (
  INSERT INTO customers (first_name, last_name, phone_primary, lead_status, lead_source, created_at, updated_at)
  VALUES ('Marwan', 'Jeha', 'N/A', 'converted', 'walk_in', NOW(), NOW())
  RETURNING id
)
INSERT INTO sales_orders (car_id, customer_id, status, created_at)
SELECT c.id, n.id, 'confirmed', NOW()
FROM cars c, new_customer n WHERE c.vin = 'LDP95C966SY890018';

-- MASHREQ HOSPITAL
WITH new_customer AS (
  INSERT INTO customers (first_name, last_name, phone_primary, lead_status, lead_source, created_at, updated_at)
  VALUES ('Mashreq', 'Hospital', 'N/A', 'converted', 'walk_in', NOW(), NOW())
  RETURNING id
)
INSERT INTO sales_orders (car_id, customer_id, status, created_at)
SELECT c.id, n.id, 'confirmed', NOW()
FROM cars c, new_customer n WHERE c.vin = 'LDP91E968RE201874';

-- MICHAEL ABDELNOUR
WITH new_customer AS (
  INSERT INTO customers (first_name, last_name, phone_primary, lead_status, lead_source, created_at, updated_at)
  VALUES ('Michael', 'Abdelnour', 'N/A', 'converted', 'walk_in', NOW(), NOW())
  RETURNING id
)
INSERT INTO sales_orders (car_id, customer_id, status, created_at)
SELECT c.id, n.id, 'confirmed', NOW()
FROM cars c, new_customer n WHERE c.vin = 'LDP95H965SE900276';

-- MILLENNIUM GROUP SERVICES SAL
WITH new_customer AS (
  INSERT INTO customers (first_name, last_name, phone_primary, lead_status, lead_source, created_at, updated_at)
  VALUES ('Millennium', 'Group Services Sal', 'N/A', 'converted', 'walk_in', NOW(), NOW())
  RETURNING id
)
INSERT INTO sales_orders (car_id, customer_id, status, created_at)
SELECT c.id, n.id, 'confirmed', NOW()
FROM cars c, new_customer n WHERE c.vin = 'LDP95H963SE009001';

-- MOHAMAD BSAT
WITH new_customer AS (
  INSERT INTO customers (first_name, last_name, phone_primary, lead_status, lead_source, created_at, updated_at)
  VALUES ('Mohamad', 'Bsat', 'N/A', 'converted', 'walk_in', NOW(), NOW())
  RETURNING id
)
INSERT INTO sales_orders (car_id, customer_id, status, created_at)
SELECT c.id, n.id, 'confirmed', NOW()
FROM cars c, new_customer n WHERE c.vin = 'LDP95H96XRE300900';

-- MOHAMAD CHAER
WITH new_customer AS (
  INSERT INTO customers (first_name, last_name, phone_primary, lead_status, lead_source, created_at, updated_at)
  VALUES ('Mohamad', 'Chaer', 'N/A', 'converted', 'walk_in', NOW(), NOW())
  RETURNING id
)
INSERT INTO sales_orders (car_id, customer_id, status, created_at)
SELECT c.id, n.id, 'confirmed', NOW()
FROM cars c, new_customer n WHERE c.vin = 'LDP29H927SM520025';

-- MOHAMAD ITANI
WITH new_customer AS (
  INSERT INTO customers (first_name, last_name, phone_primary, lead_status, lead_source, created_at, updated_at)
  VALUES ('Mohamad', 'Itani', 'N/A', 'converted', 'walk_in', NOW(), NOW())
  RETURNING id
)
INSERT INTO sales_orders (car_id, customer_id, status, created_at)
SELECT c.id, n.id, 'confirmed', NOW()
FROM cars c, new_customer n WHERE c.vin = 'LDP95H961RE300915';

-- MOHAMAD JOMAA
WITH new_customer AS (
  INSERT INTO customers (first_name, last_name, phone_primary, lead_status, lead_source, created_at, updated_at)
  VALUES ('Mohamad', 'Jomaa', 'N/A', 'converted', 'walk_in', NOW(), NOW())
  RETURNING id
)
INSERT INTO sales_orders (car_id, customer_id, status, created_at)
SELECT c.id, n.id, 'confirmed', NOW()
FROM cars c, new_customer n WHERE c.vin = 'LDP95H965RE104945';

-- MOHAMAD KAFAL
WITH new_customer AS (
  INSERT INTO customers (first_name, last_name, phone_primary, lead_status, lead_source, created_at, updated_at)
  VALUES ('Mohamad', 'Kafal', 'N/A', 'converted', 'walk_in', NOW(), NOW())
  RETURNING id
)
INSERT INTO sales_orders (car_id, customer_id, status, created_at)
SELECT c.id, n.id, 'confirmed', NOW()
FROM cars c, new_customer n WHERE c.vin = 'LDP95H963SE900258';

-- MOHAMAD SALAMEH / DANIA NASSER
WITH new_customer AS (
  INSERT INTO customers (first_name, last_name, phone_primary, lead_status, lead_source, created_at, updated_at)
  VALUES ('Mohamad', 'Salameh / Dania Nasser', 'N/A', 'converted', 'walk_in', NOW(), NOW())
  RETURNING id
)
INSERT INTO sales_orders (car_id, customer_id, status, created_at)
SELECT c.id, n.id, 'confirmed', NOW()
FROM cars c, new_customer n WHERE c.vin = 'LDP95H966RE301848';

-- MOHAMAD SUKKAR
WITH new_customer AS (
  INSERT INTO customers (first_name, last_name, phone_primary, lead_status, lead_source, created_at, updated_at)
  VALUES ('Mohamad', 'Sukkar', 'N/A', 'converted', 'walk_in', NOW(), NOW())
  RETURNING id
)
INSERT INTO sales_orders (car_id, customer_id, status, created_at)
SELECT c.id, n.id, 'confirmed', NOW()
FROM cars c, new_customer n WHERE c.vin = 'LDP29H928SM520020';

-- MONZA SAL / COMPANY CAR
WITH new_customer AS (
  INSERT INTO customers (first_name, last_name, phone_primary, lead_status, lead_source, created_at, updated_at)
  VALUES ('Monza', 'Sal / Company Car', 'N/A', 'converted', 'walk_in', NOW(), NOW())
  RETURNING id
)
INSERT INTO sales_orders (car_id, customer_id, status, created_at)
SELECT c.id, n.id, 'confirmed', NOW()
FROM cars c, new_customer n WHERE c.vin = 'LDP91E965RE201864';

-- NADA SAAB
WITH new_customer AS (
  INSERT INTO customers (first_name, last_name, phone_primary, lead_status, lead_source, created_at, updated_at)
  VALUES ('Nada', 'Saab', 'N/A', 'converted', 'walk_in', NOW(), NOW())
  RETURNING id
)
INSERT INTO sales_orders (car_id, customer_id, status, created_at)
SELECT c.id, n.id, 'confirmed', NOW()
FROM cars c, new_customer n WHERE c.vin = 'LDP95H963PE309631';

-- NADIM KARAM
WITH new_customer AS (
  INSERT INTO customers (first_name, last_name, phone_primary, lead_status, lead_source, created_at, updated_at)
  VALUES ('Nadim', 'Karam', 'N/A', 'converted', 'walk_in', NOW(), NOW())
  RETURNING id
)
INSERT INTO sales_orders (car_id, customer_id, status, created_at)
SELECT c.id, n.id, 'confirmed', NOW()
FROM cars c, new_customer n WHERE c.vin = 'LDP95H962SE900252';

-- NAJI GEHA
WITH new_customer AS (
  INSERT INTO customers (first_name, last_name, phone_primary, lead_status, lead_source, created_at, updated_at)
  VALUES ('Naji', 'Geha', 'N/A', 'converted', 'walk_in', NOW(), NOW())
  RETURNING id
)
INSERT INTO sales_orders (car_id, customer_id, status, created_at)
SELECT c.id, n.id, 'confirmed', NOW()
FROM cars c, new_customer n WHERE c.vin = 'LDP95C965SY890009';

-- NANCY KHANJI
WITH new_customer AS (
  INSERT INTO customers (first_name, last_name, phone_primary, lead_status, lead_source, created_at, updated_at)
  VALUES ('Nancy', 'Khanji', 'N/A', 'converted', 'walk_in', NOW(), NOW())
  RETURNING id
)
INSERT INTO sales_orders (car_id, customer_id, status, created_at)
SELECT c.id, n.id, 'confirmed', NOW()
FROM cars c, new_customer n WHERE c.vin = 'LDP95H965SE900262';

-- NASSER AL EK
WITH new_customer AS (
  INSERT INTO customers (first_name, last_name, phone_primary, lead_status, lead_source, created_at, updated_at)
  VALUES ('Nasser', 'Al Ek', 'N/A', 'converted', 'walk_in', NOW(), NOW())
  RETURNING id
)
INSERT INTO sales_orders (car_id, customer_id, status, created_at)
SELECT c.id, n.id, 'confirmed', NOW()
FROM cars c, new_customer n WHERE c.vin = 'LDP95H962SE900249';

-- OMAR AKAR
WITH new_customer AS (
  INSERT INTO customers (first_name, last_name, phone_primary, lead_status, lead_source, created_at, updated_at)
  VALUES ('Omar', 'Akar', 'N/A', 'converted', 'walk_in', NOW(), NOW())
  RETURNING id
)
INSERT INTO sales_orders (car_id, customer_id, status, created_at)
SELECT c.id, n.id, 'confirmed', NOW()
FROM cars c, new_customer n WHERE c.vin = 'LDP29H926TM520082';

-- OUSSAMA CHOUCAIR / PATCHI
WITH new_customer AS (
  INSERT INTO customers (first_name, last_name, phone_primary, lead_status, lead_source, created_at, updated_at)
  VALUES ('Oussama', 'Choucair / Patchi', 'N/A', 'converted', 'walk_in', NOW(), NOW())
  RETURNING id
)
INSERT INTO sales_orders (car_id, customer_id, status, created_at)
SELECT c.id, n.id, 'confirmed', NOW()
FROM cars c, new_customer n WHERE c.vin = 'LDP91E964RE201869';

-- PIERRE EL ACHKAR
WITH new_customer AS (
  INSERT INTO customers (first_name, last_name, phone_primary, lead_status, lead_source, created_at, updated_at)
  VALUES ('Pierre', 'El Achkar', 'N/A', 'converted', 'walk_in', NOW(), NOW())
  RETURNING id
)
INSERT INTO sales_orders (car_id, customer_id, status, created_at)
SELECT c.id, n.id, 'confirmed', NOW()
FROM cars c, new_customer n WHERE c.vin = 'LDP95H968SE900255';

-- RABIH MEZHER
WITH new_customer AS (
  INSERT INTO customers (first_name, last_name, phone_primary, lead_status, lead_source, created_at, updated_at)
  VALUES ('Rabih', 'Mezher', 'N/A', 'converted', 'walk_in', NOW(), NOW())
  RETURNING id
)
INSERT INTO sales_orders (car_id, customer_id, status, created_at)
SELECT c.id, n.id, 'confirmed', NOW()
FROM cars c, new_customer n WHERE c.vin = 'LDP29H921SM520019';

-- RACHID DERBAS
WITH new_customer AS (
  INSERT INTO customers (first_name, last_name, phone_primary, lead_status, lead_source, created_at, updated_at)
  VALUES ('Rachid', 'Derbas', 'N/A', 'converted', 'walk_in', NOW(), NOW())
  RETURNING id
)
INSERT INTO sales_orders (car_id, customer_id, status, created_at)
SELECT c.id, n.id, 'confirmed', NOW()
FROM cars c, new_customer n WHERE c.vin = 'LDP91C96XPE203188';
INSERT INTO sales_orders (car_id, customer_id, status, created_at)
SELECT c.id, (SELECT id FROM customers WHERE first_name = 'Rachid' AND last_name = 'Derbas' ORDER BY created_at DESC LIMIT 1), 'confirmed', NOW()
FROM cars c WHERE c.vin = 'LDP95H960SE900251';

-- RAKAN ABDEL WAHAB / DARI MOUTAWAA
WITH new_customer AS (
  INSERT INTO customers (first_name, last_name, phone_primary, lead_status, lead_source, created_at, updated_at)
  VALUES ('Rakan', 'Abdel Wahab / Dari Moutawaa', 'N/A', 'converted', 'walk_in', NOW(), NOW())
  RETURNING id
)
INSERT INTO sales_orders (car_id, customer_id, status, created_at)
SELECT c.id, n.id, 'confirmed', NOW()
FROM cars c, new_customer n WHERE c.vin = 'LDP91E963RE201782';

-- RAMI KADDOURA
WITH new_customer AS (
  INSERT INTO customers (first_name, last_name, phone_primary, lead_status, lead_source, created_at, updated_at)
  VALUES ('Rami', 'Kaddoura', 'N/A', 'converted', 'walk_in', NOW(), NOW())
  RETURNING id
)
INSERT INTO sales_orders (car_id, customer_id, status, created_at)
SELECT c.id, n.id, 'confirmed', NOW()
FROM cars c, new_customer n WHERE c.vin = 'LDP95H969RE104950';

-- RAMI KOTEICHE
WITH new_customer AS (
  INSERT INTO customers (first_name, last_name, phone_primary, lead_status, lead_source, created_at, updated_at)
  VALUES ('Rami', 'Koteiche', 'N/A', 'converted', 'walk_in', NOW(), NOW())
  RETURNING id
)
INSERT INTO sales_orders (car_id, customer_id, status, created_at)
SELECT c.id, n.id, 'confirmed', NOW()
FROM cars c, new_customer n WHERE c.vin = 'LDP95H96XSE900256';

-- RAMZI ZAYDAN
WITH new_customer AS (
  INSERT INTO customers (first_name, last_name, phone_primary, lead_status, lead_source, created_at, updated_at)
  VALUES ('Ramzi', 'Zaydan', 'N/A', 'converted', 'walk_in', NOW(), NOW())
  RETURNING id
)
INSERT INTO sales_orders (car_id, customer_id, status, created_at)
SELECT c.id, n.id, 'confirmed', NOW()
FROM cars c, new_customer n WHERE c.vin = 'LDP95H961SE900257';

-- RICHARD JOSE HACHEM
WITH new_customer AS (
  INSERT INTO customers (first_name, last_name, phone_primary, lead_status, lead_source, created_at, updated_at)
  VALUES ('Richard', 'Jose Hachem', 'N/A', 'converted', 'walk_in', NOW(), NOW())
  RETURNING id
)
INSERT INTO sales_orders (car_id, customer_id, status, created_at)
SELECT c.id, n.id, 'confirmed', NOW()
FROM cars c, new_customer n WHERE c.vin = 'LDP29H926SM520016';

-- RONI ABOU KHALIL
WITH new_customer AS (
  INSERT INTO customers (first_name, last_name, phone_primary, lead_status, lead_source, created_at, updated_at)
  VALUES ('Roni', 'Abou Khalil', 'N/A', 'converted', 'walk_in', NOW(), NOW())
  RETURNING id
)
INSERT INTO sales_orders (car_id, customer_id, status, created_at)
SELECT c.id, n.id, 'confirmed', NOW()
FROM cars c, new_customer n WHERE c.vin = 'LDP95H963SE900275';

-- ROYAL FINANCIALS SAL
WITH new_customer AS (
  INSERT INTO customers (first_name, last_name, phone_primary, lead_status, lead_source, created_at, updated_at)
  VALUES ('Royal', 'Financials Sal', 'N/A', 'converted', 'walk_in', NOW(), NOW())
  RETURNING id
)
INSERT INTO sales_orders (car_id, customer_id, status, created_at)
SELECT c.id, n.id, 'confirmed', NOW()
FROM cars c, new_customer n WHERE c.vin = 'LDP95H968RE300359';

-- SALAM CHARAFELDINE
WITH new_customer AS (
  INSERT INTO customers (first_name, last_name, phone_primary, lead_status, lead_source, created_at, updated_at)
  VALUES ('Salam', 'Charafeldine', 'N/A', 'converted', 'walk_in', NOW(), NOW())
  RETURNING id
)
INSERT INTO sales_orders (car_id, customer_id, status, created_at)
SELECT c.id, n.id, 'confirmed', NOW()
FROM cars c, new_customer n WHERE c.vin = 'LDP91E969RE201785';

-- SALEH TSABAHJI
WITH new_customer AS (
  INSERT INTO customers (first_name, last_name, phone_primary, lead_status, lead_source, created_at, updated_at)
  VALUES ('Saleh', 'Tsabahji', 'N/A', 'converted', 'walk_in', NOW(), NOW())
  RETURNING id
)
INSERT INTO sales_orders (car_id, customer_id, status, created_at)
SELECT c.id, n.id, 'confirmed', NOW()
FROM cars c, new_customer n WHERE c.vin = 'LDP95H966TE905004';

-- SAMER ALI HASSAN
WITH new_customer AS (
  INSERT INTO customers (first_name, last_name, phone_primary, lead_status, lead_source, created_at, updated_at)
  VALUES ('Samer', 'Ali Hassan', 'N/A', 'converted', 'walk_in', NOW(), NOW())
  RETURNING id
)
INSERT INTO sales_orders (car_id, customer_id, status, created_at)
SELECT c.id, n.id, 'confirmed', NOW()
FROM cars c, new_customer n WHERE c.vin = 'LDP95H96XRE300816';

-- SAMER KHANJI
WITH new_customer AS (
  INSERT INTO customers (first_name, last_name, phone_primary, lead_status, lead_source, created_at, updated_at)
  VALUES ('Samer', 'Khanji', 'N/A', 'converted', 'walk_in', NOW(), NOW())
  RETURNING id
)
INSERT INTO sales_orders (car_id, customer_id, status, created_at)
SELECT c.id, n.id, 'confirmed', NOW()
FROM cars c, new_customer n WHERE c.vin = 'LDP95C967SY890058';

-- SAMER SAAB
WITH new_customer AS (
  INSERT INTO customers (first_name, last_name, phone_primary, lead_status, lead_source, created_at, updated_at)
  VALUES ('Samer', 'Saab', 'N/A', 'converted', 'walk_in', NOW(), NOW())
  RETURNING id
)
INSERT INTO sales_orders (car_id, customer_id, status, created_at)
SELECT c.id, n.id, 'confirmed', NOW()
FROM cars c, new_customer n WHERE c.vin = 'LDP95H960RE301828';

-- SAMI WEHBE
WITH new_customer AS (
  INSERT INTO customers (first_name, last_name, phone_primary, lead_status, lead_source, created_at, updated_at)
  VALUES ('Sami', 'Wehbe', 'N/A', 'converted', 'walk_in', NOW(), NOW())
  RETURNING id
)
INSERT INTO sales_orders (car_id, customer_id, status, created_at)
SELECT c.id, n.id, 'confirmed', NOW()
FROM cars c, new_customer n WHERE c.vin = 'LDP29H922TM520242';

-- SAMIR HADDAD
WITH new_customer AS (
  INSERT INTO customers (first_name, last_name, phone_primary, lead_status, lead_source, created_at, updated_at)
  VALUES ('Samir', 'Haddad', 'N/A', 'converted', 'walk_in', NOW(), NOW())
  RETURNING id
)
INSERT INTO sales_orders (car_id, customer_id, status, created_at)
SELECT c.id, n.id, 'confirmed', NOW()
FROM cars c, new_customer n WHERE c.vin = 'LDP91E968RE201857';

-- TAREK & SARA KAADAN
WITH new_customer AS (
  INSERT INTO customers (first_name, last_name, phone_primary, lead_status, lead_source, created_at, updated_at)
  VALUES ('Tarek', '& Sara Kaadan', 'N/A', 'converted', 'walk_in', NOW(), NOW())
  RETURNING id
)
INSERT INTO sales_orders (car_id, customer_id, status, created_at)
SELECT c.id, n.id, 'confirmed', NOW()
FROM cars c, new_customer n WHERE c.vin = 'LDP95H965RE300366';

-- TAREK AHMAD MOURAD / RAMI HALAWANI
WITH new_customer AS (
  INSERT INTO customers (first_name, last_name, phone_primary, lead_status, lead_source, created_at, updated_at)
  VALUES ('Tarek', 'Ahmad Mourad / Rami Halawani', 'N/A', 'converted', 'walk_in', NOW(), NOW())
  RETURNING id
)
INSERT INTO sales_orders (car_id, customer_id, status, created_at)
SELECT c.id, n.id, 'confirmed', NOW()
FROM cars c, new_customer n WHERE c.vin = 'LDP29H921SM520022';

-- TAREK DARWICH
WITH new_customer AS (
  INSERT INTO customers (first_name, last_name, phone_primary, lead_status, lead_source, created_at, updated_at)
  VALUES ('Tarek', 'Darwich', 'N/A', 'converted', 'walk_in', NOW(), NOW())
  RETURNING id
)
INSERT INTO sales_orders (car_id, customer_id, status, created_at)
SELECT c.id, n.id, 'confirmed', NOW()
FROM cars c, new_customer n WHERE c.vin = 'LDP95H964SE900267';

-- VIVIANE RIZK MAALOUF
WITH new_customer AS (
  INSERT INTO customers (first_name, last_name, phone_primary, lead_status, lead_source, created_at, updated_at)
  VALUES ('Viviane', 'Rizk Maalouf', 'N/A', 'converted', 'walk_in', NOW(), NOW())
  RETURNING id
)
INSERT INTO sales_orders (car_id, customer_id, status, created_at)
SELECT c.id, n.id, 'confirmed', NOW()
FROM cars c, new_customer n WHERE c.vin = 'LDP29H925SM520024';

-- WAEL HOMSI
WITH new_customer AS (
  INSERT INTO customers (first_name, last_name, phone_primary, lead_status, lead_source, created_at, updated_at)
  VALUES ('Wael', 'Homsi', 'N/A', 'converted', 'walk_in', NOW(), NOW())
  RETURNING id
)
INSERT INTO sales_orders (car_id, customer_id, status, created_at)
SELECT c.id, n.id, 'confirmed', NOW()
FROM cars c, new_customer n WHERE c.vin = 'LDP95H967RE300367';

-- WASSIM KFOURY
WITH new_customer AS (
  INSERT INTO customers (first_name, last_name, phone_primary, lead_status, lead_source, created_at, updated_at)
  VALUES ('Wassim', 'Kfoury', 'N/A', 'converted', 'walk_in', NOW(), NOW())
  RETURNING id
)
INSERT INTO sales_orders (car_id, customer_id, status, created_at)
SELECT c.id, n.id, 'confirmed', NOW()
FROM cars c, new_customer n WHERE c.vin = 'LDP29H923RM500333';

-- WATERMASTER / NATHALIE BOUEIRY
WITH new_customer AS (
  INSERT INTO customers (first_name, last_name, phone_primary, lead_status, lead_source, created_at, updated_at)
  VALUES ('Watermaster', '/ Nathalie Boueiry', 'N/A', 'converted', 'walk_in', NOW(), NOW())
  RETURNING id
)
INSERT INTO sales_orders (car_id, customer_id, status, created_at)
SELECT c.id, n.id, 'confirmed', NOW()
FROM cars c, new_customer n WHERE c.vin = 'LDP95C962SY890016';

-- WISSAM BOU HABIB
WITH new_customer AS (
  INSERT INTO customers (first_name, last_name, phone_primary, lead_status, lead_source, created_at, updated_at)
  VALUES ('Wissam', 'Bou Habib', 'N/A', 'converted', 'walk_in', NOW(), NOW())
  RETURNING id
)
INSERT INTO sales_orders (car_id, customer_id, status, created_at)
SELECT c.id, n.id, 'confirmed', NOW()
FROM cars c, new_customer n WHERE c.vin = 'LDP95H966SE900271';

-- ZAREH KHEDERLARIAN
WITH new_customer AS (
  INSERT INTO customers (first_name, last_name, phone_primary, lead_status, lead_source, created_at, updated_at)
  VALUES ('Zareh', 'Khederlarian', 'N/A', 'converted', 'walk_in', NOW(), NOW())
  RETURNING id
)
INSERT INTO sales_orders (car_id, customer_id, status, created_at)
SELECT c.id, n.id, 'confirmed', NOW()
FROM cars c, new_customer n WHERE c.vin = 'LDP95H96XRE302209';

-- ZEINA MICHEL CHEBIB
WITH new_customer AS (
  INSERT INTO customers (first_name, last_name, phone_primary, lead_status, lead_source, created_at, updated_at)
  VALUES ('Zeina', 'Michel Chebib', 'N/A', 'converted', 'walk_in', NOW(), NOW())
  RETURNING id
)
INSERT INTO sales_orders (car_id, customer_id, status, created_at)
SELECT c.id, n.id, 'confirmed', NOW()
FROM cars c, new_customer n WHERE c.vin = 'LDP29H922SM520014';

-- ZIAD EL SAYED
WITH new_customer AS (
  INSERT INTO customers (first_name, last_name, phone_primary, lead_status, lead_source, created_at, updated_at)
  VALUES ('Ziad', 'El Sayed', 'N/A', 'converted', 'walk_in', NOW(), NOW())
  RETURNING id
)
INSERT INTO sales_orders (car_id, customer_id, status, created_at)
SELECT c.id, n.id, 'confirmed', NOW()
FROM cars c, new_customer n WHERE c.vin = 'LDP95H967RE302345';

-- ZUHEIR AL ZAGHIR
WITH new_customer AS (
  INSERT INTO customers (first_name, last_name, phone_primary, lead_status, lead_source, created_at, updated_at)
  VALUES ('Zuheir', 'Al Zaghir', 'N/A', 'converted', 'walk_in', NOW(), NOW())
  RETURNING id
)
INSERT INTO sales_orders (car_id, customer_id, status, created_at)
SELECT c.id, n.id, 'confirmed', NOW()
FROM cars c, new_customer n WHERE c.vin = 'LDP95H963RE302388';

COMMIT;
