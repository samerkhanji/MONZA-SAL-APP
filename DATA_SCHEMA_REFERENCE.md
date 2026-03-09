# MONZA CRM — Complete Data Schema Reference

Use this document to translate old data into MONZA CRM, see what’s missing, and fill it in.

---

## Table of Contents
1. [Cars (Vehicle Inventory)](#1-cars)
2. [Car Events (Audit Trail)](#2-car_events)
3. [Car Documents](#3-car_documents)
4. [Customers](#4-customers)
5. [Customer Notes](#5-customer_notes)
6. [Customer Documents](#6-customer_documents)
7. [Sales Orders](#7-sales_orders)
8. [Profiles (Team/Users)](#8-profiles)
9. [Parts](#9-parts)
10. [Part Movements](#10-part_movements)
11. [Garage Jobs](#11-garage_jobs)
12. [Job Parts](#12-job_parts)
13. [Job Documents](#13-job_documents)
14. [Requests (Request Center)](#14-requests)
15. [Request Attachments](#15-request_attachments)
16. [Delete Requests](#16-delete_requests)
17. [Document Access Requests](#17-document_access_requests)
18. [Page Access Requests](#18-page_access_requests)
19. [Notifications](#19-notifications)
20. [Push Subscriptions](#20-push_subscriptions)
21. [System Preferences](#21-system_preferences)
22. [Tracking Tables](#22-tracking-tables)
23. [Storage Buckets (Files)](#23-storage-buckets)
24. [Allowed Values (Enums)](#24-allowed-values-enums)

---

## 1. cars

| Column | Type | Required | Notes |
|--------|------|----------|-------|
| id | UUID | Auto | Primary key |
| vin | TEXT | ✓ | 17 chars, UNIQUE |
| plate_number | TEXT | | UNIQUE |
| sub_dealer_name | TEXT | | For `sent_to_sub_dealer` |
| brand | TEXT | ✓ | e.g. Voyah, MHero |
| model | TEXT | ✓ | |
| model_year | INTEGER | | |
| exterior_color | TEXT | | |
| interior_color | TEXT | | |
| status | car_status | ✓ | See [Car Status](#car-status) |
| issue | TEXT | | |
| software_update | TEXT | | |
| dongle | TEXT | | |
| sold_marker | TEXT | | e.g. "X" |
| suffix | TEXT | | |
| engine_number | TEXT | | |
| client_name | TEXT | | |
| delivery_date | DATE | | ISO date string |
| client_phone | TEXT | | |
| reserved_by | TEXT | | |
| reservation_date | DATE | | |
| location_type | location_type | ✓ | See [Location Type](#location-type) |
| location_slot | TEXT | | e.g. "S1-R3-C12" |
| location_floor | TEXT | | |
| battery_percent | INTEGER | | 0–100 |
| ev_range_km | INTEGER | | |
| motor | TEXT | | |
| is_erev | BOOLEAN | | |
| ev_km | INTEGER | | |
| motor_km | INTEGER | | |
| software_version | TEXT | | |
| pdi_status | pdi_status | ✓ | See [PDI Status](#pdi-status) |
| current_km | INTEGER | | |
| date_arrived | DATE | | |
| location_changed_at | TIMESTAMPTZ | | |
| status_changed_at | TIMESTAMPTZ | | |
| price | NUMERIC | | |
| price_currency | TEXT | | |
| warranty_expiry | DATE | | |
| warranty_per_dms | TEXT | | |
| warranty_monza_start_date | DATE | | |
| customs_status | customs_status | | See [Customs Status](#customs-status) |
| customs_amount_paid | NUMERIC | | |
| customs_amount_currency | TEXT | | |
| notes | TEXT | | |
| deleted_at | TIMESTAMPTZ | | Soft delete |
| created_at | TIMESTAMPTZ | ✓ | |
| updated_at | TIMESTAMPTZ | ✓ | |
| created_by | UUID | | → auth.users |

---

## 2. car_events

| Column | Type | Required | Notes |
|--------|------|----------|-------|
| id | UUID | Auto | Primary key |
| car_id | UUID | ✓ | → cars(id) |
| event_type | car_event_type | ✓ | See [Car Event Type](#car-event-type) |
| from_value | TEXT | | |
| to_value | TEXT | | |
| note | TEXT | | |
| meta | JSONB | | |
| created_by | UUID | | → auth.users |
| created_at | TIMESTAMPTZ | ✓ | |

---

## 3. car_documents

| Column | Type | Required | Notes |
|--------|------|----------|-------|
| id | UUID | Auto | Primary key |
| car_id | UUID | ✓ | → cars(id) |
| document_type | TEXT | ✓ | `pdi` or `job_card` |
| file_name | TEXT | ✓ | |
| storage_path | TEXT | ✓ | Path in bucket |
| file_size_bytes | INTEGER | | |
| uploaded_at | TIMESTAMPTZ | ✓ | |
| uploaded_by | UUID | | → profiles(id) |

Files stored in storage bucket: `car-documents`

---

## 4. customers

| Column | Type | Required | Notes |
|--------|------|----------|-------|
| id | UUID | Auto | Primary key |
| first_name | TEXT | ✓ | |
| last_name | TEXT | | |
| phone_primary | TEXT | ✓ | |
| phone_secondary | TEXT | | |
| email | TEXT | | |
| preferred_language | TEXT | | e.g. `en`, `ar` |
| lead_status | lead_status | ✓ | See [Lead Status](#lead-status) |
| lead_source | lead_source | | See [Lead Source](#lead-source) |
| company | TEXT | | |
| address | TEXT | | |
| date_of_birth | DATE | | |
| notes | TEXT | | |
| last_visit_date | DATE | | |
| deleted_at | TIMESTAMPTZ | | Soft delete |
| created_at | TIMESTAMPTZ | ✓ | |
| updated_at | TIMESTAMPTZ | ✓ | |
| created_by | UUID | | → auth.users |

---

## 5. customer_notes

| Column | Type | Required | Notes |
|--------|------|----------|-------|
| id | UUID | Auto | Primary key |
| customer_id | UUID | ✓ | → customers(id) |
| note_type | TEXT | ✓ | e.g. general, call, visit |
| content | TEXT | ✓ | |
| created_by | UUID | | → auth.users |
| created_at | TIMESTAMPTZ | ✓ | |

---

## 6. customer_documents

| Column | Type | Required | Notes |
|--------|------|----------|-------|
| id | UUID | Auto | Primary key |
| customer_id | UUID | ✓ | → customers(id) |
| document_type | TEXT | ✓ | |
| file_name | TEXT | ✓ | |
| file_path | TEXT | ✓ | Storage path |
| file_size | INTEGER | | |
| uploaded_by | UUID | | → profiles(id) |
| created_at | TIMESTAMPTZ | ✓ | |

Files stored in storage bucket: `customer-documents`

---

## 7. sales_orders

| Column | Type | Required | Notes |
|--------|------|----------|-------|
| id | UUID | Auto | Primary key |
| car_id | UUID | ✓ | → cars(id) |
| customer_id | UUID | ✓ | → customers(id) |
| status | TEXT | ✓ | `reserved` or `confirmed` (for sold) |
| selling_price | NUMERIC | | |
| currency | TEXT | | e.g. USD |
| sale_date | DATE | | |
| delivery_date | DATE | | |
| reserved_until | DATE | | For reservations (legacy end date) |
| reservation_date | DATE | | When the reservation was created (optional) |
| reserved_by | TEXT | | Who reserved the car (free text or staff name) |
| deposit_amount | NUMERIC | | |
| notes | TEXT | | |
| created_by | UUID | | → auth.users |
| created_at | TIMESTAMPTZ | ✓ | |

---

## 8. profiles

Linked to Supabase `auth.users`. Created/updated via auth triggers or manual setup.

| Column | Type | Required | Notes |
|--------|------|----------|-------|
| id | UUID | ✓ | Same as auth.users(id) |
| full_name | TEXT | ✓ | |
| phone | TEXT | | |
| role | TEXT | ✓ | See [User Role](#user-role) |
| capabilities | TEXT[] | | See [User Capability](#user-capability) |
| is_active | BOOLEAN | ✓ | Default true |

---

## 9. parts

| Column | Type | Required | Notes |
|--------|------|----------|-------|
| id | UUID | Auto | Primary key |
| part_name | TEXT | ✓ | |
| oe_number | TEXT | | Part/OE number |
| car_model | TEXT | | e.g. General, Voyah Passion |
| description | TEXT | | |
| quantity | INTEGER | ✓ | Default 0 |
| min_quantity | INTEGER | ✓ | Default 2 |
| storage_zone | TEXT | | e.g. A1-B2 |
| supplier | TEXT | | |
| supplier_contact | TEXT | | |
| unit_cost | NUMERIC | | |
| currency | TEXT | | e.g. USD |
| order_date | TEXT | | Date string (Arrived Date in UI) |
| status | part_status | ✓ | See [Part Status](#part-status) |
| notes | TEXT | | |
| deleted_at | TIMESTAMPTZ | | Soft delete |
| created_at | TIMESTAMPTZ | ✓ | |
| updated_at | TIMESTAMPTZ | ✓ | |
| created_by | UUID | | → auth.users |

**Parts Import Excel columns:** Part Name, OE Number, Car Model, Quantity, Min Quantity, Storage Zone, Supplier, Unit Cost, Currency, Arrived Date (or Order Date), Notes

---

## 10. part_movements

| Column | Type | Required | Notes |
|--------|------|----------|-------|
| id | UUID | Auto | Primary key |
| part_id | UUID | ✓ | → parts(id) |
| movement_type | movement_type | ✓ | See [Movement Type](#movement-type) |
| quantity | INTEGER | ✓ | |
| car_id | UUID | | → cars(id) |
| job_description | TEXT | | |
| note | TEXT | | |
| created_by | UUID | | → auth.users |
| created_at | TIMESTAMPTZ | ✓ | |

---

## 11. garage_jobs

| Column | Type | Required | Notes |
|--------|------|----------|-------|
| id | UUID | Auto | Primary key |
| car_id | UUID | ✓ | → cars(id) |
| title | TEXT | ✓ | Reason of visit |
| description | TEXT | | |
| priority | job_priority | ✓ | See [Job Priority](#job-priority) |
| status | job_status | ✓ | See [Job Status](#job-status) |
| assigned_to | UUID | | → profiles(id) |
| diagnosis | TEXT | | |
| work_done | TEXT | | |
| estimated_hours | NUMERIC | | |
| actual_hours | NUMERIC | | |
| started_at | TIMESTAMPTZ | | |
| completed_at | TIMESTAMPTZ | | |
| delivered_at | TIMESTAMPTZ | | |
| overtime_notified | BOOLEAN | | |
| due_date | DATE | | Day to be serviced |
| customer_id | UUID | | → customers(id) |
| notes | TEXT | | |
| deleted_at | TIMESTAMPTZ | | Soft delete |
| created_at | TIMESTAMPTZ | ✓ | |
| updated_at | TIMESTAMPTZ | ✓ | |
| created_by | UUID | | → auth.users |

---

## 12. job_parts

| Column | Type | Required | Notes |
|--------|------|----------|-------|
| id | UUID | Auto | Primary key |
| job_id | UUID | ✓ | → garage_jobs(id) |
| part_id | UUID | ✓ | → parts(id) |
| quantity | INTEGER | ✓ | |
| note | TEXT | | |
| created_by | UUID | | → auth.users |
| created_at | TIMESTAMPTZ | ✓ | |

---

## 13. job_documents

| Column | Type | Required | Notes |
|--------|------|----------|-------|
| id | UUID | Auto | Primary key |
| job_id | UUID | ✓ | → garage_jobs(id) |
| document_type | TEXT | ✓ | job_card, diagnosis_report, photo_before, photo_after, other |
| file_name | TEXT | ✓ | |
| file_path | TEXT | ✓ | Storage path |
| file_size | INTEGER | | |
| mime_type | TEXT | | |
| notes | TEXT | | |
| uploaded_by | UUID | | → profiles(id) |
| created_at | TIMESTAMPTZ | ✓ | |

Files stored in storage bucket: `job-documents`

---

## 14. requests

| Column | Type | Required | Notes |
|--------|------|----------|-------|
| id | UUID | Auto | Primary key |
| subject | TEXT | ✓ | |
| description | TEXT | | |
| category | TEXT | | Purchase, Maintenance, HR, IT, Other |
| status | TEXT | ✓ | See [Request Status](#request-status) |
| priority | TEXT | ✓ | See [Request Priority](#request-priority) |
| assistant_notes | TEXT | | |
| management_comments | TEXT | | |
| submitted_by | UUID | ✓ | → profiles(id) |
| assigned_to | UUID | | → profiles(id) |
| send_to | TEXT | | houssam, kareem, samer |
| send_to_user_id | UUID | | → profiles(id) |
| reviewed_by | UUID | | → profiles(id) |
| forwarded_at | TIMESTAMPTZ | | |
| resolved_at | TIMESTAMPTZ | | |
| created_at | TIMESTAMPTZ | ✓ | |
| updated_at | TIMESTAMPTZ | ✓ | |

---

## 15. request_attachments

| Column | Type | Required | Notes |
|--------|------|----------|-------|
| id | UUID | Auto | Primary key |
| request_id | UUID | ✓ | → requests(id) |
| file_name | TEXT | ✓ | |
| file_path | TEXT | ✓ | |
| file_size | INTEGER | | |
| mime_type | TEXT | | |
| uploaded_by | UUID | | → profiles(id) |
| created_at | TIMESTAMPTZ | ✓ | |

---

## 16. delete_requests

| Column | Type | Required | Notes |
|--------|------|----------|-------|
| id | UUID | Auto | Primary key |
| requested_by | UUID | ✓ | → profiles(id) |
| item_type | TEXT | ✓ | `car` or `part` |
| item_id | UUID | ✓ | |
| item_details | JSONB | ✓ | e.g. { part_name, oe_number, quantity } |
| status | TEXT | ✓ | pending, approved, denied |
| reviewed_by | UUID | | → profiles(id) |
| reviewed_at | TIMESTAMPTZ | | |
| created_at | TIMESTAMPTZ | ✓ | |

---

## 17. document_access_requests

| Column | Type | Required | Notes |
|--------|------|----------|-------|
| id | UUID | Auto | Primary key |
| requested_by | UUID | | → profiles(id) |
| search_query | TEXT | ✓ | |
| document_id | TEXT | | |
| status | TEXT | | pending, approved, denied |
| reviewed_by | UUID | | → profiles(id) |
| created_at | TIMESTAMPTZ | ✓ | |

---

## 18. page_access_requests

| Column | Type | Required | Notes |
|--------|------|----------|-------|
| id | UUID | Auto | Primary key |
| requested_by | UUID | | → profiles(id) |
| page_name | TEXT | ✓ | |
| status | TEXT | | pending, approved, denied |
| reviewed_by | UUID | | → profiles(id) |
| created_at | TIMESTAMPTZ | ✓ | |
| expires_at | TIMESTAMPTZ | | |

---

## 19. notifications

| Column | Type | Required | Notes |
|--------|------|----------|-------|
| id | UUID | Auto | Primary key |
| user_id | UUID | ✓ | → profiles(id) |
| title | TEXT | ✓ | |
| message | TEXT | ✓ | |
| link | TEXT | | e.g. /requests |
| is_read | BOOLEAN | | Default false |
| metadata | JSONB | | |
| created_at | TIMESTAMPTZ | ✓ | |

---

## 20. push_subscriptions

| Column | Type | Required | Notes |
|--------|------|----------|-------|
| id | UUID | Auto | Primary key |
| user_id | UUID | | → profiles(id) |
| subscription | JSONB | ✓ | Web Push subscription object |
| created_at | TIMESTAMPTZ | ✓ | |

---

## 21. system_preferences

Key-value store. Keys:

| Key | Description | Example |
|-----|-------------|---------|
| company_name | Company name | Monza S.A.L. |
| company_phone | Company phone | |
| company_email | Company email | |
| company_address | Company address | |
| company_website | Company website | |
| default_currency | Default currency | USD |
| default_language | Default language | en |

Table structure: `key` (PK), `value`, `updated_by`, `updated_at`

---

## 22. Tracking Tables

### warranty_notifications_sent
| Column | Type |
|--------|------|
| id | UUID |
| car_id | UUID |
| warranty_type | TEXT (dms, monza) |
| threshold_days | INTEGER |
| sent_at | TIMESTAMPTZ |

### service_day_notifications_sent
| Column | Type |
|--------|------|
| id | UUID |
| job_id | UUID |
| sent_date | DATE |
| sent_at | TIMESTAMPTZ |

---

## 23. Storage Buckets

| Bucket | Purpose |
|--------|---------|
| car-documents | PDI, job card PDFs per car |
| customer-documents | Customer files |
| job-documents | Garage job attachments (photos, reports) |
| request-attachments | Request Center file attachments |

---

## 24. Allowed Values (Enums)

### Car Status
`inbound`, `in_stock`, `showroom`, `reserved`, `sold`, `delivered`, `service`, `sent_to_sub_dealer`, `demo`, `registered`, `under_registration`, `sent_to_customs`, `company_car`

### Location Type
`showroom1`, `showroom2`, `garage`, `storage`, `inventory`

### PDI Status
`pending`, `in_progress`, `done`

### Customs Status
`pending`, `in_progress`, `cleared`, `exempt`

### Car Event Type
`created`, `moved`, `status_changed`, `battery_updated`, `pdi_updated`, `details_updated`, `note_added`

### Lead Status
`new_lead`, `contacted`, `interested`, `test_drive`, `negotiation`, `converted`, `lost`

### Lead Source
`walk_in`, `phone`, `whatsapp`, `instagram`, `facebook`, `website`, `referral`, `event`, `other`

### Part Status
`in_stock`, `low_stock`, `out_of_stock`, `discontinued`

### Movement Type
`stock_in`, `stock_out`, `adjustment`, `return`

### Job Status
`pending`, `in_progress`, `waiting_parts`, `done`, `delivered`, `cancelled`

### Job Priority
`low`, `normal`, `urgent`

### Request Status
`submitted`, `awaiting_approval`, `approved`, `rejected`, `needs_more_info`

### Request Priority
`low`, `normal`, `urgent`

### User Role
`owner`, `sales`, `garage_manager`, `assistant`

### User Capability
`garage`, `vehicle_software`, `cashier`, `events_ops`

---

## Excel Import Reference

### Cars (Voyah sheets)
Sheets: `Voyah 2023 & 2024 & 2025YM`, `Voyah 2026YM`, `Sent to Customs`  
Headers on row 2, data from row 3.  
Columns (case-insensitive): VIN, Status, Issue, Model, Suffix, Year, Exterior/Color, Interior, Engine, Client, Software, Dongle, Sold

### Clients (Voyah Clients sheet)
Headers on row 4, data from row 5.  
Columns: Name, Phone, Email

### Voyah Report (updates existing cars)
Columns: VIN, Client, Delivery, Phone, Reserved, Reservation date
