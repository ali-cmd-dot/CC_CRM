import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Database Types
export interface User {
  id: string
  user_id: string
  password_hash: string
  full_name: string
  email: string
  phone?: string
  role: 'admin' | 'employee'
  shift_start?: string
  shift_end?: string
  created_at?: string
  updated_at?: string
  is_active?: boolean
}

export interface Client {
  id: string
  client_id: string
  name: string
  company_name?: string
  email?: string
  phone?: string
  address?: string
  contact_person?: string
  since?: string
  total_vehicles: number
  completion_percentage: number
  status: 'active' | 'inactive' | 'progress'
  created_by?: string
  created_at?: string
  updated_at?: string
}

export interface Vehicle {
  id: string
  vehicle_id: string
  client_id: string
  vehicle_number: string
  vehicle_type?: string
  driver_name?: string
  driver_phone?: string
  status: 'online' | 'offline' | 'maintenance' | 'idle'
  alerts_active: boolean
  video_recording: boolean
  offline_reason?: 'vehicle_not_running' | 'dashcam_issue' | null
  last_online_at?: string
  created_at?: string
  updated_at?: string
}

export interface Task {
  id: string
  task_id: string
  title: string
  description?: string
  assigned_to?: string
  assigned_by?: string
  client_id?: string
  priority: 'low' | 'medium' | 'high' | 'urgent'
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled'
  due_date?: string
  completion_percentage: number
  created_at?: string
  updated_at?: string
  completed_at?: string
}

export interface LeaveRequest {
  id: string
  employee_id: string
  employee_name?: string
  leave_type: 'sick' | 'casual' | 'earned' | 'emergency' | 'unpaid'
  from_date: string
  to_date: string
  total_days: number
  reason: string
  status: 'pending' | 'approved' | 'rejected'
  approved_by?: string
  approved_at?: string
  rejection_reason?: string
  created_at?: string
}

export interface Attendance {
  id: string
  employee_id: string
  date: string
  sign_in_time?: string
  sign_out_time?: string
  scheduled_time?: string
  late_by_minutes: number
  status: 'present' | 'absent' | 'late' | 'half_day' | 'on_leave'
  notes?: string
  created_at?: string
}

export interface Roster {
  id: string
  employee_id: string
  date: string
  is_working_day: boolean
  shift_start?: string
  shift_end?: string
  notes?: string
  created_at?: string
}

export interface SignInStatus {
  id: string
  employee_id: string
  date: string
  is_signed_in: boolean
  sign_in_time?: string
  sign_out_time?: string
  expected_sign_in?: string
  is_late: boolean
  late_by_minutes: number
  updated_at?: string
}

// Helper Functions
export const authHelpers = {
  async signIn(user_id: string, password: string) {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('user_id', user_id)
        .single()

      if (error || !data) {
        return { user: null, error: 'Invalid credentials' }
      }

      // Check if password matches database password
      if (data.password_hash === password) {
        return { user: data, error: null }
      }

      return { user: null, error: 'Invalid credentials' }
    } catch (error) {
      return { user: null, error: 'Login failed' }
    }
  },

  async getCurrentUser() {
    return null
  }
}

export const clientHelpers = {
  async getAll() {
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .order('created_at', { ascending: false })
    return { data, error }
  },

  async create(client: Partial<Client>) {
    const { data, error } = await supabase
      .from('clients')
      .insert(client)
      .select()
      .single()
    return { data, error }
  },

  async update(id: string, updates: Partial<Client>) {
    const { data, error } = await supabase
      .from('clients')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    return { data, error }
  },

  async delete(id: string) {
    const { error } = await supabase
      .from('clients')
      .delete()
      .eq('id', id)
    return { error }
  }
}

export const vehicleHelpers = {
  async getByClient(clientId: string) {
    const { data, error } = await supabase
      .from('vehicles')
      .select('*')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
    return { data, error }
  },

  async create(vehicle: Partial<Vehicle>) {
    const { data, error } = await supabase
      .from('vehicles')
      .insert(vehicle)
      .select()
      .single()
    return { data, error }
  },

  async update(id: string, updates: Partial<Vehicle>) {
    const { data, error } = await supabase
      .from('vehicles')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    return { data, error }
  }
}

export const employeeHelpers = {
  async getAll() {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('role', 'employee')
      .order('created_at', { ascending: false })
    return { data, error }
  },

  async create(employee: Partial<User>) {
    const { data, error } = await supabase
      .from('users')
      .insert({ ...employee, role: 'employee' })
      .select()
      .single()
    return { data, error }
  }
}

export const taskHelpers = {
  async getAll() {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .order('created_at', { ascending: false })
    return { data, error }
  },

  async getByEmployee(employeeId: string) {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('assigned_to', employeeId)
      .order('created_at', { ascending: false })
    return { data, error }
  },

  async create(task: Partial<Task>) {
    const { data, error } = await supabase
      .from('tasks')
      .insert(task)
      .select()
      .single()
    return { data, error }
  }
}

