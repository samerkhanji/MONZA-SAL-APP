# Tour Selectors

Reference index of every `data-tour-id` attribute added to the dashboard for the tour bot.

**Convention:** `<page>-<element>-<action>`, kebab-case, unique within the app.

Phase-2 agents writing tour content should target these via:

```ts
selector: '[data-tour-id="<id>"]'
```

Pre-existing tour IDs (not in this index, but already present in the app):

- `header-notifications` — the notification bell in the top header (`NotificationBell.tsx`)
- `export-button` — the global Excel export button (`ExportButton.tsx`)
- Sidebar nav entries — `data-tour-id={item.tourId}` is rendered from the route registry in `dashboard-shell.tsx`. Use the route's `tourId` slug from the nav registry.

---

## /dashboard

- `dashboard-kpi-cards` — top KPI tile grid (Total Cars, In Garage, Leads & Clients, Active Jobs, Pending Requests)
- `dashboard-cars-by-status-panel` — Cars by Status card on the middle row
- `dashboard-low-stock-panel` — Low Stock Alerts card on the middle row
- `dashboard-garage-overview-panel` — Garage Overview card on the middle row (recent jobs + status breakdown)

## /dashboard/overview (owner overview)

- `overview-refresh-button` — Refresh button in the page header
- `overview-kpi-strip` — high-level KPI strip (Vehicles, Customers, Sales orders, Pending queue, Warranties)
- `overview-cars-by-status-panel` — "Cars by status" chart panel (with bar/horizontal/pie/line switcher)
- `overview-sales-revenue-panel` — "Sales & revenue (month-to-date)" panel
- `overview-fleet-logistics-panel` — "Fleet logistics" panel (aging, reservations, arrivals)
- `overview-cash-receivables-panel` — "Cash & receivables" panel (drawer, refunds, overdue)

## /assistant-dashboard

- `assistant-dashboard-repair-proposals-panel` — Repair proposals card (CS queue)
- `assistant-dashboard-pending-requests-panel` — Pending Requests card
- `assistant-dashboard-workshop-panel` — Workshop Status card (cars in garage)
- `assistant-dashboard-pickups-panel` — Upcoming Pickups / Delivery Schedule card

## /cars (inventory list)

- `cars-list-add-button` — "Add Car" primary button (top right)
- `cars-list-import-excel-button` — "Import from Excel" button (owner only)
- `cars-list-filters-panel` — Filters card
- `cars-list-search-input` — Search by VIN / plate / brand / model
- `cars-list-scan-vin-button` — Scan VIN icon button next to the search
- `cars-list-filter-status` — Status filter select
- `cars-list-filter-location` — Location filter select
- `cars-list-filter-brand` — Brand filter select
- `cars-list-table-panel` — Cars table card (wrap)
- `cars-list-row-actions-trigger` — `…` icon button on a row (opens dropdown)
- `cars-list-row-actions-view` — "View profile" dropdown item
- `cars-list-row-actions-documents` — "Documents & PDFs" dropdown item
- `cars-list-row-actions-edit` — "Edit" dropdown item
- `cars-list-row-actions-move` — "Move" dropdown item
- `cars-list-row-actions-scrap` — "Scrap vehicle" destructive dropdown item
- `cars-list-delete-dialog` — Scrap confirmation `AlertDialogContent`
- `cars-list-delete-password-input` — Password input inside the scrap dialog
- `cars-list-delete-cancel` — Cancel button in the scrap dialog
- `cars-list-delete-confirm` — "Confirm scrap" destructive button

## /cars/add

- `cars-add-back-button` — "← Back" button in header
- `cars-add-form` — the whole `<form>` wrapper
- `cars-add-vehicle-info-panel` — Vehicle Information card
- `cars-add-vin-input` — VIN input
- `cars-add-scan-vin-button` — Scan VIN icon button
- `cars-add-brand-select` — Brand select trigger
- `cars-add-model-input` — Model input
- `cars-add-location-select` — Location select trigger
- `cars-add-status-select` — Status select trigger
- `cars-add-customs-status-select` — Customs status select trigger
- `cars-add-technical-panel` — Technical Details card (battery, KM, EREV)
- `cars-add-customer-panel` — Customer Details card (shown when status is sold/reserved)
- `cars-add-client-first-name-input` — Client first name input
- `cars-add-client-phone-input` — Client phone input
- `cars-add-sale-panel` — Sale Details card
- `cars-add-submit-button` — "Add Car" submit button
- `cars-add-cancel-button` — "Cancel" link button

## /cars/[id] (car detail)

