/* ຊະນິດຂໍ້ມູນທີ່ backend ສົ່ງກັບມາ (ຕາມ schema.sql ແລະ controllers) */

export type Role = "admin" | "staff" | "student";
export type RoomStatus = "available" | "occupied" | "maintenance";
export type BookingStatus = "pending" | "active" | "checked_out" | "cancelled";
export type PaymentStatus = "pending" | "paid" | "failed" | "refunded";
export type PaymentMethod = "cash" | "bank_transfer" | "card" | "mobile_banking";
export type PaymentType = "rent" | "deposit" | "utility" | "other";
export type MaintenanceStatus = "pending" | "in_progress" | "resolved" | "cancelled";
export type Priority = "low" | "medium" | "high" | "urgent";
export type NotificationType = "info" | "warning" | "urgent" | "payment" | "maintenance";
export type VisitorStatus = "checked_in" | "checked_out";
export type StudentStatus = "active" | "inactive";

export interface Paged<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface Me {
  id: number;
  name: string;
  email: string;
  role: Role;
  is_active: number | boolean;
  created_at: string;
  student_id: number | null;
  avatar_url: string | null;
  phone: string | null;
  room_id: number | null;
  room_number: string | null;
  building_name: string | null;
}

export interface User {
  id: number;
  name: string;
  email: string;
  role: Role;
  is_active: number | boolean;
  created_at: string;
  updated_at?: string;
  student_id: number | null;
}

export interface Building {
  id: number;
  name: string;
  address: string | null;
  total_floors: number | null;
  created_at: string;
}

export interface Room {
  id: number;
  room_number: string;
  building_id: number;
  building_name: string | null;
  capacity: number;
  price: string | number;
  status: RoomStatus;
  occupants: number;
  vacancy: number;
  isFull: boolean;
  isAvailable: boolean;
  label: string;
  statusText: string;
}

export interface RoomList extends Paged<Room> {
  summary?: { totalBeds: number; totalOccupants: number; totalVacancy: number; fullRooms: number };
}

export interface Occupants {
  data: Pick<Student, "id" | "name" | "email" | "phone" | "avatar_url" | "status">[];
  total: number;
  capacity: number;
  occupants: number;
  vacancy: number;
  isFull: boolean;
  label: string;
  statusText: string;
}

export interface Student {
  id: number;
  user_id: number | null;
  name: string;
  email: string;
  phone: string | null;
  avatar_url: string | null;
  room_id: number | null;
  status: StudentStatus;
  room_number?: string | null;
  building_name?: string | null;
  created_at: string;
}

export interface Booking {
  id: number;
  student_id: number;
  room_id: number;
  check_in_date: string;
  check_out_date: string | null;
  status: BookingStatus;
  created_at: string;
  student_name?: string | null;
  room_number?: string | null;
  building_name?: string | null;
}

export interface Payment {
  id: number;
  student_id: number;
  amount: string | number;
  method: PaymentMethod;
  status: PaymentStatus;
  type: PaymentType;
  description: string | null;
  billing_month: string | null;
  due_date: string | null;
  invoice_no: string | null;
  receipt_no: string | null;
  paid_at: string | null;
  payment_date: string;
  created_at: string;
  student_name?: string | null;
  room_number?: string | null;
  building_name?: string | null;
  is_overdue?: number | boolean;
}

export interface PaymentTotals {
  totalPaid: number;
  totalPending: number;
  totalOverdue: number;
}

export interface PaymentDocument {
  kind: "invoice" | "receipt";
  documentNo: string | null;
  invoiceNo: string | null;
  receiptNo: string | null;
  status: PaymentStatus;
  isOverdue: boolean;
  student: { id: number; name: string; email: string; phone: string | null } | null;
  room: { roomNumber: string; buildingName: string | null } | null;
  item: { type: PaymentType; typeLabel: string; description: string | null; billingMonth: string | null };
  amount: number;
  currency: string;
  method: PaymentMethod;
  dueDate: string | null;
  issuedAt: string;
  paidAt: string | null;
}

export interface GenerateResult {
  message: string;
  dryRun: boolean;
  month: string;
  dueDate: string;
  created: number;
  skipped: number;
  totalAmount: number;
  data: { studentId: number; studentName: string; roomNumber: string; amount: number }[];
}

export interface Maintenance {
  id: number;
  room_id: number;
  reported_by: number | null;
  issue: string;
  priority: Priority;
  status: MaintenanceStatus;
  created_at: string;
  updated_at: string;
  room_number?: string | null;
  reporter_name?: string | null;
}

export interface Visitor {
  id: number;
  visitor_name: string;
  id_card_number: string | null;
  phone: string | null;
  purpose: string | null;
  student_id: number | null;
  room_id: number | null;
  check_in_time: string;
  check_out_time: string | null;
  status: VisitorStatus;
  student_name?: string | null;
  room_number?: string | null;
}

export interface AppNotification {
  id: number;
  title: string;
  message: string;
  type: NotificationType;
  student_id: number | null;
  is_read: number | boolean;
  created_at: string;
}

export interface NotificationList extends Paged<AppNotification> {
  unread?: number;
}

export interface Image {
  id: number;
  entity_type: "room" | "building" | "student";
  entity_id: number;
  image_url: string;
  is_cover: number | boolean;
  created_at: string;
}

export interface Dashboard {
  students: { active: number; unlinked: number };
  rooms: { total: number; beds: number; occupants: number; availableBeds: number; maintenance: number; occupancyRate: number };
  bookings: { pending: number; active: number };
  payments: { pendingCount: number; pendingAmount: number; overdueCount: number; overdueAmount: number; revenueThisMonth: number };
  maintenance: { open: number; openUrgent: number };
  visitors: { inside: number };
}

export interface OccupancyReport {
  totalRooms: number;
  totalBeds: number;
  maintenanceRooms: number;
  totalBookings: number;
  activeBookings: number;
  totalOccupants: number;
  occupiedRooms: number;
  fullRooms: number;
  availableBeds: number;
  occupancyRate: number;
  bookingsByStatus: Record<string, number>;
  byBuilding: { buildingId: number; buildingName: string; rooms: number; beds: number; occupants: number; occupancyRate: number }[];
}

export interface RevenueReport {
  range: { from: string | null; to: string | null };
  totalRevenue: number;
  totalPaidTransactions: number;
  outstandingAmount: number;
  outstandingCount: number;
  revenueByMethod: Record<string, number>;
  transactionCountByStatus: Record<string, number>;
  monthlyRevenue: { month: string; total: number }[];
}

export interface MaintenanceSummary {
  totalRequests: number;
  openCount: number;
  openUrgentCount: number;
  avgResolutionHours: number | null;
  byStatus: Record<string, number>;
  byPriority: Record<string, number>;
  topRooms: { roomId: number; roomNumber: string; count: number }[];
}

export interface AuditLog {
  id: number;
  admin_id: number | null;
  admin_email: string | null;
  role: string | null;
  method: string;
  path: string;
  status_code: number | null;
  ip_address: string | null;
  created_at: string;
}