export const leaveHelpers = {
  async getPending() {
    const { data, error } = await supabase
      .from('leave_requests')
      .select('*, users!leave_requests_employee_id_fkey(full_name)')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
    return { data, error }
  },

  async create(leave: Partial<LeaveRequest>) {
    const { data, error } = await supabase
      .from('leave_requests')
      .insert(leave)
      .select()
      .single()
    return { data, error }
  },

  async approve(id: string, approvedBy: string) {
    const { data, error } = await supabase
      .from('leave_requests')
      .update({
        status: 'approved',
        approved_by: approvedBy,
        approved_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single()
    return { data, error }
  },

  async reject(id: string, approvedBy: string, reason?: string) {
    const { data, error } = await supabase
      .from('leave_requests')
      .update({
        status: 'rejected',
        approved_by: approvedBy,
        approved_at: new Date().toISOString(),
        rejection_reason: reason
      })
      .eq('id', id)
      .select()
      .single()
    return { data, error }
  }
}

export const attendanceHelpers = {
  async signIn(employeeId: string, scheduledTime: string) {
    const now = new Date()
    const today = now.toISOString().split('T')[0]
    
    // Parse scheduled time properly (format: "09:00" or "09:00:00")
    const [schedHours, schedMinutes] = scheduledTime.split(':').map(Number)
    const scheduled = new Date(now)
    scheduled.setHours(schedHours, schedMinutes, 0, 0)
    
    // Calculate late minutes - only if current time is after scheduled time
    const timeDiffMs = now.getTime() - scheduled.getTime()
    const lateMinutes = timeDiffMs > 0 ? Math.floor(timeDiffMs / 60000) : 0
    
    console.log('Sign In Calculation:', {
      now: now.toLocaleString(),
      scheduled: scheduled.toLocaleString(),
      timeDiffMs,
      lateMinutes,
      scheduledTime
    })
    
    const { data, error } = await supabase
      .from('attendance')
      .insert({
        employee_id: employeeId,
        date: today,
        sign_in_time: now.toISOString(),
        scheduled_time: scheduledTime,
        late_by_minutes: lateMinutes,
        status: lateMinutes > 0 ? 'late' : 'present'
      })
      .select()
      .single()
    
    // Update sign-in status for distribution
    await supabase
      .from('employee_signin_status')
      .upsert({
        employee_id: employeeId,
        date: today,
        is_signed_in: true,
        sign_in_time: now.toISOString(),
        expected_sign_in: scheduledTime,
        is_late: lateMinutes > 0,
        late_by_minutes: lateMinutes,
        updated_at: now.toISOString()
      })
    
    // Trigger redistribution
    try {
      await supabase.rpc('distribute_tasks_by_hour')
      await supabase.rpc('distribute_clients_by_hour')
    } catch (rpcError) {
      console.log('RPC functions not available:', rpcError)
    }
    
    return { data, error, lateMinutes }
  },

  async signOut(employeeId: string) {
    const today = new Date().toISOString().split('T')[0]
    const now = new Date()
    
    const { data, error } = await supabase
      .from('attendance')
      .update({
        sign_out_time: now.toISOString()
      })
      .eq('employee_id', employeeId)
      .eq('date', today)
      .select()
      .single()
    
    // Update sign-in status
    await supabase
      .from('employee_signin_status')
      .update({
        is_signed_in: false,
        sign_out_time: now.toISOString(),
        updated_at: now.toISOString()
      })
      .eq('employee_id', employeeId)
      .eq('date', today)
    
    // Trigger redistribution
    try {
      await supabase.rpc('distribute_tasks_by_hour')
      await supabase.rpc('distribute_clients_by_hour')
    } catch (rpcError) {
      console.log('RPC functions not available:', rpcError)
    }
    
    return { data, error }
  },

  async getTodayAttendance() {
    const today = new Date().toISOString().split('T')[0]
    const { data, error } = await supabase
      .from('attendance')
      .select('*, users!attendance_employee_id_fkey(full_name, user_id)')
      .eq('date', today)
      .order('sign_in_time', { ascending: false })
    return { data, error }
  }
}

export const distributionHelpers = {
  async getSignInStatus(employeeId: string) {
    const today = new Date().toISOString().split('T')[0]
    const { data, error } = await supabase
      .from('employee_signin_status')
      .select('*')
      .eq('employee_id', employeeId)
      .eq('date', today)
      .single()
    return { data, error }
  },

  async getActiveEmployees() {
    const today = new Date().toISOString().split('T')[0]
    const { data, error } = await supabase
      .from('employee_signin_status')
      .select('employee_id, is_signed_in, sign_in_time, users!employee_signin_status_employee_id_fkey(full_name)')
      .eq('date', today)
      .eq('is_signed_in', true)
    return { data, error }
  },

  async getMyAssignments(employeeId: string) {
    const { data: taskAssignments } = await supabase
      .from('task_assignments_realtime')
      .select('*, tasks(*)')
      .eq('employee_id', employeeId)
      .eq('is_active', true)
    
    const { data: clientAssignments } = await supabase
      .from('client_assignments_realtime')
      .select('*, clients(*)')
      .eq('employee_id', employeeId)
      .eq('is_active', true)
    
    return { 
      tasks: taskAssignments || [], 
      clients: clientAssignments || [] 
    }
  },

  async getEmployeeTaskLoad() {
    const { data, error } = await supabase
      .from('employee_task_load')
      .select('*')
    return { data, error }
  }
}

export const storageHelpers = {
  async uploadFile(bucket: string, path: string, file: File) {
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(path, file, {
        cacheControl: '3600',
        upsert: false
      })
    return { data, error }
  },

  async getPublicUrl(bucket: string, path: string) {
    const { data } = supabase.storage
      .from(bucket)
      .getPublicUrl(path)
    return data.publicUrl
  }
}