- `cars-detail-edit-button` — "Edit" button in header (opens edit dialog)
- `cars-detail-move-button` — "Move location" button in header
- `cars-detail-scrap-button` — "Scrap vehicle" destructive button
- `cars-detail-tabs` — tabs root (overview, documents, history, etc.)

## /customers (list)

- `customers-list-add-button` — "Add Customer" primary button
- `customers-list-tabs` — Tabs root (All / Sold / Leads)
- `customers-list-tab-all` — All Customers tab
- `customers-list-tab-sold` — Sold Cars tab
- `customers-list-tab-leads` — Leads tab
- `customers-list-filters-panel` — Filters card
- `customers-list-search-input` — Search name / phone / email
- `customers-list-filter-status` — Status filter select
- `customers-list-filter-source` — Source filter select
- `customers-list-table-panel` — Customers table card
- `customers-list-row-actions-trigger` — `…` icon button on a row
- `customers-list-row-actions-view` — "View" dropdown item
- `customers-list-row-actions-edit` — "Edit" dropdown item
- `customers-list-row-actions-delete` — "Delete" dropdown item
- `customers-list-delete-dialog` — Remove customer `AlertDialogContent`
- `customers-list-delete-cancel` — Cancel in remove dialog
- `customers-list-delete-confirm` — Delete button in remove dialog

## /customers/add

- `customers-add-back-button` — "← Customers" back button
- `customers-add-form` — form wrapper
- `customers-add-personal-panel` — Personal Information card
- `customers-add-first-name-input` — First name input
- `customers-add-phone-input` — Phone input
- `customers-add-email-input` — Email input
- `customers-add-lead-panel` — Lead Information card
- `customers-add-lead-status-select` — Lead status select trigger
- `customers-add-lead-source-select` — Lead source select trigger
- `customers-add-notes-panel` — Notes card
- `customers-add-submit-button` — "Add Customer" submit
- `customers-add-cancel-button` — Cancel link button

## /customers/[id] (customer detail)

- `customers-detail-edit-button` — Edit button in header
- `customers-detail-delete-button` — Delete button in header
- `customers-detail-tabs` — Profile / Vehicles / Notes / etc. tabs root

## /installments

- `installments-new-plan-button` — "New Plan" primary button
- `installments-tabs` — Due / Upcoming / Paid / Plans tabs root
- `installments-due-row-mark-paid` — "Mark Paid" button on a due-row (desktop table)
- `installments-mark-paid-dialog` — Mark-paid `DialogContent`
- `installments-mark-paid-amount-input` — Amount paid input
- `installments-mark-paid-method-select` — Payment method select trigger
- `installments-mark-paid-cancel` — Cancel button
- `installments-mark-paid-confirm` — "Confirm Paid" button
- `installments-new-plan-dialog` — New payment plan `DialogContent`

## /test-drive

- `test-drive-vin-panel` — Scan or enter VIN card
- `test-drive-vin-input` — VIN text input
- `test-drive-scan-button` — "Scan" camera button
- `test-drive-lookup-button` — "Look up" submit
- `test-drive-active-panel` — Active test drives card
- `test-drive-active-open-button` — "Open" button on an active-test-drive row
- `test-drive-returns-panel` — Recent returns card
- `test-drive-returns-view-button` — "View" button on a returned-test-drive row

## /accessories

- `accessories-search-input` — Master search input across categories
- `accessories-add-line-button` — "Add line" button in each category header (multiple — first match in DOM order)

## /documents

- `documents-search-panel` — VIN-search card
- `documents-vin-search-input` — VIN search input
- `documents-scan-vin-button` — Scan VIN icon button
- `documents-search-button` — "Search" submit button

## /sales-orders (list)

- `sales-orders-list-refresh-button` — Refresh button
- `sales-orders-list-kpi-bar` — KPI grid (total / in-progress / revenue)
- `sales-orders-list-table-panel` — All orders card
- `sales-orders-list-search-input` — Search VIN / car / customer / phone
- `sales-orders-list-filter-status` — Status filter select trigger

## /sales-orders/[id]

- `sales-order-detail-stepper` — Lifecycle stepper card at the top
- `sales-order-detail-save-quote` — Save quote button
- `sales-order-detail-save-deposit` — Save deposit button
- `sales-order-detail-void-button` — Void / cancel order destructive button

## /trade-ins (list)

- `trade-ins-list-request-button` — "Request trade-in" primary button
- `trade-ins-list-status-tabs` — Tabs (Provisional / Inspecting / Inspected / Approved / Committed / Rejected)
- `trade-ins-list-search-input` — Search input
- `trade-ins-list-request-dialog` — "Request trade-in" `DialogContent`
- `trade-ins-request-customer-select` — Customer select inside the request dialog
- `trade-ins-request-make-input` — Make input
- `trade-ins-request-model-input` — Model input
- `trade-ins-request-provisional-input` — Provisional value input
- `trade-ins-request-cancel` — Cancel button in request dialog
- `trade-ins-request-submit` — "Submit request" button

