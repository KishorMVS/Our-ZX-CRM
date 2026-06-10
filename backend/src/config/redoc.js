
const redoc = {
  openapi: "3.0.3",
  info: {
    title: "ZX-CRM API",
    version: "1.0.0",
    description:
      "Complete REST API documentation for the ZX-CRM backend. All protected routes require a Bearer JWT token.",
    contact: {
      name: "ZX-CRM Support",
    },
  },
  servers: [
    {
      url: process.env.BACKEND_URL || "http://localhost:5001",
      description: process.env.BACKEND_URL ? "Production Server" : "Local Development Server",
    },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
      },
    },
    schemas: {
      // ── Auth ──────────────────────────────────────────────────────
      LoginRequest: {
        type: "object",
        required: ["email", "password"],
        properties: {
          email: { type: "string", format: "email", example: "admin@zxcrm.com" },
          password: { type: "string", example: "secret123" },
        },
      },
      LoginResponse: {
        type: "object",
        properties: {
          token: { type: "string", example: "eyJhbGciOiJIUzI1NiIs..." },
          user: {
            type: "object",
            properties: {
              id: { type: "string" },
              name: { type: "string" },
              email: { type: "string" },
              role: { type: "string", enum: ["SUPER_ADMIN", "ADMIN", "EMPLOYEE"] },
            },
          },
        },
      },
      // ── User/Team ─────────────────────────────────────────────────
      User: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          email: { type: "string" },
          phone: { type: "string" },
          role: { type: "string", enum: ["SUPER_ADMIN", "ADMIN", "EMPLOYEE", "AGENT"] },
          isActive: { type: "boolean" },
          department: { type: "string" },
          jobTitle: { type: "string" },
          onlineStatus: { type: "string" },
          createdAt: { type: "string", format: "date-time" },
        },
      },
      CreateUserRequest: {
        type: "object",
        required: ["name", "email", "password", "role"],
        properties: {
          name: { type: "string", example: "Jane Doe" },
          email: { type: "string", example: "jane@zenxai.io" },
          phone: { type: "string" },
          password: { type: "string", format: "password" },
          role: { type: "string", enum: ["ADMIN", "EMPLOYEE", "AGENT"] },
          department: { type: "string" },
          jobTitle: { type: "string" },
        },
      },
      UpdateProfileRequest: {
        type: "object",
        properties: {
          name: { type: "string" },
          phone: { type: "string" },
          avatar: { type: "string" },
        },
      },
      ChangePasswordRequest: {
        type: "object",
        required: ["currentPassword", "newPassword"],
        properties: {
          currentPassword: { type: "string" },
          newPassword: { type: "string" },
        },
      },
      // ── Lead ──────────────────────────────────────────────────────
      Lead: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          email: { type: "string" },
          phone: { type: "string" },
          company: { type: "string" },
          source: { type: "string" },
          enquiryType: { type: "string" },
          status: {
            type: "string",
            enum: ["NEW", "CONTACTED", "QUALIFIED", "PROPOSAL", "WON", "LOST"],
          },
          score: { type: "number" },
          category: { type: "string" },
          assignedToId: { type: "string", description: "User ID" },
          createdAt: { type: "string", format: "date-time" },
        },
      },
      CreateLeadRequest: {
        type: "object",
        required: ["name"],
        properties: {
          name: { type: "string", example: "Jane Smith" },
          email: { type: "string", example: "jane@example.com" },
          phone: { type: "string", example: "+919876543210" },
          company: { type: "string", example: "Acme Corp" },
          source: { type: "string", example: "WEBSITE" },
          enquiryType: { type: "string", example: "PRODUCT" },
          status: { type: "string", enum: ["NEW", "CONTACTED", "QUALIFIED", "PROPOSAL", "WON", "LOST"], default: "NEW" },
        },
      },
      BulkUpdateLeadsRequest: {
        type: "object",
        required: ["leadIds", "status"],
        properties: {
          leadIds: { type: "array", items: { type: "string" } },
          status: { type: "string" },
        },
      },
      BulkAssignLeadsRequest: {
        type: "object",
        required: ["leadIds", "assignedToId"],
        properties: {
          leadIds: { type: "array", items: { type: "string" } },
          assignedToId: { type: "string" },
        },
      },
      MergeLeadsRequest: {
        type: "object",
        required: ["primaryLeadId", "secondaryLeadId"],
        properties: {
          primaryLeadId: { type: "string" },
          secondaryLeadId: { type: "string" },
        },
      },
      FileUploadResponse: {
        type: "object",
        properties: {
          message: { type: "string" },
          url: { type: "string" },
        },
      },
      TaskFile: {
        type: "object",
        properties: {
          fileName: { type: "string" },
          fileUrl: { type: "string" },
          fileSize: { type: "integer" },
          mimeType: { type: "string" },
        },
      },
      CheckDuplicateRequest: {
        type: "object",
        properties: {
          email: { type: "string" },
          phone: { type: "string" },
        },
      },
      LeadActivity: {
        type: "object",
        properties: {
          id: { type: "string" },
          leadId: { type: "string" },
          userId: { type: "string" },
          action: { type: "string" },
          metadata: { type: "object" },
          createdAt: { type: "string", format: "date-time" },
          user: {
            type: "object",
            properties: {
              name: { type: "string" },
            },
          },
        },
      },
      // ── Task ──────────────────────────────────────────────────────
      Task: {
        type: "object",
        properties: {
          id: { type: "string" },
          title: { type: "string" },
          description: { type: "string" },
          status: { type: "string", enum: ["PENDING", "COMPLETED"] },
          kanbanStatus: { type: "string", enum: ["BACKLOG", "TODO", "IN_PROGRESS", "IN_REVIEW", "DONE", "BLOCKED"] },
          priority: { type: "string", enum: ["LOW", "MEDIUM", "HIGH"] },
          dueDate: { type: "string", format: "date-time" },
          assignedToId: { type: "string" },
          leadId: { type: "string" },
          sprintId: { type: "string" },
          storyPoints: { type: "integer" },
          estimatedHours: { type: "number" },
          actualHours: { type: "number" },
          labels: { type: "array", items: { type: "string" } },
          createdAt: { type: "string", format: "date-time" },
          completedAt: { type: "string", format: "date-time" },
          lead: { $ref: "#/components/schemas/Lead" },
          assignedTo: { $ref: "#/components/schemas/User" },
        },
      },
      CreateTaskRequest: {
        type: "object",
        required: ["title", "dueDate"],
        properties: {
          title: { type: "string", example: "Follow up with lead" },
          description: { type: "string" },
          priority: { type: "string", enum: ["LOW", "MEDIUM", "HIGH"], default: "MEDIUM" },
          dueDate: { type: "string", format: "date-time" },
          assignedTo: { type: "string", description: "User ID" },
          leadId: { type: "string" },
          sprintId: { type: "string" },
          storyPoints: { type: "integer" },
          estimatedHours: { type: "number" },
          labels: { type: "array", items: { type: "string" } },
        },
      },
      TaskComment: {
        type: "object",
        properties: {
          id: { type: "string" },
          taskId: { type: "string" },
          userId: { type: "string" },
          content: { type: "string" },
          createdAt: { type: "string", format: "date-time" },
          user: {
            type: "object",
            properties: {
              id: { type: "string" },
              name: { type: "string" },
            },
          },
        },
      },
      // ── Invoice ───────────────────────────────────────────────────
      CreateInvoiceRequest: {
        type: "object",
        required: ["clientName", "amount"],
        properties: {
          clientName: { type: "string", example: "Acme Corp" },
          amount: { type: "number", example: 5000 },
          dueDate: { type: "string", format: "date" },
          items: {
            type: "array",
            items: {
              type: "object",
              properties: {
                description: { type: "string" },
                quantity: { type: "number" },
                unitPrice: { type: "number" },
              },
            },
          },
        },
      },
      Invoice: {
        type: "object",
        properties: {
          id: { type: "string" },
          invoiceNumber: { type: "string" },
          invoiceType: { type: "string", enum: ["TAX_INVOICE", "PROFORMA"] },
          clientName: { type: "string" },
          clientEmail: { type: "string" },
          clientPhone: { type: "string" },
          clientAddress: { type: "string" },
          clientGstin: { type: "string" },
          subtotal: { type: "number" },
          cgst: { type: "number" },
          sgst: { type: "number" },
          igst: { type: "number" },
          total: { type: "number" },
          totalPaid: { type: "number" },
          balance: { type: "number" },
          status: { type: "string", enum: ["DRAFT", "SENT", "PARTIALLY_PAID", "PAID", "CANCELLED"] },
          dueDate: { type: "string", format: "date-time" },
          notes: { type: "string" },
          items: { type: "array", items: { $ref: "#/components/schemas/InvoiceItem" } },
          payments: { type: "array", items: { $ref: "#/components/schemas/PaymentEntry" } },
          createdAt: { type: "string", format: "date-time" },
        },
      },
      InvoiceItem: {
        type: "object",
        properties: {
          id: { type: "string" },
          description: { type: "string" },
          price: { type: "number" },
          quantity: { type: "number" },
          taxRate: { type: "number" },
          taxableValue: { type: "number" },
          amount: { type: "number" },
        },
      },
      PaymentEntry: {
        type: "object",
        properties: {
          id: { type: "string" },
          amount: { type: "number" },
          type: { type: "string", enum: ["CREDIT", "DEBIT"] },
          description: { type: "string" },
          paymentDate: { type: "string", format: "date-time" },
        },
      },
      BalanceSheet: {
        type: "object",
        properties: {
          summary: {
            type: "object",
            properties: {
              totalInvoiced: { type: "number" },
              totalReceived: { type: "number" },
              totalOutstanding: { type: "number" },
              invoiceCount: { type: "integer" },
              paidCount: { type: "integer" },
              partialCount: { type: "integer" },
              overdueCount: { type: "integer" },
            },
          },
          ledger: {
            type: "array",
            items: { $ref: "#/components/schemas/Invoice" },
          },
        },
      },
      // ── Sprint ────────────────────────────────────────────────────
      CreateSprintRequest: {
        type: "object",
        required: ["name", "startDate", "endDate"],
        properties: {
          name: { type: "string", example: "Sprint 1" },
          startDate: { type: "string", format: "date" },
          endDate: { type: "string", format: "date" },
          goal: { type: "string" },
        },
      },
      Sprint: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          goal: { type: "string" },
          startDate: { type: "string", format: "date-time" },
          endDate: { type: "string", format: "date-time" },
          status: { type: "string", enum: ["PLANNED", "ACTIVE", "COMPLETED"] },
          createdAt: { type: "string", format: "date-time" },
          tasks: { type: "array", items: { $ref: "#/components/schemas/Task" } },
        },
      },
      // ── Note ──────────────────────────────────────────────────────
      CreateNoteRequest: {
        type: "object",
        required: ["content"],
        properties: {
          content: { type: "string", example: "Called the lead, they seem interested." },
        },
      },
      Note: {
        type: "object",
        properties: {
          id: { type: "string" },
          leadId: { type: "string" },
          content: { type: "string" },
          createdAt: { type: "string", format: "date-time" },
        },
      },
      Reminder: {
        type: "object",
        properties: {
          id: { type: "string" },
          title: { type: "string" },
          remindAt: { type: "string", format: "date-time" },
          isCompleted: { type: "boolean" },
          leadId: { type: "string" },
          userId: { type: "string" },
          createdAt: { type: "string", format: "date-time" },
        },
      },
      // ── Attendance ────────────────────────────────────────────────
      Notification: {
        type: "object",
        properties: {
          id: { type: "string" },
          userId: { type: "string" },
          title: { type: "string" },
          message: { type: "string" },
          type: { type: "string" },
          link: { type: "string" },
          isRead: { type: "boolean" },
          createdAt: { type: "string", format: "date-time" },
        },
      },
      CheckInRequest: {
        type: "object",
        properties: {
          location: { type: "string", example: "Office" },
        },
      },
      LeadWebhookRequest: {
        type: "object",
        required: ["name", "phone"],
        properties: {
          source: { type: "string", example: "WEBSITE" },
          name: { type: "string", example: "John Doe" },
          email: { type: "string", example: "john@example.com" },
          phone: { type: "string", example: "+919876543210" },
          enquiryType: { type: "string", example: "SERVICES" },
          metadata: { type: "object" },
        },
      },
      ZenVoiceWebhookRequest: {
        type: "object",
        required: ["collectedData", "room_name"],
        properties: {
          assistantId: { type: "string" },
          toolName: { type: "string" },
          collectedData: {
            type: "object",
            properties: {
              name: { type: "string" },
              phonenum: { type: "string" },
              interest: { type: "string" },
            },
          },
          room_name: { type: "string", description: "The call session ID" },
        },
      },
      CalendlyWebhookRequest: {
        type: "object",
        required: ["event", "payload"],
        properties: {
          event: { type: "string", example: "invitee.created" },
          payload: {
            type: "object",
            properties: {
              email: { type: "string" },
              name: { type: "string" },
              scheduled_event: {
                type: "object",
                properties: {
                  start_time: { type: "string", format: "date-time" },
                  name: { type: "string" },
                  location: {
                    type: "object",
                    properties: {
                      join_url: { type: "string" },
                    },
                  },
                },
              },
            },
          },
        },
      },
      // ── Leave ─────────────────────────────────────────────────────
      ApplyLeaveRequest: {
        type: "object",
        required: ["fromDate", "toDate", "reason", "approverIds", "leaveType"],
        properties: {
          fromDate: { type: "string", format: "date", example: "2026-05-01" },
          toDate: { type: "string", format: "date", example: "2026-05-03" },
          reason: { type: "string", example: "Personal emergency" },
          leaveType: { type: "string", enum: ["LEAVE", "WFH", "COMP_OFF"], default: "LEAVE" },
          approverIds: { type: "array", items: { type: "string" }, description: "List of user IDs to approve this leave" },
        },
      },
      Leave: {
        type: "object",
        properties: {
          id: { type: "string" },
          userId: { type: "string" },
          fromDate: { type: "string", format: "date-time" },
          toDate: { type: "string", format: "date-time" },
          totalDays: { type: "integer" },
          reason: { type: "string" },
          leaveType: { type: "string", enum: ["LEAVE", "WFH", "COMP_OFF"] },
          status: { type: "string", enum: ["PENDING", "APPROVED", "REJECTED"] },
          createdAt: { type: "string", format: "date-time" },
          approvals: { type: "array", items: { $ref: "#/components/schemas/LeaveApproval" } },
          user: {
            type: "object",
            properties: {
              id: { type: "string" },
              name: { type: "string" },
              email: { type: "string" },
              department: { type: "string" },
            },
          },
        },
      },
      LeaveApproval: {
        type: "object",
        properties: {
          id: { type: "string" },
          leaveId: { type: "string" },
          approverId: { type: "string" },
          status: { type: "string", enum: ["PENDING", "APPROVED", "REJECTED"] },
          comments: { type: "string" },
          approver: {
            type: "object",
            properties: {
              id: { type: "string" },
              name: { type: "string" },
              email: { type: "string" },
            },
          },
        },
      },
      LeaveStats: {
        type: "object",
        properties: {
          totalApplied: { type: "integer" },
          approved: { type: "integer" },
          pending: { type: "integer" },
          rejected: { type: "integer" },
          totalDaysTaken: { type: "integer" },
        },
      },
      // ── Department ────────────────────────────────────────────────
      CreateDepartmentRequest: {
        type: "object",
        required: ["name"],
        properties: {
          name: { type: "string", example: "Sales" },
        },
      },
      BusinessSearchRequest: {
        type: "object",
        required: ["query"],
        properties: {
          query: { type: "string", example: "digital marketing agencies in Bangalore" },
        },
      },
      BusinessSearchResult: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          phone: { type: "string" },
          email: { type: "string" },
          address: { type: "string" },
          website: { type: "string" },
          rating: { type: "number" },
          ratingCount: { type: "integer" },
          category: { type: "string" },
          source: { type: "string" },
          enquiryType: { type: "string" },
        },
      },
      ImportSearchedLeadsRequest: {
        type: "object",
        required: ["leads"],
        properties: {
          leads: { type: "array", items: { $ref: "#/components/schemas/BusinessSearchResult" } },
        },
      },
      Department: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          _count: {
            type: "object",
            properties: {
              users: { type: "integer" },
            },
          },
          users: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "string" },
                name: { type: "string" },
                email: { type: "string" },
                phone: { type: "string" },
                role: { type: "string" },
                jobTitle: { type: "string" },
              },
            },
          },
        },
      },
      // ── Reminder ──────────────────────────────────────────────────
      CreateReminderRequest: {
        type: "object",
        required: ["title", "remindAt"],
        properties: {
          title: { type: "string", example: "Call client back" },
          remindAt: { type: "string", format: "date-time" },
          leadId: { type: "string" },
        },
      },
      // ── Generic ───────────────────────────────────────────────────
      ErrorResponse: {
        type: "object",
        properties: {
          error: { type: "string", example: "Unauthorized" },
          message: { type: "string" },
        },
      },
      SuccessResponse: {
        type: "object",
        properties: {
          message: { type: "string", example: "Operation successful" },
        },
      },
      CompanySettings: {
        type: "object",
        properties: {
          id: { type: "string" },
          companyName: { type: "string" },
          shortName: { type: "string" },
          gstin: { type: "string" },
          address: { type: "string" },
          city: { type: "string" },
          state: { type: "string" },
          pincode: { type: "string" },
          phone: { type: "string" },
          email: { type: "string" },
          website: { type: "string" },
          placeOfSupply: { type: "string" },
          bankName: { type: "string" },
          accountNo: { type: "string" },
          ifsc: { type: "string" },
          branch: { type: "string" },
          defaultTaxRate: { type: "number" },
          defaultNotes: { type: "string" },
        },
      },
      DemoBookingRequest: {
        type: "object",
        required: ["companyName", "email", "phone", "date", "time"],
        properties: {
          companyName: { type: "string", example: "Acme Corp" },
          email: { type: "string", format: "email", example: "jane@example.com" },
          phone: { type: "string", example: "+919876543210" },
          date: { type: "string", format: "date", example: "2024-05-20" },
          time: { type: "string", example: "14:30" },
        },
      },
    },
  },
  security: [{ bearerAuth: [] }],
  tags: [
    { name: "Auth", description: "Authentication endpoints (public)" },
    { name: "Users", description: "User profile management" },
    { name: "Team", description: "Team/user management (Admin only)" },
    { name: "Leads", description: "Lead management" },
    { name: "Notes", description: "Lead notes" },
    { name: "Tasks", description: "Task management" },
    { name: "Sprints", description: "Sprint/project management" },
    { name: "Invoices", description: "Invoice management" },
    { name: "Call Logs", description: "Call logging and recording" },
    { name: "Attendance", description: "Employee attendance tracking" },
    { name: "Leave", description: "Leave management" },
    { name: "Departments", description: "Department management" },
    { name: "Reminders", description: "Personal reminders" },
    { name: "Notifications", description: "In-app notifications" },
    { name: "Analytics", description: "CRM analytics and reporting" },
    { name: "Integrations", description: "Third-party integrations" },
    { name: "Audit Logs", description: "System audit trail" },
    { name: "Sessions", description: "User session management" },
    { name: "Search", description: "Global search" },
    { name: "Export", description: "Data export" },
    { name: "Upload", description: "File upload" },
    { name: "Webhooks", description: "Outgoing webhooks" },
    { name: "Commission", description: "Sales commission tracking" },
    { name: "Reports", description: "CRM reports" },
    { name: "Company", description: "Company account and global settings" },
    { name: "Demo Booking", description: "Public demo booking endpoints" },
  ],
  paths: {
    "/api/auth/login": {
      post: {
        tags: ["Auth"],
        summary: "Login to CRM",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/LoginRequest" } } },
        },
        responses: {
          200: { description: "Success", content: { "application/json": { schema: { $ref: "#/components/schemas/LoginResponse" } } } },
          401: { description: "Invalid credentials" },
        },
      },
    },
    "/api/users/profile": {
      get: {
        tags: ["Users"],
        summary: "Get my profile",
        responses: { 200: { description: "User profile" }, 401: { description: "Unauthorized" } },
      },
      patch: {
        tags: ["Users"],
        summary: "Update my profile",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/UpdateProfileRequest" } } },
        },
        responses: { 200: { description: "Profile updated" }, 401: { description: "Unauthorized" } },
      },
    },
    "/api/users/password": {
      patch: {
        tags: ["Users"],
        summary: "Change my password",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/ChangePasswordRequest" } } },
        },
        responses: {
          200: { description: "Password changed" },
          400: { description: "Incorrect current password" },
        },
      },
    },
    "/api/users/preferences": {
      patch: {
        tags: ["Users"],
        summary: "Update preferences",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  theme: { type: "string", enum: ["light", "dark"] },
                  language: { type: "string" },
                  notifications: { type: "boolean" },
                },
              },
            },
          },
        },
        responses: {
          200: { description: "Preferences updated" },
        },
      },
    },
    "/api/team": {
      get: {
        tags: ["Team"],
        summary: "Get all team members (Admin only)",
        responses: { 200: { description: "Team list" }, 403: { description: "Forbidden" } },
      },
      post: {
        tags: ["Team"],
        summary: "Create a team member (Admin only)",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/CreateUserRequest" } } },
        },
        responses: { 201: { description: "User created" }, 403: { description: "Forbidden" } },
      },
    },
    "/api/team/{id}/toggle": {
      patch: {
        tags: ["Team"],
        summary: "Toggle user access (Admin only)",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: { description: "Access toggled" } },
      },
    },
    "/api/team/{id}": {
      patch: {
        tags: ["Team"],
        summary: "Update team member (Admin only)",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/UpdateProfileRequest" } } },
        },
        responses: { 200: { description: "Updated" } },
      },
      delete: {
        tags: ["Team"],
        summary: "Soft delete team member (Admin only)",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: { description: "Deleted" } },
      },
    },
    "/api/leads": {
      get: {
        tags: ["Leads"],
        summary: "Get all leads",
        parameters: [
          { name: "page", in: "query", schema: { type: "integer", default: 1 } },
          { name: "limit", in: "query", schema: { type: "integer", default: 20 } },
          { name: "status", in: "query", schema: { type: "string" } },
          { name: "search", in: "query", schema: { type: "string" } },
        ],
        responses: {
          200: {
            description: "Paginated lead list",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: { type: "array", items: { $ref: "#/components/schemas/Lead" } },
                    total: { type: "integer" },
                    page: { type: "integer" },
                  },
                },
              },
            },
          },
        },
      },
      post: {
        tags: ["Leads"],
        summary: "Create lead (Admin only)",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/CreateLeadRequest" } } },
        },
        responses: {
          201: { description: "Lead created", content: { "application/json": { schema: { $ref: "#/components/schemas/Lead" } } } },
        },
      },
    },
    "/api/leads/export": {
      get: {
        tags: ["Leads"],
        summary: "Export leads as CSV",
        responses: { 200: { description: "CSV file download" } },
      },
    },
    "/api/leads/import": {
      post: {
        tags: ["Leads"],
        summary: "Import leads from CSV (Admin only)",
        requestBody: {
          required: true,
          content: {
            "multipart/form-data": {
              schema: {
                type: "object",
                properties: { csv: { type: "string", format: "binary" } },
              },
            },
          },
        },
        responses: { 200: { description: "Leads imported" } },
      },
    },
    "/api/leads/check-duplicate": {
      post: {
        tags: ["Leads"],
        summary: "Check for duplicate lead",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/CheckDuplicateRequest" },
            },
          },
        },
        responses: { 200: { description: "Duplicate check result" } },
      },
    },
    "/api/leads/merge": {
      post: {
        tags: ["Leads"],
        summary: "Merge two leads (Admin only)",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/MergeLeadsRequest" } } },
        },
        responses: { 200: { description: "Leads merged" } },
      },
    },
    "/api/leads/bulk-update": {
      patch: {
        tags: ["Leads"],
        summary: "Bulk update leads (Admin only)",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/BulkUpdateLeadsRequest" } } },
        },
        responses: { 200: { description: "Updated" } },
      },
    },
    "/api/leads/bulk-assign": {
      patch: {
        tags: ["Leads"],
        summary: "Bulk assign leads (Admin only)",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/BulkAssignLeadsRequest" } } },
        },
        responses: { 200: { description: "Assigned" } },
      },
    },
    "/api/leads/{id}/activities": {
      get: {
        tags: ["Leads"],
        summary: "Get lead activity timeline",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: { description: "Activities list" } },
      },
    },
    "/api/leads/{id}/assign": {
      patch: {
        tags: ["Leads"],
        summary: "Assign lead to user (Admin only)",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { type: "object", properties: { assignedTo: { type: "string" } } },
            },
          },
        },
        responses: { 200: { description: "Assigned" } },
      },
    },
    "/api/leads/{id}/status": {
      patch: {
        tags: ["Leads"],
        summary: "Update lead status",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  status: { type: "string", enum: ["NEW", "CONTACTED", "QUALIFIED", "PROPOSAL", "WON", "LOST"] },
                },
              },
            },
          },
        },
        responses: { 200: { description: "Status updated" } },
      },
    },
    "/api/leads/{leadId}/notes": {
      get: {
        tags: ["Notes"],
        summary: "Get notes for a lead",
        parameters: [{ name: "leadId", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: { description: "Notes list" } },
      },
      post: {
        tags: ["Notes"],
        summary: "Create a note for a lead",
        parameters: [{ name: "leadId", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/CreateNoteRequest" } } },
        },
        responses: { 201: { description: "Note created" } },
      },
    },
    "/api/tasks": {
      get: {
        tags: ["Tasks"],
        summary: "Get all tasks",
        parameters: [
          { name: "status", in: "query", schema: { type: "string" } },
          { name: "assignedTo", in: "query", schema: { type: "string" } },
        ],
        responses: { 200: { description: "Tasks list" } },
      },
      post: {
        tags: ["Tasks"],
        summary: "Create task (Admin only)",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/CreateTaskRequest" } } },
        },
        responses: { 201: { description: "Task created" } },
      },
    },
    "/api/tasks/{id}": {
      get: {
        tags: ["Tasks"],
        summary: "Get task by ID",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: { description: "Task detail" } },
      },
      put: {
        tags: ["Tasks"],
        summary: "Update task (Admin only)",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/CreateTaskRequest" } } },
        },
        responses: { 200: { description: "Updated" } },
      },
      delete: {
        tags: ["Tasks"],
        summary: "Delete task (Admin only)",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: { description: "Deleted" } },
      },
    },
    "/api/tasks/{id}/status": {
      patch: {
        tags: ["Tasks"],
        summary: "Update task status",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { type: "object", properties: { status: { type: "string" } } },
            },
          },
        },
        responses: { 200: { description: "Status updated" } },
      },
    },
    "/api/tasks/{id}/kanban": {
      patch: {
        tags: ["Tasks"],
        summary: "Update kanban position (drag & drop)",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  kanbanStatus: { type: "string" },
                  position: { type: "integer" },
                },
              },
            },
          },
        },
        responses: { 200: { description: "Updated" } },
      },
    },
    "/api/tasks/{id}/comments": {
      get: {
        tags: ["Tasks"],
        summary: "Get task comments",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: { description: "Comments list" } },
      },
      post: {
        tags: ["Tasks"],
        summary: "Add comment to task",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { type: "object", properties: { content: { type: "string" } } },
            },
          },
        },
        responses: { 201: { description: "Comment added" } },
      },
    },
    "/api/tasks/{id}/comments/{commentId}": {
      delete: {
        tags: ["Tasks"],
        summary: "Delete a task comment",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
          { name: "commentId", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: { 200: { description: "Deleted" } },
      },
    },
    "/api/sprints": {
      get: {
        tags: ["Sprints"],
        summary: "Get all sprints",
        responses: { 200: { description: "Sprint list" } },
      },
      post: {
        tags: ["Sprints"],
        summary: "Create sprint (Admin only)",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/CreateSprintRequest" } } },
        },
        responses: { 201: { description: "Sprint created" } },
      },
    },
    "/api/sprints/active": {
      get: { tags: ["Sprints"], summary: "Get active sprint", responses: { 200: { description: "Active sprint" } } },
    },
    "/api/sprints/backlog": {
      get: { tags: ["Sprints"], summary: "Get backlog tasks", responses: { 200: { description: "Backlog" } } },
    },
    "/api/sprints/velocity": {
      get: { tags: ["Sprints"], summary: "Get team velocity", responses: { 200: { description: "Velocity data" } } },
    },
    "/api/sprints/{id}": {
      put: {
        tags: ["Sprints"],
        summary: "Update sprint (Admin only)",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/CreateSprintRequest" } } },
        },
        responses: { 200: { description: "Updated" } },
      },
      delete: {
        tags: ["Sprints"],
        summary: "Delete sprint (Admin only)",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: { description: "Deleted" } },
      },
    },
    "/api/sprints/{id}/analytics": {
      get: {
        tags: ["Sprints"],
        summary: "Get sprint analytics",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: { description: "Analytics data" } },
      },
    },
    "/api/sprints/{id}/start": {
      post: {
        tags: ["Sprints"],
        summary: "Start sprint (Admin only)",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: { description: "Sprint started" } },
      },
    },
    "/api/sprints/{id}/complete": {
      post: {
        tags: ["Sprints"],
        summary: "Complete sprint (Admin only)",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: { description: "Sprint completed" } },
      },
    },
    "/api/sprints/{id}/tasks": {
      post: {
        tags: ["Sprints"],
        summary: "Add tasks to sprint (Admin only)",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { type: "object", properties: { taskIds: { type: "array", items: { type: "string" } } } },
            },
          },
        },
        responses: { 200: { description: "Tasks added" } },
      },
    },
    "/api/sprints/{id}/tasks/{taskId}": {
      delete: {
        tags: ["Sprints"],
        summary: "Remove task from sprint (Admin only)",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
          { name: "taskId", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: { 200: { description: "Task removed" } },
      },
    },
    "/api/invoices": {
      get: { tags: ["Invoices"], summary: "Get all invoices", responses: { 200: { description: "Invoice list" } } },
      post: {
        tags: ["Invoices"],
        summary: "Create invoice (Admin only)",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/CreateInvoiceRequest" } } },
        },
        responses: { 201: { description: "Invoice created" } },
      },
    },
    "/api/invoices/balance-sheet": {
      get: { tags: ["Invoices"], summary: "Get balance sheet", responses: { 200: { description: "Balance sheet data" } } },
    },
    "/api/invoices/{id}": {
      get: {
        tags: ["Invoices"],
        summary: "Get invoice by ID",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: { description: "Invoice detail" } },
      },
      patch: {
        tags: ["Invoices"],
        summary: "Update invoice (Admin only)",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/CreateInvoiceRequest" } } },
        },
        responses: { 200: { description: "Updated" } },
      },
      delete: {
        tags: ["Invoices"],
        summary: "Delete invoice (Admin only)",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: { description: "Deleted" } },
      },
    },
    "/api/invoices/{id}/send-email": {
      post: {
        tags: ["Invoices"],
        summary: "Send invoice via email (Admin only)",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: { description: "Email sent" } },
      },
    },
    "/api/invoices/{id}/payments": {
      post: {
        tags: ["Invoices"],
        summary: "Add payment to invoice (Admin only)",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  amount: { type: "number" },
                  method: { type: "string" },
                  paidAt: { type: "string", format: "date" },
                },
              },
            },
          },
        },
        responses: { 201: { description: "Payment added" } },
      },
    },
    "/api/invoices/{id}/payments/{paymentId}": {
      delete: {
        tags: ["Invoices"],
        summary: "Delete payment (Admin only)",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
          { name: "paymentId", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: { 200: { description: "Deleted" } },
      },
    },
    "/api/calls/log": {
      post: {
        tags: ["Call Logs"],
        summary: "Log a manual call",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  leadId: { type: "string" },
                  duration: { type: "integer", description: "Duration in seconds" },
                  outcome: { type: "string" },
                  notes: { type: "string" },
                },
              },
            },
          },
        },
        responses: { 201: { description: "Call logged" } },
      },
    },
    "/api/calls/click2call": {
      post: {
        tags: ["Call Logs"],
        summary: "Initiate click-to-call",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { type: "object", properties: { leadId: { type: "string" }, phone: { type: "string" } } },
            },
          },
        },
        responses: { 200: { description: "Call initiated" } },
      },
    },
    "/api/calls/upload-recording": {
      post: {
        tags: ["Call Logs"],
        summary: "Upload call recording",
        requestBody: {
          required: true,
          content: {
            "multipart/form-data": {
              schema: { type: "object", properties: { recording: { type: "string", format: "binary" } } },
            },
          },
        },
        responses: { 200: { description: "Recording uploaded" } },
      },
    },
    "/api/calls/{leadId}": {
      get: {
        tags: ["Call Logs"],
        summary: "Get call logs for a lead",
        parameters: [{ name: "leadId", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: { description: "Call logs" } },
      },
    },
    "/api/attendance/check-in": {
      post: {
        tags: ["Attendance"],
        summary: "Employee check-in",
        requestBody: {
          content: { "application/json": { schema: { $ref: "#/components/schemas/CheckInRequest" } } },
        },
        responses: { 200: { description: "Checked in" } },
      },
    },
    "/api/attendance/check-out": {
      post: {
        tags: ["Attendance"],
        summary: "Employee check-out",
        responses: { 200: { description: "Checked out" } },
      },
    },
    "/api/attendance/my": {
      get: {
        tags: ["Attendance"],
        summary: "Get my attendance records",
        parameters: [
          { name: "month", in: "query", schema: { type: "integer" } },
          { name: "year", in: "query", schema: { type: "integer" } },
        ],
        responses: { 200: { description: "My attendance" } },
      },
    },
    "/api/leave/apply": {
      post: {
        tags: ["Leave"],
        summary: "Apply for leave",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/ApplyLeaveRequest" } } },
        },
        responses: { 201: { description: "Leave applied" } },
      },
    },
    "/api/leave/my": {
      get: { tags: ["Leave"], summary: "Get my leave requests", responses: { 200: { description: "My leaves" } } },
    },
    "/api/departments": {
      get: { tags: ["Departments"], summary: "Get all departments", responses: { 200: { description: "Department list" } } },
      post: {
        tags: ["Departments"],
        summary: "Create department (Admin only)",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/CreateDepartmentRequest" } } },
        },
        responses: { 201: { description: "Department created" } },
      },
    },
    "/api/reminders": {
      get: { tags: ["Reminders"], summary: "Get my reminders", responses: { 200: { description: "Reminders list" } } },
      post: {
        tags: ["Reminders"],
        summary: "Create reminder",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/CreateReminderRequest" } } },
        },
        responses: { 201: { description: "Reminder created" } },
      },
    },
    "/api/notifications": {
      get: { tags: ["Notifications"], summary: "Get my notifications", responses: { 200: { description: "Notifications list" } } },
    },
    "/api/notifications/read-all": {
      patch: { tags: ["Notifications"], summary: "Mark all notifications as read", responses: { 200: { description: "All marked read" } } },
    },
    "/api/analytics/leaderboard": {
      get: { tags: ["Analytics"], summary: "Get sales leaderboard", responses: { 200: { description: "Leaderboard" } } },
    },
    "/api/audit-logs": {
      get: {
        tags: ["Audit Logs"],
        summary: "Get audit logs",
        parameters: [
          { name: "page", in: "query", schema: { type: "integer" } },
          { name: "limit", in: "query", schema: { type: "integer" } },
        ],
        responses: { 200: { description: "Audit logs" } },
      },
    },
    "/api/search": {
      get: {
        tags: ["Search"],
        summary: "Global search",
        parameters: [{ name: "q", in: "query", required: true, schema: { type: "string" } }],
        responses: { 200: { description: "Search results" } },
      },
    },
    "/api/upload": {
      post: {
        tags: ["Upload"],
        summary: "Upload a file",
        requestBody: {
          required: true,
          content: {
            "multipart/form-data": {
              schema: { type: "object", properties: { file: { type: "string", format: "binary" } } },
            },
          },
        },
        responses: {
          200: { description: "File uploaded", content: { "application/json": { schema: { type: "object", properties: { url: { type: "string" } } } } } },
        },
      },
    },
    "/api/webhooks": {
      get: { tags: ["Webhooks"], summary: "Get configured webhooks", responses: { 200: { description: "Webhooks list" } } },
    },
  },
};

module.exports = redoc;
