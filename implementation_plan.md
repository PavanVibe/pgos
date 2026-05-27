# PGOS: Resident Onboarding Workflow Implementation

The goal of this phase is to build the "operational heart" of PGOS: a lightning-fast, mobile-optimized Resident Onboarding Workflow.

## User Review Required

> [!IMPORTANT]
> Please review the structural plan below for the Resident Onboarding system. If the steps, backend transaction logic, and UX flow align with your vision for Indian PG operators, approve this plan so I can begin generating the code.

## 1. Backend: Atomic Onboarding API (Step 8)
We will build `POST /api/tenants/onboard`.
This endpoint will execute a massive, safe `prisma.$transaction`:
1. **Validate**: Check if the `Bed` is vacant and `isActive`.
2. **GlobalTenant**: Upsert based on Phone Number (to prevent duplicates).
3. **PGTenantProfile**: Create active profile linked to the PG and Bed.
4. **RentInvoice**: Automatically generate the first month's rent invoice (+ security deposit).
5. **AuditLog**: Log the action.
6. **EventBus**: Emit `TENANT_MOVED_IN` and `BED_ALLOCATED`.
*If any step fails, the entire database transaction rolls back, leaving zero orphaned data.*

## 2. Frontend: Zustand State Management
We will create a multi-step `Zustand` store (`useOnboardingStore`) to hold the transient state of the onboarding wizard without forcing premature database saves.
```typescript
interface OnboardingState {
  step: number;
  pgId: string | null;
  bedId: string | null;
  residentDetails: { name: string, phone: string, emergencyContact: string, moveInDate: Date } | null;
  kycDetails: { aadhaarUrl: string, photoUrl: string } | null;
  rentConfig: { monthlyRent: number, deposit: number, dueDate: Date } | null;
  // actions...
}
```

## 3. Frontend: Step Components (Steps 1-7)
We will generate a mobile-first wizard in `frontend/src/app/(dashboard)/onboarding/page.tsx`:
- **Step 1: Bed Selector Grid**: Visually maps Rooms -> Beds. Green (Vacant), Red (Occupied). Designed with large tap targets.
- **Step 2: Resident Details**: A minimal `react-hook-form` capturing Name, Phone, and Move-in Date.
- **Step 3: KYC Uploader**: Connects to the Cloudinary signed URL service for fast uploads.
- **Step 4: Rent Config**: Auto-fills from the Bed's default rent.
- **Step 5: Review & Confirm**: One-click confirmation that triggers the backend transaction.

## 4. Quick Add Resident Mode (Step 11)
A secondary, ultra-fast mode inside `QuickActions.tsx` that bypasses KYC and Rent Config, requiring ONLY: Name, Phone, and Bed Selection. The backend will use defaults for the rest, allowing the PG Owner to complete the profile later.

## 5. Dashboard Integration & Optimistic Updates
Using React Query, upon successful onboarding, we will instantly invalidate the `dashboard-summary` and `occupancy-grid` cache keys, updating the UI metrics immediately without a hard page reload.

---

### Execution Steps
Upon your approval, I will:
1. Build the Backend `tenantController` and `onboard` API.
2. Setup the `Zustand` store and `react-query` hooks on the frontend.
3. Build the UI components (`BedSelectorGrid`, Stepper, Forms).
4. Wire the `QuickActions` to launch this workflow.