## /trade-ins/[id]

- `trade-in-detail-start-inspection` — "Start inspection" button (provisional → inspecting)
- `trade-in-detail-complete-inspection` — "Complete inspection" button (opens inspect dialog)
- `trade-in-detail-approve` — Owner approve button
- `trade-in-detail-reject` — Owner reject button
- `trade-in-detail-commit` — "Commit to sales order" button
- `trade-in-detail-cancel` — Cancel button

## /requests

- `requests-new-button` — "New Request" primary button
- `requests-filter-status` — Status filter select trigger
- `requests-filter-priority` — Priority filter select trigger
- `requests-new-dialog` — New request `DialogContent`
- `requests-new-cancel` — Cancel in new-request dialog
- `requests-new-submit` — Submit in new-request dialog
- `requests-detail-dialog` — Request detail `DialogContent`

## /requests/pending

- `requests-pending-panel` — Pending Requests card

## /garage (jobs board)

- `garage-jobs-time-reports-link` — "Time reports" link button (owner/manager)
- `garage-jobs-scan-vin-button` — "Scan VIN" button
- `garage-jobs-new-job-button` — "New Job" primary button
- `garage-jobs-search-input` — Job search input

## /garage/jobs/[id]

- `garage-job-complete-button` — "Complete" button (opens FinishJobDialog)
- `garage-job-delete-button` — "Delete" destructive button
- `garage-job-add-part-button` — "Add part" button in the parts card

## /garage/tasks

- `garage-tasks-create-checklist-button` — "Create checklist from template" button
- `garage-tasks-template-dialog` — Template dialog `DialogContent`
- `garage-tasks-template-cancel` — Cancel button
- `garage-tasks-template-submit` — "Create tasks" submit

## /garage/inventory

- `garage-inventory-add-part-button` — "Add New Part" button
- `garage-inventory-import-button` — "Import from Excel" button
- `garage-inventory-search-input` — Search input (part name / OE)

## /garage/purchase-orders (list)

- `garage-po-new-button` — "New PO" primary button
- `garage-po-status-tabs` — Tabs (Draft / Pending / Approved / etc.)
- `garage-po-search-input` — Search by PO number / supplier

## /garage/purchase-orders/[id]

- `garage-po-detail-send-button` — "Send to supplier" button (approved → sent)
- `garage-po-detail-grn-button` — "Log GRN (receipt)" button
- `garage-po-detail-invoice-button` — "Attach invoice" button
- `garage-po-detail-payment-button` — "Record payment" button

## /garage/suppliers

- `garage-suppliers-new-button` — "New supplier" primary button
- `garage-suppliers-search-input` — Search input

## /garage/warranty (list)

- `garage-warranty-new-button` — "New case" primary button
- `garage-warranty-tabs` — Status tabs
- `garage-warranty-search-input` — Search by case number / VIN / customer
- `garage-warranty-new-dialog` — New case `DialogContent`
- `garage-warranty-new-cancel` — Cancel
- `garage-warranty-new-submit` — Submit

## /garage/warranty/[id]

- `garage-warranty-detail-info-panel` — Header info card (VIN / customer / kind)
- `garage-warranty-detail-parts-panel` — Parts used / claimed card
- `garage-warranty-detail-resolution-panel` — Resolution card

## /garage/recalls (list)

- `garage-recalls-new-button` — "New recall" primary button
- `garage-recalls-tabs` — Status tabs
- `garage-recalls-search-input` — Search by recall number / title / model

## /garage/recalls/[id]

- `garage-recall-detail-info-panel` — Recall info card
- `garage-recall-detail-vehicles-panel` — Affected vehicles card
- `garage-recall-detail-assign-button` — "Assign vehicles" button

## /garage/refunds (list)

- `garage-refunds-new-button` — "Request refund" primary button
- `garage-refunds-tabs` — Status tabs
- `garage-refunds-search-input` — Search by number / customer / reason

## /garage/refunds/[id]

- `garage-refund-detail-approve` — "Approve" button
- `garage-refund-detail-reject` — "Reject" button
- `garage-refund-detail-mark-paid` — "Mark as paid" button
- `garage-refund-detail-cancel` — "Cancel request" button

## /garage/history

- `garage-history-search-input` — History search input

## /garage/efficiency

- `garage-efficiency-jobs-panel` — Job efficiency table card
- `garage-efficiency-bays-panel` — Bay utilization card
- `garage-efficiency-technicians-panel` — Technician efficiency card

