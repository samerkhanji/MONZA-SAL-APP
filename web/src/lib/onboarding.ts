import type { AppRole } from "@/lib/permissions";

export interface OnboardingStep {
  target: string;
  title: string;
  content: string;
}

export function getOnboardingSteps(role: AppRole | null): OnboardingStep[] {
  switch (role) {
    case "owner":
      return [
        {
          target: '[data-tour-id="nav-dashboard"]',
          title: "Dashboard",
          content:
            "This is your main dashboard. You see company-wide stats — total cars, active garage jobs, pending requests, and recent activity.",
        },
        {
          target: '[data-tour-id="nav-requests"]',
          title: "Request Center",
          content:
            "All employee requests come here. Assistants review requests first and forward the important ones to you. You can approve, reject, or ask for more info.",
        },
        {
          target: '[data-tour-id="nav-requests"]',
          title: "Request Workflow",
          content:
            "Requests flow like this: Employee submits → Assistants review → If approved, it reaches you → You make the final decision.",
        },
        {
          target: '[data-tour-id="nav-cars"]',
          title: "Car Inventory",
          content:
            "Your full car inventory. You can add, edit, and delete cars. Click any car to see its full profile, completion checklist, and linked customer.",
        },
        {
          target: '[data-tour-id="nav-customers"]',
          title: "Customers",
          content:
            "All customers and leads. Click a customer to see their profile, linked vehicles, and interaction history. You can add new customers and convert leads.",
        },
        {
          target: '[data-tour-id="nav-garage"]',
          title: "Garage Jobs",
          content:
            "Track all workshop activity. See which cars are being serviced, who is working on them, and their progress.",
        },
        {
          target: '[data-tour-id="nav-parts"]',
          title: "Parts Inventory",
          content:
            "Track spare parts stock. Add parts, scan barcodes, and monitor quantities.",
        },
        {
          target: '[data-tour-id="nav-documents"]',
          title: "Documents",
          content: "Store and search company documents.",
        },
        {
          target: '[data-tour-id="header-notifications"]',
          title: "Notifications",
          content:
            "Click the bell icon to see notifications about new requests, garage updates, warranty alerts, and approvals.",
        },
        {
          target: '[data-tour-id="header-notifications"]',
          title: "Delete Approvals",
          content:
            "When employees request to delete a car or part, you will get a notification here. Approve or deny directly from the notification.",
        },
        {
          target: '[data-tour-id="nav-settings"]',
          title: "Settings",
          content:
            "Manage your team, assign roles, view pending requests, and configure notifications.",
        },
        {
          target: '[data-tour-id="export-button"]',
          title: "Export",
          content:
            "Most tables have an Export button. Click it to download the data as a clean Excel file.",
        },
      ];
    case "assistant":
      return [
        {
          target: '[data-tour-id="nav-assistant-dashboard"]',
          title: "Assistant Dashboard",
          content:
            "This is your home base. You see pending requests, cars ready for pickup, workshop status, warranty alerts, and recent activity.",
        },
        {
          target: '[data-tour-id="nav-requests"]',
          title: "Request Pipeline",
          content:
            "Your main job here: review requests sent to the owners. You can approve them, reject them, or add notes before they go to management.",
        },
        {
          target: '[data-tour-id="nav-requests"]',
          title: "Request Actions",
          content:
            "For each request, you can set priority (🟢🟡🔴), add assistant notes, approve, reject, or forward to management.",
        },
        {
          target: '[data-tour-id="nav-garage"]',
          title: "Workshop Monitoring",
          content:
            "Track cars in the garage. See which are in progress, completed, or overdue for pickup.",
        },
        {
          target: '[data-tour-id="nav-cars"]',
          title: "Car Inventory",
          content:
            "View all cars in stock. You can see details but cannot add or delete cars. Use the checklist inside each car to see what's incomplete.",
        },
        {
          target: '[data-tour-id="nav-customers"]',
          title: "Customers",
          content:
            "View customer profiles and their linked vehicles. You can look up information but cannot edit customer records.",
        },
        {
          target: '[data-tour-id="nav-garage"]',
          title: "Pickup Management",
          content:
            "When a car is marked Completed in the garage, you coordinate the customer pickup and mark it as Delivered.",
        },
        {
          target: '[data-tour-id="nav-assistant-dashboard"]',
          title: "Warranty Alerts",
          content:
            "On the Assistant Dashboard you will see warnings when warranties are approaching expiry: 🔴 within 7 days, 🟡 within 14 days, 🟢 within 30 days.",
        },
        {
          target: '[data-tour-id="header-notifications"]',
          title: "Notifications",
          content:
            "Check the bell for real-time updates on requests, garage status, and approvals.",
        },
        {
          target: '[data-tour-id="export-button"]',
          title: "Export",
          content: "Export any table to Excel for reporting.",
        },
      ];
    case "garage_manager":
      return [
        {
          target: '[data-tour-id="nav-garage"]',
          title: "Garage Jobs",
          content:
            "This is your main page. You see all active jobs, can create new jobs, assign mechanics, set priorities, and track progress.",
        },
        {
          target: '[data-tour-id="nav-garage"]',
          title: "Creating a Job",
          content:
            "Use the New Job button to create a job: choose car by VIN, define reason of visit, priority, estimated hours, day to be serviced, and assignee.",
        },
        {
          target: '[data-tour-id="nav-garage"]',
          title: "Job Workflow",
          content:
            "Jobs flow through stages: Pending → In Progress → Completed → Delivered.",
        },
        {
          target: '[data-tour-id="nav-garage"]',
          title: "Overtime Alerts",
          content:
            "Jobs that exceed the estimated hours are highlighted. You'll also get notifications.",
        },
        {
          target: '[data-tour-id="nav-parts"]',
          title: "Parts Inventory",
          content:
            "Manage spare parts: add new parts, update quantities, and scan barcodes.",
        },
        {
          target: '[data-tour-id="nav-garage-history"]',
          title: "Garage History",
          content:
            "View completed jobs history and search by VIN, date, or mechanic.",
        },
        {
          target: '[data-tour-id="nav-requests"]',
          title: "Request Center",
          content:
            "Submit requests to management and see requests addressed to you or related to the garage.",
        },
        {
          target: '[data-tour-id="header-notifications"]',
          title: "Notifications",
          content:
            "You will be notified when new cars are added for service, jobs are overdue, and parts are running low.",
        },
      ];
    case "garage_staff":
      return [
        {
          target: '[data-tour-id="nav-garage"]',
          title: "Your Assigned Jobs",
          content:
            "You only see jobs assigned to you. This keeps the view focused on your work.",
        },
        {
          target: '[data-tour-id="nav-garage"]',
          title: "Updating a Job",
          content:
            "For each assigned job, you can update notes, change the stage, upload photos of your work, and mark checklist items as done.",
        },
        {
          target: '[data-tour-id="nav-garage"]',
          title: "What You Cannot Change",
          content:
            "Priority, estimated hours, and assignments are managed by your manager. If something needs changing, talk to Mark or submit a request.",
        },
        {
          target: '[data-tour-id="nav-parts"]',
          title: "Parts Inventory",
          content:
            "You can view available parts in stock. Check here before requesting new parts.",
        },
        {
          target: '[data-tour-id="nav-requests"]',
          title: "Request Center",
          content:
            "Submit requests when you need something from management or other teams.",
        },
      ];
    case "hybrid":
      return [
        {
          target: '[data-tour-id="nav-requests"]',
          title: "Request Center",
          content:
            "Submit and track your requests. You see requests you've sent and requests addressed to you.",
        },
        {
          target: '[data-tour-id="nav-cars"]',
          title: "Car Inventory",
          content:
            "View all cars in the system. Adding and deleting cars is handled by the sales team.",
        },
        {
          target: '[data-tour-id="nav-parts"]',
          title: "Parts Inventory",
          content:
            "You can view and edit parts: update quantities, check stock, and scan barcodes.",
        },
        {
          target: '[data-tour-id="nav-documents"]',
          title: "Documents",
          content: "Access company documents here.",
        },
      ];
    case "it":
      return [
        {
          target: '[data-tour-id="nav-requests"]',
          title: "Request Center",
          content:
            "You see your own requests plus any IT-related requests from the team.",
        },
        {
          target: '[data-tour-id="nav-cars"]',
          title: "Car Inventory",
          content: "View car data for reference when troubleshooting systems.",
        },
        {
          target: '[data-tour-id="nav-parts"]',
          title: "Parts Inventory",
          content: "View parts inventory for reference.",
        },
        {
          target: '[data-tour-id="nav-documents"]',
          title: "Documents",
          content: "Access and manage technical and company documents.",
        },
      ];
    case "sales_ops":
      return [
        {
          target: '[data-tour-id="nav-customers"]',
          title: "Customers",
          content:
            "Create new customers, edit profiles, convert leads, and track interactions.",
        },
        {
          target: '[data-tour-id="nav-cars"]',
          title: "Car Inventory",
          content:
            "Full access to add, edit, and manage cars. When a car is sold, link it to a customer and fill in all required fields.",
        },
        {
          target: '[data-tour-id="nav-garage-history"]',
          title: "Garage History",
          content:
            "View past garage work on any car. You have read-only access here.",
        },
        {
          target: '[data-tour-id="nav-requests"]',
          title: "Request Center",
          content: "Submit requests and track your submissions.",
        },
        {
          target: '[data-tour-id="nav-documents"]',
          title: "Documents",
          content: "Access company documents.",
        },
        {
          target: '[data-tour-id="export-button"]',
          title: "Export",
          content:
            "Export customer or inventory data to Excel for sales reports.",
        },
      ];
    default:
      return [];
  }
}

