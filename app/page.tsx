'use client'

import React, { useState, useEffect } from 'react'
import Image from 'next/image'
import { 
  Users, Truck, UserCheck, CheckCircle, AlertTriangle, Activity, Plus, Upload, 
  ClipboardCheck, Calendar, BarChart3, Bell, Search, Download, LogOut, Clock,
  FileText, TrendingUp, X, Check, Edit, Trash2, Eye, Settings, Home, Zap, 
  ChevronLeft, ChevronRight, Menu, Shield, ArrowRight, ChevronDown, RefreshCw
} from 'lucide-react'
import { 
  supabase, 
  authHelpers, 
  clientHelpers, 
  vehicleHelpers, 
  employeeHelpers, 
  taskHelpers, 
  leaveHelpers,
  attendanceHelpers,
  type User,
  type Client,
  type Vehicle,
  type Task,
  type LeaveRequest,
  type Attendance,
  type Roster
} from '@/lib/supabase'
import {
  createHourSchedule,
  getAllSchedules,
  getDistributionSummary,
  deleteSchedule,
  manualRedistribute,
  redistributeOnAbsence,
  restoreOnLateSignIn,
  type DistributionSchedule
} from '@/lib/distribution'

export default function CautioCRM() {
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [loginForm, setLoginForm] = useState({ user_id: '', password: '' })
  const [activeSection, setActiveSection] = useState('dashboard')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [isSignedIn, setIsSignedIn] = useState(false)
  const [signInTime, setSignInTime] = useState<string | null>(null)
  
  // Data states
  const [clients, setClients] = useState<Client[]>([])
  const [employees, setEmployees] = useState<User[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([])
  const [attendance, setAttendance] = useState<Attendance[]>([])
  const [roster, setRoster] = useState<Roster[]>([])
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const [selectedEmployee, setSelectedEmployee] = useState<User | null>(null)
  const [rosterMonth, setRosterMonth] = useState(new Date())
  
  // Distribution states
  const [schedules, setSchedules] = useState<any[]>([])
  const [distributionSummary, setDistributionSummary] = useState<any[]>([])
  const [redistributing, setRedistributing] = useState(false)
  
  // Modal states
  const [showModal, setShowModal] = useState<string | null>(null)
  const [modalData, setModalData] = useState<any>({})
  const [loading, setLoading] = useState(false)
  const [passwordVisible, setPasswordVisible] = useState(false)

  // Session Management
  useEffect(() => {
    const savedUser = localStorage.getItem('cautio_user')
    if (savedUser) {
      try {
        const user = JSON.parse(savedUser)
        setCurrentUser(user)
      } catch (error) {
        localStorage.removeItem('cautio_user')
      }
    }
  }, [])

  useEffect(() => {
    if (currentUser) {
      loadInitialData()
    }
  }, [currentUser])

  const loadInitialData = async () => {
    const { data: clientsData } = await clientHelpers.getAll()
    const { data: employeesData } = await employeeHelpers.getAll()
    const { data: tasksData } = await taskHelpers.getAll()
    const { data: leaveData } = await leaveHelpers.getPending()
    const { data: attendanceData } = await attendanceHelpers.getTodayAttendance()
    
    setClients(clientsData || [])
    setEmployees(employeesData || [])
    setTasks(tasksData || [])
    setLeaveRequests(leaveData || [])
    setAttendance(attendanceData || [])
    
    // Load distribution data for admin
    if (currentUser?.role === 'admin') {
      loadDistributionData()
    }
  }

  const loadDistributionData = async () => {
    const { data: schedulesData } = await getAllSchedules()
    const summaryData = await getDistributionSummary()
    
    setSchedules(schedulesData || [])
    setDistributionSummary(summaryData || [])
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    
    const { user, error } = await authHelpers.signIn(loginForm.user_id, loginForm.password)
    
    if (error || !user) {
      alert('Login failed: Invalid credentials')
      setLoading(false)
      return
    }
    
    localStorage.setItem('cautio_user', JSON.stringify(user))
    setCurrentUser(user)
    setLoading(false)
  }

  const handleLogout = () => {
    localStorage.removeItem('cautio_user')
    setCurrentUser(null)
    setActiveSection('dashboard')
    setLoginForm({ user_id: '', password: '' })
  }

  const handleSignIn = async () => {
    if (!currentUser?.shift_start) return
    
    setLoading(true)
    const { data, error, lateMinutes } = await attendanceHelpers.signIn(
      currentUser.id,
      currentUser.shift_start
    )
    
    if (error) {
      alert('Sign in failed: ' + error)
      setLoading(false)
      return
    }
    
    // If late, restore original assignments
    if (lateMinutes > 0) {
      await restoreOnLateSignIn(currentUser.id)
    }
    
    setIsSignedIn(true)
    setSignInTime(new Date().toLocaleTimeString())
    
    const time = new Date().toLocaleTimeString()
    alert(`✓ Signed in at ${time}${lateMinutes > 0 ? `\n⚠️ Late by ${lateMinutes} minutes\n✓ Your tasks & clients have been restored` : '\n✓ On Time'}`)
    loadInitialData()
    setLoading(false)
  }

  const handleSignOut = async () => {
    setLoading(true)
    const { error } = await attendanceHelpers.signOut(currentUser!.id)
    
    if (error) {
      alert('Sign out failed')
      setLoading(false)
      return
    }
    
    setIsSignedIn(false)
    setSignInTime(null)
    
    alert(`✓ Signed out at ${new Date().toLocaleTimeString()}`)
    setLoading(false)
  }

  const openModal = (type: string, data: any = {}) => {
    setShowModal(type)
    setModalData(data)
  }

  const closeModal = () => {
    setShowModal(null)
    setModalData({})
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, clientId: string) => {
    const file = e.target.files?.[0]
    if (!file) return

    setLoading(true)
    
    try {
      const filePath = `${clientId}/${Date.now()}_${file.name}`
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('client-files')
        .upload(filePath, file)

      if (uploadError) throw uploadError

      await supabase.from('client_files').insert({
        client_id: clientId,
        file_name: file.name,
        file_path: filePath,
        file_size: file.size,
        file_type: file.type,
        uploaded_by: currentUser?.id
      })

      alert('✓ File uploaded successfully!')
    } catch (error) {
      alert('✗ Upload failed')
    }
    
    setLoading(false)
  }

  const handleAddClient = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    
    const clientData = {
      client_id: 'CLI' + Date.now(),
      name: modalData.name,
      email: modalData.email,
      phone: modalData.phone,
      company_name: modalData.company_name || modalData.name,
      total_vehicles: 0,
      completion_percentage: 0,
      status: 'active' as const,
      created_by: currentUser?.id
    }
    
    const { error } = await clientHelpers.create(clientData)
    
    if (error) {
      alert('Failed to add client')
    } else {
      alert('✓ Client added successfully')
      closeModal()
      loadInitialData()
    }
    
    setLoading(false)
  }

  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    
    const employeeData = {
      user_id: modalData.user_id,
      password_hash: modalData.password,
      full_name: modalData.full_name,
      email: modalData.email,
      phone: modalData.phone,
      role: 'employee' as const,
      shift_start: modalData.shift_start,
      shift_end: modalData.shift_end
    }
    
    const { error } = await employeeHelpers.create(employeeData)
    
    if (error) {
      alert('Failed to add employee')
    } else {
      alert('✓ Employee added successfully')
      closeModal()
      loadInitialData()
    }
    
    setLoading(false)
  }

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    
    const taskData = {
      task_id: 'TSK' + Date.now(),
      title: modalData.title,
      description: modalData.description,
      assigned_to: modalData.assigned_to,
      assigned_by: currentUser?.id,
      client_id: modalData.client_id,
      priority: modalData.priority,
      status: 'pending' as const,
      due_date: modalData.due_date,
      completion_percentage: 0
    }
    
    const { error } = await taskHelpers.create(taskData)
    
    if (error) {
      alert('Failed to add task')
    } else {
      alert('✓ Task added successfully')
      closeModal()
      loadInitialData()
    }
    
    setLoading(false)
  }

  const handleAddVehicle = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedClient) return
    
    setLoading(true)
    
    const vehicleData = {
      vehicle_id: 'VEH' + Date.now(),
      client_id: selectedClient.id,
      vehicle_number: modalData.vehicle_number,
      vehicle_type: modalData.vehicle_type,
      driver_name: modalData.driver_name,
      driver_phone: modalData.driver_phone,
      status: 'online' as const,
      alerts_active: false,
      video_recording: true
    }
    
    const { error } = await vehicleHelpers.create(vehicleData)
    
    if (error) {
      alert('Failed to add vehicle')
    } else {
      alert('✓ Vehicle added successfully')
      closeModal()
      loadVehicles(selectedClient.id)
    }
    
    setLoading(false)
  }

  const loadVehicles = async (clientId: string) => {
    const { data } = await vehicleHelpers.getByClient(clientId)
    setVehicles(data || [])
  }

  const updateVehicleStatus = async (vehicleId: string, field: string, value: any) => {
    await vehicleHelpers.update(vehicleId, { [field]: value })
    if (selectedClient) {
      loadVehicles(selectedClient.id)
    }
  }

  const handleApproveLeave = async (leaveId: string, approved: boolean) => {
    if (!currentUser) return
    
    if (approved) {
      await leaveHelpers.approve(leaveId, currentUser.id)
    } else {
      await leaveHelpers.reject(leaveId, currentUser.id)
    }
    
    alert(`Leave ${approved ? 'approved ✓' : 'rejected ✗'}`)
    loadInitialData()
  }

  const handleLeaveRequest = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentUser) return
    
    setLoading(true)
    
    const leaveData = {
      employee_id: currentUser.id,
      leave_type: modalData.leave_type,
      from_date: modalData.from_date,
      to_date: modalData.to_date,
      total_days: parseInt(modalData.total_days),
      reason: modalData.reason,
      status: 'pending' as const
    }
    
    const { error } = await leaveHelpers.create(leaveData)
    
    if (error) {
      alert('Failed to submit leave request')
    } else {
      alert('✓ Leave request submitted successfully')
      closeModal()
    }
    
    setLoading(false)
  }

  const loadEmployeeRoster = async (employeeId: string) => {
    const { data } = await supabase
      .from('employee_roster')
      .select('*')
      .eq('employee_id', employeeId)
      .gte('date', new Date(rosterMonth.getFullYear(), rosterMonth.getMonth(), 1).toISOString())
      .lte('date', new Date(rosterMonth.getFullYear(), rosterMonth.getMonth() + 1, 0).toISOString())
      .order('date', { ascending: true })
    
    setRoster(data || [])
  }

  const generateMonthRoster = async (employeeId: string) => {
    const year = rosterMonth.getFullYear()
    const month = rosterMonth.getMonth()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    
    const rosterEntries = []
    const employee = employees.find(e => e.id === employeeId)
    
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day)
      const dayOfWeek = date.getDay()
      
      rosterEntries.push({
        employee_id: employeeId,
        date: date.toISOString().split('T')[0],
        is_working_day: dayOfWeek !== 0 && dayOfWeek !== 6,
        shift_start: employee?.shift_start,
        shift_end: employee?.shift_end
      })
    }
    
    await supabase
      .from('employee_roster')
      .delete()
      .eq('employee_id', employeeId)
      .gte('date', new Date(year, month, 1).toISOString())
      .lte('date', new Date(year, month + 1, 0).toISOString())
    
    await supabase.from('employee_roster').insert(rosterEntries)
    
    alert('✓ Roster generated successfully')
    loadEmployeeRoster(employeeId)
  }

  const toggleWorkingDay = async (rosterId: string, currentStatus: boolean) => {
    await supabase
      .from('employee_roster')
      .update({ is_working_day: !currentStatus })
      .eq('id', rosterId)
    
    if (selectedEmployee) {
      loadEmployeeRoster(selectedEmployee.id)
    }
  }

  // Distribution Functions
  const handleCreateSchedule = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    
    const scheduleData = {
      hour_start: parseInt(modalData.hour_start),
      hour_end: parseInt(modalData.hour_end),
      task_id: modalData.type === 'task' ? modalData.item_id : undefined,
      client_id: modalData.type === 'client' ? modalData.item_id : undefined,
      assigned_to: modalData.assigned_to,
      created_by: currentUser!.id,
      is_recurring: true
    }
    
    const { error } = await createHourSchedule(scheduleData)
    
    if (error) {
      alert('Failed to create schedule: ' + error.message)
    } else {
      alert('✓ Schedule created successfully!')
      closeModal()
      loadDistributionData()
    }
    
    setLoading(false)
  }

  const handleDeleteSchedule = async (scheduleId: string) => {
    if (!confirm('Are you sure you want to delete this schedule?')) return
    
    const { error } = await deleteSchedule(scheduleId)
    
    if (error) {
      alert('Failed to delete schedule')
    } else {
      alert('✓ Schedule deleted')
      loadDistributionData()
    }
  }

  const handleManualRedistribute = async () => {
    setRedistributing(true)
    
    try {
      const result = await manualRedistribute()
      alert('✓ ' + result.message)
      loadDistributionData()
    } catch (error) {
      alert('Failed to redistribute')
    }
    
    setRedistributing(false)
  }

  // Login Page
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-[#0a0a0b] flex">
        {/* Left Side - 3D Shield Design */}
        <div className="hidden lg:flex lg:w-1/2 items-center justify-center relative overflow-hidden">
          {/* Background gradient */}
          <div className="absolute inset-0 bg-gradient-to-br from-blue-600/10 via-transparent to-purple-600/10"></div>
          
          {/* Vertical lines */}
          <div className="absolute inset-0 flex">
            {Array.from({ length: 8 }).map((_, i) => (
              <div 
                key={i} 
                className="flex-1 border-r border-gray-800/30"
                style={{ animationDelay: `${i * 0.1}s` }}
              ></div>
            ))}
          </div>
          
          {/* 3D Shield */}
          <div className="relative z-10">
            <div className="w-96 h-96 relative">
              {/* Outer glow */}
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-full blur-3xl"></div>
              
              {/* Main shield circle */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-80 h-80 rounded-full bg-gradient-to-br from-gray-700 via-gray-800 to-gray-900 shadow-2xl flex items-center justify-center">
                  {/* Inner circle */}
                  <div className="w-56 h-56 rounded-full bg-gradient-to-br from-gray-800 via-gray-900 to-black shadow-inner flex items-center justify-center">
                    {/* Shield icon */}
                    <Shield className="w-32 h-32 text-gray-600" strokeWidth={1.5} />
                  </div>
                </div>
              </div>
              
              {/* Light reflection */}
              <div className="absolute top-20 left-20 w-40 h-40 bg-gradient-to-br from-white/10 to-transparent rounded-full blur-2xl"></div>
            </div>
          </div>
        </div>

        {/* Right Side - Login Form */}
        <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
          <div className="w-full max-w-md">
            {/* Logo */}
            <div className="flex justify-center mb-8">
              <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/50">
                <Shield className="w-10 h-10 text-white" />
              </div>
            </div>
            
            {/* Heading */}
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-white mb-2">Sign in</h1>
              <p className="text-gray-400">Welcome to Cautio</p>
            </div>
            
            {/* Login Form */}
            <form onSubmit={handleLogin} className="space-y-6">
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-300">Email</label>
                <input
                  type="text"
                  value={loginForm.user_id}
                  onChange={(e) => setLoginForm({ ...loginForm, user_id: e.target.value })}
                  className="w-full px-4 py-3 bg-white/5 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                  placeholder="example@gmail.com"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-300">Password</label>
                <div className="relative">
                  <input
                    type={passwordVisible ? "text" : "password"}
                    value={loginForm.password}
                    onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                    className="w-full px-4 py-3 pr-12 bg-white/5 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                    placeholder="Password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setPasswordVisible(!passwordVisible)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                  >
                    <Eye className="w-5 h-5" />
                  </button>
                </div>
              </div>
              
              <div className="text-right">
                <a href="#" className="text-sm text-blue-500 hover:text-blue-400 transition-colors">
                  Forgot Password?
                </a>
              </div>
              
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-semibold transition-all shadow-lg shadow-blue-600/30 hover:shadow-blue-600/50"
              >
                {loading ? 'Signing in...' : 'Login'}
              </button>
            </form>
            
            {/* Demo Credentials */}
            <div className="mt-8 pt-6 border-t border-gray-800">
              <p className="text-center text-sm text-gray-400 mb-3">Demo Credentials:</p>
              <div className="space-y-2 text-xs">
                <div className="bg-gray-800/50 rounded-lg p-3 flex items-center justify-between">
                  <span className="text-gray-400">Admin:</span>
                  <div className="flex gap-2">
                    <span className="text-blue-400 font-mono">admin</span>
                    <span className="text-gray-500">/</span>
                    <span className="text-blue-400 font-mono">admin123</span>
                  </div>
                </div>
                <div className="bg-gray-800/50 rounded-lg p-3 flex items-center justify-between">
                  <span className="text-gray-400">Employee:</span>
                  <div className="flex gap-2">
                    <span className="text-blue-400 font-mono">emp001</span>
                    <span className="text-gray-500">/</span>
                    <span className="text-blue-400 font-mono">emp123</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const isAdmin = currentUser.role === 'admin'

  // Clickable metrics with navigation
  const metrics = [
    { 
      value: clients.length, 
      label: 'Total Clients', 
      subtext: '↗ 25% growth', 
      icon: Users, 
      color: 'from-blue-500 to-blue-600',
      onClick: () => setActiveSection('clients')
    },
    { 
      value: vehicles.length, 
      label: 'Fleet Size', 
      subtext: `+${vehicles.filter(v => new Date(v.created_at!).getMonth() === new Date().getMonth()).length} this month`, 
      icon: Truck, 
      color: 'from-indigo-500 to-indigo-600',
      onClick: () => setActiveSection('clients')
    },
    { 
      value: employees.length, 
      label: 'Team Members', 
      subtext: 'All active', 
      icon: UserCheck, 
      color: 'from-purple-500 to-purple-600',
      onClick: () => setActiveSection('employees')
    },
    { 
      value: vehicles.filter(v => v.status === 'online').length, 
      label: 'Online Vehicles', 
      subtext: `${Math.round((vehicles.filter(v => v.status === 'online').length / vehicles.length) * 100) || 0}% uptime`, 
      icon: CheckCircle, 
      color: 'from-green-500 to-green-600',
      onClick: () => setActiveSection('clients')
    },
    { 
      value: `${Math.round((tasks.filter(t => t.status === 'completed').length / tasks.length) * 100) || 0}%`, 
      label: 'Completion Rate', 
      subtext: '↗ +12% weekly', 
      icon: BarChart3, 
      color: 'from-cyan-500 to-cyan-600',
      onClick: () => setActiveSection('tasks')
    },
    { 
      value: leaveRequests.length, 
      label: 'Pending Leaves', 
      subtext: 'Needs review', 
      icon: AlertTriangle, 
      color: 'from-red-500 to-red-600',
      onClick: () => setActiveSection('leaves')
    }
  ]

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white">
      {/* Perfect Cautio Sidebar */}
      <div className="cautio-sidebar">
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <Shield className="logo-icon animate-glow" />
            <div className="logo-text">
              <span className="logo-title">cautio</span>
            </div>
          </div>
        </div>
        
        <nav className="sidebar-nav">
          {(isAdmin ? [
            { id: 'dashboard', label: 'Dashboard', icon: Home },
            { id: 'clients', label: 'Clients', icon: Truck },
            { id: 'employees', label: 'Employees', icon: Users },
            { id: 'tasks', label: 'Tasks', icon: ClipboardCheck },
            { id: 'distribution', label: 'Distribution', icon: Zap },
            { id: 'attendance', label: 'Attendance', icon: Clock },
            { id: 'leaves', label: 'Leaves', icon: Calendar },
            { id: 'roster', label: 'Reports', icon: BarChart3 }
          ] : [
            { id: 'dashboard', label: 'Dashboard', icon: Home },
            { id: 'my-tasks', label: 'My Tasks', icon: ClipboardCheck },
            { id: 'my-clients', label: 'My Clients', icon: Truck },
            { id: 'my-roster', label: 'My Roster', icon: Calendar },
            { id: 'request-leave', label: 'Leave Request', icon: FileText }
          ]).map((item) => {
            const Icon = item.icon
            return (
              <button
                key={item.id}
                onClick={() => setActiveSection(item.id)}
                className={`sidebar-item ${activeSection === item.id ? 'active' : ''}`}
              >
                <Icon className="sidebar-item-icon" />
                <span className="sidebar-item-text">{item.label}</span>
                <span className="sidebar-tooltip">{item.label}</span>
              </button>
            )
          })}
        </nav>
        
        <div className="sidebar-footer">
          <button
            onClick={handleLogout}
            className="sidebar-item"
          >
            <LogOut className="sidebar-item-icon" />
            <span className="sidebar-item-text">Logout</span>
            <span className="sidebar-tooltip">Logout</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="ml-[72px] transition-all duration-300">
        {/* Glassmorphic Header */}
        <div className="header-glass">
          <div className="px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div>
                <h1 className="text-xl font-bold">{activeSection.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</h1>
                <p className="text-sm text-gray-400">{new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              {!isAdmin && (
                <>
                  {!isSignedIn ? (
                    <button 
                      onClick={handleSignIn} 
                      disabled={loading}
                      className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-all shadow-lg flex items-center gap-2"
                    >
                      <Clock className="w-4 h-4" />
                      {loading ? 'Signing In...' : 'Sign In'}
                    </button>
                  ) : (
                    <>
                      <div className="bg-green-600/20 border-2 border-green-500 text-green-400 px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                        Signed In at {signInTime}
                      </div>
                      <button 
                        onClick={handleSignOut}
                        disabled={loading}
                        className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-all shadow-lg flex items-center gap-2"
                      >
                        <LogOut className="w-4 h-4" />
                        {loading ? 'Signing Out...' : 'Sign Out'}
                      </button>
                    </>
                  )}
                </>
              )}
              
              {isAdmin && (
                <button 
                  onClick={() => setActiveSection('leaves')}
                  className="relative p-2 hover:bg-gray-800 rounded-lg transition-colors cursor-pointer"
                >
                  <Bell className="w-5 h-5" />
                  {leaveRequests.length > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-semibold animate-pulse">
                      {leaveRequests.length}
                    </span>
                  )}
                </button>
              )}
              
              <div className="flex items-center gap-3 px-3 py-2 bg-gray-800/50 rounded-lg border border-gray-700/50">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white font-semibold text-sm">
                  {currentUser.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                </div>
                <div>
                  <div className="font-medium text-sm">{currentUser.full_name}</div>
                  <div className="text-xs text-gray-400">{isAdmin ? 'Administrator' : 'Employee'}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="p-6">
          {isAdmin ? (
            <>
              {activeSection === 'dashboard' && (
                <div className="space-y-6 animate-fade-in">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                    {metrics.map((metric, idx) => {
                      const Icon = metric.icon
                      return (
                        <div
                          key={idx}
                          onClick={metric.onClick}
                          className={`metric-card bg-gradient-to-br ${metric.color}`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="text-3xl font-bold">{metric.value}</div>
                            <Icon className="w-7 h-7 opacity-80" />
                          </div>
                          <div className="text-xs opacity-90 mb-1">{metric.subtext}</div>
                          <div className="text-sm opacity-90 flex items-center justify-between">
                            <span>{metric.label}</span>
                            <ArrowRight className="w-4 h-4 opacity-70" />
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  <div className="dark-card p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-xl font-bold flex items-center gap-2">
                        <Clock className="w-6 h-6 text-blue-500" />
                        Today's Live Attendance
                      </h3>
                      <button 
                        onClick={() => setActiveSection('attendance')}
                        className="text-blue-500 hover:text-blue-400 text-sm flex items-center gap-1 transition-colors"
                      >
                        View All <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                    
                    <div className="grid grid-cols-4 gap-4 mb-6">
                      {[
                        { label: 'Present', count: attendance.filter(a => a.status === 'present').length, color: 'from-green-500 to-green-600', icon: '✓' },
                        { label: 'Late', count: attendance.filter(a => a.status === 'late').length, color: 'from-orange-500 to-orange-600', icon: '⚠' },
                        { label: 'Absent', count: employees.length - attendance.length, color: 'from-red-500 to-red-600', icon: '✗' },
                        { label: 'On Leave', count: attendance.filter(a => a.status === 'on_leave').length, color: 'from-purple-500 to-purple-600', icon: '📅' }
                      ].map((stat, idx) => (
                        <div 
                          key={idx} 
                          onClick={() => setActiveSection('attendance')}
                          className={`stat-card-clickable bg-gradient-to-br ${stat.color} text-white rounded-lg p-4 text-center`}
                        >
                          <div className="text-3xl mb-2">{stat.icon}</div>
                          <div className="text-2xl font-bold">{stat.count}</div>
                          <div className="text-xs opacity-90 mt-1">{stat.label}</div>
                        </div>
                      ))}
                    </div>

                    {attendance.filter(a => a.status === 'late').length > 0 && (
                      <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-4 mb-4">
                        <h4 className="font-bold text-orange-400 mb-3 flex items-center gap-2 text-sm">
                          <AlertTriangle className="w-4 h-4" />
                          Late Arrivals ({attendance.filter(a => a.status === 'late').length})
                        </h4>
                        <div className="space-y-2">
                          {attendance.filter(a => a.status === 'late').slice(0, 3).map((att) => {
                            const emp = employees.find(e => e.id === att.employee_id)
                            return (
                              <div 
                                key={att.id} 
                                onClick={() => setActiveSection('attendance')}
                                className="flex items-center justify-between bg-gray-800/50 rounded p-3 cursor-pointer hover:bg-gray-800 transition-colors text-sm"
                              >
                                <div>
                                  <div className="font-semibold">{emp?.full_name || 'Employee'}</div>
                                  <div className="text-xs text-gray-400">Scheduled: {att.scheduled_time}</div>
                                </div>
                                <div className="text-right">
                                  <div className="font-bold text-red-400">{att.late_by_minutes} min late</div>
                                  <div className="text-xs text-gray-400">{new Date(att.sign_in_time!).toLocaleTimeString()}</div>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-3 gap-4 mt-6">
                      <button 
                        onClick={() => openModal('addClient')}
                        className="dark-card-clickable p-4 text-center"
                      >
                        <Plus className="w-7 h-7 mx-auto mb-2 text-blue-500" />
                        <div className="font-semibold text-sm">Add Client</div>
                      </button>
                      <button 
                        onClick={() => openModal('addEmployee')}
                        className="dark-card-clickable p-4 text-center"
                      >
                        <Plus className="w-7 h-7 mx-auto mb-2 text-purple-500" />
                        <div className="font-semibold text-sm">Add Employee</div>
                      </button>
                      <button 
                        onClick={() => openModal('addTask')}
                        className="dark-card-clickable p-4 text-center"
                      >
                        <Plus className="w-7 h-7 mx-auto mb-2 text-green-500" />
                        <div className="font-semibold text-sm">Create Task</div>
                      </button>
                    </div>
                  </div>

                  <div className="dark-card p-6">
                    <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                      <Activity className="w-6 h-6 text-blue-500" />
                      Recent Activity
                    </h3>
                    <div className="space-y-2">
                      {tasks.slice(0, 5).map((task) => (
                        <div 
                          key={task.id}
                          onClick={() => setActiveSection('tasks')}
                          className="flex items-center justify-between p-3 bg-gray-800/30 rounded-lg hover:bg-gray-800/50 transition-colors cursor-pointer interactive-hover"
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-2 h-2 rounded-full ${
                              task.priority === 'urgent' ? 'bg-red-500' :
                              task.priority === 'high' ? 'bg-orange-500' :
                              'bg-blue-500'
                            } animate-pulse`}></div>
                            <div>
                              <div className="font-semibold text-sm">{task.title}</div>
                              <div className="text-xs text-gray-400">{task.description?.slice(0, 50)}...</div>
                            </div>
                          </div>
                          <span className={`badge ${
                            task.priority === 'urgent' ? 'badge-danger' :
                            task.priority === 'high' ? 'badge-warning' :
                            'badge-info'
                          }`}>
                            {task.priority}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {activeSection === 'distribution' && (
                <div className="animate-fade-in space-y-6">
                  <div className="flex justify-between items-center">
                    <div>
                      <h2 className="text-2xl font-bold">Hour-Based Distribution System</h2>
                      <p className="text-sm text-gray-400 mt-1">Manage task & client assignments by hour</p>
                    </div>
                    <div className="flex gap-3">
                      <button 
                        onClick={handleManualRedistribute}
                        disabled={redistributing}
                        className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-all shadow-lg flex items-center gap-2"
                      >
                        <RefreshCw className={`w-4 h-4 ${redistributing ? 'animate-spin' : ''}`} />
                        {redistributing ? 'Redistributing...' : 'Manual Redistribute'}
                      </button>
                      <button 
                        onClick={() => openModal('createSchedule')}
                        className="btn-primary"
                      >
                        <Plus className="w-4 h-4 inline mr-2" />
                        Create Schedule
                      </button>
                    </div>
                  </div>

                  <div className="dark-card p-6">
                    <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                      <Activity className="w-5 h-5 text-blue-500" />
                      Live Distribution Status (Hour: {new Date().getHours()}:00)
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {distributionSummary.map((emp, idx) => (
                        <div 
                          key={idx}
                          className={`p-4 rounded-lg border-2 ${
                            emp.isSignedIn 
                              ? 'bg-green-500/10 border-green-500/30' 
                              : 'bg-red-500/10 border-red-500/30'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-3">
                            <div>
                              <div className="font-bold">{emp.employeeName}</div>
                              <div className="text-xs text-gray-400">{emp.userId}</div>
                            </div>
                            <div className={`w-3 h-3 rounded-full ${
                              emp.isSignedIn ? 'bg-green-500' : 'bg-red-500'
                            } animate-pulse`}></div>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div className="bg-blue-500/20 rounded p-2 text-center">
                              <div className="text-2xl font-bold text-blue-400">{emp.tasksCount}</div>
                              <div className="text-xs text-gray-300">Tasks</div>
                            </div>
                            <div className="bg-purple-500/20 rounded p-2 text-center">
                              <div className="text-2xl font-bold text-purple-400">{emp.clientsCount}</div>
                              <div className="text-xs text-gray-300">Clients</div>
                            </div>
                          </div>
                          {emp.isLate && (
                            <div className="mt-2 text-xs text-orange-400 flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" />
                              Late Sign In
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="dark-card p-6">
                    <h3 className="text-lg font-bold mb-4">All Schedules</h3>
                    <div className="table-container">
                      <table className="w-full">
                        <thead>
                          <tr>
                            <th className="table-header">Time Slot</th>
                            <th className="table-header">Type</th>
                            <th className="table-header">Item</th>
                            <th className="table-header">Assigned To</th>
                            <th className="table-header">Status</th>
                            <th className="table-header">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {schedules.map((schedule) => {
                            const assignedEmp = employees.find(e => e.id === schedule.assigned_to)
                            const isAssigned = distributionSummary.find(s => s.employeeId === schedule.assigned_to)
                            
                            return (
                              <tr key={schedule.id} className="table-row">
                                <td className="px-6 py-4 font-medium text-sm">
                                  {String(schedule.hour_start).padStart(2, '0')}:00 - {String(schedule.hour_end).padStart(2, '0')}:00
                                </td>
                                <td className="px-6 py-4">
                                  <span className={`badge ${schedule.task_id ? 'badge-info' : 'badge-warning'}`}>
                                    {schedule.task_id ? 'Task' : 'Client'}
                                  </span>
                                </td>
                                <td className="px-6 py-4">
                                  <div className="font-medium text-sm">
                                    {schedule.tasks?.title || schedule.clients?.name || 'Unknown'}
                                  </div>
                                  {schedule.tasks?.priority && (
                                    <div className="text-xs text-gray-400">Priority: {schedule.tasks.priority}</div>
                                  )}
                                </td>
                                <td className="px-6 py-4">
                                  <div className="font-medium text-sm">{assignedEmp?.full_name}</div>
                                  <div className="text-xs text-gray-400">{assignedEmp?.user_id}</div>
                                </td>
                                <td className="px-6 py-4">
                                  {isAssigned?.isSignedIn ? (
                                    <span className="badge badge-success">✓ Signed In</span>
                                  ) : (
                                    <span className="badge badge-danger">✗ Not Signed In</span>
                                  )}
                                </td>
                                <td className="px-6 py-4">
                                  <button
                                    onClick={() => handleDeleteSchedule(schedule.id)}
                                    className="text-red-500 hover:text-red-400 transition-colors"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {activeSection === 'clients' && (
                <div className="animate-fade-in">
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold">Client Management</h2>
                    <button onClick={() => openModal('addClient')} className="btn-primary">
                      <Plus className="w-4 h-4 inline mr-2" />
                      Add Client
                    </button>
                  </div>
                  <div className="grid gap-4">
                    {clients.map((client) => (
                      <div key={client.id} className="dark-card p-6">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <h3 className="text-xl font-bold mb-2">{client.name}</h3>
                            <div className="grid grid-cols-3 gap-4 text-sm">
                              <div>
                                <p className="text-gray-400 text-xs">Email</p>
                                <p className="font-medium">{client.email}</p>
                              </div>
                              <div>
                                <p className="text-gray-400 text-xs">Phone</p>
                                <p className="font-medium">{client.phone}</p>
                              </div>
                              <div>
                                <p className="text-gray-400 text-xs">Vehicles</p>
                                <p className="font-medium">{client.total_vehicles}</p>
                              </div>
                            </div>
                            <div className="mt-4">
                              <div className="flex items-center gap-2">
                                <div className="progress-bar flex-1">
                                  <div
                                    className="progress-fill"
                                    style={{ width: `${client.completion_percentage}%` }}
                                  />
                                </div>
                                <span className="text-sm font-medium">{client.completion_percentage}%</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => { 
                                setSelectedClient(client)
                                loadVehicles(client.id)
                                setActiveSection('vehicles')
                              }}
                              className="btn-primary text-sm"
                            >
                              <Eye className="w-4 h-4 inline mr-2" />
                              Vehicles
                            </button>
                            <label className="btn-success text-sm cursor-pointer">
                              <Upload className="w-4 h-4 inline mr-2" />
                              Upload
                              <input
                                type="file"
                                accept=".csv,.xlsx,.xls"
                                onChange={(e) => handleFileUpload(e, client.id)}
                                className="hidden"
                              />
                            </label>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeSection === 'vehicles' && selectedClient && (
                <div className="animate-fade-in">
                  <div className="flex justify-between items-center mb-6">
                    <div>
                      <button
                        onClick={() => setActiveSection('clients')}
                        className="text-blue-500 hover:text-blue-400 mb-2 flex items-center gap-2 transition-colors text-sm"
                      >
                        <ChevronLeft className="w-4 h-4" />
                        Back to Clients
                      </button>
                      <h2 className="text-2xl font-bold">{selectedClient.name} - Vehicles</h2>
                    </div>
                    <button
                      onClick={() => openModal('addVehicle')}
                      className="btn-primary"
                    >
                      <Plus className="w-4 h-4 inline mr-2" />
                      Add Vehicle
                    </button>
                  </div>
                  <div className="table-container">
                    <table className="w-full">
                      <thead>
                        <tr>
                          <th className="table-header">Vehicle #</th>
                          <th className="table-header">Driver</th>
                          <th className="table-header">Status</th>
                          <th className="table-header">Alerts (24h)</th>
                          <th className="table-header">Video</th>
                          <th className="table-header">Offline Reason</th>
                        </tr>
                      </thead>
                      <tbody>
                        {vehicles.map((vehicle) => (
                          <tr key={vehicle.id} className="table-row">
                            <td className="px-6 py-4 font-medium text-sm">{vehicle.vehicle_number}</td>
                            <td className="px-6 py-4">
                              <div>
                                <div className="font-medium text-sm">{vehicle.driver_name}</div>
                                <div className="text-xs text-gray-400">{vehicle.driver_phone}</div>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <select
                                value={vehicle.status}
                                onChange={(e) => updateVehicleStatus(vehicle.id, 'status', e.target.value)}
                                className={`px-3 py-1 rounded-lg text-xs font-medium cursor-pointer border bg-transparent ${
                                  vehicle.status === 'online' ? 'border-green-500 text-green-400' :
                                  vehicle.status === 'offline' ? 'border-red-500 text-red-400' :
                                  'border-yellow-500 text-yellow-400'
                                }`}
                              >
                                <option value="online">● Online</option>
                                <option value="offline">● Offline</option>
                                <option value="maintenance">● Maintenance</option>
                                <option value="idle">● Idle</option>
                              </select>
                            </td>
                            <td className="px-6 py-4">
                              <input
                                type="checkbox"
                                checked={vehicle.alerts_active}
                                onChange={(e) => updateVehicleStatus(vehicle.id, 'alerts_active', e.target.checked)}
                                className="w-5 h-5 cursor-pointer accent-blue-500"
                              />
                            </td>
                            <td className="px-6 py-4">
                              <input
                                type="checkbox"
                                checked={vehicle.video_recording}
                                onChange={(e) => updateVehicleStatus(vehicle.id, 'video_recording', e.target.checked)}
                                className="w-5 h-5 cursor-pointer accent-blue-500"
                              />
                            </td>
                            <td className="px-6 py-4">
                              {vehicle.status === 'offline' && (
                                <select
                                  value={vehicle.offline_reason || ''}
                                  onChange={(e) => updateVehicleStatus(vehicle.id, 'offline_reason', e.target.value)}
                                  className="px-3 py-1 border border-gray-600 bg-gray-800 rounded-lg text-xs"
                                >
                                  <option value="">Select reason</option>
                                  <option value="vehicle_not_running">🚫 Vehicle Not Running</option>
                                  <option value="dashcam_issue">📹 Dashcam Issue</option>
                                </select>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {activeSection === 'employees' && (
                <div className="animate-fade-in">
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold">Employee Management</h2>
                    <button
                      onClick={() => openModal('addEmployee')}
                      className="btn-primary"
                    >
                      <Plus className="w-4 h-4 inline mr-2" />
                      Add Employee
                    </button>
                  </div>
                  <div className="grid gap-4">
                    {employees.map((emp) => (
                      <div key={emp.id} className="dark-card p-6">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <h3 className="text-xl font-bold">{emp.full_name}</h3>
                            <p className="text-gray-400 text-sm">{emp.email}</p>
                            <div className="grid grid-cols-3 gap-4 mt-3 text-sm">
                              <div>
                                <p className="text-gray-400 text-xs">User ID</p>
                                <p className="font-medium">{emp.user_id}</p>
                              </div>
                              <div>
                                <p className="text-gray-400 text-xs">Shift Time</p>
                                <p className="font-medium">{emp.shift_start} - {emp.shift_end}</p>
                              </div>
                              <div>
                                <p className="text-gray-400 text-xs">Phone</p>
                                <p className="font-medium">{emp.phone}</p>
                              </div>
                            </div>
                          </div>
                          <button 
                            onClick={() => {
                              setSelectedEmployee(emp)
                              setActiveSection('roster')
                              loadEmployeeRoster(emp.id)
                            }}
                            className="btn-primary text-sm"
                          >
                            <Calendar className="w-4 h-4 inline mr-2" />
                            Roster
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeSection === 'tasks' && (
                <div className="animate-fade-in">
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold">Tasks Management</h2>
                    <button
                      onClick={() => openModal('addTask')}
                      className="btn-primary"
                    >
                      <Plus className="w-4 h-4 inline mr-2" />
                      Create Task
                    </button>
                  </div>
                  <div className="grid gap-4">
                    {tasks.map((task) => (
                      <div key={task.id} className="dark-card p-6">
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className="text-lg font-bold">{task.title}</h3>
                            <p className="text-gray-400 text-sm mt-1">{task.description}</p>
                            <div className="flex gap-4 mt-3 text-sm">
                              <span className={`badge ${
                                task.priority === 'urgent' ? 'badge-danger' :
                                task.priority === 'high' ? 'badge-warning' :
                                'badge-info'
                              }`}>
                                {task.priority}
                              </span>
                              <span className="text-gray-400 text-xs">Due: {task.due_date}</span>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-2xl font-bold text-blue-500">{task.completion_percentage}%</div>
                            <div className="text-xs text-gray-400">Complete</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeSection === 'attendance' && (
                <div className="animate-fade-in">
                  <h2 className="text-2xl font-bold mb-6">Attendance Overview</h2>
                  <div className="table-container">
                    <table className="w-full">
                      <thead>
                        <tr>
                          <th className="table-header">Employee</th>
                          <th className="table-header">Sign In</th>
                          <th className="table-header">Sign Out</th>
                          <th className="table-header">Status</th>
                          <th className="table-header">Late By</th>
                        </tr>
                      </thead>
                      <tbody>
                        {attendance.map((att) => {
                          const emp = employees.find(e => e.id === att.employee_id)
                          return (
                            <tr key={att.id} className="table-row">
                              <td className="px-6 py-4 font-medium text-sm">{emp?.full_name || 'Employee'}</td>
                              <td className="px-6 py-4 text-sm">{att.sign_in_time ? new Date(att.sign_in_time).toLocaleTimeString() : '-'}</td>
                              <td className="px-6 py-4 text-sm">{att.sign_out_time ? new Date(att.sign_out_time).toLocaleTimeString() : 'Working...'}</td>
                              <td className="px-6 py-4">
                                <span className={`badge ${
                                  att.status === 'present' ? 'badge-success' :
                                  att.status === 'late' ? 'badge-warning' :
                                  'badge-danger'
                                }`}>
                                  {att.status}
                                </span>
                              </td>
                              <td className="px-6 py-4">
                                {att.late_by_minutes > 0 && (
                                  <span className="text-red-400 font-semibold text-sm">{att.late_by_minutes} min</span>
                                )}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {activeSection === 'leaves' && (
                <div className="animate-fade-in">
                  <h2 className="text-2xl font-bold mb-6">Leave Requests ({leaveRequests.length} Pending)</h2>
                  <div className="grid gap-4">
                    {leaveRequests.map((leave) => {
                      const emp = employees.find(e => e.id === leave.employee_id)
                      return (
                        <div key={leave.id} className="dark-card p-6">
                          <div className="flex justify-between items-start">
                            <div>
                              <h3 className="text-lg font-bold">{emp?.full_name || 'Employee'}</h3>
                              <p className="text-gray-400 text-sm">{leave.leave_type} Leave</p>
                              <p className="text-xs text-gray-500 mt-2">
                                {leave.from_date} to {leave.to_date} ({leave.total_days} days)
                              </p>
                              <p className="mt-2 text-gray-300 text-sm">{leave.reason}</p>
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleApproveLeave(leave.id, true)}
                                className="btn-success text-sm"
                              >
                                <Check className="w-4 h-4 inline mr-2" />
                                Approve
                              </button>
                              <button
                                onClick={() => handleApproveLeave(leave.id, false)}
                                className="btn-danger text-sm"
                              >
                                <X className="w-4 h-4 inline mr-2" />
                                Reject
                              </button>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {activeSection === 'roster' && (
                <div className="animate-fade-in">
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold">Employee Roster Management</h2>
                    <div className="flex items-center gap-4">
                      <button
                        onClick={() => {
                          const newDate = new Date(rosterMonth)
                          newDate.setMonth(newDate.getMonth() - 1)
                          setRosterMonth(newDate)
                        }}
                        className="p-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
                      >
                        <ChevronLeft className="w-5 h-5" />
                      </button>
                      <div className="text-lg font-bold">
                        {rosterMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                      </div>
                      <button
                        onClick={() => {
                          const newDate = new Date(rosterMonth)
                          newDate.setMonth(newDate.getMonth() + 1)
                          setRosterMonth(newDate)
                        }}
                        className="p-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
                      >
                        <ChevronRight className="w-5 h-5" />
                      </button>
                    </div>
                    {selectedEmployee && (
                      <button
                        onClick={() => generateMonthRoster(selectedEmployee.id)}
                        className="btn-primary"
                      >
                        <Calendar className="w-4 h-4 inline mr-2" />
                        Generate Roster
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-4 gap-4 mb-6">
                    {employees.map((emp) => (
                      <button
                        key={emp.id}
                        onClick={() => {
                          setSelectedEmployee(emp)
                          loadEmployeeRoster(emp.id)
                        }}
                        className={`dark-card p-4 text-left transition-all text-sm ${
                          selectedEmployee?.id === emp.id
                            ? 'ring-2 ring-blue-500'
                            : ''
                        }`}
                      >
                        <div className="font-bold">{emp.full_name}</div>
                        <div className="text-xs text-gray-400">{emp.shift_start} - {emp.shift_end}</div>
                      </button>
                    ))}
                  </div>

                  {selectedEmployee && roster.length > 0 && (
                    <div className="dark-card p-6">
                      <h3 className="text-lg font-bold mb-4">{selectedEmployee.full_name}'s Roster</h3>
                      <div className="grid grid-cols-7 gap-2">
                        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                          <div key={day} className="text-center font-bold text-xs text-gray-400 py-2">
                            {day}
                          </div>
                        ))}
                        {roster.map((day, idx) => {
                          const date = new Date(day.date)
                          return (
                            <button
                              key={idx}
                              onClick={() => toggleWorkingDay(day.id, day.is_working_day)}
                              className={`p-3 rounded-lg text-center transition-all hover:scale-105 cursor-pointer ${
                                day.is_working_day
                                  ? 'bg-gradient-to-br from-green-500 to-green-600 text-white border border-green-400'
                                  : 'bg-gradient-to-br from-red-500 to-red-600 text-white border border-red-400'
                              }`}
                            >
                              <div className="font-bold text-base">{date.getDate()}</div>
                              <div className="text-xs mt-1">{day.is_working_day ? '✓' : '✗'}</div>
                              {day.is_working_day && (
                                <div className="text-xs mt-1 opacity-80">
                                  {day.shift_start?.slice(0, 5)}-{day.shift_end?.slice(0, 5)}
                                </div>
                              )}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <>
              {activeSection === 'dashboard' && (
                <div className="space-y-6 animate-fade-in">
                  <div className="dark-card p-6">
                    <h3 className="text-lg font-bold mb-4">Today's Shift</h3>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-gray-400 text-sm">Shift Timing</p>
                        <p className="text-3xl font-bold">{currentUser.shift_start} - {currentUser.shift_end}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-gray-400 text-sm">Status</p>
                        <p className="text-2xl font-bold text-green-400 flex items-center gap-2">
                          <span className="status-online"></span>
                          Active
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    {[
                      { value: tasks.filter(t => t.assigned_to === currentUser.id).length, label: 'My Tasks', color: 'from-blue-500 to-blue-600', onClick: () => setActiveSection('my-tasks') },
                      { value: clients.length, label: 'My Clients', color: 'from-indigo-500 to-indigo-600', onClick: () => setActiveSection('my-clients') },
                      { value: 0, label: 'Pending Leaves', color: 'from-purple-500 to-purple-600', onClick: () => setActiveSection('request-leave') }
                    ].map((stat, idx) => (
                      <div 
                        key={idx} 
                        onClick={stat.onClick}
                        className={`metric-card bg-gradient-to-br ${stat.color}`}
                      >
                        <p className="text-4xl font-bold">{stat.value}</p>
                        <p className="text-sm opacity-90 mt-2 flex items-center justify-between">
                          <span>{stat.label}</span>
                          <ArrowRight className="w-4 h-4 opacity-60" />
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeSection === 'my-tasks' && (
                <div className="animate-fade-in">
                  <h2 className="text-2xl font-bold mb-6">My Tasks</h2>
                  <div className="grid gap-4">
                    {tasks.filter(t => t.assigned_to === currentUser.id).map((task) => (
                      <div key={task.id} className="dark-card p-6">
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className="text-lg font-bold">{task.title}</h3>
                            <p className="text-gray-400 text-sm mt-1">{task.description}</p>
                            <div className="flex gap-4 mt-3 text-sm">
                              <span className={`badge ${
                                task.priority === 'urgent' ? 'badge-danger' :
                                task.priority === 'high' ? 'badge-warning' :
                                'badge-info'
                              }`}>
                                {task.priority}
                              </span>
                              <span className="text-gray-400 text-xs">Due: {task.due_date}</span>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-3xl font-bold text-blue-500">{task.completion_percentage}%</div>
                            <div className="text-xs text-gray-400">Complete</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeSection === 'my-clients' && (
                <div className="animate-fade-in">
                  <h2 className="text-2xl font-bold mb-6">My Assigned Clients</h2>
                  <div className="grid gap-4">
                    {clients.map((client) => (
                      <div
                        key={client.id}
                        onClick={() => { 
                          setSelectedClient(client)
                          loadVehicles(client.id)
                          setActiveSection('client-vehicles')
                        }}
                        className="dark-card-clickable p-6"
                      >
                        <div className="flex justify-between items-center">
                          <div>
                            <h3 className="text-xl font-bold">{client.name}</h3>
                            <p className="text-gray-400 text-sm">{client.email}</p>
                            <p className="text-xs text-gray-500 mt-2">{client.total_vehicles} vehicles</p>
                          </div>
                          <div className="text-right">
                            <div className="text-5xl font-bold text-blue-500">{client.completion_percentage}%</div>
                            <p className="text-xs text-gray-400">Completion</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeSection === 'client-vehicles' && selectedClient && (
                <div className="animate-fade-in">
                  <button onClick={() => setActiveSection('my-clients')} className="text-blue-500 hover:text-blue-400 mb-4 flex items-center gap-2 transition-colors text-sm">
                    <ChevronLeft className="w-4 h-4" />
                    Back to Clients
                  </button>
                  <h2 className="text-2xl font-bold mb-6">{selectedClient.name} - Vehicles</h2>
                  <div className="table-container">
                    <table className="w-full">
                      <thead>
                        <tr>
                          <th className="table-header">Vehicle #</th>
                          <th className="table-header">Driver</th>
                          <th className="table-header">Status</th>
                          <th className="table-header">Alerts</th>
                          <th className="table-header">Video</th>
                          <th className="table-header">Reason</th>
                        </tr>
                      </thead>
                      <tbody>
                        {vehicles.map((vehicle) => (
                          <tr key={vehicle.id} className="table-row">
                            <td className="px-6 py-4 font-medium text-sm">{vehicle.vehicle_number}</td>
                            <td className="px-6 py-4">
                              <div>
                                <div className="font-medium text-sm">{vehicle.driver_name}</div>
                                <div className="text-xs text-gray-400">{vehicle.driver_phone}</div>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <select
                                value={vehicle.status}
                                onChange={(e) => updateVehicleStatus(vehicle.id, 'status', e.target.value)}
                                className={`px-2 py-1 rounded text-xs font-medium cursor-pointer border bg-transparent ${
                                  vehicle.status === 'online' ? 'border-green-500 text-green-400' :
                                  vehicle.status === 'offline' ? 'border-red-500 text-red-400' :
                                  'border-yellow-500 text-yellow-400'
                                }`}
                              >
                                <option value="online">● Online</option>
                                <option value="offline">● Offline</option>
                                <option value="maintenance">● Maintenance</option>
                                <option value="idle">● Idle</option>
                              </select>
                            </td>
                            <td className="px-6 py-4">
                              <input
                                type="checkbox"
                                checked={vehicle.alerts_active}
                                onChange={(e) => updateVehicleStatus(vehicle.id, 'alerts_active', e.target.checked)}
                                className="w-4 h-4 cursor-pointer accent-blue-500"
                              />
                            </td>
                            <td className="px-6 py-4">
                              <input
                                type="checkbox"
                                checked={vehicle.video_recording}
                                onChange={(e) => updateVehicleStatus(vehicle.id, 'video_recording', e.target.checked)}
                                className="w-4 h-4 cursor-pointer accent-blue-500"
                              />
                            </td>
                            <td className="px-6 py-4">
                              {vehicle.status === 'offline' && (
                                <select
                                  value={vehicle.offline_reason || ''}
                                  onChange={(e) => updateVehicleStatus(vehicle.id, 'offline_reason', e.target.value)}
                                  className="px-2 py-1 border border-gray-600 bg-gray-800 rounded text-xs"
                                >
                                  <option value="">Select</option>
                                  <option value="vehicle_not_running">🚫 Not Running</option>
                                  <option value="dashcam_issue">📹 Dashcam Issue</option>
                                </select>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {activeSection === 'my-roster' && (
                <div className="animate-fade-in">
                  <h2 className="text-2xl font-bold mb-6">My Roster</h2>
                  <div className="dark-card p-6">
                    <button
                      onClick={() => loadEmployeeRoster(currentUser.id)}
                      className="btn-primary mb-4"
                    >
                      Load My Roster
                    </button>
                    {roster.length > 0 && (
                      <div className="grid grid-cols-7 gap-2">
                        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                          <div key={day} className="text-center font-bold text-xs text-gray-400 py-2">
                            {day}
                          </div>
                        ))}
                        {roster.slice(0, 35).map((day, idx) => {
                          const date = new Date(day.date)
                          return (
                            <div
                              key={idx}
                              className={`p-3 rounded-lg text-center ${
                                day.is_working_day
                                  ? 'bg-gradient-to-br from-green-500 to-green-600 text-white border border-green-400'
                                  : 'bg-gradient-to-br from-red-500 to-red-600 text-white border border-red-400'
                              }`}
                            >
                              <div className="font-bold text-xs">{date.toLocaleDateString('en-US', { weekday: 'short' })}</div>
                              <div className="text-lg font-bold">{date.getDate()}</div>
                              <div className="text-xs mt-1">{day.is_working_day ? '✓' : '✗'}</div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeSection === 'request-leave' && (
                <div className="max-w-2xl mx-auto animate-fade-in">
                  <h2 className="text-2xl font-bold mb-6">Request Leave</h2>
                  <div className="dark-card p-6">
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium mb-2 text-gray-300">Leave Type</label>
                        <select
                          onChange={(e) => setModalData({ ...modalData, leave_type: e.target.value })}
                          className="input-field"
                        >
                          <option value="">Select Type</option>
                          <option value="sick">Sick Leave</option>
                          <option value="casual">Casual Leave</option>
                          <option value="earned">Earned Leave</option>
                          <option value="emergency">Emergency Leave</option>
                        </select>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium mb-2 text-gray-300">From Date</label>
                          <input
                            type="date"
                            onChange={(e) => setModalData({ ...modalData, from_date: e.target.value })}
                            className="input-field"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-2 text-gray-300">To Date</label>
                          <input
                            type="date"
                            onChange={(e) => setModalData({ ...modalData, to_date: e.target.value })}
                            className="input-field"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2 text-gray-300">Total Days</label>
                        <input
                          type="number"
                          onChange={(e) => setModalData({ ...modalData, total_days: e.target.value })}
                          className="input-field"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2 text-gray-300">Reason</label>
                        <textarea
                          onChange={(e) => setModalData({ ...modalData, reason: e.target.value })}
                          className="input-field"
                          rows={4}
                        />
                      </div>
                      <button onClick={handleLeaveRequest} className="btn-primary w-full" disabled={loading}>
                        {loading ? 'Submitting...' : 'Submit Leave Request'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Modals for Admin */}
      {isAdmin && (
        <>
          {showModal === 'addClient' && (
            <div className="modal-overlay" onClick={closeModal}>
              <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <h3 className="text-xl font-bold mb-4">Add New Client</h3>
                <div className="space-y-4">
                  <input
                    type="text"
                    placeholder="Company Name"
                    onChange={(e) => setModalData({ ...modalData, name: e.target.value })}
                    className="input-field"
                  />
                  <input
                    type="email"
                    placeholder="Email"
                    onChange={(e) => setModalData({ ...modalData, email: e.target.value })}
                    className="input-field"
                  />
                  <input
                    type="tel"
                    placeholder="Phone"
                    onChange={(e) => setModalData({ ...modalData, phone: e.target.value })}
                    className="input-field"
                  />
                  <div className="flex gap-2">
                    <button onClick={handleAddClient} className="btn-primary flex-1" disabled={loading}>
                      {loading ? 'Adding...' : 'Add Client'}
                    </button>
                    <button onClick={closeModal} className="btn-secondary">Cancel</button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {showModal === 'addEmployee' && (
            <div className="modal-overlay" onClick={closeModal}>
              <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <h3 className="text-xl font-bold mb-4">Add New Employee</h3>
                <div className="space-y-4">
                  <input
                    type="text"
                    placeholder="User ID"
                    onChange={(e) => setModalData({ ...modalData, user_id: e.target.value })}
                    className="input-field"
                  />
                  <input
                    type="password"
                    placeholder="Password"
                    onChange={(e) => setModalData({ ...modalData, password: e.target.value })}
                    className="input-field"
                  />
                  <input
                    type="text"
                    placeholder="Full Name"
                    onChange={(e) => setModalData({ ...modalData, full_name: e.target.value })}
                    className="input-field"
                  />
                  <input
                    type="email"
                    placeholder="Email"
                    onChange={(e) => setModalData({ ...modalData, email: e.target.value })}
                    className="input-field"
                  />
                  <input
                    type="tel"
                    placeholder="Phone"
                    onChange={(e) => setModalData({ ...modalData, phone: e.target.value })}
                    className="input-field"
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <input
                      type="time"
                      placeholder="Shift Start"
                      onChange={(e) => setModalData({ ...modalData, shift_start: e.target.value })}
                      className="input-field"
                    />
                    <input
                      type="time"
                      placeholder="Shift End"
                      onChange={(e) => setModalData({ ...modalData, shift_end: e.target.value })}
                      className="input-field"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={handleAddEmployee} className="btn-primary flex-1" disabled={loading}>
                      {loading ? 'Adding...' : 'Add Employee'}
                    </button>
                    <button onClick={closeModal} className="btn-secondary">Cancel</button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {showModal === 'addTask' && (
            <div className="modal-overlay" onClick={closeModal}>
              <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <h3 className="text-xl font-bold mb-4">Create New Task</h3>
                <div className="space-y-4">
                  <input
                    type="text"
                    placeholder="Task Title"
                    onChange={(e) => setModalData({ ...modalData, title: e.target.value })}
                    className="input-field"
                  />
                  <textarea
                    placeholder="Description"
                    onChange={(e) => setModalData({ ...modalData, description: e.target.value })}
                    className="input-field"
                    rows={3}
                  />
                  <select
                    onChange={(e) => setModalData({ ...modalData, assigned_to: e.target.value })}
                    className="input-field"
                  >
                    <option value="">Assign to Employee</option>
                    {employees.map(emp => (
                      <option key={emp.id} value={emp.id}>{emp.full_name}</option>
                    ))}
                  </select>
                  <select
                    onChange={(e) => setModalData({ ...modalData, client_id: e.target.value })}
                    className="input-field"
                  >
                    <option value="">Select Client (Optional)</option>
                    {clients.map(client => (
                      <option key={client.id} value={client.id}>{client.name}</option>
                    ))}
                  </select>
                  <div className="grid grid-cols-2 gap-4">
                    <select
                      onChange={(e) => setModalData({ ...modalData, priority: e.target.value })}
                      className="input-field"
                    >
                      <option value="medium">Medium Priority</option>
                      <option value="low">Low Priority</option>
                      <option value="high">High Priority</option>
                      <option value="urgent">Urgent</option>
                    </select>
                    <input
                      type="date"
                      onChange={(e) => setModalData({ ...modalData, due_date: e.target.value })}
                      className="input-field"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={handleAddTask} className="btn-primary flex-1" disabled={loading}>
                      {loading ? 'Creating...' : 'Create Task'}
                    </button>
                    <button onClick={closeModal} className="btn-secondary">Cancel</button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {showModal === 'addVehicle' && (
            <div className="modal-overlay" onClick={closeModal}>
              <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <h3 className="text-xl font-bold mb-4">Add New Vehicle</h3>
                <div className="space-y-4">
                  <input
                    type="text"
                    placeholder="Vehicle Number (e.g., MH01AB1234)"
                    onChange={(e) => setModalData({ ...modalData, vehicle_number: e.target.value })}
                    className="input-field"
                  />
                  <input
                    type="text"
                    placeholder="Vehicle Type (e.g., Truck, Van)"
                    onChange={(e) => setModalData({ ...modalData, vehicle_type: e.target.value })}
                    className="input-field"
                  />
                  <input
                    type="text"
                    placeholder="Driver Name"
                    onChange={(e) => setModalData({ ...modalData, driver_name: e.target.value })}
                    className="input-field"
                  />
                  <input
                    type="tel"
                    placeholder="Driver Phone"
                    onChange={(e) => setModalData({ ...modalData, driver_phone: e.target.value })}
                    className="input-field"
                  />
                  <div className="flex gap-2">
                    <button onClick={handleAddVehicle} className="btn-primary flex-1" disabled={loading}>
                      {loading ? 'Adding...' : 'Add Vehicle'}
                    </button>
                    <button onClick={closeModal} className="btn-secondary">Cancel</button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {showModal === 'createSchedule' && (
            <div className="modal-overlay" onClick={closeModal}>
              <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <h3 className="text-xl font-bold mb-4">Create Hour-Based Schedule</h3>
                <form onSubmit={handleCreateSchedule} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2 text-gray-300">Start Hour</label>
                      <select
                        onChange={(e) => setModalData({ ...modalData, hour_start: e.target.value })}
                        className="input-field"
                        required
                      >
                        <option value="">Select Start</option>
                        {Array.from({ length: 24 }, (_, i) => (
                          <option key={i} value={i}>{String(i).padStart(2, '0')}:00</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2 text-gray-300">End Hour</label>
                      <select
                        onChange={(e) => setModalData({ ...modalData, hour_end: e.target.value })}
                        className="input-field"
                        required
                      >
                        <option value="">Select End</option>
                        {Array.from({ length: 24 }, (_, i) => (
                          <option key={i} value={i}>{String(i).padStart(2, '0')}:00</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-2 text-gray-300">Type</label>
                    <select
                      onChange={(e) => setModalData({ ...modalData, type: e.target.value })}
                      className="input-field"
                      required
                    >
                      <option value="">Select Type</option>
                      <option value="task">Task</option>
                      <option value="client">Client</option>
                    </select>
                  </div>

                  {modalData.type === 'task' && (
                    <div>
                      <label className="block text-sm font-medium mb-2 text-gray-300">Select Task</label>
                      <select
                        onChange={(e) => setModalData({ ...modalData, item_id: e.target.value })}
                        className="input-field"
                        required
                      >
                        <option value="">Select Task</option>
                        {tasks.map(task => (
                          <option key={task.id} value={task.id}>{task.title} ({task.priority})</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {modalData.type === 'client' && (
                    <div>
                      <label className="block text-sm font-medium mb-2 text-gray-300">Select Client</label>
                      <select
                        onChange={(e) => setModalData({ ...modalData, item_id: e.target.value })}
                        className="input-field"
                        required
                      >
                        <option value="">Select Client</option>
                        {clients.map(client => (
                          <option key={client.id} value={client.id}>{client.name}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium mb-2 text-gray-300">Assign to Employee</label>
                    <select
                      onChange={(e) => setModalData({ ...modalData, assigned_to: e.target.value })}
                      className="input-field"
                      required
                    >
                      <option value="">Select Employee</option>
                      {employees.map(emp => (
                        <option key={emp.id} value={emp.id}>{emp.full_name} ({emp.user_id})</option>
                      ))}
                    </select>
                  </div>

                  <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 text-sm">
                    <p className="text-blue-400 font-medium mb-1">ℹ️ How it works:</p>
                    <ul className="text-xs text-gray-300 space-y-1 ml-4 list-disc">
                      <li>This task/client will be assigned during the selected hours</li>
                      <li>If employee is absent/late, it will auto-redistribute to others</li>
                      <li>When employee signs in late, assignments restore automatically</li>
                    </ul>
                  </div>

                  <div className="flex gap-2">
                    <button type="submit" className="btn-primary flex-1" disabled={loading}>
                      {loading ? 'Creating...' : 'Create Schedule'}
                    </button>
                    <button type="button" onClick={closeModal} className="btn-secondary">Cancel</button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