## /garage/time-reports

- `garage-time-reports-panel` — "By employee" hours table card

## /garage/settings

- `garage-settings-capacities-panel` — Resource capacities card
- `garage-settings-templates-panel` — Task templates card
- `garage-settings-new-template-button` — "New template" button

## /data-health

- `data-health-search-input` — Search by VIN / customer / phone
- `data-health-filter-section` — Section filter select
- `data-health-filter-severity` — Severity filter select
- `data-health-summary-panel` — Data Health Score summary card

## /notifications

- `notifications-tabs` — Tabs (Unread / All / etc.)
- `notifications-search-input` — Search input
- `notifications-bulk-mark-read` — "Mark read" bulk action
- `notifications-bulk-dismiss` — "Dismiss" bulk action

## /reports

- `reports-margin-panel` — Profit margin per delivered sale card
- `reports-sales-rep-panel` — Sales rep performance card
- `reports-inventory-aging-panel` — Inventory aging card
- `reports-aged-receivables-panel` — Aged receivables card
- `reports-time-state-panel` — Garage time-in-state card

## /cash

- `cash-open-session-button` — "Open today's session" primary button
- `cash-add-movement-button` — "Add movement" button (visible when session open)
- `cash-close-session-button` — "Close session" destructive button
- `cash-today-session-panel` — Today's session card
- `cash-history-panel` — Recent sessions card
- `cash-open-session-dialog` — Open-session `DialogContent`
- `cash-open-session-opening-input` — Counted opening balance input
- `cash-open-session-cancel` — Cancel
- `cash-open-session-submit` — "Open session" submit
- `cash-close-session-dialog` — Close-session `DialogContent`
- `cash-close-actual-input` — Counted closing input
- `cash-close-cancel` — Cancel
- `cash-close-submit` — "Close session" submit
- `cash-movement-dialog` — Manual movement `DialogContent`
- `cash-movement-amount-input` — Amount input
- `cash-movement-cancel` — Cancel
- `cash-movement-submit` — "Record" submit

## /settings

- `settings-profile-panel` — Profile Settings card
- `settings-change-password-button` — "Change Password" button
- `settings-team-panel` — Team Members card
- `settings-company-panel` — Company Information card
- `settings-prefs-panel` — System Preferences card
- `settings-notifications-panel` — Push Notifications card
- `settings-push-toggle` — Enable / Disable push toggle button
- `settings-audit-panel` — Audit Log card

## /settings/approval-thresholds

- `settings-approval-threshold-card` — Per-rule threshold card (repeated for each row)
- `settings-approval-threshold-save` — Save button on a threshold card

## /settings/notifications

- `settings-notifications-channels-panel` — Delivery channels card
- `settings-notifications-quiet-hours-panel` — Quiet hours card
- `settings-notifications-digest-panel` — Daily digest card
- `settings-notifications-mutes-panel` — Muted entities card
- `settings-notifications-mute-input` — Add mute entity input
- `settings-notifications-mute-button` — "Mute" submit button

## /settings/workflow-rules

- `workflow-rules-tabs` — Tabs (Task routing / Notification events)
- `workflow-rules-tab-routing` — Task routing tab
- `workflow-rules-tab-events` — Notification events tab
- `workflow-rules-routing-panel` — "Who gets the task" card
- `workflow-rules-events-panel` — "Who hears about it" card

---

## Shared dialog components (in `web/src/components/**`)

These dialogs are opened from multiple pages — the IDs live on the dialog root or its primary actions, so a tour can target them no matter where they were opened from.

- `edit-car-dialog` — `EditCarDialog` `DialogContent` (`web/src/components/edit-car-dialog.tsx`)
- `edit-car-dialog-cancel` / `edit-car-dialog-save` — its Cancel / Save buttons
- `edit-customer-dialog` — `EditCustomerDialog` `DialogContent` (`web/src/components/customers/EditCustomerDialog.tsx`)
- `edit-customer-dialog-cancel` / `edit-customer-dialog-save`
- `move-car-dialog` — `MoveCarDialog` `DialogContent`
- `customs-dialog` — `CustomsDialog` `DialogContent`
- `pdi-status-dialog` — `PdiStatusDialog` `DialogContent`
- `new-job-dialog` — `NewJobDialog` `DialogContent` (garage)
- `new-job-dialog-cancel` / `new-job-dialog-submit`
- `add-part-dialog` — `AddPartDialog` `DialogContent`
- `edit-part-dialog` — `EditPartDialog` `DialogContent`
- `finish-job-dialog` — `FinishJobDialog` `DialogContent`
- `set-job-category-dialog` — `SetJobCategoryDialog` `DialogContent`
