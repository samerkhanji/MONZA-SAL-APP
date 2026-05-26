export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      accessory_custom_items: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          label: string
          linked_plate: string | null
          note: string | null
          quantity: number
          sort_order: number
          table_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          label: string
          linked_plate?: string | null
          note?: string | null
          quantity?: number
          sort_order?: number
          table_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          label?: string
          linked_plate?: string | null
          note?: string | null
          quantity?: number
          sort_order?: number
          table_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "accessory_custom_items_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accessory_custom_items_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "report_sales_rep_performance"
            referencedColumns: ["sales_rep_id"]
          },
          {
            foreignKeyName: "accessory_custom_items_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "accessory_custom_tables"
            referencedColumns: ["id"]
          },
        ]
      }
      accessory_custom_tables: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "accessory_custom_tables_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accessory_custom_tables_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "report_sales_rep_performance"
            referencedColumns: ["sales_rep_id"]
          },
        ]
      }
      accessory_inventory: {
        Row: {
          category: string
          created_at: string
          created_by: string | null
          id: string
          label: string
          linked_plate: string | null
          note: string
          quantity: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          category: string
          created_at?: string
          created_by?: string | null
          id?: string
          label?: string
          linked_plate?: string | null
          note?: string
          quantity?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          category?: string
          created_at?: string
          created_by?: string | null
          id?: string
          label?: string
          linked_plate?: string | null
          note?: string
          quantity?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      api_rate_limit_events: {
        Row: {
          created_at: string
          endpoint: string
          id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          endpoint: string
          id?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          endpoint?: string
          id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "api_rate_limit_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "api_rate_limit_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "report_sales_rep_performance"
            referencedColumns: ["sales_rep_id"]
          },
        ]
      }
      appointments: {
        Row: {
          assigned_to: string | null
          car_id: string | null
          created_at: string
          created_by: string | null
          customer_id: string | null
          duration_minutes: number
          id: string
          kind: string
          location: string | null
          notes: string | null
          scheduled_for: string
          status: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          car_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          duration_minutes?: number
          id?: string
          kind: string
          location?: string | null
          notes?: string | null
          scheduled_for: string
          status?: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          car_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          duration_minutes?: number
          id?: string
          kind?: string
          location?: string | null
          notes?: string | null
          scheduled_for?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "report_sales_rep_performance"
            referencedColumns: ["sales_rep_id"]
          },
          {
            foreignKeyName: "appointments_car_id_fkey"
            columns: ["car_id"]
            isOneToOne: false
            referencedRelation: "car_service_status"
            referencedColumns: ["car_id"]
          },
          {
            foreignKeyName: "appointments_car_id_fkey"
            columns: ["car_id"]
            isOneToOne: false
            referencedRelation: "cars"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_car_id_fkey"
            columns: ["car_id"]
            isOneToOne: false
            referencedRelation: "cars_display"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_car_id_fkey"
            columns: ["car_id"]
            isOneToOne: false
            referencedRelation: "cars_missing_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_car_id_fkey"
            columns: ["car_id"]
            isOneToOne: false
            referencedRelation: "report_inventory_aging"
            referencedColumns: ["car_id"]
          },
          {
            foreignKeyName: "appointments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "report_sales_rep_performance"
            referencedColumns: ["sales_rep_id"]
          },
          {
            foreignKeyName: "appointments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers_display"
            referencedColumns: ["id"]
          },
        ]
      }
      approval_thresholds: {
        Row: {
          active: boolean
          created_at: string
          currency: string
          description: string | null
          id: string
          label_en: string
          manager_floor: number
          owner_floor: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          currency?: string
          description?: string | null
          id: string
          label_en: string
          manager_floor?: number
          owner_floor: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          label_en?: string
          manager_floor?: number
          owner_floor?: number
          updated_at?: string
        }
        Relationships: []
      }
      bay_assignment_history: {
        Row: {
          bay_id: number
          bay_status_after: string | null
          bay_status_before: string | null
          car_id: string | null
          created_at: string
          created_by: string | null
          event_type: string
          id: string
          job_id: string | null
          note: string | null
          vin: string | null
        }
        Insert: {
          bay_id: number
          bay_status_after?: string | null
          bay_status_before?: string | null
          car_id?: string | null
          created_at?: string
          created_by?: string | null
          event_type: string
          id?: string
          job_id?: string | null
          note?: string | null
          vin?: string | null
        }
        Update: {
          bay_id?: number
          bay_status_after?: string | null
          bay_status_before?: string | null
          car_id?: string | null
          created_at?: string
          created_by?: string | null
          event_type?: string
          id?: string
          job_id?: string | null
          note?: string | null
          vin?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bay_assignment_history_bay_id_fkey"
            columns: ["bay_id"]
            isOneToOne: false
            referencedRelation: "garage_bay_utilization"
            referencedColumns: ["bay_id"]
          },
          {
            foreignKeyName: "bay_assignment_history_bay_id_fkey"
            columns: ["bay_id"]
            isOneToOne: false
            referencedRelation: "garage_bays"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bay_assignment_history_car_id_fkey"
            columns: ["car_id"]
            isOneToOne: false
            referencedRelation: "car_service_status"
            referencedColumns: ["car_id"]
          },
          {
            foreignKeyName: "bay_assignment_history_car_id_fkey"
            columns: ["car_id"]
            isOneToOne: false
            referencedRelation: "cars"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bay_assignment_history_car_id_fkey"
            columns: ["car_id"]
            isOneToOne: false
            referencedRelation: "cars_display"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bay_assignment_history_car_id_fkey"
            columns: ["car_id"]
            isOneToOne: false
            referencedRelation: "cars_missing_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bay_assignment_history_car_id_fkey"
            columns: ["car_id"]
            isOneToOne: false
            referencedRelation: "report_inventory_aging"
            referencedColumns: ["car_id"]
          },
          {
            foreignKeyName: "bay_assignment_history_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bay_assignment_history_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "report_sales_rep_performance"
            referencedColumns: ["sales_rep_id"]
          },
          {
            foreignKeyName: "bay_assignment_history_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "garage_job_efficiency"
            referencedColumns: ["job_id"]
          },
          {
            foreignKeyName: "bay_assignment_history_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "garage_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bay_assignment_history_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "report_garage_time_in_state"
            referencedColumns: ["job_id"]
          },
        ]
      }
      car_arrival_checks: {
        Row: {
          accessories_received: boolean
          car_id: string
          charger_received: boolean
          checked_at: string
          checked_by: string | null
          created_at: string
          damage_notes: string | null
          documents_received: boolean
          exterior_ok: boolean
          has_issues: boolean
          id: string
          keys_received: boolean
          missing_notes: string | null
          vin_confirmed: boolean
        }
        Insert: {
          accessories_received?: boolean
          car_id: string
          charger_received?: boolean
          checked_at?: string
          checked_by?: string | null
          created_at?: string
          damage_notes?: string | null
          documents_received?: boolean
          exterior_ok?: boolean
          has_issues?: boolean
          id?: string
          keys_received?: boolean
          missing_notes?: string | null
          vin_confirmed?: boolean
        }
        Update: {
          accessories_received?: boolean
          car_id?: string
          charger_received?: boolean
          checked_at?: string
          checked_by?: string | null
          created_at?: string
          damage_notes?: string | null
          documents_received?: boolean
          exterior_ok?: boolean
          has_issues?: boolean
          id?: string
          keys_received?: boolean
          missing_notes?: string | null
          vin_confirmed?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "car_arrival_checks_car_id_fkey"
            columns: ["car_id"]
            isOneToOne: false
            referencedRelation: "car_service_status"
            referencedColumns: ["car_id"]
          },
          {
            foreignKeyName: "car_arrival_checks_car_id_fkey"
            columns: ["car_id"]
            isOneToOne: false
            referencedRelation: "cars"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "car_arrival_checks_car_id_fkey"
            columns: ["car_id"]
            isOneToOne: false
            referencedRelation: "cars_display"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "car_arrival_checks_car_id_fkey"
            columns: ["car_id"]
            isOneToOne: false
            referencedRelation: "cars_missing_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "car_arrival_checks_car_id_fkey"
            columns: ["car_id"]
            isOneToOne: false
            referencedRelation: "report_inventory_aging"
            referencedColumns: ["car_id"]
          },
          {
            foreignKeyName: "car_arrival_checks_checked_by_fkey"
            columns: ["checked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "car_arrival_checks_checked_by_fkey"
            columns: ["checked_by"]
            isOneToOne: false
            referencedRelation: "report_sales_rep_performance"
            referencedColumns: ["sales_rep_id"]
          },
        ]
      }
      car_documents: {
        Row: {
          car_id: string
          created_at: string
          document_type: string
          event_date: string | null
          file_name: string
          file_path: string | null
          file_size: number | null
          file_size_bytes: number | null
          id: string
          mime_type: string | null
          notes: string | null
          storage_path: string | null
          uploaded_at: string
          uploaded_by: string | null
        }
        Insert: {
          car_id: string
          created_at?: string
          document_type: string
          event_date?: string | null
          file_name: string
          file_path?: string | null
          file_size?: number | null
          file_size_bytes?: number | null
          id?: string
          mime_type?: string | null
          notes?: string | null
          storage_path?: string | null
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Update: {
          car_id?: string
          created_at?: string
          document_type?: string
          event_date?: string | null
          file_name?: string
          file_path?: string | null
          file_size?: number | null
          file_size_bytes?: number | null
          id?: string
          mime_type?: string | null
          notes?: string | null
          storage_path?: string | null
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "car_documents_car_id_fkey"
            columns: ["car_id"]
            isOneToOne: false
            referencedRelation: "car_service_status"
            referencedColumns: ["car_id"]
          },
          {
            foreignKeyName: "car_documents_car_id_fkey"
            columns: ["car_id"]
            isOneToOne: false
            referencedRelation: "cars"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "car_documents_car_id_fkey"
            columns: ["car_id"]
            isOneToOne: false
            referencedRelation: "cars_display"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "car_documents_car_id_fkey"
            columns: ["car_id"]
            isOneToOne: false
            referencedRelation: "cars_missing_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "car_documents_car_id_fkey"
            columns: ["car_id"]
            isOneToOne: false
            referencedRelation: "report_inventory_aging"
            referencedColumns: ["car_id"]
          },
        ]
      }
      car_events: {
        Row: {
          car_id: string
          created_at: string
          created_by: string | null
          event_group_id: string | null
          event_type: Database["public"]["Enums"]["car_event_type"]
          field_name: string | null
          from_value: string | null
          id: string
          metadata: Json
          note: string | null
          to_value: string | null
        }
        Insert: {
          car_id: string
          created_at?: string
          created_by?: string | null
          event_group_id?: string | null
          event_type: Database["public"]["Enums"]["car_event_type"]
          field_name?: string | null
          from_value?: string | null
          id?: string
          metadata?: Json
          note?: string | null
          to_value?: string | null
        }
        Update: {
          car_id?: string
          created_at?: string
          created_by?: string | null
          event_group_id?: string | null
          event_type?: Database["public"]["Enums"]["car_event_type"]
          field_name?: string | null
          from_value?: string | null
          id?: string
          metadata?: Json
          note?: string | null
          to_value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "car_events_car_id_fkey"
            columns: ["car_id"]
            isOneToOne: false
            referencedRelation: "car_service_status"
            referencedColumns: ["car_id"]
          },
          {
            foreignKeyName: "car_events_car_id_fkey"
            columns: ["car_id"]
            isOneToOne: false
            referencedRelation: "cars"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "car_events_car_id_fkey"
            columns: ["car_id"]
            isOneToOne: false
            referencedRelation: "cars_display"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "car_events_car_id_fkey"
            columns: ["car_id"]
            isOneToOne: false
            referencedRelation: "cars_missing_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "car_events_car_id_fkey"
            columns: ["car_id"]
            isOneToOne: false
            referencedRelation: "report_inventory_aging"
            referencedColumns: ["car_id"]
          },
          {
            foreignKeyName: "car_events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "car_events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "report_sales_rep_performance"
            referencedColumns: ["sales_rep_id"]
          },
        ]
      }
      car_warranties: {
        Row: {
          bl_issue_date: string | null
          car_id: string
          created_at: string
          id: string
          notes: string | null
          registration_date: string | null
          updated_at: string
          warranty_battery_dms: string | null
          warranty_battery_expiry: string | null
          warranty_battery_km_limit: number | null
          warranty_vehicle_dms: string | null
          warranty_vehicle_expiry: string | null
          warranty_vehicle_km_limit: number | null
        }
        Insert: {
          bl_issue_date?: string | null
          car_id: string
          created_at?: string
          id?: string
          notes?: string | null
          registration_date?: string | null
          updated_at?: string
          warranty_battery_dms?: string | null
          warranty_battery_expiry?: string | null
          warranty_battery_km_limit?: number | null
          warranty_vehicle_dms?: string | null
          warranty_vehicle_expiry?: string | null
          warranty_vehicle_km_limit?: number | null
        }
        Update: {
          bl_issue_date?: string | null
          car_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          registration_date?: string | null
          updated_at?: string
          warranty_battery_dms?: string | null
          warranty_battery_expiry?: string | null
          warranty_battery_km_limit?: number | null
          warranty_vehicle_dms?: string | null
          warranty_vehicle_expiry?: string | null
          warranty_vehicle_km_limit?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "car_warranties_car_id_fkey"
            columns: ["car_id"]
            isOneToOne: false
            referencedRelation: "car_service_status"
            referencedColumns: ["car_id"]
          },
          {
            foreignKeyName: "car_warranties_car_id_fkey"
            columns: ["car_id"]
            isOneToOne: false
            referencedRelation: "cars"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "car_warranties_car_id_fkey"
            columns: ["car_id"]
            isOneToOne: false
            referencedRelation: "cars_display"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "car_warranties_car_id_fkey"
            columns: ["car_id"]
            isOneToOne: false
            referencedRelation: "cars_missing_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "car_warranties_car_id_fkey"
            columns: ["car_id"]
            isOneToOne: false
            referencedRelation: "report_inventory_aging"
            referencedColumns: ["car_id"]
          },
        ]
      }
      cars: {
        Row: {
          battery_percent: number | null
          bl_issue_date: string | null
          brand: string
          created_at: string
          created_by: string | null
          current_km: number | null
          customer_id: string | null
          customs_amount_currency: string | null
          customs_amount_paid: number | null
          customs_notes: string | null
          customs_status: string | null
          date_arrived: string | null
          date_bought: string | null
          deleted_at: string | null
          delivery_date: string | null
          dongle: string | null
          engine_number: string | null
          ev_km: number | null
          exterior_color: string | null
          id: string
          incoming_eta: string | null
          interior_color: string | null
          is_erev: boolean
          issue: string | null
          km_range: number | null
          location_changed_at: string | null
          location_floor: string | null
          location_slot: string | null
          location_type: Database["public"]["Enums"]["location_type"]
          model: string
          model_year: number | null
          motor: string | null
          motor_km: number | null
          notes: string | null
          pdi_status: Database["public"]["Enums"]["pdi_status"]
          plate_number: string | null
          price: number | null
          price_currency: string | null
          recall_notes: string | null
          recall_reason: string | null
          recalled_at: string | null
          registration_date: string | null
          reservation_date: string | null
          shipment_code: string | null
          software_update: string | null
          software_version: string | null
          sold_at: string | null
          sold_marker: string | null
          specs: string | null
          status: Database["public"]["Enums"]["car_status"]
          status_changed_at: string | null
          sub_dealer_name: string | null
          suffix: string | null
          supplier_id: string | null
          trim: string | null
          updated_at: string
          vin: string
          warranty_battery_dms: string | null
          warranty_battery_expiry: string | null
          warranty_battery_km_limit: number | null
          warranty_expiry: string | null
          warranty_monza_start_date: string | null
          warranty_per_dms: string | null
          warranty_vehicle_expiry: string | null
          warranty_vehicle_km_limit: number | null
        }
        Insert: {
          battery_percent?: number | null
          bl_issue_date?: string | null
          brand: string
          created_at?: string
          created_by?: string | null
          current_km?: number | null
          customer_id?: string | null
          customs_amount_currency?: string | null
          customs_amount_paid?: number | null
          customs_notes?: string | null
          customs_status?: string | null
          date_arrived?: string | null
          date_bought?: string | null
          deleted_at?: string | null
          delivery_date?: string | null
          dongle?: string | null
          engine_number?: string | null
          ev_km?: number | null
          exterior_color?: string | null
          id?: string
          incoming_eta?: string | null
          interior_color?: string | null
          is_erev?: boolean
          issue?: string | null
          km_range?: number | null
          location_changed_at?: string | null
          location_floor?: string | null
          location_slot?: string | null
          location_type?: Database["public"]["Enums"]["location_type"]
          model: string
          model_year?: number | null
          motor?: string | null
          motor_km?: number | null
          notes?: string | null
          pdi_status?: Database["public"]["Enums"]["pdi_status"]
          plate_number?: string | null
          price?: number | null
          price_currency?: string | null
          recall_notes?: string | null
          recall_reason?: string | null
          recalled_at?: string | null
          registration_date?: string | null
          reservation_date?: string | null
          shipment_code?: string | null
          software_update?: string | null
          software_version?: string | null
          sold_at?: string | null
          sold_marker?: string | null
          specs?: string | null
          status?: Database["public"]["Enums"]["car_status"]
          status_changed_at?: string | null
          sub_dealer_name?: string | null
          suffix?: string | null
          supplier_id?: string | null
          trim?: string | null
          updated_at?: string
          vin: string
          warranty_battery_dms?: string | null
          warranty_battery_expiry?: string | null
          warranty_battery_km_limit?: number | null
          warranty_expiry?: string | null
          warranty_monza_start_date?: string | null
          warranty_per_dms?: string | null
          warranty_vehicle_expiry?: string | null
          warranty_vehicle_km_limit?: number | null
        }
        Update: {
          battery_percent?: number | null
          bl_issue_date?: string | null
          brand?: string
          created_at?: string
          created_by?: string | null
          current_km?: number | null
          customer_id?: string | null
          customs_amount_currency?: string | null
          customs_amount_paid?: number | null
          customs_notes?: string | null
          customs_status?: string | null
          date_arrived?: string | null
          date_bought?: string | null
          deleted_at?: string | null
          delivery_date?: string | null
          dongle?: string | null
          engine_number?: string | null
          ev_km?: number | null
          exterior_color?: string | null
          id?: string
          incoming_eta?: string | null
          interior_color?: string | null
          is_erev?: boolean
          issue?: string | null
          km_range?: number | null
          location_changed_at?: string | null
          location_floor?: string | null
          location_slot?: string | null
          location_type?: Database["public"]["Enums"]["location_type"]
          model?: string
          model_year?: number | null
          motor?: string | null
          motor_km?: number | null
          notes?: string | null
          pdi_status?: Database["public"]["Enums"]["pdi_status"]
          plate_number?: string | null
          price?: number | null
          price_currency?: string | null
          recall_notes?: string | null
          recall_reason?: string | null
          recalled_at?: string | null
          registration_date?: string | null
          reservation_date?: string | null
          shipment_code?: string | null
          software_update?: string | null
          software_version?: string | null
          sold_at?: string | null
          sold_marker?: string | null
          specs?: string | null
          status?: Database["public"]["Enums"]["car_status"]
          status_changed_at?: string | null
          sub_dealer_name?: string | null
          suffix?: string | null
          supplier_id?: string | null
          trim?: string | null
          updated_at?: string
          vin?: string
          warranty_battery_dms?: string | null
          warranty_battery_expiry?: string | null
          warranty_battery_km_limit?: number | null
          warranty_expiry?: string | null
          warranty_monza_start_date?: string | null
          warranty_per_dms?: string | null
          warranty_vehicle_expiry?: string | null
          warranty_vehicle_km_limit?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "cars_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cars_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers_display"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cars_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_drawers: {
        Row: {
          active: boolean
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      cash_movements: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          currency: string
          direction: string
          id: string
          kind: string
          note: string | null
          session_id: string
          source_id: string | null
          source_type: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          currency?: string
          direction: string
          id?: string
          kind: string
          note?: string | null
          session_id: string
          source_id?: string | null
          source_type?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          currency?: string
          direction?: string
          id?: string
          kind?: string
          note?: string | null
          session_id?: string
          source_id?: string | null
          source_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cash_movements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_movements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "report_sales_rep_performance"
            referencedColumns: ["sales_rep_id"]
          },
          {
            foreignKeyName: "cash_movements_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "cash_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_sessions: {
        Row: {
          business_date: string
          closed_at: string | null
          closed_by: string | null
          closing_actual: number | null
          closing_note: string | null
          created_at: string
          drawer_id: string
          id: string
          notes: string | null
          opened_at: string
          opened_by: string | null
          opening_balance: number
          opening_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
          variance: number | null
          variance_note: string | null
        }
        Insert: {
          business_date?: string
          closed_at?: string | null
          closed_by?: string | null
          closing_actual?: number | null
          closing_note?: string | null
          created_at?: string
          drawer_id: string
          id?: string
          notes?: string | null
          opened_at?: string
          opened_by?: string | null
          opening_balance?: number
          opening_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          variance?: number | null
          variance_note?: string | null
        }
        Update: {
          business_date?: string
          closed_at?: string | null
          closed_by?: string | null
          closing_actual?: number | null
          closing_note?: string | null
          created_at?: string
          drawer_id?: string
          id?: string
          notes?: string | null
          opened_at?: string
          opened_by?: string | null
          opening_balance?: number
          opening_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          variance?: number | null
          variance_note?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cash_sessions_closed_by_fkey"
            columns: ["closed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_sessions_closed_by_fkey"
            columns: ["closed_by"]
            isOneToOne: false
            referencedRelation: "report_sales_rep_performance"
            referencedColumns: ["sales_rep_id"]
          },
          {
            foreignKeyName: "cash_sessions_drawer_id_fkey"
            columns: ["drawer_id"]
            isOneToOne: false
            referencedRelation: "cash_drawers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_sessions_opened_by_fkey"
            columns: ["opened_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_sessions_opened_by_fkey"
            columns: ["opened_by"]
            isOneToOne: false
            referencedRelation: "report_sales_rep_performance"
            referencedColumns: ["sales_rep_id"]
          },
          {
            foreignKeyName: "cash_sessions_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_sessions_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "report_sales_rep_performance"
            referencedColumns: ["sales_rep_id"]
          },
        ]
      }
      cash_settings: {
        Row: {
          currency: string
          id: string
          updated_at: string
          variance_threshold: number
        }
        Insert: {
          currency?: string
          id?: string
          updated_at?: string
          variance_threshold?: number
        }
        Update: {
          currency?: string
          id?: string
          updated_at?: string
          variance_threshold?: number
        }
        Relationships: []
      }
      commissions: {
        Row: {
          amount: number
          approved_at: string | null
          beneficiary_profile_id: string
          created_at: string
          created_by: string | null
          currency: string
          id: string
          notes: string | null
          paid_at: string | null
          sales_order_id: string
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          approved_at?: string | null
          beneficiary_profile_id: string
          created_at?: string
          created_by?: string | null
          currency?: string
          id?: string
          notes?: string | null
          paid_at?: string | null
          sales_order_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          approved_at?: string | null
          beneficiary_profile_id?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          id?: string
          notes?: string | null
          paid_at?: string | null
          sales_order_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "commissions_beneficiary_profile_id_fkey"
            columns: ["beneficiary_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commissions_beneficiary_profile_id_fkey"
            columns: ["beneficiary_profile_id"]
            isOneToOne: false
            referencedRelation: "report_sales_rep_performance"
            referencedColumns: ["sales_rep_id"]
          },
          {
            foreignKeyName: "commissions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commissions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "report_sales_rep_performance"
            referencedColumns: ["sales_rep_id"]
          },
          {
            foreignKeyName: "commissions_sales_order_id_fkey"
            columns: ["sales_order_id"]
            isOneToOne: false
            referencedRelation: "report_sales_margin"
            referencedColumns: ["sales_order_id"]
          },
          {
            foreignKeyName: "commissions_sales_order_id_fkey"
            columns: ["sales_order_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      company_costs: {
        Row: {
          amount: number
          approval_status: string
          approved_at: string | null
          approved_by: string | null
          category: string
          cost_date: string
          created_at: string
          created_by: string | null
          currency: string
          deleted_at: string | null
          description: string | null
          id: string
          payment_method: string | null
          receipt_url: string | null
          related_car_id: string | null
          related_customer_id: string | null
          related_employee_id: string | null
          related_garage_job_id: string | null
          related_marketing_campaign_id: string | null
          related_purchase_order_id: string | null
          related_sales_order_id: string | null
          related_supplier_id: string | null
          subcategory: string | null
          type: string
          updated_at: string
        }
        Insert: {
          amount: number
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          category: string
          cost_date?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          payment_method?: string | null
          receipt_url?: string | null
          related_car_id?: string | null
          related_customer_id?: string | null
          related_employee_id?: string | null
          related_garage_job_id?: string | null
          related_marketing_campaign_id?: string | null
          related_purchase_order_id?: string | null
          related_sales_order_id?: string | null
          related_supplier_id?: string | null
          subcategory?: string | null
          type: string
          updated_at?: string
        }
        Update: {
          amount?: number
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          category?: string
          cost_date?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          payment_method?: string | null
          receipt_url?: string | null
          related_car_id?: string | null
          related_customer_id?: string | null
          related_employee_id?: string | null
          related_garage_job_id?: string | null
          related_marketing_campaign_id?: string | null
          related_purchase_order_id?: string | null
          related_sales_order_id?: string | null
          related_supplier_id?: string | null
          subcategory?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_costs_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_costs_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "report_sales_rep_performance"
            referencedColumns: ["sales_rep_id"]
          },
          {
            foreignKeyName: "company_costs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_costs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "report_sales_rep_performance"
            referencedColumns: ["sales_rep_id"]
          },
          {
            foreignKeyName: "company_costs_related_car_id_fkey"
            columns: ["related_car_id"]
            isOneToOne: false
            referencedRelation: "car_service_status"
            referencedColumns: ["car_id"]
          },
          {
            foreignKeyName: "company_costs_related_car_id_fkey"
            columns: ["related_car_id"]
            isOneToOne: false
            referencedRelation: "cars"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_costs_related_car_id_fkey"
            columns: ["related_car_id"]
            isOneToOne: false
            referencedRelation: "cars_display"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_costs_related_car_id_fkey"
            columns: ["related_car_id"]
            isOneToOne: false
            referencedRelation: "cars_missing_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_costs_related_car_id_fkey"
            columns: ["related_car_id"]
            isOneToOne: false
            referencedRelation: "report_inventory_aging"
            referencedColumns: ["car_id"]
          },
          {
            foreignKeyName: "company_costs_related_customer_id_fkey"
            columns: ["related_customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_costs_related_customer_id_fkey"
            columns: ["related_customer_id"]
            isOneToOne: false
            referencedRelation: "customers_display"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_costs_related_employee_id_fkey"
            columns: ["related_employee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_costs_related_employee_id_fkey"
            columns: ["related_employee_id"]
            isOneToOne: false
            referencedRelation: "report_sales_rep_performance"
            referencedColumns: ["sales_rep_id"]
          },
          {
            foreignKeyName: "company_costs_related_garage_job_id_fkey"
            columns: ["related_garage_job_id"]
            isOneToOne: false
            referencedRelation: "garage_job_efficiency"
            referencedColumns: ["job_id"]
          },
          {
            foreignKeyName: "company_costs_related_garage_job_id_fkey"
            columns: ["related_garage_job_id"]
            isOneToOne: false
            referencedRelation: "garage_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_costs_related_garage_job_id_fkey"
            columns: ["related_garage_job_id"]
            isOneToOne: false
            referencedRelation: "report_garage_time_in_state"
            referencedColumns: ["job_id"]
          },
          {
            foreignKeyName: "company_costs_related_marketing_campaign_id_fkey"
            columns: ["related_marketing_campaign_id"]
            isOneToOne: false
            referencedRelation: "marketing_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_costs_related_purchase_order_id_fkey"
            columns: ["related_purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_costs_related_sales_order_id_fkey"
            columns: ["related_sales_order_id"]
            isOneToOne: false
            referencedRelation: "report_sales_margin"
            referencedColumns: ["sales_order_id"]
          },
          {
            foreignKeyName: "company_costs_related_sales_order_id_fkey"
            columns: ["related_sales_order_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_costs_related_supplier_id_fkey"
            columns: ["related_supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_credits: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          currency: string
          customer_id: string
          id: string
          note: string | null
          source_id: string | null
          source_type: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          currency?: string
          customer_id: string
          id?: string
          note?: string | null
          source_id?: string | null
          source_type: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          currency?: string
          customer_id?: string
          id?: string
          note?: string | null
          source_id?: string | null
          source_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_credits_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_credits_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers_display"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_documents: {
        Row: {
          created_at: string
          customer_id: string
          document_type: string
          file_name: string
          file_path: string
          file_size: number | null
          id: string
          mime_type: string | null
          notes: string | null
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          customer_id: string
          document_type: string
          file_name: string
          file_path: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          notes?: string | null
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          customer_id?: string
          document_type?: string
          file_name?: string
          file_path?: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          notes?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_documents_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_documents_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers_display"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_interactions: {
        Row: {
          body: string | null
          car_id: string | null
          channel: string
          created_at: string
          created_by: string | null
          customer_id: string
          direction: string
          id: string
          occurred_at: string
          subject: string | null
          updated_at: string
        }
        Insert: {
          body?: string | null
          car_id?: string | null
          channel: string
          created_at?: string
          created_by?: string | null
          customer_id: string
          direction: string
          id?: string
          occurred_at?: string
          subject?: string | null
          updated_at?: string
        }
        Update: {
          body?: string | null
          car_id?: string | null
          channel?: string
          created_at?: string
          created_by?: string | null
          customer_id?: string
          direction?: string
          id?: string
          occurred_at?: string
          subject?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_interactions_car_id_fkey"
            columns: ["car_id"]
            isOneToOne: false
            referencedRelation: "car_service_status"
            referencedColumns: ["car_id"]
          },
          {
            foreignKeyName: "customer_interactions_car_id_fkey"
            columns: ["car_id"]
            isOneToOne: false
            referencedRelation: "cars"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_interactions_car_id_fkey"
            columns: ["car_id"]
            isOneToOne: false
            referencedRelation: "cars_display"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_interactions_car_id_fkey"
            columns: ["car_id"]
            isOneToOne: false
            referencedRelation: "cars_missing_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_interactions_car_id_fkey"
            columns: ["car_id"]
            isOneToOne: false
            referencedRelation: "report_inventory_aging"
            referencedColumns: ["car_id"]
          },
          {
            foreignKeyName: "customer_interactions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_interactions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "report_sales_rep_performance"
            referencedColumns: ["sales_rep_id"]
          },
          {
            foreignKeyName: "customer_interactions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_interactions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers_display"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_notes: {
        Row: {
          content: string
          created_at: string
          created_by: string | null
          customer_id: string
          id: string
          note_type: string
        }
        Insert: {
          content: string
          created_at?: string
          created_by?: string | null
          customer_id: string
          id?: string
          note_type?: string
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string | null
          customer_id?: string
          id?: string
          note_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_notes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_notes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers_display"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address: string | null
          anonymized_at: string | null
          anonymized_by: string | null
          company: string | null
          created_at: string
          created_by: string | null
          date_of_birth: string | null
          deleted_at: string | null
          email: string | null
          first_name: string
          id: string
          last_name: string | null
          last_visit_date: string | null
          lead_source: Database["public"]["Enums"]["lead_source"] | null
          lead_status: Database["public"]["Enums"]["lead_status"]
          notes: string | null
          phone_primary: string | null
          phone_secondary: string | null
          preferred_language: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          anonymized_at?: string | null
          anonymized_by?: string | null
          company?: string | null
          created_at?: string
          created_by?: string | null
          date_of_birth?: string | null
          deleted_at?: string | null
          email?: string | null
          first_name: string
          id?: string
          last_name?: string | null
          last_visit_date?: string | null
          lead_source?: Database["public"]["Enums"]["lead_source"] | null
          lead_status?: Database["public"]["Enums"]["lead_status"]
          notes?: string | null
          phone_primary?: string | null
          phone_secondary?: string | null
          preferred_language?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          anonymized_at?: string | null
          anonymized_by?: string | null
          company?: string | null
          created_at?: string
          created_by?: string | null
          date_of_birth?: string | null
          deleted_at?: string | null
          email?: string | null
          first_name?: string
          id?: string
          last_name?: string | null
          last_visit_date?: string | null
          lead_source?: Database["public"]["Enums"]["lead_source"] | null
          lead_status?: Database["public"]["Enums"]["lead_status"]
          notes?: string | null
          phone_primary?: string | null
          phone_secondary?: string | null
          preferred_language?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      delete_requests: {
        Row: {
          created_at: string | null
          id: string
          item_details: Json
          item_id: string
          item_type: string
          requested_by: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          item_details: Json
          item_id: string
          item_type: string
          requested_by?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          item_details?: Json
          item_id?: string
          item_type?: string
          requested_by?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "delete_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delete_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "report_sales_rep_performance"
            referencedColumns: ["sales_rep_id"]
          },
          {
            foreignKeyName: "delete_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delete_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "report_sales_rep_performance"
            referencedColumns: ["sales_rep_id"]
          },
        ]
      }
      document_access_requests: {
        Row: {
          created_at: string | null
          document_id: string | null
          id: string
          requested_by: string | null
          reviewed_by: string | null
          search_query: string
          status: string | null
        }
        Insert: {
          created_at?: string | null
          document_id?: string | null
          id?: string
          requested_by?: string | null
          reviewed_by?: string | null
          search_query: string
          status?: string | null
        }
        Update: {
          created_at?: string | null
          document_id?: string | null
          id?: string
          requested_by?: string | null
          reviewed_by?: string | null
          search_query?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "document_access_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_access_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "report_sales_rep_performance"
            referencedColumns: ["sales_rep_id"]
          },
          {
            foreignKeyName: "document_access_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_access_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "report_sales_rep_performance"
            referencedColumns: ["sales_rep_id"]
          },
        ]
      }
      garage_bays: {
        Row: {
          bay_number: number
          bay_type: string
          created_at: string | null
          current_job_id: string | null
          id: number
          is_active: boolean
          name: string
          sort_order: number
          status: string
          updated_at: string | null
        }
        Insert: {
          bay_number: number
          bay_type: string
          created_at?: string | null
          current_job_id?: string | null
          id?: number
          is_active?: boolean
          name: string
          sort_order?: number
          status?: string
          updated_at?: string | null
        }
        Update: {
          bay_number?: number
          bay_type?: string
          created_at?: string | null
          current_job_id?: string | null
          id?: number
          is_active?: boolean
          name?: string
          sort_order?: number
          status?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      garage_capacities: {
        Row: {
          capacity: number
          resource_name: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          capacity: number
          resource_name: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          capacity?: number
          resource_name?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "garage_capacities_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "garage_capacities_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "report_sales_rep_performance"
            referencedColumns: ["sales_rep_id"]
          },
        ]
      }
      garage_job_bay_context: {
        Row: {
          bay_type: string
          context: Json
          created_at: string
          created_by: string | null
          id: string
          job_id: string
          updated_at: string
        }
        Insert: {
          bay_type: string
          context?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          job_id: string
          updated_at?: string
        }
        Update: {
          bay_type?: string
          context?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          job_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "garage_job_bay_context_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "garage_job_bay_context_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "report_sales_rep_performance"
            referencedColumns: ["sales_rep_id"]
          },
          {
            foreignKeyName: "garage_job_bay_context_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "garage_job_efficiency"
            referencedColumns: ["job_id"]
          },
          {
            foreignKeyName: "garage_job_bay_context_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "garage_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "garage_job_bay_context_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "report_garage_time_in_state"
            referencedColumns: ["job_id"]
          },
        ]
      }
      garage_jobs: {
        Row: {
          actual_hours: number | null
          assigned_to: string | null
          bay_entered_at: string | null
          bay_exited_at: string | null
          car_id: string | null
          complaint: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          current_km: number | null
          customer_id: string | null
          deleted_at: string | null
          delivered_at: string | null
          description: string | null
          diagnosis: string | null
          due_date: string | null
          estimated_hours: number | null
          external_assignee_name: string | null
          garage_bay_id: number | null
          id: string
          is_battery_only: boolean | null
          job_number: string | null
          notes: string | null
          overtime_notified: boolean | null
          priority: string | null
          started_at: string
          status: string
          task_category_id: string | null
          title: string | null
          updated_at: string
          work_checklist: Json | null
          work_done: string | null
        }
        Insert: {
          actual_hours?: number | null
          assigned_to?: string | null
          bay_entered_at?: string | null
          bay_exited_at?: string | null
          car_id?: string | null
          complaint?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          current_km?: number | null
          customer_id?: string | null
          deleted_at?: string | null
          delivered_at?: string | null
          description?: string | null
          diagnosis?: string | null
          due_date?: string | null
          estimated_hours?: number | null
          external_assignee_name?: string | null
          garage_bay_id?: number | null
          id?: string
          is_battery_only?: boolean | null
          job_number?: string | null
          notes?: string | null
          overtime_notified?: boolean | null
          priority?: string | null
          started_at?: string
          status?: string
          task_category_id?: string | null
          title?: string | null
          updated_at?: string
          work_checklist?: Json | null
          work_done?: string | null
        }
        Update: {
          actual_hours?: number | null
          assigned_to?: string | null
          bay_entered_at?: string | null
          bay_exited_at?: string | null
          car_id?: string | null
          complaint?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          current_km?: number | null
          customer_id?: string | null
          deleted_at?: string | null
          delivered_at?: string | null
          description?: string | null
          diagnosis?: string | null
          due_date?: string | null
          estimated_hours?: number | null
          external_assignee_name?: string | null
          garage_bay_id?: number | null
          id?: string
          is_battery_only?: boolean | null
          job_number?: string | null
          notes?: string | null
          overtime_notified?: boolean | null
          priority?: string | null
          started_at?: string
          status?: string
          task_category_id?: string | null
          title?: string | null
          updated_at?: string
          work_checklist?: Json | null
          work_done?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "garage_jobs_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "garage_jobs_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "report_sales_rep_performance"
            referencedColumns: ["sales_rep_id"]
          },
          {
            foreignKeyName: "garage_jobs_car_id_fkey"
            columns: ["car_id"]
            isOneToOne: false
            referencedRelation: "car_service_status"
            referencedColumns: ["car_id"]
          },
          {
            foreignKeyName: "garage_jobs_car_id_fkey"
            columns: ["car_id"]
            isOneToOne: false
            referencedRelation: "cars"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "garage_jobs_car_id_fkey"
            columns: ["car_id"]
            isOneToOne: false
            referencedRelation: "cars_display"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "garage_jobs_car_id_fkey"
            columns: ["car_id"]
            isOneToOne: false
            referencedRelation: "cars_missing_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "garage_jobs_car_id_fkey"
            columns: ["car_id"]
            isOneToOne: false
            referencedRelation: "report_inventory_aging"
            referencedColumns: ["car_id"]
          },
          {
            foreignKeyName: "garage_jobs_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "garage_jobs_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers_display"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "garage_jobs_garage_bay_id_fkey"
            columns: ["garage_bay_id"]
            isOneToOne: false
            referencedRelation: "garage_bay_utilization"
            referencedColumns: ["bay_id"]
          },
          {
            foreignKeyName: "garage_jobs_garage_bay_id_fkey"
            columns: ["garage_bay_id"]
            isOneToOne: false
            referencedRelation: "garage_bays"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "garage_jobs_task_category_id_fkey"
            columns: ["task_category_id"]
            isOneToOne: false
            referencedRelation: "task_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      garage_task_template_items: {
        Row: {
          default_resource_type: string | null
          description: string
          id: string
          sort_order: number
          template_id: string
        }
        Insert: {
          default_resource_type?: string | null
          description: string
          id?: string
          sort_order?: number
          template_id: string
        }
        Update: {
          default_resource_type?: string | null
          description?: string
          id?: string
          sort_order?: number
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "garage_task_template_items_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "garage_task_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      garage_task_templates: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_system: boolean
          name: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_system?: boolean
          name: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_system?: boolean
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "garage_task_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "garage_task_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "report_sales_rep_performance"
            referencedColumns: ["sales_rep_id"]
          },
        ]
      }
      garage_tasks: {
        Row: {
          assigned_to: string | null
          car_id: string
          completed_at: string | null
          created_at: string
          created_by: string | null
          description: string
          id: string
          notes: string | null
          resource_type: string | null
          sort_order: number
          started_at: string | null
          status: Database["public"]["Enums"]["garage_task_status"]
          template_item_id: string | null
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          car_id: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description: string
          id?: string
          notes?: string | null
          resource_type?: string | null
          sort_order?: number
          started_at?: string | null
          status?: Database["public"]["Enums"]["garage_task_status"]
          template_item_id?: string | null
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          car_id?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          notes?: string | null
          resource_type?: string | null
          sort_order?: number
          started_at?: string | null
          status?: Database["public"]["Enums"]["garage_task_status"]
          template_item_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "garage_tasks_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "garage_tasks_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "report_sales_rep_performance"
            referencedColumns: ["sales_rep_id"]
          },
          {
            foreignKeyName: "garage_tasks_car_id_fkey"
            columns: ["car_id"]
            isOneToOne: false
            referencedRelation: "car_service_status"
            referencedColumns: ["car_id"]
          },
          {
            foreignKeyName: "garage_tasks_car_id_fkey"
            columns: ["car_id"]
            isOneToOne: false
            referencedRelation: "cars"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "garage_tasks_car_id_fkey"
            columns: ["car_id"]
            isOneToOne: false
            referencedRelation: "cars_display"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "garage_tasks_car_id_fkey"
            columns: ["car_id"]
            isOneToOne: false
            referencedRelation: "cars_missing_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "garage_tasks_car_id_fkey"
            columns: ["car_id"]
            isOneToOne: false
            referencedRelation: "report_inventory_aging"
            referencedColumns: ["car_id"]
          },
          {
            foreignKeyName: "garage_tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "garage_tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "report_sales_rep_performance"
            referencedColumns: ["sales_rep_id"]
          },
          {
            foreignKeyName: "garage_tasks_template_item_id_fkey"
            columns: ["template_item_id"]
            isOneToOne: false
            referencedRelation: "garage_task_template_items"
            referencedColumns: ["id"]
          },
        ]
      }
      infrastructure_compute_target: {
        Row: {
          desired_addon_type: string
          desired_variant_id: string | null
          id: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          desired_addon_type?: string
          desired_variant_id?: string | null
          id?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          desired_addon_type?: string
          desired_variant_id?: string | null
          id?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "infrastructure_compute_target_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "infrastructure_compute_target_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "report_sales_rep_performance"
            referencedColumns: ["sales_rep_id"]
          },
        ]
      }
      installment_payments: {
        Row: {
          amount_due: number
          created_at: string
          due_date: string
          id: string
          installment_no: number
          marked_paid_by: string | null
          note: string | null
          paid_amount: number | null
          paid_at: string | null
          payment_method: string | null
          plan_id: string
          receipt_url: string | null
          status: Database["public"]["Enums"]["installment_status"]
          updated_at: string
        }
        Insert: {
          amount_due: number
          created_at?: string
          due_date: string
          id?: string
          installment_no: number
          marked_paid_by?: string | null
          note?: string | null
          paid_amount?: number | null
          paid_at?: string | null
          payment_method?: string | null
          plan_id: string
          receipt_url?: string | null
          status?: Database["public"]["Enums"]["installment_status"]
          updated_at?: string
        }
        Update: {
          amount_due?: number
          created_at?: string
          due_date?: string
          id?: string
          installment_no?: number
          marked_paid_by?: string | null
          note?: string | null
          paid_amount?: number | null
          paid_at?: string | null
          payment_method?: string | null
          plan_id?: string
          receipt_url?: string | null
          status?: Database["public"]["Enums"]["installment_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "installment_payments_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "payment_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          created_at: string
          created_by: string | null
          currency: string
          customer_id: string
          due_at: string | null
          id: string
          invoice_number: string
          issued_at: string
          notes: string | null
          paid_amount: number
          sales_order_id: string | null
          status: string
          total_amount: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          currency?: string
          customer_id: string
          due_at?: string | null
          id?: string
          invoice_number: string
          issued_at?: string
          notes?: string | null
          paid_amount?: number
          sales_order_id?: string | null
          status?: string
          total_amount: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          currency?: string
          customer_id?: string
          due_at?: string | null
          id?: string
          invoice_number?: string
          issued_at?: string
          notes?: string | null
          paid_amount?: number
          sales_order_id?: string | null
          status?: string
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "report_sales_rep_performance"
            referencedColumns: ["sales_rep_id"]
          },
          {
            foreignKeyName: "invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers_display"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_sales_order_id_fkey"
            columns: ["sales_order_id"]
            isOneToOne: false
            referencedRelation: "report_sales_margin"
            referencedColumns: ["sales_order_id"]
          },
          {
            foreignKeyName: "invoices_sales_order_id_fkey"
            columns: ["sales_order_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      job_documents: {
        Row: {
          created_at: string
          document_type: string
          file_name: string
          file_path: string
          file_size: number | null
          id: string
          job_id: string
          mime_type: string | null
          notes: string | null
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          document_type?: string
          file_name: string
          file_path: string
          file_size?: number | null
          id?: string
          job_id: string
          mime_type?: string | null
          notes?: string | null
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          document_type?: string
          file_name?: string
          file_path?: string
          file_size?: number | null
          id?: string
          job_id?: string
          mime_type?: string | null
          notes?: string | null
          uploaded_by?: string | null
        }
        Relationships: []
      }
      job_parts: {
        Row: {
          created_at: string
          created_by: string | null
          currency_snapshot: string | null
          id: string
          job_id: string
          note: string | null
          part_id: string
          quantity: number
          unit_cost_snapshot: number | null
          used_at: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          currency_snapshot?: string | null
          id?: string
          job_id: string
          note?: string | null
          part_id: string
          quantity?: number
          unit_cost_snapshot?: number | null
          used_at?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          currency_snapshot?: string | null
          id?: string
          job_id?: string
          note?: string | null
          part_id?: string
          quantity?: number
          unit_cost_snapshot?: number | null
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "job_parts_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "parts"
            referencedColumns: ["id"]
          },
        ]
      }
      job_time_entries: {
        Row: {
          bay_id: number | null
          created_at: string | null
          duration_minutes: number | null
          ended_at: string | null
          id: string
          job_id: string
          notes: string | null
          started_at: string
          user_id: string
        }
        Insert: {
          bay_id?: number | null
          created_at?: string | null
          duration_minutes?: number | null
          ended_at?: string | null
          id?: string
          job_id: string
          notes?: string | null
          started_at?: string
          user_id: string
        }
        Update: {
          bay_id?: number | null
          created_at?: string | null
          duration_minutes?: number | null
          ended_at?: string | null
          id?: string
          job_id?: string
          notes?: string | null
          started_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_entries_employee_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entries_employee_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "report_sales_rep_performance"
            referencedColumns: ["sales_rep_id"]
          },
        ]
      }
      marketing_campaigns: {
        Row: {
          budget_amount: number | null
          budget_currency: string
          created_at: string
          created_by: string | null
          end_date: string | null
          id: string
          name: string
          notes: string | null
          platform: string | null
          related_car_id: string | null
          start_date: string | null
          status: string
          updated_at: string
        }
        Insert: {
          budget_amount?: number | null
          budget_currency?: string
          created_at?: string
          created_by?: string | null
          end_date?: string | null
          id?: string
          name: string
          notes?: string | null
          platform?: string | null
          related_car_id?: string | null
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          budget_amount?: number | null
          budget_currency?: string
          created_at?: string
          created_by?: string | null
          end_date?: string | null
          id?: string
          name?: string
          notes?: string | null
          platform?: string | null
          related_car_id?: string | null
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketing_campaigns_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketing_campaigns_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "report_sales_rep_performance"
            referencedColumns: ["sales_rep_id"]
          },
          {
            foreignKeyName: "marketing_campaigns_related_car_id_fkey"
            columns: ["related_car_id"]
            isOneToOne: false
            referencedRelation: "car_service_status"
            referencedColumns: ["car_id"]
          },
          {
            foreignKeyName: "marketing_campaigns_related_car_id_fkey"
            columns: ["related_car_id"]
            isOneToOne: false
            referencedRelation: "cars"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketing_campaigns_related_car_id_fkey"
            columns: ["related_car_id"]
            isOneToOne: false
            referencedRelation: "cars_display"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketing_campaigns_related_car_id_fkey"
            columns: ["related_car_id"]
            isOneToOne: false
            referencedRelation: "cars_missing_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketing_campaigns_related_car_id_fkey"
            columns: ["related_car_id"]
            isOneToOne: false
            referencedRelation: "report_inventory_aging"
            referencedColumns: ["car_id"]
          },
        ]
      }
      notification_event_rules: {
        Row: {
          active: boolean
          category: Database["public"]["Enums"]["notification_category"]
          channel_email: boolean
          channel_inapp: boolean
          channel_whatsapp: boolean
          created_at: string
          description: string | null
          event_type: string
          id: string
          note: string | null
          recipient_kind: string
          recipient_value: string | null
          severity: Database["public"]["Enums"]["notification_severity"]
          updated_at: string
        }
        Insert: {
          active?: boolean
          category: Database["public"]["Enums"]["notification_category"]
          channel_email?: boolean
          channel_inapp?: boolean
          channel_whatsapp?: boolean
          created_at?: string
          description?: string | null
          event_type: string
          id?: string
          note?: string | null
          recipient_kind: string
          recipient_value?: string | null
          severity: Database["public"]["Enums"]["notification_severity"]
          updated_at?: string
        }
        Update: {
          active?: boolean
          category?: Database["public"]["Enums"]["notification_category"]
          channel_email?: boolean
          channel_inapp?: boolean
          channel_whatsapp?: boolean
          created_at?: string
          description?: string | null
          event_type?: string
          id?: string
          note?: string | null
          recipient_kind?: string
          recipient_value?: string | null
          severity?: Database["public"]["Enums"]["notification_severity"]
          updated_at?: string
        }
        Relationships: []
      }
      notification_preferences: {
        Row: {
          created_at: string
          desktop_push: boolean
          digest_categories: string[]
          email_enabled: boolean
          in_app_enabled: boolean
          muted_entity_keys: string[]
          quiet_hours_end: string | null
          quiet_hours_start: string | null
          sound_on_critical: boolean
          updated_at: string
          user_id: string
          whatsapp_enabled: boolean
        }
        Insert: {
          created_at?: string
          desktop_push?: boolean
          digest_categories?: string[]
          email_enabled?: boolean
          in_app_enabled?: boolean
          muted_entity_keys?: string[]
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          sound_on_critical?: boolean
          updated_at?: string
          user_id: string
          whatsapp_enabled?: boolean
        }
        Update: {
          created_at?: string
          desktop_push?: boolean
          digest_categories?: string[]
          email_enabled?: boolean
          in_app_enabled?: boolean
          muted_entity_keys?: string[]
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          sound_on_critical?: boolean
          updated_at?: string
          user_id?: string
          whatsapp_enabled?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "notification_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "report_sales_rep_performance"
            referencedColumns: ["sales_rep_id"]
          },
        ]
      }
      notifications: {
        Row: {
          category: Database["public"]["Enums"]["notification_category"] | null
          created_at: string | null
          delivered_email_at: string | null
          delivered_whatsapp_at: string | null
          dismissed_at: string | null
          event_type: string | null
          id: string
          is_read: boolean | null
          link: string | null
          message: string
          metadata: Json | null
          read_at: string | null
          related_entity_id: string | null
          related_entity_type: string | null
          severity: Database["public"]["Enums"]["notification_severity"]
          snoozed_until: string | null
          title: string
          user_id: string | null
        }
        Insert: {
          category?: Database["public"]["Enums"]["notification_category"] | null
          created_at?: string | null
          delivered_email_at?: string | null
          delivered_whatsapp_at?: string | null
          dismissed_at?: string | null
          event_type?: string | null
          id?: string
          is_read?: boolean | null
          link?: string | null
          message: string
          metadata?: Json | null
          read_at?: string | null
          related_entity_id?: string | null
          related_entity_type?: string | null
          severity?: Database["public"]["Enums"]["notification_severity"]
          snoozed_until?: string | null
          title: string
          user_id?: string | null
        }
        Update: {
          category?: Database["public"]["Enums"]["notification_category"] | null
          created_at?: string | null
          delivered_email_at?: string | null
          delivered_whatsapp_at?: string | null
          dismissed_at?: string | null
          event_type?: string | null
          id?: string
          is_read?: boolean | null
          link?: string | null
          message?: string
          metadata?: Json | null
          read_at?: string | null
          related_entity_id?: string | null
          related_entity_type?: string | null
          severity?: Database["public"]["Enums"]["notification_severity"]
          snoozed_until?: string | null
          title?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "report_sales_rep_performance"
            referencedColumns: ["sales_rep_id"]
          },
        ]
      }
      page_access_requests: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          page_name: string
          requested_by: string
          reviewed_by: string | null
          status: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          page_name: string
          requested_by: string
          reviewed_by?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          page_name?: string
          requested_by?: string
          reviewed_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "page_access_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "page_access_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "report_sales_rep_performance"
            referencedColumns: ["sales_rep_id"]
          },
          {
            foreignKeyName: "page_access_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "page_access_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "report_sales_rep_performance"
            referencedColumns: ["sales_rep_id"]
          },
        ]
      }
      part_movements: {
        Row: {
          car_id: string | null
          created_at: string
          created_by: string | null
          id: string
          job_description: string | null
          movement_type: string
          note: string | null
          part_id: string
          quantity: number
        }
        Insert: {
          car_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          job_description?: string | null
          movement_type: string
          note?: string | null
          part_id: string
          quantity: number
        }
        Update: {
          car_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          job_description?: string | null
          movement_type?: string
          note?: string | null
          part_id?: string
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "part_movements_car_id_fkey"
            columns: ["car_id"]
            isOneToOne: false
            referencedRelation: "car_service_status"
            referencedColumns: ["car_id"]
          },
          {
            foreignKeyName: "part_movements_car_id_fkey"
            columns: ["car_id"]
            isOneToOne: false
            referencedRelation: "cars"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "part_movements_car_id_fkey"
            columns: ["car_id"]
            isOneToOne: false
            referencedRelation: "cars_display"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "part_movements_car_id_fkey"
            columns: ["car_id"]
            isOneToOne: false
            referencedRelation: "cars_missing_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "part_movements_car_id_fkey"
            columns: ["car_id"]
            isOneToOne: false
            referencedRelation: "report_inventory_aging"
            referencedColumns: ["car_id"]
          },
          {
            foreignKeyName: "part_movements_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "parts"
            referencedColumns: ["id"]
          },
        ]
      }
      parts: {
        Row: {
          car_model: string | null
          created_at: string
          created_by: string | null
          currency: string | null
          deleted_at: string | null
          description: string | null
          id: string
          min_quantity: number
          notes: string | null
          oe_number: string | null
          order_date: string | null
          part_name: string
          quantity: number
          received_at: string | null
          status: Database["public"]["Enums"]["part_status"]
          storage_zone: string | null
          supplier: string | null
          supplier_contact: string | null
          supplier_id: string | null
          unit_cost: number | null
          updated_at: string
        }
        Insert: {
          car_model?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: string
          min_quantity?: number
          notes?: string | null
          oe_number?: string | null
          order_date?: string | null
          part_name: string
          quantity?: number
          received_at?: string | null
          status?: Database["public"]["Enums"]["part_status"]
          storage_zone?: string | null
          supplier?: string | null
          supplier_contact?: string | null
          supplier_id?: string | null
          unit_cost?: number | null
          updated_at?: string
        }
        Update: {
          car_model?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: string
          min_quantity?: number
          notes?: string | null
          oe_number?: string | null
          order_date?: string | null
          part_name?: string
          quantity?: number
          received_at?: string | null
          status?: Database["public"]["Enums"]["part_status"]
          storage_zone?: string | null
          supplier?: string | null
          supplier_contact?: string | null
          supplier_id?: string | null
          unit_cost?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "parts_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_plans: {
        Row: {
          car_id: string
          created_at: string
          created_by: string | null
          customer_id: string
          deleted_at: string | null
          down_payment: number
          due_day: number
          id: string
          interest_rate: number | null
          monthly_amount: number
          months: number
          start_date: string
          status: Database["public"]["Enums"]["payment_plan_status"]
          total_amount: number
          updated_at: string
        }
        Insert: {
          car_id: string
          created_at?: string
          created_by?: string | null
          customer_id: string
          deleted_at?: string | null
          down_payment?: number
          due_day: number
          id?: string
          interest_rate?: number | null
          monthly_amount: number
          months: number
          start_date: string
          status?: Database["public"]["Enums"]["payment_plan_status"]
          total_amount: number
          updated_at?: string
        }
        Update: {
          car_id?: string
          created_at?: string
          created_by?: string | null
          customer_id?: string
          deleted_at?: string | null
          down_payment?: number
          due_day?: number
          id?: string
          interest_rate?: number | null
          monthly_amount?: number
          months?: number
          start_date?: string
          status?: Database["public"]["Enums"]["payment_plan_status"]
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_plans_car_id_fkey"
            columns: ["car_id"]
            isOneToOne: false
            referencedRelation: "car_service_status"
            referencedColumns: ["car_id"]
          },
          {
            foreignKeyName: "payment_plans_car_id_fkey"
            columns: ["car_id"]
            isOneToOne: false
            referencedRelation: "cars"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_plans_car_id_fkey"
            columns: ["car_id"]
            isOneToOne: false
            referencedRelation: "cars_display"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_plans_car_id_fkey"
            columns: ["car_id"]
            isOneToOne: false
            referencedRelation: "cars_missing_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_plans_car_id_fkey"
            columns: ["car_id"]
            isOneToOne: false
            referencedRelation: "report_inventory_aging"
            referencedColumns: ["car_id"]
          },
          {
            foreignKeyName: "payment_plans_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_plans_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers_display"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          can_view_owner_requests: boolean
          capabilities: Database["public"]["Enums"]["user_capability"][]
          created_at: string
          created_by: string | null
          department: string | null
          email: string | null
          employment_status: string
          full_name: string
          id: string
          is_active: boolean
          is_pipeline_user: boolean
          job_title: string | null
          last_active_at: string | null
          must_change_password: boolean | null
          onboarding_completed: boolean | null
          onboarding_completed_at: string | null
          phone: string | null
          preferred_language: string | null
          terminated_at: string | null
          termination_reason: string | null
          updated_at: string
          updated_by: string | null
          user_role: Database["public"]["Enums"]["user_role"] | null
        }
        Insert: {
          can_view_owner_requests?: boolean
          capabilities?: Database["public"]["Enums"]["user_capability"][]
          created_at?: string
          created_by?: string | null
          department?: string | null
          email?: string | null
          employment_status?: string
          full_name: string
          id: string
          is_active?: boolean
          is_pipeline_user?: boolean
          job_title?: string | null
          last_active_at?: string | null
          must_change_password?: boolean | null
          onboarding_completed?: boolean | null
          onboarding_completed_at?: string | null
          phone?: string | null
          preferred_language?: string | null
          terminated_at?: string | null
          termination_reason?: string | null
          updated_at?: string
          updated_by?: string | null
          user_role?: Database["public"]["Enums"]["user_role"] | null
        }
        Update: {
          can_view_owner_requests?: boolean
          capabilities?: Database["public"]["Enums"]["user_capability"][]
          created_at?: string
          created_by?: string | null
          department?: string | null
          email?: string | null
          employment_status?: string
          full_name?: string
          id?: string
          is_active?: boolean
          is_pipeline_user?: boolean
          job_title?: string | null
          last_active_at?: string | null
          must_change_password?: boolean | null
          onboarding_completed?: boolean | null
          onboarding_completed_at?: string | null
          phone?: string | null
          preferred_language?: string | null
          terminated_at?: string | null
          termination_reason?: string | null
          updated_at?: string
          updated_by?: string | null
          user_role?: Database["public"]["Enums"]["user_role"] | null
        }
        Relationships: []
      }
      purchase_order_invoices: {
        Row: {
          amount: number
          attached_by: string | null
          created_at: string
          currency: string
          due_at: string | null
          file_url: string | null
          id: string
          invoice_date: string
          po_id: string
          status: string
          supplier_invoice_number: string
          updated_at: string
          vat_amount: number
        }
        Insert: {
          amount: number
          attached_by?: string | null
          created_at?: string
          currency?: string
          due_at?: string | null
          file_url?: string | null
          id?: string
          invoice_date: string
          po_id: string
          status?: string
          supplier_invoice_number: string
          updated_at?: string
          vat_amount?: number
        }
        Update: {
          amount?: number
          attached_by?: string | null
          created_at?: string
          currency?: string
          due_at?: string | null
          file_url?: string | null
          id?: string
          invoice_date?: string
          po_id?: string
          status?: string
          supplier_invoice_number?: string
          updated_at?: string
          vat_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_invoices_attached_by_fkey"
            columns: ["attached_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_invoices_attached_by_fkey"
            columns: ["attached_by"]
            isOneToOne: false
            referencedRelation: "report_sales_rep_performance"
            referencedColumns: ["sales_rep_id"]
          },
          {
            foreignKeyName: "purchase_order_invoices_po_id_fkey"
            columns: ["po_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_order_lines: {
        Row: {
          created_at: string
          id: string
          line_total: number | null
          note: string | null
          oe_number: string | null
          part_id: string | null
          part_name: string
          po_id: string
          quantity: number
          sort_order: number
          unit_cost: number
        }
        Insert: {
          created_at?: string
          id?: string
          line_total?: number | null
          note?: string | null
          oe_number?: string | null
          part_id?: string | null
          part_name: string
          po_id: string
          quantity: number
          sort_order?: number
          unit_cost?: number
        }
        Update: {
          created_at?: string
          id?: string
          line_total?: number | null
          note?: string | null
          oe_number?: string | null
          part_id?: string | null
          part_name?: string
          po_id?: string
          quantity?: number
          sort_order?: number
          unit_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_lines_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "parts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_lines_po_id_fkey"
            columns: ["po_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_order_payments: {
        Row: {
          amount: number
          created_at: string
          currency: string
          id: string
          invoice_id: string | null
          notes: string | null
          paid_at: string
          paid_by: string | null
          payment_method: string
          po_id: string
          reference: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          id?: string
          invoice_id?: string | null
          notes?: string | null
          paid_at?: string
          paid_by?: string | null
          payment_method: string
          po_id: string
          reference?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          id?: string
          invoice_id?: string | null
          notes?: string | null
          paid_at?: string
          paid_by?: string | null
          payment_method?: string
          po_id?: string
          reference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "purchase_order_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_payments_paid_by_fkey"
            columns: ["paid_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_payments_paid_by_fkey"
            columns: ["paid_by"]
            isOneToOne: false
            referencedRelation: "report_sales_rep_performance"
            referencedColumns: ["sales_rep_id"]
          },
          {
            foreignKeyName: "purchase_order_payments_po_id_fkey"
            columns: ["po_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_order_receipt_lines: {
        Row: {
          condition: string
          id: string
          note: string | null
          po_line_id: string
          quantity_received: number
          receipt_id: string
        }
        Insert: {
          condition?: string
          id?: string
          note?: string | null
          po_line_id: string
          quantity_received: number
          receipt_id: string
        }
        Update: {
          condition?: string
          id?: string
          note?: string | null
          po_line_id?: string
          quantity_received?: number
          receipt_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_receipt_lines_po_line_id_fkey"
            columns: ["po_line_id"]
            isOneToOne: false
            referencedRelation: "purchase_order_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_receipt_lines_receipt_id_fkey"
            columns: ["receipt_id"]
            isOneToOne: false
            referencedRelation: "purchase_order_receipts"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_order_receipts: {
        Row: {
          condition_note: string | null
          created_at: string
          grn_number: string
          id: string
          photos: string[]
          po_id: string
          received_at: string
          received_by: string | null
        }
        Insert: {
          condition_note?: string | null
          created_at?: string
          grn_number: string
          id?: string
          photos?: string[]
          po_id: string
          received_at?: string
          received_by?: string | null
        }
        Update: {
          condition_note?: string | null
          created_at?: string
          grn_number?: string
          id?: string
          photos?: string[]
          po_id?: string
          received_at?: string
          received_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_receipts_po_id_fkey"
            columns: ["po_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_receipts_received_by_fkey"
            columns: ["received_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_receipts_received_by_fkey"
            columns: ["received_by"]
            isOneToOne: false
            referencedRelation: "report_sales_rep_performance"
            referencedColumns: ["sales_rep_id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          cancel_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          created_at: string
          created_by: string | null
          currency: string
          deleted_at: string | null
          estimated_total: number
          expected_delivery_at: string | null
          id: string
          notes: string | null
          po_number: string
          rejected_at: string | null
          rejected_by: string | null
          rejection_reason: string | null
          related_car_id: string | null
          related_job_id: string | null
          requested_by: string | null
          sent_at: string | null
          sent_by: string | null
          status: string
          supplier_contact: string | null
          supplier_id: string | null
          supplier_reference: string | null
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          cancel_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          deleted_at?: string | null
          estimated_total?: number
          expected_delivery_at?: string | null
          id?: string
          notes?: string | null
          po_number: string
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_reason?: string | null
          related_car_id?: string | null
          related_job_id?: string | null
          requested_by?: string | null
          sent_at?: string | null
          sent_by?: string | null
          status?: string
          supplier_contact?: string | null
          supplier_id?: string | null
          supplier_reference?: string | null
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          cancel_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          deleted_at?: string | null
          estimated_total?: number
          expected_delivery_at?: string | null
          id?: string
          notes?: string | null
          po_number?: string
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_reason?: string | null
          related_car_id?: string | null
          related_job_id?: string | null
          requested_by?: string | null
          sent_at?: string | null
          sent_by?: string | null
          status?: string
          supplier_contact?: string | null
          supplier_id?: string | null
          supplier_reference?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "report_sales_rep_performance"
            referencedColumns: ["sales_rep_id"]
          },
          {
            foreignKeyName: "purchase_orders_cancelled_by_fkey"
            columns: ["cancelled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_cancelled_by_fkey"
            columns: ["cancelled_by"]
            isOneToOne: false
            referencedRelation: "report_sales_rep_performance"
            referencedColumns: ["sales_rep_id"]
          },
          {
            foreignKeyName: "purchase_orders_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "report_sales_rep_performance"
            referencedColumns: ["sales_rep_id"]
          },
          {
            foreignKeyName: "purchase_orders_rejected_by_fkey"
            columns: ["rejected_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_rejected_by_fkey"
            columns: ["rejected_by"]
            isOneToOne: false
            referencedRelation: "report_sales_rep_performance"
            referencedColumns: ["sales_rep_id"]
          },
          {
            foreignKeyName: "purchase_orders_related_car_id_fkey"
            columns: ["related_car_id"]
            isOneToOne: false
            referencedRelation: "car_service_status"
            referencedColumns: ["car_id"]
          },
          {
            foreignKeyName: "purchase_orders_related_car_id_fkey"
            columns: ["related_car_id"]
            isOneToOne: false
            referencedRelation: "cars"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_related_car_id_fkey"
            columns: ["related_car_id"]
            isOneToOne: false
            referencedRelation: "cars_display"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_related_car_id_fkey"
            columns: ["related_car_id"]
            isOneToOne: false
            referencedRelation: "cars_missing_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_related_car_id_fkey"
            columns: ["related_car_id"]
            isOneToOne: false
            referencedRelation: "report_inventory_aging"
            referencedColumns: ["car_id"]
          },
          {
            foreignKeyName: "purchase_orders_related_job_id_fkey"
            columns: ["related_job_id"]
            isOneToOne: false
            referencedRelation: "garage_job_efficiency"
            referencedColumns: ["job_id"]
          },
          {
            foreignKeyName: "purchase_orders_related_job_id_fkey"
            columns: ["related_job_id"]
            isOneToOne: false
            referencedRelation: "garage_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_related_job_id_fkey"
            columns: ["related_job_id"]
            isOneToOne: false
            referencedRelation: "report_garage_time_in_state"
            referencedColumns: ["job_id"]
          },
          {
            foreignKeyName: "purchase_orders_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "report_sales_rep_performance"
            referencedColumns: ["sales_rep_id"]
          },
          {
            foreignKeyName: "purchase_orders_sent_by_fkey"
            columns: ["sent_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_sent_by_fkey"
            columns: ["sent_by"]
            isOneToOne: false
            referencedRelation: "report_sales_rep_performance"
            referencedColumns: ["sales_rep_id"]
          },
          {
            foreignKeyName: "purchase_orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          created_at: string | null
          id: string
          subscription: Json
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          subscription: Json
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          subscription?: Json
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "push_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "report_sales_rep_performance"
            referencedColumns: ["sales_rep_id"]
          },
        ]
      }
      recall_vehicles: {
        Row: {
          car_id: string
          completed_at: string | null
          completed_by: string | null
          created_at: string
          id: string
          job_id: string | null
          notes: string | null
          notified_at: string | null
          recall_id: string
          scheduled_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          car_id: string
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          id?: string
          job_id?: string | null
          notes?: string | null
          notified_at?: string | null
          recall_id: string
          scheduled_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          car_id?: string
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          id?: string
          job_id?: string | null
          notes?: string | null
          notified_at?: string | null
          recall_id?: string
          scheduled_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recall_vehicles_car_id_fkey"
            columns: ["car_id"]
            isOneToOne: false
            referencedRelation: "car_service_status"
            referencedColumns: ["car_id"]
          },
          {
            foreignKeyName: "recall_vehicles_car_id_fkey"
            columns: ["car_id"]
            isOneToOne: false
            referencedRelation: "cars"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recall_vehicles_car_id_fkey"
            columns: ["car_id"]
            isOneToOne: false
            referencedRelation: "cars_display"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recall_vehicles_car_id_fkey"
            columns: ["car_id"]
            isOneToOne: false
            referencedRelation: "cars_missing_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recall_vehicles_car_id_fkey"
            columns: ["car_id"]
            isOneToOne: false
            referencedRelation: "report_inventory_aging"
            referencedColumns: ["car_id"]
          },
          {
            foreignKeyName: "recall_vehicles_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "garage_job_efficiency"
            referencedColumns: ["job_id"]
          },
          {
            foreignKeyName: "recall_vehicles_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "garage_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recall_vehicles_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "report_garage_time_in_state"
            referencedColumns: ["job_id"]
          },
          {
            foreignKeyName: "recall_vehicles_recall_id_fkey"
            columns: ["recall_id"]
            isOneToOne: false
            referencedRelation: "recalls"
            referencedColumns: ["id"]
          },
        ]
      }
      recalls: {
        Row: {
          affected_models: string[] | null
          closed_at: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          description: string | null
          estimated_labor_hours: number | null
          id: string
          manufacturer: string | null
          model_year_max: number | null
          model_year_min: number | null
          opened_at: string
          recall_number: string
          required_parts: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          affected_models?: string[] | null
          closed_at?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          estimated_labor_hours?: number | null
          id?: string
          manufacturer?: string | null
          model_year_max?: number | null
          model_year_min?: number | null
          opened_at?: string
          recall_number: string
          required_parts?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          affected_models?: string[] | null
          closed_at?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          estimated_labor_hours?: number | null
          id?: string
          manufacturer?: string | null
          model_year_max?: number | null
          model_year_min?: number | null
          opened_at?: string
          recall_number?: string
          required_parts?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      refunds: {
        Row: {
          amount: number
          approval_required: string
          approved_at: string | null
          approved_by: string | null
          created_at: string
          currency: string
          customer_id: string
          deleted_at: string | null
          id: string
          invoice_id: string | null
          job_id: string | null
          kind: string
          notes: string | null
          paid_at: string | null
          paid_by: string | null
          part_id: string | null
          payment_method: string | null
          quantity: number | null
          reason: string
          refund_number: string
          rejected_at: string | null
          rejected_by: string | null
          rejection_reason: string | null
          requested_at: string
          requested_by: string | null
          status: string
          updated_at: string
          warranty_case_id: string | null
        }
        Insert: {
          amount: number
          approval_required: string
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          currency?: string
          customer_id: string
          deleted_at?: string | null
          id?: string
          invoice_id?: string | null
          job_id?: string | null
          kind: string
          notes?: string | null
          paid_at?: string | null
          paid_by?: string | null
          part_id?: string | null
          payment_method?: string | null
          quantity?: number | null
          reason: string
          refund_number: string
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_reason?: string | null
          requested_at?: string
          requested_by?: string | null
          status?: string
          updated_at?: string
          warranty_case_id?: string | null
        }
        Update: {
          amount?: number
          approval_required?: string
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          currency?: string
          customer_id?: string
          deleted_at?: string | null
          id?: string
          invoice_id?: string | null
          job_id?: string | null
          kind?: string
          notes?: string | null
          paid_at?: string | null
          paid_by?: string | null
          part_id?: string | null
          payment_method?: string | null
          quantity?: number | null
          reason?: string
          refund_number?: string
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_reason?: string | null
          requested_at?: string
          requested_by?: string | null
          status?: string
          updated_at?: string
          warranty_case_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "refunds_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "refunds_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers_display"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "refunds_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "refunds_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "garage_job_efficiency"
            referencedColumns: ["job_id"]
          },
          {
            foreignKeyName: "refunds_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "garage_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "refunds_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "report_garage_time_in_state"
            referencedColumns: ["job_id"]
          },
          {
            foreignKeyName: "refunds_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "parts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "refunds_warranty_case_id_fkey"
            columns: ["warranty_case_id"]
            isOneToOne: false
            referencedRelation: "warranty_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      repair_proposal_items: {
        Row: {
          created_at: string | null
          customer_decision: string | null
          id: string
          item_type: string
          name: string
          notes: string | null
          part_id: string | null
          part_number: string | null
          proposal_id: string
          quantity: number
          total_price: number
          unit_price: number
        }
        Insert: {
          created_at?: string | null
          customer_decision?: string | null
          id?: string
          item_type: string
          name: string
          notes?: string | null
          part_id?: string | null
          part_number?: string | null
          proposal_id: string
          quantity?: number
          total_price?: number
          unit_price?: number
        }
        Update: {
          created_at?: string | null
          customer_decision?: string | null
          id?: string
          item_type?: string
          name?: string
          notes?: string | null
          part_id?: string | null
          part_number?: string | null
          proposal_id?: string
          quantity?: number
          total_price?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "proposal_items_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "parts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposal_items_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "repair_proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      repair_proposals: {
        Row: {
          approved_at: string | null
          car_id: string
          created_at: string | null
          created_by: string | null
          customer_id: string | null
          id: string
          job_id: string
          notes: string | null
          reminder_sent_at: string | null
          status: string
          total_cost: number | null
          total_labor_cost: number | null
          total_parts_cost: number | null
          updated_at: string | null
        }
        Insert: {
          approved_at?: string | null
          car_id: string
          created_at?: string | null
          created_by?: string | null
          customer_id?: string | null
          id?: string
          job_id: string
          notes?: string | null
          reminder_sent_at?: string | null
          status?: string
          total_cost?: number | null
          total_labor_cost?: number | null
          total_parts_cost?: number | null
          updated_at?: string | null
        }
        Update: {
          approved_at?: string | null
          car_id?: string
          created_at?: string | null
          created_by?: string | null
          customer_id?: string | null
          id?: string
          job_id?: string
          notes?: string | null
          reminder_sent_at?: string | null
          status?: string
          total_cost?: number | null
          total_labor_cost?: number | null
          total_parts_cost?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "repair_proposals_car_id_fkey"
            columns: ["car_id"]
            isOneToOne: false
            referencedRelation: "car_service_status"
            referencedColumns: ["car_id"]
          },
          {
            foreignKeyName: "repair_proposals_car_id_fkey"
            columns: ["car_id"]
            isOneToOne: false
            referencedRelation: "cars"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "repair_proposals_car_id_fkey"
            columns: ["car_id"]
            isOneToOne: false
            referencedRelation: "cars_display"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "repair_proposals_car_id_fkey"
            columns: ["car_id"]
            isOneToOne: false
            referencedRelation: "cars_missing_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "repair_proposals_car_id_fkey"
            columns: ["car_id"]
            isOneToOne: false
            referencedRelation: "report_inventory_aging"
            referencedColumns: ["car_id"]
          },
          {
            foreignKeyName: "repair_proposals_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "repair_proposals_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "report_sales_rep_performance"
            referencedColumns: ["sales_rep_id"]
          },
          {
            foreignKeyName: "repair_proposals_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "repair_proposals_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers_display"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "repair_proposals_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "garage_job_efficiency"
            referencedColumns: ["job_id"]
          },
          {
            foreignKeyName: "repair_proposals_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "garage_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "repair_proposals_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "report_garage_time_in_state"
            referencedColumns: ["job_id"]
          },
        ]
      }
      requests: {
        Row: {
          assigned_to: string | null
          assistant_notes: string | null
          category: string | null
          completed_at: string | null
          created_at: string
          decision_reason: string | null
          department_id: string | null
          description: string | null
          due_date: string | null
          forwarded_at: string | null
          id: string
          management_comments: string | null
          owner_visible: boolean
          pipeline_enabled: boolean
          pipeline_stage: string | null
          priority: string | null
          reminder_sent_at: string | null
          resolved_at: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          send_to: string | null
          send_to_user_id: string | null
          status: string
          subject: string
          submitted_by: string
          updated_at: string
          vin: string | null
        }
        Insert: {
          assigned_to?: string | null
          assistant_notes?: string | null
          category?: string | null
          completed_at?: string | null
          created_at?: string
          decision_reason?: string | null
          department_id?: string | null
          description?: string | null
          due_date?: string | null
          forwarded_at?: string | null
          id?: string
          management_comments?: string | null
          owner_visible?: boolean
          pipeline_enabled?: boolean
          pipeline_stage?: string | null
          priority?: string | null
          reminder_sent_at?: string | null
          resolved_at?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          send_to?: string | null
          send_to_user_id?: string | null
          status?: string
          subject: string
          submitted_by: string
          updated_at?: string
          vin?: string | null
        }
        Update: {
          assigned_to?: string | null
          assistant_notes?: string | null
          category?: string | null
          completed_at?: string | null
          created_at?: string
          decision_reason?: string | null
          department_id?: string | null
          description?: string | null
          due_date?: string | null
          forwarded_at?: string | null
          id?: string
          management_comments?: string | null
          owner_visible?: boolean
          pipeline_enabled?: boolean
          pipeline_stage?: string | null
          priority?: string | null
          reminder_sent_at?: string | null
          resolved_at?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          send_to?: string | null
          send_to_user_id?: string | null
          status?: string
          subject?: string
          submitted_by?: string
          updated_at?: string
          vin?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "requests_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requests_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "report_sales_rep_performance"
            referencedColumns: ["sales_rep_id"]
          },
          {
            foreignKeyName: "requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "report_sales_rep_performance"
            referencedColumns: ["sales_rep_id"]
          },
          {
            foreignKeyName: "requests_send_to_user_id_fkey"
            columns: ["send_to_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requests_send_to_user_id_fkey"
            columns: ["send_to_user_id"]
            isOneToOne: false
            referencedRelation: "report_sales_rep_performance"
            referencedColumns: ["sales_rep_id"]
          },
          {
            foreignKeyName: "requests_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requests_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "report_sales_rep_performance"
            referencedColumns: ["sales_rep_id"]
          },
        ]
      }
      sales_orders: {
        Row: {
          car_id: string
          contract_signed_at: string | null
          created_at: string
          created_by: string | null
          currency: string | null
          customer_id: string
          date_bought: string | null
          delivered_at: string | null
          delivered_by: string | null
          delivery_date: string | null
          delivery_notes: string | null
          deposit_amount: number | null
          deposit_currency: string | null
          deposit_method: string | null
          deposit_paid_at: string | null
          id: string
          notes: string | null
          quote_accepted_at: string | null
          quote_amount: number | null
          quote_currency: string | null
          quote_sent_at: string | null
          reservation_date: string | null
          reserved_by: string | null
          reserved_until: string | null
          sale_date: string | null
          selling_price: number | null
          signed_contract_url: string | null
          status: Database["public"]["Enums"]["sale_status"]
          updated_at: string
          vin: string | null
          void_at: string | null
          void_by: string | null
          void_reason: string | null
        }
        Insert: {
          car_id: string
          contract_signed_at?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string | null
          customer_id: string
          date_bought?: string | null
          delivered_at?: string | null
          delivered_by?: string | null
          delivery_date?: string | null
          delivery_notes?: string | null
          deposit_amount?: number | null
          deposit_currency?: string | null
          deposit_method?: string | null
          deposit_paid_at?: string | null
          id?: string
          notes?: string | null
          quote_accepted_at?: string | null
          quote_amount?: number | null
          quote_currency?: string | null
          quote_sent_at?: string | null
          reservation_date?: string | null
          reserved_by?: string | null
          reserved_until?: string | null
          sale_date?: string | null
          selling_price?: number | null
          signed_contract_url?: string | null
          status?: Database["public"]["Enums"]["sale_status"]
          updated_at?: string
          vin?: string | null
          void_at?: string | null
          void_by?: string | null
          void_reason?: string | null
        }
        Update: {
          car_id?: string
          contract_signed_at?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string | null
          customer_id?: string
          date_bought?: string | null
          delivered_at?: string | null
          delivered_by?: string | null
          delivery_date?: string | null
          delivery_notes?: string | null
          deposit_amount?: number | null
          deposit_currency?: string | null
          deposit_method?: string | null
          deposit_paid_at?: string | null
          id?: string
          notes?: string | null
          quote_accepted_at?: string | null
          quote_amount?: number | null
          quote_currency?: string | null
          quote_sent_at?: string | null
          reservation_date?: string | null
          reserved_by?: string | null
          reserved_until?: string | null
          sale_date?: string | null
          selling_price?: number | null
          signed_contract_url?: string | null
          status?: Database["public"]["Enums"]["sale_status"]
          updated_at?: string
          vin?: string | null
          void_at?: string | null
          void_by?: string | null
          void_reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_orders_car_id_fkey"
            columns: ["car_id"]
            isOneToOne: false
            referencedRelation: "car_service_status"
            referencedColumns: ["car_id"]
          },
          {
            foreignKeyName: "sales_orders_car_id_fkey"
            columns: ["car_id"]
            isOneToOne: false
            referencedRelation: "cars"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_orders_car_id_fkey"
            columns: ["car_id"]
            isOneToOne: false
            referencedRelation: "cars_display"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_orders_car_id_fkey"
            columns: ["car_id"]
            isOneToOne: false
            referencedRelation: "cars_missing_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_orders_car_id_fkey"
            columns: ["car_id"]
            isOneToOne: false
            referencedRelation: "report_inventory_aging"
            referencedColumns: ["car_id"]
          },
          {
            foreignKeyName: "sales_orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers_display"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_orders_delivered_by_fkey"
            columns: ["delivered_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_orders_delivered_by_fkey"
            columns: ["delivered_by"]
            isOneToOne: false
            referencedRelation: "report_sales_rep_performance"
            referencedColumns: ["sales_rep_id"]
          },
          {
            foreignKeyName: "sales_orders_vin_fkey"
            columns: ["vin"]
            isOneToOne: false
            referencedRelation: "car_service_status"
            referencedColumns: ["vin"]
          },
          {
            foreignKeyName: "sales_orders_vin_fkey"
            columns: ["vin"]
            isOneToOne: false
            referencedRelation: "cars"
            referencedColumns: ["vin"]
          },
          {
            foreignKeyName: "sales_orders_vin_fkey"
            columns: ["vin"]
            isOneToOne: false
            referencedRelation: "cars_display"
            referencedColumns: ["vin"]
          },
          {
            foreignKeyName: "sales_orders_vin_fkey"
            columns: ["vin"]
            isOneToOne: false
            referencedRelation: "cars_missing_data"
            referencedColumns: ["vin"]
          },
          {
            foreignKeyName: "sales_orders_vin_fkey"
            columns: ["vin"]
            isOneToOne: false
            referencedRelation: "garage_job_efficiency"
            referencedColumns: ["vin"]
          },
          {
            foreignKeyName: "sales_orders_vin_fkey"
            columns: ["vin"]
            isOneToOne: false
            referencedRelation: "report_garage_time_in_state"
            referencedColumns: ["vin"]
          },
          {
            foreignKeyName: "sales_orders_vin_fkey"
            columns: ["vin"]
            isOneToOne: false
            referencedRelation: "report_inventory_aging"
            referencedColumns: ["vin"]
          },
          {
            foreignKeyName: "sales_orders_vin_fkey"
            columns: ["vin"]
            isOneToOne: false
            referencedRelation: "report_sales_margin"
            referencedColumns: ["vin"]
          },
        ]
      }
      service_day_notifications_sent: {
        Row: {
          id: string
          job_id: string
          sent_at: string | null
          sent_date: string
        }
        Insert: {
          id?: string
          job_id: string
          sent_at?: string | null
          sent_date: string
        }
        Update: {
          id?: string
          job_id?: string
          sent_at?: string | null
          sent_date?: string
        }
        Relationships: []
      }
      service_intervals: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          id: string
          interval_km: number | null
          interval_months: number | null
          label_en: string
          lead_days: number
          lead_km: number
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          id: string
          interval_km?: number | null
          interval_months?: number | null
          label_en: string
          lead_days?: number
          lead_km?: number
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          interval_km?: number | null
          interval_months?: number | null
          label_en?: string
          lead_days?: number
          lead_km?: number
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      suppliers: {
        Row: {
          address: string | null
          contact_person: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          email: string | null
          id: string
          kind: string
          name: string
          notes: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          contact_person?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          email?: string | null
          id?: string
          kind?: string
          name: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          contact_person?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          email?: string | null
          id?: string
          kind?: string
          name?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "suppliers_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "report_sales_rep_performance"
            referencedColumns: ["sales_rep_id"]
          },
        ]
      }
      system_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          message: string | null
          metadata: Json
          severity: string
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          message?: string | null
          metadata?: Json
          severity?: string
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          message?: string | null
          metadata?: Json
          severity?: string
        }
        Relationships: []
      }
      system_preferences: {
        Row: {
          id: string
          key: string
          updated_at: string
          updated_by: string | null
          value: string
        }
        Insert: {
          id?: string
          key: string
          updated_at?: string
          updated_by?: string | null
          value: string
        }
        Update: {
          id?: string
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: string
        }
        Relationships: []
      }
      task_categories: {
        Row: {
          active: boolean
          created_at: string
          default_severity: Database["public"]["Enums"]["notification_severity"]
          description: string | null
          escalate_after_extra_hours: number
          id: string
          label_ar: string | null
          label_en: string
          requires_triage_first: boolean
          sla_hours: number
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          default_severity?: Database["public"]["Enums"]["notification_severity"]
          description?: string | null
          escalate_after_extra_hours?: number
          id: string
          label_ar?: string | null
          label_en: string
          requires_triage_first?: boolean
          sla_hours: number
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          default_severity?: Database["public"]["Enums"]["notification_severity"]
          description?: string | null
          escalate_after_extra_hours?: number
          id?: string
          label_ar?: string | null
          label_en?: string
          requires_triage_first?: boolean
          sla_hours?: number
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      task_routing_rules: {
        Row: {
          active: boolean
          assignee_kind: string
          assignee_value: string
          category_id: string
          created_at: string
          id: string
          is_parallel: boolean
          is_primary: boolean
          note: string | null
          role_label: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          assignee_kind: string
          assignee_value: string
          category_id: string
          created_at?: string
          id?: string
          is_parallel?: boolean
          is_primary?: boolean
          note?: string | null
          role_label?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          assignee_kind?: string
          assignee_value?: string
          category_id?: string
          created_at?: string
          id?: string
          is_parallel?: boolean
          is_primary?: boolean
          note?: string | null
          role_label?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_routing_rules_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "task_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      task_timers: {
        Row: {
          duration_seconds: number | null
          end_time: string | null
          id: string
          start_time: string
          task_id: string
          user_id: string
        }
        Insert: {
          duration_seconds?: number | null
          end_time?: string | null
          id?: string
          start_time?: string
          task_id: string
          user_id: string
        }
        Update: {
          duration_seconds?: number | null
          end_time?: string | null
          id?: string
          start_time?: string
          task_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_timers_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "garage_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_timers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_timers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "report_sales_rep_performance"
            referencedColumns: ["sales_rep_id"]
          },
        ]
      }
      tasks: {
        Row: {
          assigned_to_user_id: string | null
          completed_at: string | null
          created_at: string
          created_by_user_id: string | null
          department_id: string | null
          description: string | null
          due_at: string | null
          id: string
          priority: Database["public"]["Enums"]["job_priority"]
          source_id: string | null
          source_type: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to_user_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by_user_id?: string | null
          department_id?: string | null
          description?: string | null
          due_at?: string | null
          id?: string
          priority?: Database["public"]["Enums"]["job_priority"]
          source_id?: string | null
          source_type?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to_user_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by_user_id?: string | null
          department_id?: string | null
          description?: string | null
          due_at?: string | null
          id?: string
          priority?: Database["public"]["Enums"]["job_priority"]
          source_id?: string | null
          source_type?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_assigned_to_user_id_fkey"
            columns: ["assigned_to_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_assigned_to_user_id_fkey"
            columns: ["assigned_to_user_id"]
            isOneToOne: false
            referencedRelation: "report_sales_rep_performance"
            referencedColumns: ["sales_rep_id"]
          },
          {
            foreignKeyName: "tasks_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "report_sales_rep_performance"
            referencedColumns: ["sales_rep_id"]
          },
        ]
      }
      test_drives: {
        Row: {
          actual_return_at: string | null
          battery_in: number | null
          battery_out: number | null
          car_id: string
          car_status_before_test_drive:
            | Database["public"]["Enums"]["car_status"]
            | null
          companion_employee: string | null
          created_at: string
          customer_id: string | null
          customer_name: string | null
          customer_phone: string | null
          driver_license_checked: boolean
          employee_name: string | null
          employee_user_id: string
          expected_return_at: string | null
          fuel_in: number | null
          fuel_out: number | null
          id: string
          incident_notes: string | null
          license_number: string | null
          notes: string | null
          odometer_in: number | null
          odometer_out: number | null
          outcome: string | null
          purpose: string | null
          route: string | null
          status: string
          test_drive_start_at: string
          updated_at: string
          vin: string
          waiver_signed: boolean
        }
        Insert: {
          actual_return_at?: string | null
          battery_in?: number | null
          battery_out?: number | null
          car_id: string
          car_status_before_test_drive?:
            | Database["public"]["Enums"]["car_status"]
            | null
          companion_employee?: string | null
          created_at?: string
          customer_id?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          driver_license_checked?: boolean
          employee_name?: string | null
          employee_user_id: string
          expected_return_at?: string | null
          fuel_in?: number | null
          fuel_out?: number | null
          id?: string
          incident_notes?: string | null
          license_number?: string | null
          notes?: string | null
          odometer_in?: number | null
          odometer_out?: number | null
          outcome?: string | null
          purpose?: string | null
          route?: string | null
          status?: string
          test_drive_start_at?: string
          updated_at?: string
          vin: string
          waiver_signed?: boolean
        }
        Update: {
          actual_return_at?: string | null
          battery_in?: number | null
          battery_out?: number | null
          car_id?: string
          car_status_before_test_drive?:
            | Database["public"]["Enums"]["car_status"]
            | null
          companion_employee?: string | null
          created_at?: string
          customer_id?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          driver_license_checked?: boolean
          employee_name?: string | null
          employee_user_id?: string
          expected_return_at?: string | null
          fuel_in?: number | null
          fuel_out?: number | null
          id?: string
          incident_notes?: string | null
          license_number?: string | null
          notes?: string | null
          odometer_in?: number | null
          odometer_out?: number | null
          outcome?: string | null
          purpose?: string | null
          route?: string | null
          status?: string
          test_drive_start_at?: string
          updated_at?: string
          vin?: string
          waiver_signed?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "test_drives_car_id_fkey"
            columns: ["car_id"]
            isOneToOne: false
            referencedRelation: "car_service_status"
            referencedColumns: ["car_id"]
          },
          {
            foreignKeyName: "test_drives_car_id_fkey"
            columns: ["car_id"]
            isOneToOne: false
            referencedRelation: "cars"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "test_drives_car_id_fkey"
            columns: ["car_id"]
            isOneToOne: false
            referencedRelation: "cars_display"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "test_drives_car_id_fkey"
            columns: ["car_id"]
            isOneToOne: false
            referencedRelation: "cars_missing_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "test_drives_car_id_fkey"
            columns: ["car_id"]
            isOneToOne: false
            referencedRelation: "report_inventory_aging"
            referencedColumns: ["car_id"]
          },
          {
            foreignKeyName: "test_drives_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "test_drives_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers_display"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "test_drives_employee_user_id_fkey"
            columns: ["employee_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "test_drives_employee_user_id_fkey"
            columns: ["employee_user_id"]
            isOneToOne: false
            referencedRelation: "report_sales_rep_performance"
            referencedColumns: ["sales_rep_id"]
          },
        ]
      }
      trade_in_documents: {
        Row: {
          caption: string | null
          created_at: string
          created_by: string | null
          filename: string
          id: string
          kind: string
          mime_type: string | null
          size_bytes: number | null
          storage_path: string
          trade_in_id: string
        }
        Insert: {
          caption?: string | null
          created_at?: string
          created_by?: string | null
          filename: string
          id?: string
          kind?: string
          mime_type?: string | null
          size_bytes?: number | null
          storage_path: string
          trade_in_id: string
        }
        Update: {
          caption?: string | null
          created_at?: string
          created_by?: string | null
          filename?: string
          id?: string
          kind?: string
          mime_type?: string | null
          size_bytes?: number | null
          storage_path?: string
          trade_in_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trade_in_documents_trade_in_id_fkey"
            columns: ["trade_in_id"]
            isOneToOne: false
            referencedRelation: "trade_ins"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_in_issues: {
        Row: {
          created_at: string
          created_by: string | null
          description: string
          estimated_cost: number | null
          id: string
          notes: string | null
          severity: string
          trade_in_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description: string
          estimated_cost?: number | null
          id?: string
          notes?: string | null
          severity?: string
          trade_in_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string
          estimated_cost?: number | null
          id?: string
          notes?: string | null
          severity?: string
          trade_in_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trade_in_issues_trade_in_id_fkey"
            columns: ["trade_in_id"]
            isOneToOne: false
            referencedRelation: "trade_ins"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_ins: {
        Row: {
          accepted_value: number | null
          approved_at: string | null
          approved_by: string | null
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          committed_at: string | null
          committed_by: string | null
          condition: string | null
          created_at: string
          created_by: string | null
          currency: string
          customer_id: string
          deleted_at: string | null
          estimated_repair_cost: number | null
          id: string
          inspected_at: string | null
          inspected_by: string | null
          inspection_notes: string | null
          inspection_started_at: string | null
          inspection_started_by: string | null
          linked_sales_order_id: string | null
          mileage_km: number | null
          provisional_value: number
          recommended_value: number | null
          rejected_at: string | null
          rejected_by: string | null
          rejection_reason: string | null
          status: string
          trade_in_number: string
          updated_at: string
          vehicle_color: string | null
          vehicle_make: string
          vehicle_model: string
          vehicle_plate: string | null
          vehicle_trim: string | null
          vehicle_vin: string | null
          vehicle_year: number | null
        }
        Insert: {
          accepted_value?: number | null
          approved_at?: string | null
          approved_by?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          committed_at?: string | null
          committed_by?: string | null
          condition?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          customer_id: string
          deleted_at?: string | null
          estimated_repair_cost?: number | null
          id?: string
          inspected_at?: string | null
          inspected_by?: string | null
          inspection_notes?: string | null
          inspection_started_at?: string | null
          inspection_started_by?: string | null
          linked_sales_order_id?: string | null
          mileage_km?: number | null
          provisional_value: number
          recommended_value?: number | null
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_reason?: string | null
          status?: string
          trade_in_number: string
          updated_at?: string
          vehicle_color?: string | null
          vehicle_make: string
          vehicle_model: string
          vehicle_plate?: string | null
          vehicle_trim?: string | null
          vehicle_vin?: string | null
          vehicle_year?: number | null
        }
        Update: {
          accepted_value?: number | null
          approved_at?: string | null
          approved_by?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          committed_at?: string | null
          committed_by?: string | null
          condition?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          customer_id?: string
          deleted_at?: string | null
          estimated_repair_cost?: number | null
          id?: string
          inspected_at?: string | null
          inspected_by?: string | null
          inspection_notes?: string | null
          inspection_started_at?: string | null
          inspection_started_by?: string | null
          linked_sales_order_id?: string | null
          mileage_km?: number | null
          provisional_value?: number
          recommended_value?: number | null
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_reason?: string | null
          status?: string
          trade_in_number?: string
          updated_at?: string
          vehicle_color?: string | null
          vehicle_make?: string
          vehicle_model?: string
          vehicle_plate?: string | null
          vehicle_trim?: string | null
          vehicle_vin?: string | null
          vehicle_year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "trade_ins_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_ins_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers_display"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_ins_linked_sales_order_id_fkey"
            columns: ["linked_sales_order_id"]
            isOneToOne: false
            referencedRelation: "report_sales_margin"
            referencedColumns: ["sales_order_id"]
          },
          {
            foreignKeyName: "trade_ins_linked_sales_order_id_fkey"
            columns: ["linked_sales_order_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      warranty_case_documents: {
        Row: {
          caption: string | null
          case_id: string
          created_at: string
          created_by: string | null
          filename: string
          id: string
          kind: string
          mime_type: string | null
          size_bytes: number | null
          storage_path: string
        }
        Insert: {
          caption?: string | null
          case_id: string
          created_at?: string
          created_by?: string | null
          filename: string
          id?: string
          kind?: string
          mime_type?: string | null
          size_bytes?: number | null
          storage_path: string
        }
        Update: {
          caption?: string | null
          case_id?: string
          created_at?: string
          created_by?: string | null
          filename?: string
          id?: string
          kind?: string
          mime_type?: string | null
          size_bytes?: number | null
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "warranty_case_documents_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "warranty_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      warranty_case_parts: {
        Row: {
          case_id: string
          created_at: string
          created_by: string | null
          description: string
          id: string
          notes: string | null
          part_id: string | null
          quantity: number
          unit_cost: number | null
        }
        Insert: {
          case_id: string
          created_at?: string
          created_by?: string | null
          description: string
          id?: string
          notes?: string | null
          part_id?: string | null
          quantity: number
          unit_cost?: number | null
        }
        Update: {
          case_id?: string
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          notes?: string | null
          part_id?: string | null
          quantity?: number
          unit_cost?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "warranty_case_parts_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "warranty_cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warranty_case_parts_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "parts"
            referencedColumns: ["id"]
          },
        ]
      }
      warranty_cases: {
        Row: {
          car_id: string
          case_number: string
          closed_at: string | null
          closed_by: string | null
          created_at: string
          created_by: string | null
          customer_id: string | null
          deleted_at: string | null
          id: string
          job_id: string | null
          kind: string
          notes: string | null
          opened_at: string
          opened_by: string | null
          recall_id: string | null
          resolution: string | null
          severity: string
          status: string
          summary: string
          updated_at: string
        }
        Insert: {
          car_id: string
          case_number: string
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          deleted_at?: string | null
          id?: string
          job_id?: string | null
          kind?: string
          notes?: string | null
          opened_at?: string
          opened_by?: string | null
          recall_id?: string | null
          resolution?: string | null
          severity?: string
          status?: string
          summary: string
          updated_at?: string
        }
        Update: {
          car_id?: string
          case_number?: string
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          deleted_at?: string | null
          id?: string
          job_id?: string | null
          kind?: string
          notes?: string | null
          opened_at?: string
          opened_by?: string | null
          recall_id?: string | null
          resolution?: string | null
          severity?: string
          status?: string
          summary?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "warranty_cases_car_id_fkey"
            columns: ["car_id"]
            isOneToOne: false
            referencedRelation: "car_service_status"
            referencedColumns: ["car_id"]
          },
          {
            foreignKeyName: "warranty_cases_car_id_fkey"
            columns: ["car_id"]
            isOneToOne: false
            referencedRelation: "cars"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warranty_cases_car_id_fkey"
            columns: ["car_id"]
            isOneToOne: false
            referencedRelation: "cars_display"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warranty_cases_car_id_fkey"
            columns: ["car_id"]
            isOneToOne: false
            referencedRelation: "cars_missing_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warranty_cases_car_id_fkey"
            columns: ["car_id"]
            isOneToOne: false
            referencedRelation: "report_inventory_aging"
            referencedColumns: ["car_id"]
          },
          {
            foreignKeyName: "warranty_cases_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warranty_cases_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers_display"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warranty_cases_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "garage_job_efficiency"
            referencedColumns: ["job_id"]
          },
          {
            foreignKeyName: "warranty_cases_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "garage_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warranty_cases_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "report_garage_time_in_state"
            referencedColumns: ["job_id"]
          },
          {
            foreignKeyName: "warranty_cases_recall_id_fkey"
            columns: ["recall_id"]
            isOneToOne: false
            referencedRelation: "recalls"
            referencedColumns: ["id"]
          },
        ]
      }
      warranty_notifications_sent: {
        Row: {
          car_id: string
          id: string
          sent_at: string | null
          threshold_days: number
          warranty_type: string
        }
        Insert: {
          car_id: string
          id?: string
          sent_at?: string | null
          threshold_days: number
          warranty_type: string
        }
        Update: {
          car_id?: string
          id?: string
          sent_at?: string | null
          threshold_days?: number
          warranty_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "warranty_notifications_sent_car_id_fkey"
            columns: ["car_id"]
            isOneToOne: false
            referencedRelation: "car_service_status"
            referencedColumns: ["car_id"]
          },
          {
            foreignKeyName: "warranty_notifications_sent_car_id_fkey"
            columns: ["car_id"]
            isOneToOne: false
            referencedRelation: "cars"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warranty_notifications_sent_car_id_fkey"
            columns: ["car_id"]
            isOneToOne: false
            referencedRelation: "cars_display"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warranty_notifications_sent_car_id_fkey"
            columns: ["car_id"]
            isOneToOne: false
            referencedRelation: "cars_missing_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warranty_notifications_sent_car_id_fkey"
            columns: ["car_id"]
            isOneToOne: false
            referencedRelation: "report_inventory_aging"
            referencedColumns: ["car_id"]
          },
        ]
      }
    }
    Views: {
      car_service_status: {
        Row: {
          brand: string | null
          car_id: string | null
          current_km: number | null
          days_to_next: number | null
          interval_id: string | null
          interval_km: number | null
          interval_label: string | null
          interval_months: number | null
          km_to_next: number | null
          last_service_at: string | null
          last_service_km: number | null
          lead_days: number | null
          lead_km: number | null
          model: string | null
          next_due_at: string | null
          next_due_km: number | null
          status: string | null
          vin: string | null
        }
        Relationships: []
      }
      cars_display: {
        Row: {
          battery_display: string | null
          battery_percent: number | null
          bl_issue_date: string | null
          brand: string | null
          client_name: string | null
          client_phone: string | null
          created_at: string | null
          created_by: string | null
          current_km: number | null
          customer_id: string | null
          customs_amount_currency: string | null
          customs_amount_paid: number | null
          customs_notes: string | null
          customs_status: string | null
          date_arrived: string | null
          date_bought: string | null
          deleted_at: string | null
          delivery_date: string | null
          dongle: string | null
          engine_number: string | null
          ev_km: number | null
          exterior_color: string | null
          id: string | null
          interior_color: string | null
          is_erev: boolean | null
          issue: string | null
          km_range: number | null
          location_changed_at: string | null
          location_floor: string | null
          location_full: string | null
          location_slot: string | null
          location_type: Database["public"]["Enums"]["location_type"] | null
          model: string | null
          model_year: number | null
          motor_km: number | null
          notes: string | null
          pdi_status: Database["public"]["Enums"]["pdi_status"] | null
          plate_number: string | null
          price: number | null
          price_currency: string | null
          registration_date: string | null
          reservation_date: string | null
          reserved_by: string | null
          software_update: string | null
          software_version: string | null
          sold_marker: string | null
          specs: string | null
          status: Database["public"]["Enums"]["car_status"] | null
          status_changed_at: string | null
          status_display: string | null
          sub_dealer_name: string | null
          suffix: string | null
          trim: string | null
          updated_at: string | null
          vin: string | null
          vin_short: string | null
          warranty_battery_dms: string | null
          warranty_battery_expired: boolean | null
          warranty_battery_expiry: string | null
          warranty_battery_km_limit: number | null
          warranty_battery_status: string | null
          warranty_vehicle_dms: string | null
          warranty_vehicle_expired: boolean | null
          warranty_vehicle_expiry: string | null
          warranty_vehicle_km_limit: number | null
          warranty_vehicle_status: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cars_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cars_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers_display"
            referencedColumns: ["id"]
          },
        ]
      }
      cars_missing_data: {
        Row: {
          battery_percent: number | null
          bl_issue_date: string | null
          brand: string | null
          created_at: string | null
          created_by: string | null
          current_km: number | null
          customer_id: string | null
          customs_amount_currency: string | null
          customs_amount_paid: number | null
          customs_notes: string | null
          customs_status: string | null
          date_arrived: string | null
          date_bought: string | null
          deleted_at: string | null
          delivery_date: string | null
          dongle: string | null
          engine_number: string | null
          ev_km: number | null
          exterior_color: string | null
          id: string | null
          interior_color: string | null
          is_erev: boolean | null
          issue: string | null
          km_range: number | null
          location_changed_at: string | null
          location_slot: string | null
          location_type: Database["public"]["Enums"]["location_type"] | null
          model: string | null
          model_year: number | null
          motor_km: number | null
          notes: string | null
          pdi_status: Database["public"]["Enums"]["pdi_status"] | null
          plate_number: string | null
          price: number | null
          price_currency: string | null
          registration_date: string | null
          reservation_date: string | null
          software_update: string | null
          software_version: string | null
          sold_at: string | null
          sold_marker: string | null
          specs: string | null
          status: Database["public"]["Enums"]["car_status"] | null
          status_changed_at: string | null
          sub_dealer_name: string | null
          suffix: string | null
          trim: string | null
          updated_at: string | null
          vin: string | null
          warranty_battery_dms: string | null
          warranty_battery_expiry: string | null
          warranty_battery_km_limit: number | null
          warranty_vehicle_dms: string | null
          warranty_vehicle_expiry: string | null
          warranty_vehicle_km_limit: number | null
        }
        Relationships: [
          {
            foreignKeyName: "cars_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cars_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers_display"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_credit_balance: {
        Row: {
          balance: number | null
          currency: string | null
          customer_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_credits_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_credits_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers_display"
            referencedColumns: ["id"]
          },
        ]
      }
      customers_display: {
        Row: {
          address: string | null
          company: string | null
          created_at: string | null
          created_by: string | null
          date_of_birth: string | null
          deleted_at: string | null
          email: string | null
          first_name: string | null
          full_name: string | null
          id: string | null
          language_display: string | null
          last_name: string | null
          last_visit_date: string | null
          lead_source: Database["public"]["Enums"]["lead_source"] | null
          lead_status: Database["public"]["Enums"]["lead_status"] | null
          notes: string | null
          phone_primary: string | null
          phone_secondary: string | null
          preferred_language: string | null
          source_display: string | null
          status_display: string | null
          total_notes: number | null
          total_orders: number | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          company?: string | null
          created_at?: string | null
          created_by?: string | null
          date_of_birth?: string | null
          deleted_at?: string | null
          email?: string | null
          first_name?: string | null
          full_name?: never
          id?: string | null
          language_display?: never
          last_name?: string | null
          last_visit_date?: string | null
          lead_source?: Database["public"]["Enums"]["lead_source"] | null
          lead_status?: Database["public"]["Enums"]["lead_status"] | null
          notes?: string | null
          phone_primary?: string | null
          phone_secondary?: string | null
          preferred_language?: string | null
          source_display?: never
          status_display?: never
          total_notes?: never
          total_orders?: never
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          company?: string | null
          created_at?: string | null
          created_by?: string | null
          date_of_birth?: string | null
          deleted_at?: string | null
          email?: string | null
          first_name?: string | null
          full_name?: never
          id?: string | null
          language_display?: never
          last_name?: string | null
          last_visit_date?: string | null
          lead_source?: Database["public"]["Enums"]["lead_source"] | null
          lead_status?: Database["public"]["Enums"]["lead_status"] | null
          notes?: string | null
          phone_primary?: string | null
          phone_secondary?: string | null
          preferred_language?: string | null
          source_display?: never
          status_display?: never
          total_notes?: never
          total_orders?: never
          updated_at?: string | null
        }
        Relationships: []
      }
      garage_bay_utilization: {
        Row: {
          avg_dwell_hours: number | null
          bay_id: number | null
          bay_number: number | null
          bay_type: string | null
          current_job_id: string | null
          hours_occupied_30d: number | null
          jobs_30d: number | null
          name: string | null
          status: string | null
          utilization_pct: number | null
        }
        Relationships: []
      }
      garage_employee_efficiency: {
        Row: {
          avg_actual_vs_estimated_ratio: number | null
          avg_hours_per_entry: number | null
          employee_name: string | null
          jobs_count_30d: number | null
          role: string | null
          total_hours_30d: number | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "time_entries_employee_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entries_employee_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "report_sales_rep_performance"
            referencedColumns: ["sales_rep_id"]
          },
        ]
      }
      garage_job_efficiency: {
        Row: {
          actual_hours: number | null
          assigned_to: string | null
          bay_entered_at: string | null
          bay_exited_at: string | null
          brand: string | null
          car_id: string | null
          completed_at: string | null
          estimated_hours: number | null
          garage_bay_id: number | null
          job_id: string | null
          job_number: string | null
          model: string | null
          on_time: boolean | null
          parts_cost_total: number | null
          parts_currency: string | null
          started_at: string | null
          status: string | null
          turnaround_hours: number | null
          variance_hours: number | null
          vin: string | null
        }
        Relationships: [
          {
            foreignKeyName: "garage_jobs_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "garage_jobs_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "report_sales_rep_performance"
            referencedColumns: ["sales_rep_id"]
          },
          {
            foreignKeyName: "garage_jobs_car_id_fkey"
            columns: ["car_id"]
            isOneToOne: false
            referencedRelation: "car_service_status"
            referencedColumns: ["car_id"]
          },
          {
            foreignKeyName: "garage_jobs_car_id_fkey"
            columns: ["car_id"]
            isOneToOne: false
            referencedRelation: "cars"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "garage_jobs_car_id_fkey"
            columns: ["car_id"]
            isOneToOne: false
            referencedRelation: "cars_display"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "garage_jobs_car_id_fkey"
            columns: ["car_id"]
            isOneToOne: false
            referencedRelation: "cars_missing_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "garage_jobs_car_id_fkey"
            columns: ["car_id"]
            isOneToOne: false
            referencedRelation: "report_inventory_aging"
            referencedColumns: ["car_id"]
          },
          {
            foreignKeyName: "garage_jobs_garage_bay_id_fkey"
            columns: ["garage_bay_id"]
            isOneToOne: false
            referencedRelation: "garage_bay_utilization"
            referencedColumns: ["bay_id"]
          },
          {
            foreignKeyName: "garage_jobs_garage_bay_id_fkey"
            columns: ["garage_bay_id"]
            isOneToOne: false
            referencedRelation: "garage_bays"
            referencedColumns: ["id"]
          },
        ]
      }
      report_aged_receivables: {
        Row: {
          age_bucket: string | null
          amount_due: number | null
          amount_outstanding: number | null
          customer_id: string | null
          customer_name: string | null
          customer_phone: string | null
          days_overdue: number | null
          due_date: string | null
          installment_id: string | null
          installment_no: number | null
          paid_amount: number | null
          plan_id: string | null
          status: string | null
        }
        Relationships: [
          {
            foreignKeyName: "installment_payments_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "payment_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_plans_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_plans_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers_display"
            referencedColumns: ["id"]
          },
        ]
      }
      report_garage_time_in_state: {
        Row: {
          active_hours: number | null
          brand: string | null
          category_label: string | null
          completed_at: string | null
          created_at: string | null
          delivered_at: string | null
          handover_hours: number | null
          job_id: string | null
          model: string | null
          queued_hours: number | null
          started_at: string | null
          task_category_id: string | null
          title: string | null
          total_hours: number | null
          vin: string | null
        }
        Relationships: [
          {
            foreignKeyName: "garage_jobs_task_category_id_fkey"
            columns: ["task_category_id"]
            isOneToOne: false
            referencedRelation: "task_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      report_inventory_aging: {
        Row: {
          age_bucket: string | null
          brand: string | null
          car_id: string | null
          days_in_stock: number | null
          entry_date: string | null
          model: string | null
          model_year: number | null
          price: number | null
          price_currency: string | null
          status: Database["public"]["Enums"]["car_status"] | null
          vin: string | null
        }
        Insert: {
          age_bucket?: never
          brand?: string | null
          car_id?: string | null
          days_in_stock?: never
          entry_date?: never
          model?: string | null
          model_year?: number | null
          price?: number | null
          price_currency?: string | null
          status?: Database["public"]["Enums"]["car_status"] | null
          vin?: string | null
        }
        Update: {
          age_bucket?: never
          brand?: string | null
          car_id?: string | null
          days_in_stock?: never
          entry_date?: never
          model?: string | null
          model_year?: number | null
          price?: number | null
          price_currency?: string | null
          status?: Database["public"]["Enums"]["car_status"] | null
          vin?: string | null
        }
        Relationships: []
      }
      report_sales_margin: {
        Row: {
          brand: string | null
          car_id: string | null
          cost: number | null
          cost_currency: string | null
          customer_id: string | null
          delivered_at: string | null
          margin: number | null
          margin_pct: number | null
          model: string | null
          model_year: number | null
          revenue: number | null
          revenue_currency: string | null
          sale_date: string | null
          sales_order_id: string | null
          sales_rep_id: string | null
          vin: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_orders_car_id_fkey"
            columns: ["car_id"]
            isOneToOne: false
            referencedRelation: "car_service_status"
            referencedColumns: ["car_id"]
          },
          {
            foreignKeyName: "sales_orders_car_id_fkey"
            columns: ["car_id"]
            isOneToOne: false
            referencedRelation: "cars"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_orders_car_id_fkey"
            columns: ["car_id"]
            isOneToOne: false
            referencedRelation: "cars_display"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_orders_car_id_fkey"
            columns: ["car_id"]
            isOneToOne: false
            referencedRelation: "cars_missing_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_orders_car_id_fkey"
            columns: ["car_id"]
            isOneToOne: false
            referencedRelation: "report_inventory_aging"
            referencedColumns: ["car_id"]
          },
          {
            foreignKeyName: "sales_orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers_display"
            referencedColumns: ["id"]
          },
        ]
      }
      report_sales_rep_performance: {
        Row: {
          avg_days_to_close: number | null
          deals_delivered: number | null
          deals_in_pipeline: number | null
          deals_voided: number | null
          margin_total: number | null
          revenue_total: number | null
          sales_rep_id: string | null
          sales_rep_name: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      _emit_warranty_bucket: {
        Args: {
          p_column_name: string
          p_event_prefix: string
          p_label: string
          p_lower_days: number
          p_severity: string
          p_upper_days: number
        }
        Returns: number
      }
      _require_any_capability: {
        Args: { p_caps: Database["public"]["Enums"]["user_capability"][] }
        Returns: undefined
      }
      active_test_drive_id_for_car: {
        Args: { p_car_id: string }
        Returns: string
      }
      advance_installment_statuses: {
        Args: never
        Returns: {
          newly_due: number
          newly_overdue: number
          plans_defaulted: number
        }[]
      }
      apply_installment_payment: {
        Args: {
          p_amount: number
          p_installment_id: string
          p_note?: string
          p_payment_method: string
          p_receipt_url?: string
        }
        Returns: Json
      }
      apply_part_to_job: {
        Args: {
          p_job_id: string
          p_note?: string
          p_part_id: string
          p_quantity: number
          p_user_id?: string
        }
        Returns: {
          created_at: string
          created_by: string | null
          currency_snapshot: string | null
          id: string
          job_id: string
          note: string | null
          part_id: string
          quantity: number
          unit_cost_snapshot: number | null
          used_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "job_parts"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      approve_purchase_order: { Args: { p_po_id: string }; Returns: undefined }
      approve_refund: { Args: { p_refund_id: string }; Returns: undefined }
      approve_trade_in: {
        Args: { p_accepted_value: number; p_trade_in_id: string }
        Returns: undefined
      }
      assign_recall_vehicles: {
        Args: { p_car_ids: string[]; p_recall_id: string }
        Returns: number
      }
      attach_job_to_bay: {
        Args: { p_bay_id: number; p_job_id: string; p_user_id?: string }
        Returns: {
          actual_hours: number | null
          assigned_to: string | null
          bay_entered_at: string | null
          bay_exited_at: string | null
          car_id: string | null
          complaint: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          current_km: number | null
          customer_id: string | null
          deleted_at: string | null
          delivered_at: string | null
          description: string | null
          diagnosis: string | null
          due_date: string | null
          estimated_hours: number | null
          external_assignee_name: string | null
          garage_bay_id: number | null
          id: string
          is_battery_only: boolean | null
          job_number: string | null
          notes: string | null
          overtime_notified: boolean | null
          priority: string | null
          started_at: string
          status: string
          task_category_id: string | null
          title: string | null
          updated_at: string
          work_checklist: Json | null
          work_done: string | null
        }
        SetofOptions: {
          from: "*"
          to: "garage_jobs"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      attach_purchase_order_invoice: {
        Args: {
          p_amount: number
          p_currency?: string
          p_due_at?: string
          p_file_url?: string
          p_invoice_date: string
          p_invoice_no: string
          p_po_id: string
          p_vat?: number
        }
        Returns: string
      }
      can_view_owner_requests: { Args: never; Returns: boolean }
      cancel_purchase_order: {
        Args: { p_po_id: string; p_reason: string }
        Returns: undefined
      }
      cancel_refund: { Args: { p_refund_id: string }; Returns: undefined }
      cancel_trade_in: {
        Args: { p_reason?: string; p_trade_in_id: string }
        Returns: undefined
      }
      cars_phase3_can_edit_monza_warranty: { Args: never; Returns: boolean }
      close_cash_session: {
        Args: {
          p_actual_balance: number
          p_closing_note?: string
          p_session_id: string
          p_variance_note?: string
        }
        Returns: Json
      }
      commit_trade_in_to_sale: {
        Args: { p_sales_order_id: string; p_trade_in_id: string }
        Returns: undefined
      }
      complete_delivery: {
        Args: { p_notes?: string; p_sales_order_id: string }
        Returns: undefined
      }
      complete_task: { Args: { p_task_id: string }; Returns: boolean }
      complete_trade_in_inspection: {
        Args: {
          p_condition: string
          p_estimated_repair_cost?: number
          p_inspection_notes?: string
          p_mileage_km?: number
          p_recommended_value: number
          p_trade_in_id: string
        }
        Returns: undefined
      }
      create_car: {
        Args: {
          p_brand: string
          p_exterior_color?: string
          p_interior_color?: string
          p_location_slot?: string
          p_location_type?: Database["public"]["Enums"]["location_type"]
          p_model: string
          p_model_year?: number
          p_status?: Database["public"]["Enums"]["car_status"]
          p_user_id?: string
          p_vin: string
        }
        Returns: {
          battery_percent: number | null
          bl_issue_date: string | null
          brand: string
          created_at: string
          created_by: string | null
          current_km: number | null
          customer_id: string | null
          customs_amount_currency: string | null
          customs_amount_paid: number | null
          customs_notes: string | null
          customs_status: string | null
          date_arrived: string | null
          date_bought: string | null
          deleted_at: string | null
          delivery_date: string | null
          dongle: string | null
          engine_number: string | null
          ev_km: number | null
          exterior_color: string | null
          id: string
          incoming_eta: string | null
          interior_color: string | null
          is_erev: boolean
          issue: string | null
          km_range: number | null
          location_changed_at: string | null
          location_floor: string | null
          location_slot: string | null
          location_type: Database["public"]["Enums"]["location_type"]
          model: string
          model_year: number | null
          motor: string | null
          motor_km: number | null
          notes: string | null
          pdi_status: Database["public"]["Enums"]["pdi_status"]
          plate_number: string | null
          price: number | null
          price_currency: string | null
          recall_notes: string | null
          recall_reason: string | null
          recalled_at: string | null
          registration_date: string | null
          reservation_date: string | null
          shipment_code: string | null
          software_update: string | null
          software_version: string | null
          sold_at: string | null
          sold_marker: string | null
          specs: string | null
          status: Database["public"]["Enums"]["car_status"]
          status_changed_at: string | null
          sub_dealer_name: string | null
          suffix: string | null
          supplier_id: string | null
          trim: string | null
          updated_at: string
          vin: string
          warranty_battery_dms: string | null
          warranty_battery_expiry: string | null
          warranty_battery_km_limit: number | null
          warranty_expiry: string | null
          warranty_monza_start_date: string | null
          warranty_per_dms: string | null
          warranty_vehicle_expiry: string | null
          warranty_vehicle_km_limit: number | null
        }
        SetofOptions: {
          from: "*"
          to: "cars"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_payment_plan: {
        Args: {
          p_car_id: string
          p_customer_id: string
          p_down_payment: number
          p_down_payment_method?: string
          p_down_payment_note?: string
          p_due_dates: string[]
          p_due_day: number
          p_interest_rate?: number
          p_monthly_amount: number
          p_months: number
          p_start_date: string
          p_total_amount: number
        }
        Returns: Json
      }
      create_task_from_request: {
        Args: { p_created_by_user_id?: string; p_request_id: string }
        Returns: string
      }
      delete_job_time_entry: {
        Args: { p_entry_id: string }
        Returns: undefined
      }
      detect_overdue_test_drives: {
        Args: never
        Returns: {
          overdue_1h_emitted: number
          overdue_3h_emitted: number
        }[]
      }
      detect_service_due: {
        Args: never
        Returns: {
          due_soon_emitted: number
          overdue_emitted: number
        }[]
      }
      detect_stuck_garage_jobs: {
        Args: never
        Returns: {
          stuck_14d_emitted: number
          stuck_7d_emitted: number
        }[]
      }
      detect_warranty_expiry: {
        Args: never
        Returns: {
          expires_14d_emitted: number
          expires_30d_emitted: number
          expires_7d_emitted: number
        }[]
      }
      dismiss_notification: { Args: { p_id: string }; Returns: undefined }
      emit_notification: {
        Args: {
          p_body: string
          p_event_subject_user_id?: string
          p_event_submitter_id?: string
          p_event_type: string
          p_link?: string
          p_metadata?: Json
          p_related_entity_id?: string
          p_related_entity_type?: string
          p_title: string
        }
        Returns: number
      }
      gdpr_anonymize_customer: {
        Args: { p_customer_id: string; p_reason: string }
        Returns: undefined
      }
      generate_po_number: { Args: never; Returns: string }
      generate_recall_number: { Args: never; Returns: string }
      generate_refund_number: { Args: never; Returns: string }
      generate_trade_in_number: { Args: never; Returns: string }
      generate_warranty_case_number: { Args: never; Returns: string }
      get_my_user_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      get_my_user_role_resolved: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      has_capability: {
        Args: { cap: Database["public"]["Enums"]["user_capability"] }
        Returns: boolean
      }
      has_role: {
        Args: { r: Database["public"]["Enums"]["user_role"] }
        Returns: boolean
      }
      is_any_role: {
        Args: { p_roles: Database["public"]["Enums"]["user_role"][] }
        Returns: boolean
      }
      is_any_role_resolved: {
        Args: { allowed_roles: Database["public"]["Enums"]["user_role"][] }
        Returns: boolean
      }
      is_owner: { Args: never; Returns: boolean }
      is_pipeline_user: { Args: never; Returns: boolean }
      is_role: {
        Args: { p_role: Database["public"]["Enums"]["user_role"] }
        Returns: boolean
      }
      mark_all_notifications_read: { Args: never; Returns: number }
      mark_notifications_read: { Args: { p_ids: string[] }; Returns: number }
      mark_recall_vehicle: {
        Args: {
          p_job_id?: string
          p_notes?: string
          p_recall_vehicle_id: string
          p_status: string
        }
        Returns: undefined
      }
      mark_refund_paid: {
        Args: { p_method: string; p_refund_id: string }
        Returns: undefined
      }
      move_car: {
        Args: {
          p_car_id: string
          p_new_location_slot: string
          p_new_location_type: Database["public"]["Enums"]["location_type"]
          p_new_status?: Database["public"]["Enums"]["car_status"]
          p_note?: string
          p_user_id?: string
        }
        Returns: {
          battery_percent: number | null
          bl_issue_date: string | null
          brand: string
          created_at: string
          created_by: string | null
          current_km: number | null
          customer_id: string | null
          customs_amount_currency: string | null
          customs_amount_paid: number | null
          customs_notes: string | null
          customs_status: string | null
          date_arrived: string | null
          date_bought: string | null
          deleted_at: string | null
          delivery_date: string | null
          dongle: string | null
          engine_number: string | null
          ev_km: number | null
          exterior_color: string | null
          id: string
          incoming_eta: string | null
          interior_color: string | null
          is_erev: boolean
          issue: string | null
          km_range: number | null
          location_changed_at: string | null
          location_floor: string | null
          location_slot: string | null
          location_type: Database["public"]["Enums"]["location_type"]
          model: string
          model_year: number | null
          motor: string | null
          motor_km: number | null
          notes: string | null
          pdi_status: Database["public"]["Enums"]["pdi_status"]
          plate_number: string | null
          price: number | null
          price_currency: string | null
          recall_notes: string | null
          recall_reason: string | null
          recalled_at: string | null
          registration_date: string | null
          reservation_date: string | null
          shipment_code: string | null
          software_update: string | null
          software_version: string | null
          sold_at: string | null
          sold_marker: string | null
          specs: string | null
          status: Database["public"]["Enums"]["car_status"]
          status_changed_at: string | null
          sub_dealer_name: string | null
          suffix: string | null
          supplier_id: string | null
          trim: string | null
          updated_at: string
          vin: string
          warranty_battery_dms: string | null
          warranty_battery_expiry: string | null
          warranty_battery_km_limit: number | null
          warranty_expiry: string | null
          warranty_monza_start_date: string | null
          warranty_per_dms: string | null
          warranty_vehicle_expiry: string | null
          warranty_vehicle_km_limit: number | null
        }
        SetofOptions: {
          from: "*"
          to: "cars"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      move_part_stock: {
        Args: {
          p_car_id?: string
          p_job_description?: string
          p_movement_type: string
          p_note?: string
          p_part_id: string
          p_quantity: number
          p_user_id?: string
        }
        Returns: undefined
      }
      normalize_phone: { Args: { p: string }; Returns: string }
      notify_expiring_warranties: {
        Args: { p_threshold_days?: number }
        Returns: number
      }
      open_cash_session: {
        Args: {
          p_drawer_id?: string
          p_note?: string
          p_opening_balance: number
        }
        Returns: string
      }
      purge_old_system_events: { Args: never; Returns: number }
      record_manual_cash_movement: {
        Args: {
          p_amount: number
          p_direction: string
          p_drawer_id?: string
          p_kind: string
          p_note?: string
        }
        Returns: string
      }
      record_purchase_order_payment: {
        Args: {
          p_amount: number
          p_currency?: string
          p_invoice_id: string
          p_method: string
          p_notes?: string
          p_po_id: string
          p_reference?: string
        }
        Returns: string
      }
      record_purchase_order_receipt: {
        Args: {
          p_condition_note?: string
          p_grn_number: string
          p_photos?: string[]
          p_po_id: string
          p_received_lines: Json
        }
        Returns: Json
      }
      recover_payment_plan_from_default: {
        Args: { p_plan_id: string; p_reason: string }
        Returns: undefined
      }
      reject_purchase_order: {
        Args: { p_po_id: string; p_reason: string }
        Returns: undefined
      }
      reject_refund: {
        Args: { p_reason: string; p_refund_id: string }
        Returns: undefined
      }
      reject_trade_in: {
        Args: { p_reason: string; p_trade_in_id: string }
        Returns: undefined
      }
      release_bay: {
        Args: {
          p_bay_id: number
          p_new_job_status?: string
          p_set_bay_status?: string
          p_user_id?: string
        }
        Returns: {
          bay_number: number
          bay_type: string
          created_at: string | null
          current_job_id: string | null
          id: number
          is_active: boolean
          name: string
          sort_order: number
          status: string
          updated_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "garage_bays"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      request_refund: {
        Args: {
          p_amount: number
          p_currency?: string
          p_customer_id: string
          p_invoice_id?: string
          p_job_id?: string
          p_kind: string
          p_notes?: string
          p_part_id?: string
          p_quantity?: number
          p_reason: string
          p_warranty_case_id?: string
        }
        Returns: string
      }
      request_trade_in: {
        Args: {
          p_currency?: string
          p_customer_id: string
          p_mileage_km?: number
          p_notes?: string
          p_provisional_value: number
          p_vehicle_color?: string
          p_vehicle_make: string
          p_vehicle_model: string
          p_vehicle_plate?: string
          p_vehicle_trim?: string
          p_vehicle_vin?: string
          p_vehicle_year?: number
        }
        Returns: string
      }
      required_approver: {
        Args: { p_amount: number; p_kind: string }
        Returns: string
      }
      resolve_actor_id: { Args: { p_user_id: string }; Returns: string }
      return_part_from_job: {
        Args: { p_job_part_id: string; p_user_id?: string }
        Returns: boolean
      }
      scan_vin_to_bay: {
        Args: { p_bay_id: number; p_user_id?: string; p_vin: string }
        Returns: {
          actual_hours: number | null
          assigned_to: string | null
          bay_entered_at: string | null
          bay_exited_at: string | null
          car_id: string | null
          complaint: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          current_km: number | null
          customer_id: string | null
          deleted_at: string | null
          delivered_at: string | null
          description: string | null
          diagnosis: string | null
          due_date: string | null
          estimated_hours: number | null
          external_assignee_name: string | null
          garage_bay_id: number | null
          id: string
          is_battery_only: boolean | null
          job_number: string | null
          notes: string | null
          overtime_notified: boolean | null
          priority: string | null
          started_at: string
          status: string
          task_category_id: string | null
          title: string | null
          updated_at: string
          work_checklist: Json | null
          work_done: string | null
        }
        SetofOptions: {
          from: "*"
          to: "garage_jobs"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      send_purchase_order: {
        Args: {
          p_expected_delivery?: string
          p_po_id: string
          p_supplier_contact?: string
          p_supplier_reference?: string
        }
        Returns: undefined
      }
      send_workflow_reminders: {
        Args: never
        Returns: {
          abandoned_requests_closed: number
          abandoned_requests_reminded: number
          stale_proposals_reminded: number
        }[]
      }
      set_garage_job_category: {
        Args: { p_category_id: string; p_current_km?: number; p_job_id: string }
        Returns: Json
      }
      set_recall_status: {
        Args: { p_recall_id: string; p_status: string }
        Returns: {
          affected_models: string[] | null
          closed_at: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          description: string | null
          estimated_labor_hours: number | null
          id: string
          manufacturer: string | null
          model_year_max: number | null
          model_year_min: number | null
          opened_at: string
          recall_number: string
          required_parts: string | null
          status: string
          title: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "recalls"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_warranty_case_status: {
        Args: { p_case_id: string; p_note?: string; p_status: string }
        Returns: {
          car_id: string
          case_number: string
          closed_at: string | null
          closed_by: string | null
          created_at: string
          created_by: string | null
          customer_id: string | null
          deleted_at: string | null
          id: string
          job_id: string | null
          kind: string
          notes: string | null
          opened_at: string
          opened_by: string | null
          recall_id: string | null
          resolution: string | null
          severity: string
          status: string
          summary: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "warranty_cases"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      snooze_notification: {
        Args: { p_id: string; p_until: string }
        Returns: undefined
      }
      start_trade_in_inspection: {
        Args: { p_trade_in_id: string }
        Returns: undefined
      }
      submit_purchase_order: { Args: { p_po_id: string }; Returns: Json }
      use_part_on_job: {
        Args: {
          p_job_id: string
          p_note?: string
          p_part_id: string
          p_quantity: number
          p_user_id?: string
        }
        Returns: undefined
      }
      void_sales_order: {
        Args: { p_reason: string; p_sales_order_id: string }
        Returns: undefined
      }
      wake_snoozed_notifications: { Args: never; Returns: number }
    }
    Enums: {
      car_document_type: "pdi" | "job_card"
      car_event_type:
        | "created"
        | "moved"
        | "status_changed"
        | "battery_updated"
        | "pdi_updated"
        | "details_updated"
        | "note_added"
      car_status:
        | "inbound"
        | "in_stock"
        | "showroom"
        | "reserved"
        | "sold"
        | "delivered"
        | "service"
        | "sent_to_sub_dealer"
        | "demo"
        | "registered"
        | "under_registration"
        | "sent_to_customs"
        | "company_car"
        | "inventory"
        | "test_drive"
        | "available"
        | "scrapped"
      customs_status: "pending" | "in_progress" | "cleared" | "exempt"
      garage_task_status:
        | "pending"
        | "in_progress"
        | "blocked"
        | "done"
        | "cancelled"
      installment_status:
        | "upcoming"
        | "due"
        | "overdue"
        | "partial"
        | "paid"
        | "waived"
      job_priority: "low" | "normal" | "urgent"
      job_status:
        | "pending"
        | "in_progress"
        | "waiting_parts"
        | "done"
        | "cancelled"
      lead_source:
        | "walk_in"
        | "phone"
        | "whatsapp"
        | "instagram"
        | "facebook"
        | "website"
        | "referral"
        | "event"
        | "other"
      lead_status:
        | "new_lead"
        | "contacted"
        | "interested"
        | "test_drive"
        | "negotiation"
        | "converted"
        | "lost"
      location_type:
        | "showroom1"
        | "showroom2"
        | "garage"
        | "storage"
        | "inventory"
      notification_category:
        | "mention"
        | "assignment"
        | "approval"
        | "reply"
        | "status_change"
        | "alert"
        | "customer"
        | "critical"
      notification_severity: "info" | "warning" | "urgent" | "critical"
      part_status: "in_stock" | "low_stock" | "out_of_stock" | "discontinued"
      payment_plan_status: "active" | "completed" | "defaulted" | "cancelled"
      payment_type: "full" | "installments"
      pdi_status: "pending" | "in_progress" | "done"
      sale_status:
        | "reserved"
        | "draft"
        | "confirmed"
        | "paid"
        | "delivered"
        | "cancelled"
      shipping_status:
        | "pending"
        | "in_transit"
        | "arrived_port"
        | "customs"
        | "ready"
        | "received"
      user_capability:
        | "garage"
        | "vehicle_software"
        | "cashier"
        | "events_ops"
        | "manage_team"
        | "edit_users"
        | "deactivate_users"
        | "view_reports"
        | "inventory"
        | "sales"
        | "data_health"
        | "view_customer_documents"
      user_role:
        | "owner"
        | "sales"
        | "garage_manager"
        | "assistant"
        | "khalil_hybrid"
        | "it"
        | "garage_staff"
        | "sales_ops"
        | "hybrid"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      car_document_type: ["pdi", "job_card"],
      car_event_type: [
        "created",
        "moved",
        "status_changed",
        "battery_updated",
        "pdi_updated",
        "details_updated",
        "note_added",
      ],
      car_status: [
        "inbound",
        "in_stock",
        "showroom",
        "reserved",
        "sold",
        "delivered",
        "service",
        "sent_to_sub_dealer",
        "demo",
        "registered",
        "under_registration",
        "sent_to_customs",
        "company_car",
        "inventory",
        "test_drive",
        "available",
        "scrapped",
      ],
      customs_status: ["pending", "in_progress", "cleared", "exempt"],
      garage_task_status: [
        "pending",
        "in_progress",
        "blocked",
        "done",
        "cancelled",
      ],
      installment_status: [
        "upcoming",
        "due",
        "overdue",
        "partial",
        "paid",
        "waived",
      ],
      job_priority: ["low", "normal", "urgent"],
      job_status: [
        "pending",
        "in_progress",
        "waiting_parts",
        "done",
        "cancelled",
      ],
      lead_source: [
        "walk_in",
        "phone",
        "whatsapp",
        "instagram",
        "facebook",
        "website",
        "referral",
        "event",
        "other",
      ],
      lead_status: [
        "new_lead",
        "contacted",
        "interested",
        "test_drive",
        "negotiation",
        "converted",
        "lost",
      ],
      location_type: [
        "showroom1",
        "showroom2",
        "garage",
        "storage",
        "inventory",
      ],
      notification_category: [
        "mention",
        "assignment",
        "approval",
        "reply",
        "status_change",
        "alert",
        "customer",
        "critical",
      ],
      notification_severity: ["info", "warning", "urgent", "critical"],
      part_status: ["in_stock", "low_stock", "out_of_stock", "discontinued"],
      payment_plan_status: ["active", "completed", "defaulted", "cancelled"],
      payment_type: ["full", "installments"],
      pdi_status: ["pending", "in_progress", "done"],
      sale_status: [
        "reserved",
        "draft",
        "confirmed",
        "paid",
        "delivered",
        "cancelled",
      ],
      shipping_status: [
        "pending",
        "in_transit",
        "arrived_port",
        "customs",
        "ready",
        "received",
      ],
      user_capability: [
        "garage",
        "vehicle_software",
        "cashier",
        "events_ops",
        "manage_team",
        "edit_users",
        "deactivate_users",
        "view_reports",
        "inventory",
        "sales",
        "data_health",
        "view_customer_documents",
      ],
      user_role: [
        "owner",
        "sales",
        "garage_manager",
        "assistant",
        "khalil_hybrid",
        "it",
        "garage_staff",
        "sales_ops",
        "hybrid",
      ],
    },
  },
} as const
