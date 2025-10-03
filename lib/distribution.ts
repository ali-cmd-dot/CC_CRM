import { supabase } from './supabase'

export interface HourSlot {
  id?: string
  hour: number
  employee_id: string
  task_ids: string[]
  client_ids: string[]
  is_active: boolean
  created_at?: string
}

export interface DistributionSchedule {
  id?: string
  hour_start: number
  hour_end: number
  task_id?: string
  client_id?: string
  assigned_to: string
  created_by: string
  is_recurring: boolean
  created_at?: string
}

// ============================================
// 1. CREATE HOUR-BASED SCHEDULE (Manual by Admin)
// ============================================
export const createHourSchedule = async (schedule: {
  hour_start: number
  hour_end: number
  task_id?: string
  client_id?: string
  assigned_to: string
  created_by: string
  is_recurring: boolean
}) => {
  const { data, error } = await supabase
    .from('distribution_schedule')
    .insert(schedule)
    .select()
    .single()
  
  return { data, error }
}

// ============================================
// 2. GET ALL SCHEDULES
// ============================================
export const getAllSchedules = async () => {
  const { data, error } = await supabase
    .from('distribution_schedule')
    .select(`
      *,
      tasks(title),
      clients(name),
      users!distribution_schedule_assigned_to_fkey(full_name)
    `)
    .order('hour_start', { ascending: true })
  
  return { data, error }
}

// ============================================
// 3. GET CURRENT HOUR ASSIGNMENTS
// ============================================
export const getCurrentHourAssignments = async (employeeId: string) => {
  const currentHour = new Date().getHours()
  
  const { data, error } = await supabase
    .from('distribution_schedule')
    .select(`
      *,
      tasks(*),
      clients(*)
    `)
    .eq('assigned_to', employeeId)
    .lte('hour_start', currentHour)
    .gte('hour_end', currentHour)
    .eq('is_recurring', true)
  
  return { data, error }
}

// ============================================
// 4. GET SIGNED-IN EMPLOYEES RIGHT NOW
// ============================================
export const getActiveEmployeesNow = async () => {
  const today = new Date().toISOString().split('T')[0]
  
  const { data, error } = await supabase
    .from('employee_signin_status')
    .select('employee_id, sign_in_time, is_late, late_by_minutes, users(full_name)')
    .eq('date', today)
    .eq('is_signed_in', true)
  
  return { data, error }
}

// ============================================
// 5. REDISTRIBUTE ON ABSENCE/LATE
// ============================================
export const redistributeOnAbsence = async (absentEmployeeId: string) => {
  const currentHour = new Date().getHours()
  
  // Get tasks/clients that were assigned to absent employee
  const { data: absentAssignments } = await supabase
    .from('distribution_schedule')
    .select('*')
    .eq('assigned_to', absentEmployeeId)
    .lte('hour_start', currentHour)
    .gte('hour_end', currentHour)
  
  if (!absentAssignments || absentAssignments.length === 0) {
    return { success: true, message: 'No assignments to redistribute' }
  }
  
  // Get active employees
  const { data: activeEmployees } = await getActiveEmployeesNow()
  
  if (!activeEmployees || activeEmployees.length === 0) {
    return { success: false, message: 'No active employees to redistribute to' }
  }
  
  // Distribute equally
  const taskIds = absentAssignments.filter(a => a.task_id).map(a => a.task_id)
  const clientIds = absentAssignments.filter(a => a.client_id).map(a => a.client_id)
  
  let empIndex = 0
  
  // Redistribute tasks
  for (const taskId of taskIds) {
    const targetEmployee = activeEmployees[empIndex % activeEmployees.length]
    
    // Create temporary assignment
    await supabase
      .from('task_assignments_realtime')
      .insert({
        task_id: taskId,
        employee_id: targetEmployee.employee_id,
        hour_slot: currentHour,
        is_active: true,
        reassigned_from: absentEmployeeId,
        is_temporary: true
      })
    
    empIndex++
  }
  
  // Redistribute clients
  empIndex = 0
  for (const clientId of clientIds) {
    const targetEmployee = activeEmployees[empIndex % activeEmployees.length]
    
    await supabase
      .from('client_assignments_realtime')
      .insert({
        client_id: clientId,
        employee_id: targetEmployee.employee_id,
        hour_slot: currentHour,
        is_active: true,
        reassigned_from: absentEmployeeId,
        is_temporary: true
      })
    
    empIndex++
  }
  
  return { 
    success: true, 
    message: `Redistributed ${taskIds.length} tasks and ${clientIds.length} clients`,
    redistributedTo: activeEmployees.length
  }
}

