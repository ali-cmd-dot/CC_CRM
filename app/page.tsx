'use client'

import React, { useState, useEffect } from 'react'
import Image from 'next/image'
import { 
  Users, Truck, UserCheck, CheckCircle, AlertTriangle, Activity, Plus, Upload, 
  ClipboardCheck, Calendar, BarChart3, Bell, Search, Download, LogOut, Clock,
  FileText, TrendingUp, X, Check, Edit, Trash2, Eye, Settings, Home, Zap, 
  ChevronLeft, ChevronRight, Menu, Shield, ArrowRight, ChevronDown
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

export default function FleetTrackCRM() {
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [loginForm, setLoginForm] = useState({ user_id: '', password: '' })
  const [activeSection, setActiveSection] = useState('dashboard')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  
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
  
  // Modal states
  const [showModal, setShowModal] = useState<string | null>(null)
  const [modalData, setModalData] = useState<any>({})
  const [loading, setLoading] = useState(false)
  const [passwordVisible, setPasswordVisible] = useState(false)

  // Session Management
  useEffect(() => {
    const savedUser = localStorage.getItem('fleettrack_user')
    if (savedUser) {
      try {
        const user = JSON.parse(savedUser)
        setCurrentUser(user)
      } catch (error) {
        localStorage.removeItem('fleettrack_user')
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
    
    localStorage.setItem('fleettrack_user', JSON.stringify(user))
    setCurrentUser(user)
    setLoading(false)
  }

  const handleLogout = () => {
    localStorage.removeItem('fleettrack_user')
    setCurrentUser(null)
    setActiveSection('dashboard')
    setLoginForm({ user_id: '', password: '' })
  }

  const handleSignIn = async () => {
    if (!currentUser?.shift_start) return
    
    const { data, error, lateMinutes } = await attendanceHelpers.signIn(
      currentUser.id,
      currentUser.shift_start
    )
    
    if (error) {
      alert('Sign in failed: ' + error)
      return
    }
    
    const time = new Date().toLocaleTimeString()
    alert(`Signed in at ${time}${lateMinutes > 0 ? `\n⚠️ Late by ${lateMinutes} minutes` : '\n✓ On Time'}`)
    loadInitialData()
  }

  const handleSignOut = async () => {
    const { error } = await attendanceHelpers.signOut(currentUser!.id)
    
    if (error) {
      alert('Sign out failed')
      return
    }
    
    alert(`Signed out at ${new Date().toLocaleTimeString()}`)
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

  // Login Page
  if (!currentUser) {
    return (
      <div className="login-container">
        <div className="login-box">
          <div className="logo-container">
            <div className="logo-shield">
              <Image 
                src="/main-logo-1.png" 
                alt="FleetTrack Logo" 
                width={60} 
                height={60}
                className="object-contain"
              />
            </div>
          </div>
          
          <h1 className="text-3xl font-bold text-center mb-2 text-white">Sign in</h1>
          <p className="text-center text-gray-400 mb-8">Welcome back to FleetTrack</p>
          
          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-300">Email</label>
              <input
                type="text"
                value={loginForm.user_id}
                onChange={(e) => setLoginForm({ ...loginForm, user_id: e.target.value })}
                className="input-field"
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
                  className="input-field pr-12"
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
              className="btn-primary w-full"
            >
              {loading ? 'Signing in...' : 'Login'}
            </button>
          </form>
          
          <div className="mt-8 pt-6 border-t border-gray-700">
            <p className="text-center text-sm text-gray-400 mb-3">Demo Credentials:</p>
            <div className="space-y-2 text-xs text-center">
              <div className="bg-gray-800 rounded-lg p-2">
                <span className="text-gray-400">Admin:</span> <span className="text-blue-400 font-mono">admin / admin123</span>
              </div>
              <div className="bg-gray-800 rounded-lg p-2">
                <span className="text-gray-400">Employee:</span> <span className="text-blue-400 font-mono">emp001 / emp123</span>
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
    <div className="min-h-screen bg-[#0f0f10] text-white">
      {/* Glassmorphic Sidebar */}
      <div className={`sidebar ${sidebarCollapsed ? 'w-20' : 'w-64'} transition-all duration-300`}>
        {/* Sidebar Toggle Button */}
        <button
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className="sidebar-toggle"
          title={sidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
        >
          {sidebarCollapsed ? <ChevronRight className="w-4 h-4 text-white" /> : <ChevronLeft className="w-4 h-4 text-white" />}
        </button>

        <div className="p-6">
          <div className="flex items-center gap-3 mb-8">
            {!sidebarCollapsed ? (
              <>
                <Shield className="w-8 h-8 text-blue-500 animate-glow" />
                <div>
                  <span className="text-xl font-bold">FleetTrack</span>
                  <p className="text-xs text-gray-400">Pro CRM</p>
                </div>
              </>
            ) : (
              <Shield className="w-8 h-8 text-blue-500 mx-auto animate-glow" />
            )}
          </div>
          
          <nav className="space-y-2">
            {(isAdmin ? [
              { id: 'dashboard', label: 'Dashboard', icon: Home },
              { id: 'clients', label: 'Clients', icon: Users },
              { id: 'employees', label: 'Employees', icon: UserCheck },
              { id: 'tasks', label: 'Tasks', icon: ClipboardCheck },
              { id: 'attendance', label: 'Attendance', icon: Clock },
              { id: 'leaves', label: 'Leaves', icon: Calendar, badge: leaveRequests.length },
              { id: 'roster', label: 'Roster', icon: BarChart3 }
            ] : [
              { id: 'dashboard', label: 'Dashboard', icon: Home },
              { id: 'my-tasks', label: 'My Tasks', icon: ClipboardCheck },
              { id: 'my-clients', label: 'My Clients', icon: Users },
              { id: 'my-roster', label: 'My Roster', icon: Calendar },
              { id: 'request-leave', label: 'Leave Request', icon: FileText }
            ]).map((item) => {
              const Icon = item.icon
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveSection(item.id)}
                  className={`sidebar-item w-full ${activeSection === item.id ? 'active' : ''}`}
                  title={sidebarCollapsed ? item.label : ''}
                >
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  {!sidebarCollapsed && <span>{item.label}</span>}
                  {item.badge && item.badge > 0 && !sidebarCollapsed && (
                    <span className="ml-auto bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center animate-pulse">
                      {item.badge}
                    </span>
                  )}
                </button>
              )
            })}
          </nav>
        </div>
        
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-800">
          <button
            onClick={handleLogout}
            className="sidebar-item w-full text-red-400 hover:text-red-300 hover:bg-red-500/10"
            title={sidebarCollapsed ? "Logout" : ''}
          >
            <LogOut className="w-5 h-5" />
            {!sidebarCollapsed && <span>Logout</span>}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className={`${sidebarCollapsed ? 'ml-20' : 'ml-64'} transition-all duration-300`}>
        {/* Header */}
        <div className="header sticky top-0 z-40">
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
                  <button onClick={handleSignIn} className="btn-success text-sm">
                    <Clock className="w-4 h-4 inline mr-2" />
                    Sign In
                  </button>
                  <button onClick={handleSignOut} className="btn-secondary text-sm">
                    <Clock className="w-4 h-4 inline mr-2" />
                    Sign Out
                  </button>
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
              
              <div className="flex items-center gap-3 px-3 py-2 bg-gray-800 rounded-lg">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white font-semibold">
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
                <div className="space-y-6">
                  {/* Clickable Metrics */}
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
                            <Icon className="w-8 h-8 opacity-70" />
                          </div>
                          <div className="text-xs opacity-90 mb-1">{metric.subtext}</div>
                          <div className="text-sm opacity-80 flex items-center justify-between">
                            <span>{metric.label}</span>
                            <ArrowRight className="w-4 h-4 opacity-60" />
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {/* Live Attendance Dashboard - Clickable */}
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
                          <div className="text-4xl mb-2">{stat.icon}</div>
                          <div className="text-3xl font-bold">{stat.count}</div>
                          <div className="text-sm opacity-90 mt-1">{stat.label}</div>
                        </div>
                      ))}
                    </div>

                    {/* Late Employees Alert - Clickable */}
                    {attendance.filter(a => a.status === 'late').length > 0 && (
                      <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-4 mb-4">
                        <h4 className="font-bold text-orange-400 mb-3 flex items-center gap-2">
                          <AlertTriangle className="w-5 h-5" />
                          Late Arrivals ({attendance.filter(a => a.status === 'late').length})
                        </h4>
                        <div className="space-y-2">
                          {attendance.filter(a => a.status === 'late').slice(0, 3).map((att) => {
                            const emp = employees.find(e => e.id === att.employee_id)
                            return (
                              <div 
                                key={att.id} 
                                onClick={() => setActiveSection('attendance')}
                                className="flex items-center justify-between bg-gray-800/50 rounded p-3 cursor-pointer hover:bg-gray-800 transition-colors"
                              >
                                <div>
                                  <div className="font-semibold">{emp?.full_name || 'Employee'}</div>
                                  <div className="text-sm text-gray-400">Scheduled: {att.scheduled_time}</div>
                                </div>
                                <div className="text-right">
                                  <div className="font-bold text-red-400 text-lg">{att.late_by_minutes} min late</div>
                                  <div className="text-sm text-gray-400">{new Date(att.sign_in_time!).toLocaleTimeString()}</div>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    {/* Quick Actions */}
                    <div className="grid grid-cols-3 gap-4 mt-6">
                      <button 
                        onClick={() => openModal('addClient')}
                        className="dark-card-clickable p-4 text-center"
                      >
                        <Plus className="w-8 h-8 mx-auto mb-2 text-blue-500" />
                        <div className="font-semibold">Add Client</div>
                      </button>
                      <button 
                        onClick={() => openModal('addEmployee')}
                        className="dark-card-clickable p-4 text-center"
                      >
                        <Plus className="w-8 h-8 mx-auto mb-2 text-purple-500" />
                        <div className="font-semibold">Add Employee</div>
                      </button>
                      <button 
                        onClick={() => openModal('addTask')}
                        className="dark-card-clickable p-4 text-center"
                      >
                        <Plus className="w-8 h-8 mx-auto mb-2 text-green-500" />
                        <div className="font-semibold">Create Task</div>
                      </button>
                    </div>
                  </div>

                  {/* Recent Activity */}
                  <div className="dark-card p-6">
                    <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                      <Activity className="w-6 h-6 text-blue-500" />
                      Recent Activity
                    </h3>
                    <div className="space-y-3">
                      {tasks.slice(0, 5).map((task) => (
                        <div 
                          key={task.id}
                          onClick={() => setActiveSection('tasks')}
                          className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg hover:bg-gray-800 transition-colors cursor-pointer interactive-hover"
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-2 h-2 rounded-full ${
                              task.priority === 'urgent' ? 'bg-red-500' :
                              task.priority === 'high' ? 'bg-orange-500' :
                              'bg-blue-500'
                            } animate-pulse`}></div>
                            <div>
                              <div className="font-semibold">{task.title}</div>
                              <div className="text-sm text-gray-400">{task.description?.slice(0, 50)}...</div>
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

              {activeSection === 'clients' && (
                <div>
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold">Clients Management</h2>
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
                                <p className="text-gray-400">Email</p>
                                <p className="font-medium">{client.email}</p>
                              </div>
                              <div>
                                <p className="text-gray-400">Phone</p>
                                <p className="font-medium">{client.phone}</p>
                              </div>
                              <div>
                                <p className="text-gray-400">Vehicles</p>
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
                <div>
                  <div className="flex justify-between items-center mb-6">
                    <div>
                      <button
                        onClick={() => setActiveSection('clients')}
                        className="text-blue-500 hover:text-blue-400 mb-2 flex items-center gap-2 transition-colors"
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
                            <td className="px-6 py-4 font-medium">{vehicle.vehicle_number}</td>
                            <td className="px-6 py-4">
                              <div>
                                <div className="font-medium">{vehicle.driver_name}</div>
                                <div className="text-sm text-gray-400">{vehicle.driver_phone}</div>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <select
                                value={vehicle.status}
                                onChange={(e) => updateVehicleStatus(vehicle.id, 'status', e.target.value)}
                                className={`px-3 py-1 rounded-lg text-sm font-medium cursor-pointer border-2 bg-transparent ${
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
                                  className="px-3 py-1 border-2 border-gray-600 bg-gray-800 rounded-lg text-sm"
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
                <div>
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold">Employees Management</h2>
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
                            <p className="text-gray-400">{emp.email}</p>
                            <div className="grid grid-cols-3 gap-4 mt-3 text-sm">
                              <div>
                                <p className="text-gray-400">User ID</p>
                                <p className="font-medium">{emp.user_id}</p>
                              </div>
                              <div>
                                <p className="text-gray-400">Shift Time</p>
                                <p className="font-medium">{emp.shift_start} - {emp.shift_end}</p>
                              </div>
                              <div>
                                <p className="text-gray-400">Phone</p>
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
                <div>
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
                              <span className="text-gray-400">Due: {task.due_date}</span>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-2xl font-bold text-blue-500">{task.completion_percentage}%</div>
                            <div className="text-sm text-gray-400">Complete</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeSection === 'attendance' && (
                <div>
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
                              <td className="px-6 py-4 font-medium">{emp?.full_name || 'Employee'}</td>
                              <td className="px-6 py-4">{att.sign_in_time ? new Date(att.sign_in_time).toLocaleTimeString() : '-'}</td>
                              <td className="px-6 py-4">{att.sign_out_time ? new Date(att.sign_out_time).toLocaleTimeString() : 'Working...'}</td>
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
                                  <span className="text-red-400 font-semibold">{att.late_by_minutes} min</span>
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
                <div>
                  <h2 className="text-2xl font-bold mb-6">Leave Requests ({leaveRequests.length} Pending)</h2>
                  <div className="grid gap-4">
                    {leaveRequests.map((leave) => {
                      const emp = employees.find(e => e.id === leave.employee_id)
                      return (
                        <div key={leave.id} className="dark-card p-6">
                          <div className="flex justify-between items-start">
                            <div>
                              <h3 className="text-lg font-bold">{emp?.full_name || 'Employee'}</h3>
                              <p className="text-gray-400">{leave.leave_type} Leave</p>
                              <p className="text-sm text-gray-500 mt-2">
                                {leave.from_date} to {leave.to_date} ({leave.total_days} days)
                              </p>
                              <p className="mt-2 text-gray-300">{leave.reason}</p>
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
                <div>
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
                        className={`dark-card p-4 text-left transition-all ${
                          selectedEmployee?.id === emp.id
                            ? 'ring-2 ring-blue-500'
                            : ''
                        }`}
                      >
                        <div className="font-bold">{emp.full_name}</div>
                        <div className="text-sm text-gray-400">{emp.shift_start} - {emp.shift_end}</div>
                      </button>
                    ))}
                  </div>

                  {selectedEmployee && roster.length > 0 && (
                    <div className="dark-card p-6">
                      <h3 className="text-lg font-bold mb-4">{selectedEmployee.full_name}'s Roster</h3>
                      <div className="grid grid-cols-7 gap-2">
                        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                          <div key={day} className="text-center font-bold text-sm text-gray-400 py-2">
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
                                  ? 'bg-gradient-to-br from-green-500 to-green-600 text-white border-2 border-green-400'
                                  : 'bg-gradient-to-br from-red-500 to-red-600 text-white border-2 border-red-400'
                              }`}
                            >
                              <div className="font-bold text-lg">{date.getDate()}</div>
                              <div className="text-xs mt-1">{day.is_working_day ? '✓ Working' : '✗ OFF'}</div>
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
                <div className="space-y-6">
                  <div className="dark-card p-6">
                    <h3 className="text-lg font-bold mb-4">Today's Shift</h3>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-gray-400">Shift Timing</p>
                        <p className="text-3xl font-bold">{currentUser.shift_start} - {currentUser.shift_end}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-gray-400">Status</p>
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
                      { value: clients.length, label: 'Assigned Clients', color: 'from-indigo-500 to-indigo-600', onClick: () => setActiveSection('my-clients') },
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
                <div>
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
                              <span className="text-gray-400">Due: {task.due_date}</span>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-3xl font-bold text-blue-500">{task.completion_percentage}%</div>
                            <div className="text-sm text-gray-400">Complete</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeSection === 'my-clients' && (
                <div>
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
                            <p className="text-gray-400">{client.email}</p>
                            <p className="text-sm text-gray-500 mt-2">{client.total_vehicles} vehicles</p>
                          </div>
                          <div className="text-right">
                            <div className="text-5xl font-bold text-blue-500">{client.completion_percentage}%</div>
                            <p className="text-sm text-gray-400">Completion</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeSection === 'client-vehicles' && selectedClient && (
                <div>
                  <button onClick={() => setActiveSection('my-clients')} className="text-blue-500 hover:text-blue-400 mb-4 flex items-center gap-2 transition-colors">
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
                          <th className="table-header">Alerts (24h)</th>
                          <th className="table-header">Video</th>
                          <th className="table-header">Offline Reason</th>
                        </tr>
                      </thead>
                      <tbody>
                        {vehicles.map((vehicle) => (
                          <tr key={vehicle.id} className="table-row">
                            <td className="px-6 py-4 font-medium">{vehicle.vehicle_number}</td>
                            <td className="px-6 py-4">
                              <div>
                                <div className="font-medium">{vehicle.driver_name}</div>
                                <div className="text-sm text-gray-400">{vehicle.driver_phone}</div>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <select
                                value={vehicle.status}
                                onChange={(e) => updateVehicleStatus(vehicle.id, 'status', e.target.value)}
                                className={`px-3 py-1 rounded-lg text-sm font-medium cursor-pointer border-2 bg-transparent ${
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
                                  className="px-3 py-1 border-2 border-gray-600 bg-gray-800 rounded-lg text-sm"
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

              {activeSection === 'my-roster' && (
                <div>
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
                          <div key={day} className="text-center font-bold text-sm text-gray-400 py-2">
                            {day}
                          </div>
                        ))}
                        {roster.slice(0, 35).map((day, idx) => {
                          const date = new Date(day.date)
                          return (
                            <div
                              key={idx}
                              className={`p-3 rounded-lg text-center transition-all ${
                                day.is_working_day
                                  ? 'bg-gradient-to-br from-green-500 to-green-600 text-white border-2 border-green-400'
                                  : 'bg-gradient-to-br from-red-500 to-red-600 text-white border-2 border-red-400'
                              }`}
                            >
                              <div className="font-bold text-sm">{date.toLocaleDateString('en-US', { weekday: 'short' })}</div>
                              <div className="text-xl font-bold">{date.getDate()}</div>
                              <div className="text-xs mt-1 font-semibold">{day.is_working_day ? '✓ Working' : '✗ OFF'}</div>
                              {day.is_working_day && (
                                <div className="text-xs mt-1 opacity-80">
                                  {day.shift_start?.slice(0, 5)}-{day.shift_end?.slice(0, 5)}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeSection === 'request-leave' && (
                <div className="max-w-2xl mx-auto">
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
        </>
      )}
    </div>
  )
}
