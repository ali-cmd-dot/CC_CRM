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

interface ActiveEmployee {
  employee_id: string
  sign_in_time?: string
  is_late: boolean
  late_by_minutes: number
  users?: {
    full_name: string
    user_id: string
  }
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
      tasks(title, priority, status),
      clients(name, total_vehicles),
      users!distribution_schedule_assigned_to_fkey(full_name, user_id)
    `)
    .order('hour_start', { ascending: true })
  
  return { data, error }
}

// ============================================
// 3. GET CURRENT HOUR ASSIGNMENTS FOR EMPLOYEE
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
    .select('employee_id, sign_in_time, is_late, late_by_minutes, users(full_name, user_id)')
    .eq('date', today)
    .eq('is_signed_in', true)
  
  return { data: data as ActiveEmployee[] | null, error }
}

// ============================================
// 5. REDISTRIBUTE ON ABSENCE/LATE (EQUAL DISTRIBUTION)
// ============================================
export const redistributeOnAbsence = async (absentEmployeeId: string) => {
  const currentHour = new Date().getHours()
  
  console.log(`🔄 Redistributing for absent employee: ${absentEmployeeId} at hour ${currentHour}`)
  
  // Get tasks/clients that were assigned to absent employee for current hour
  const { data: absentAssignments } = await supabase
    .from('distribution_schedule')
    .select('*')
    .eq('assigned_to', absentEmployeeId)
    .lte('hour_start', currentHour)
    .gte('hour_end', currentHour)
  
  if (!absentAssignments || absentAssignments.length === 0) {
    console.log('✅ No assignments to redistribute')
    return { success: true, message: 'No assignments to redistribute' }
  }
  
  // Get active employees (who have signed in)
  const { data: activeEmployees } = await getActiveEmployeesNow()
  
  if (!activeEmployees || activeEmployees.length === 0) {
    console.log('❌ No active employees to redistribute to')
    return { success: false, message: 'No active employees to redistribute to' }
  }
  
  console.log(`📊 Active employees count: ${activeEmployees.length}`)
  
  // Mark all current assignments from absent employee as inactive
  await supabase
    .from('task_assignments_realtime')
    .update({ is_active: false })
    .eq('employee_id', absentEmployeeId)
    .eq('is_active', true)
  
  await supabase
    .from('client_assignments_realtime')
    .update({ is_active: false })
    .eq('employee_id', absentEmployeeId)
    .eq('is_active', true)
  
  // Distribute equally
  const taskIds = absentAssignments.filter(a => a.task_id).map(a => a.task_id)
  const clientIds = absentAssignments.filter(a => a.client_id).map(a => a.client_id)
  
  let empIndex = 0
  
  // Redistribute tasks equally
  for (const taskId of taskIds) {
    const targetEmployee = activeEmployees[empIndex % activeEmployees.length]
    
    console.log(`📝 Assigning task ${taskId} to ${targetEmployee.users?.full_name || 'Employee'}`)
    
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
    
    // Update main tasks table
    await supabase
      .from('tasks')
      .update({ assigned_to: targetEmployee.employee_id })
      .eq('id', taskId)
    
    empIndex++
  }
  
  // Redistribute clients equally
  empIndex = 0
  for (const clientId of clientIds) {
    const targetEmployee = activeEmployees[empIndex % activeEmployees.length]
    
    console.log(`🏢 Assigning client ${clientId} to ${targetEmployee.users?.full_name || 'Employee'}`)
    
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
  
  console.log(`✅ Redistributed ${taskIds.length} tasks and ${clientIds.length} clients to ${activeEmployees.length} employees`)
  
  return { 
    success: true, 
    message: `Redistributed ${taskIds.length} tasks and ${clientIds.length} clients`,
    redistributedTo: activeEmployees.length
  }
}

// ============================================
// 6. RESTORE ON LATE SIGN-IN (Give back original assignments)
// ============================================
export const restoreOnLateSignIn = async (employeeId: string) => {
  const today = new Date().toISOString().split('T')[0]
  const currentHour = new Date().getHours()
  
  console.log(`🔙 Restoring assignments for late employee: ${employeeId} at hour ${currentHour}`)
  
  // Deactivate all temporary assignments that were reassigned from this employee
  await supabase
    .from('task_assignments_realtime')
    .update({ is_active: false })
    .eq('reassigned_from', employeeId)
    .eq('is_temporary', true)
    .eq('is_active', true)
  
  await supabase
    .from('client_assignments_realtime')
    .update({ is_active: false })
    .eq('reassigned_from', employeeId)
    .eq('is_temporary', true)
    .eq('is_active', true)
  
  // Get original assignments for current hour from schedule
  const { data: originalSchedule } = await supabase
    .from('distribution_schedule')
    .select('*')
    .eq('assigned_to', employeeId)
    .lte('hour_start', currentHour)
    .gte('hour_end', currentHour)
  
  if (!originalSchedule || originalSchedule.length === 0) {
    console.log('✅ No original schedule to restore')
    return { success: true, message: 'No original schedule to restore' }
  }
  
  // Restore tasks to original employee
  for (const schedule of originalSchedule.filter(s => s.task_id)) {
    console.log(`📝 Restoring task ${schedule.task_id} to original employee`)
    
    await supabase
      .from('task_assignments_realtime')
      .insert({
        task_id: schedule.task_id,
        employee_id: employeeId,
        hour_slot: currentHour,
        is_active: true,
        is_temporary: false
      })
    
    // Update main tasks table
    await supabase
      .from('tasks')
      .update({ assigned_to: employeeId })
      .eq('id', schedule.task_id)
  }
  
  // Restore clients to original employee
  for (const schedule of originalSchedule.filter(s => s.client_id)) {
    console.log(`🏢 Restoring client ${schedule.client_id} to original employee`)
    
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
  
  const taskCount = originalSchedule.filter(s => s.task_id).length
  const clientCount = originalSchedule.filter(s => s.client_id).length
  
  console.log(`✅ Restored ${taskCount} tasks and ${clientCount} clients to original employee`)
  
  return { 
    success: true, 
    message: `Restored ${taskCount} tasks and ${clientCount} clients`
  }
}

// ============================================
// 7. CHECK EVERY HOUR & REDISTRIBUTE
// ============================================
export const checkAndRedistributeHourly = async () => {
  const currentHour = new Date().getHours()
  const today = new Date().toISOString().split('T')[0]
  
  console.log(`⏰ Running hourly check for hour ${currentHour}`)
  
  // Get all scheduled assignments for current hour
  const { data: schedules } = await supabase
    .from('distribution_schedule')
    .select('*, users(full_name)')
    .lte('hour_start', currentHour)
    .gte('hour_end', currentHour)
  
  if (!schedules || schedules.length === 0) {
    console.log('📭 No schedules for current hour')
    return
  }
  
  console.log(`📋 Found ${schedules.length} schedules for hour ${currentHour}`)
  
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
      console.log(`⚠️ Employee ${(schedule.users as any)?.full_name} not signed in - redistributing`)
      await redistributeOnAbsence(schedule.assigned_to)
    } else {
      console.log(`✅ Employee ${(schedule.users as any)?.full_name} is signed in`)
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
      sign_in_time,
      users(full_name, user_id)
    `)
    .eq('date', today)
  
  const summary = []
  
  for (const emp of activeEmployees || []) {
    // Get active task assignments
    const { data: tasks } = await supabase
      .from('task_assignments_realtime')
      .select('*, tasks(title, priority, status)')
      .eq('employee_id', emp.employee_id)
      .eq('is_active', true)
    
    // Get active client assignments
    const { data: clients } = await supabase
      .from('client_assignments_realtime')
      .select('*, clients(name, total_vehicles)')
      .eq('employee_id', emp.employee_id)
      .eq('is_active', true)
    
    // Get scheduled assignments for current hour
    const { data: scheduled } = await supabase
      .from('distribution_schedule')
      .select('*')
      .eq('assigned_to', emp.employee_id)
      .lte('hour_start', currentHour)
      .gte('hour_end', currentHour)
    
    const empUsers = emp.users as { full_name: string; user_id: string }
    
    summary.push({
      employeeId: emp.employee_id,
      employeeName: empUsers?.full_name || 'Unknown',
      userId: empUsers?.user_id,
      isSignedIn: emp.is_signed_in,
      isLate: emp.is_late,
      signInTime: emp.sign_in_time,
      tasksCount: tasks?.length || 0,
      clientsCount: clients?.length || 0,
      scheduledCount: scheduled?.length || 0,
      taskDetails: tasks || [],
      clientDetails: clients || [],
      scheduledDetails: scheduled || []
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

// ============================================
// 10. UPDATE SCHEDULE
// ============================================
export const updateSchedule = async (scheduleId: string, updates: Partial<DistributionSchedule>) => {
  const { data, error } = await supabase
    .from('distribution_schedule')
    .update(updates)
    .eq('id', scheduleId)
    .select()
    .single()
  
  return { data, error }
}

// ============================================
// 11. GET EMPLOYEE'S SCHEDULE FOR TODAY
// ============================================
export const getEmployeeScheduleToday = async (employeeId: string) => {
  const { data, error } = await supabase
    .from('distribution_schedule')
    .select(`
      *,
      tasks(title, description, priority, status),
      clients(name, company_name, total_vehicles)
    `)
    .eq('assigned_to', employeeId)
    .order('hour_start', { ascending: true })
  
  return { data, error }
}

// ============================================
// 12. MANUALLY TRIGGER REDISTRIBUTION (For testing)
// ============================================
export const manualRedistribute = async () => {
  console.log('🔧 Manual redistribution triggered')
  await checkAndRedistributeHourly()
  return { success: true, message: 'Manual redistribution completed' }
}