// ============================================
// 6. RESTORE ON LATE SIGN-IN
// ============================================
export const restoreOnLateSignIn = async (employeeId: string) => {
  const today = new Date().toISOString().split('T')[0]
  
  // Mark all temporary assignments as inactive
  await supabase
    .from('task_assignments_realtime')
    .update({ is_active: false })
    .eq('reassigned_from', employeeId)
    .eq('is_temporary', true)
  
  await supabase
    .from('client_assignments_realtime')
    .update({ is_active: false })
    .eq('reassigned_from', employeeId)
    .eq('is_temporary', true)
  
  // Get original assignments for current hour
  const currentHour = new Date().getHours()
  const { data: originalSchedule } = await supabase
    .from('distribution_schedule')
    .select('*')
    .eq('assigned_to', employeeId)
    .lte('hour_start', currentHour)
    .gte('hour_end', currentHour)
  
  if (!originalSchedule) return { success: false }
  
  // Restore tasks
  for (const schedule of originalSchedule.filter(s => s.task_id)) {
    await supabase
      .from('task_assignments_realtime')
      .insert({
        task_id: schedule.task_id,
        employee_id: employeeId,
        hour_slot: currentHour,
        is_active: true,
        is_temporary: false
      })
  }
  
  // Restore clients
  for (const schedule of originalSchedule.filter(s => s.client_id)) {
    await supabase
      .from('client_assignments_realtime')
      .insert({
        client_id: schedule.client_id,
        employee_id: employeeId,
        hour_slot: currentHour,
        is_active: true,
        is_temporary: false
      })
  }
  
  return { 
    success: true, 
    message: `Restored assignments for ${originalSchedule.length} items`
  }
}

// ============================================
// 7. CHECK EVERY HOUR & REDISTRIBUTE
// ============================================
export const checkAndRedistributeHourly = async () => {
  const currentHour = new Date().getHours()
  const today = new Date().toISOString().split('T')[0]
  
  // Get all scheduled assignments for current hour
  const { data: schedules } = await supabase
    .from('distribution_schedule')
    .select('*')
    .lte('hour_start', currentHour)
    .gte('hour_end', currentHour)
  
  if (!schedules) return
  
  // Check each employee's sign-in status
  for (const schedule of schedules) {
    const { data: signInStatus } = await supabase
      .from('employee_signin_status')
      .select('*')
      .eq('employee_id', schedule.assigned_to)
      .eq('date', today)
      .single()
    
    // If not signed in, redistribute
    if (!signInStatus || !signInStatus.is_signed_in) {
      await redistributeOnAbsence(schedule.assigned_to)
    }
  }
}

// ============================================
// 8. GET DISTRIBUTION SUMMARY FOR ADMIN
// ============================================
export const getDistributionSummary = async () => {
  const currentHour = new Date().getHours()
  const today = new Date().toISOString().split('T')[0]
  
  const { data: activeEmployees } = await supabase
    .from('employee_signin_status')
    .select(`
      employee_id,
      is_signed_in,
      is_late,
      users(full_name)
    `)
    .eq('date', today)
  
  const summary = []
  
  for (const emp of activeEmployees || []) {
    const { data: tasks } = await supabase
      .from('task_assignments_realtime')
      .select('*, tasks(title)')
      .eq('employee_id', emp.employee_id)
      .eq('is_active', true)
    
    const { data: clients } = await supabase
      .from('client_assignments_realtime')
      .select('*, clients(name)')
      .eq('employee_id', emp.employee_id)
      .eq('is_active', true)
    
    summary.push({
      employee: emp.users?.full_name,
      isSignedIn: emp.is_signed_in,
      isLate: emp.is_late,
      tasks: tasks?.length || 0,
      clients: clients?.length || 0,
      taskDetails: tasks,
      clientDetails: clients
    })
  }
  
  return summary
}

// ============================================
// 9. DELETE SCHEDULE
// ============================================
export const deleteSchedule = async (scheduleId: string) => {
  const { error } = await supabase
    .from('distribution_schedule')
    .delete()
    .eq('id', scheduleId)
  
  return { error }
}
