'use client'

import React, { useState, useEffect } from 'react'
import { 
  Users, Truck, UserCheck, CheckCircle, AlertTriangle, Activity, Plus, Upload, 
  ClipboardCheck, Calendar, BarChart3, Bell, Search, Download, LogOut, Clock,
  FileText, TrendingUp, X, Check, Edit, Trash2, Eye, Settings, Home, Zap, ChevronLeft, ChevronRight
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
  const [scrollY, setScrollY] = useState(0)
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 })
  
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

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY)
    const handleMouseMove = (e: MouseEvent) => setMousePosition({ x: e.clientX, y: e.clientY })
    
    window.addEventListener('scroll', handleScroll)
    window.addEventListener('mousemove', handleMouseMove)
    
    return () => {
      window.removeEventListener('scroll', handleScroll)
      window.removeEventListener('mousemove', handleMouseMove)
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
    
    setCurrentUser(user)
    setLoading(false)
  }

  const handleLogout = () => {
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
    
    // Delete existing roster for the month
    await supabase
      .from('employee_roster')
      .delete()
      .eq('employee_id', employeeId)
      .gte('date', new Date(year, month, 1).toISOString())
      .lte('date', new Date(year, month + 1, 0).toISOString())
    
    // Insert new roster
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
      <div className="min-h-screen bg-gradient-to-br from-blue-900 via-indigo-900 to-purple-900 flex items-center justify-center p-4 relative overflow-hidden">
        <div 
          className="fixed inset-0 opacity-30 pointer-events-none"
          style={{
            background: `radial-gradient(circle at ${mousePosition.x}px ${mousePosition.y}px, rgba(59, 130, 246, 0.3), transparent 40%)`
          }}
        />
        
        <div className="w-full max-w-md relative z-10">
          <div className="text-center mb-8 animate-fade-in">
            <div className="flex items-center justify-center gap-3 mb-4">
              <div className="relative">
                <Truck className="w-16 h-16 text-blue-400 animate-pulse" />
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-400 rounded-full animate-ping" />
              </div>
            </div>
            <h1 className="text-5xl font-bold text-white mb-2">
              FleetTrack
            </h1>
            <p className="text-blue-200 text-lg">Pro Enterprise CRM</p>
          </div>

          <div 
            className="rounded-2xl p-8 shadow-2xl animate-slide-in backdrop-blur-xl bg-white/10 border border-white/20"
          >
            <h2 className="text-2xl font-bold mb-6 text-center text-white">Sign In</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2 text-blue-100">User ID</label>
                <input
                  type="text"
                  value={loginForm.user_id}
                  onChange={(e) => setLoginForm({ ...loginForm, user_id: e.target.value })}
                  className="w-full px-4 py-3 bg-white/20 border border-white/30 rounded-lg text-white placeholder-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-400 backdrop-blur-sm"
                  placeholder="Enter your user ID"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2 text-blue-100">Password</label>
                <input
                  type="password"
                  value={loginForm.password}
                  onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                  className="w-full px-4 py-3 bg-white/20 border border-white/30 rounded-lg text-white placeholder-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-400 backdrop-blur-sm"
                  placeholder="Enter your password"
                  required
                />
              </div>
              <button
                onClick={handleLogin}
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-semibold transition-all shadow-lg hover:shadow-xl"
              >
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
            </div>
            <div className="mt-6 text-center text-sm text-blue-100">
              <p className="font-semibold mb-2">Demo Credentials:</p>
              <div className="space-y-1 text-xs">
                <p><strong>Admin:</strong> admin / admin123</p>
                <p><strong>Employee:</strong> emp001 / emp123</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const metrics = [
    { value: clients.length, label: 'Total Clients', subtext: '↗ 25% growth', icon: Users, color: 'from-blue-500 to-blue-700' },
    { value: vehicles.length, label: 'Fleet Size', subtext: `+${vehicles.filter(v => new Date(v.created_at!).getMonth() === new Date().getMonth()).length} this month`, icon: Truck, color: 'from-indigo-500 to-indigo-700' },
    { value: employees.length, label: 'Team Members', subtext: 'All active', icon: UserCheck, color: 'from-purple-500 to-purple-700' },
    { value: vehicles.filter(v => v.status === 'online').length, label: 'Online Vehicles', subtext: `${Math.round((vehicles.filter(v => v.status === 'online').length / vehicles.length) * 100) || 0}% uptime`, icon: CheckCircle, color: 'from-green-500 to-green-700' },
    { value: `${Math.round((tasks.filter(t => t.status === 'completed').length / tasks.length) * 100) || 0}%`, label: 'Completion Rate', subtext: '↗ +12% weekly', icon: BarChart3, color: 'from-cyan-500 to-cyan-700' },
    { value: leaveRequests.length, label: 'Pending Leaves', subtext: 'Needs review', icon: AlertTriangle, color: 'from-red-500 to-red-700' }
  ]

  const isAdmin = currentUser.role === 'admin'

  return (
    <div className={`min-h-screen ${isAdmin ? 'bg-gray-50' : 'bg-gradient-to-br from-blue-900 via-indigo-900 to-purple-900'} relative overflow-x-hidden`}>
      {isAdmin && (
        <>
          <div 
            className="fixed inset-0 opacity-10 pointer-events-none"
            style={{
              background: 'radial-gradient(circle at 20% 50%, rgba(59, 130, 246, 0.3), transparent 50%), radial-gradient(circle at 80% 50%, rgba(147, 51, 234, 0.3), transparent 50%)'
            }}
          />
          
          <div 
            className="fixed inset-0 opacity-10 pointer-events-none"
            style={{
              background: `radial-gradient(circle at ${mousePosition.x}px ${mousePosition.y}px, rgba(59, 130, 246, 0.2), transparent 40%)`
            }}
          />
        </>
      )}

      {/* Header */}
      <div 
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
          isAdmin ? 'border-b' : ''
        }`}
        style={isAdmin ? {
          background: scrollY > 50 
            ? 'linear-gradient(to bottom, rgba(255, 255, 255, 0.5), rgba(255, 255, 255, 0.3))' 
            : 'linear-gradient(to bottom, rgba(255, 255, 255, 0.7), rgba(255, 255, 255, 0.5))',
          backdropFilter: `blur(${Math.min(scrollY / 3 + 25, 50)}px) saturate(200%) brightness(105%)`,
          WebkitBackdropFilter: `blur(${Math.min(scrollY / 3 + 25, 50)}px) saturate(200%) brightness(105%)`,
          boxShadow: scrollY > 50 
            ? '0 8px 32px rgba(59, 130, 246, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.8)' 
            : '0 4px 24px rgba(59, 130, 246, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.9)',
          borderColor: 'rgba(255, 255, 255, 0.3)'
        } : {
          background: 'rgba(30, 58, 138, 0.8)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)'
        }}
      >
        <div className="px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Truck className={`w-8 h-8 ${isAdmin ? 'text-blue-600' : 'text-blue-400'} animate-pulse`} />
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full animate-ping" />
            </div>
            <div>
              <h1 className={`text-2xl font-bold ${isAdmin ? 'bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent' : 'text-white'}`}>
                FleetTrack {isAdmin ? 'Admin' : 'Employee'}
              </h1>
              <div className={`flex items-center gap-3 text-sm ${isAdmin ? 'text-gray-500' : 'text-blue-200'}`}>
                <span className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  Live
                </span>
                <span>{new Date().toLocaleString()}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {!isAdmin && (
              <>
                <button onClick={handleSignIn} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-all shadow-lg">
                  <Clock className="w-4 h-4" />
                  Sign In
                </button>
                <button onClick={handleSignOut} className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-all shadow-lg">
                  <Clock className="w-4 h-4" />
                  Sign Out
                </button>
              </>
            )}
            {isAdmin && (
              <>
                <div className="text-right group cursor-pointer">
                  <div className="text-sm text-gray-500 group-hover:text-gray-700 transition-colors">System Health</div>
                  <div className="text-xl font-bold text-green-600 group-hover:scale-110 transition-transform">98.7%</div>
                </div>
                <div className="relative cursor-pointer group">
                  <Bell className="w-5 h-5 text-gray-400 group-hover:text-blue-600 transition-colors" />
                  {leaveRequests.length > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-semibold animate-pulse">
                      {leaveRequests.length}
                    </span>
                  )}
                </div>
              </>
            )}
            <div className="flex items-center gap-2 cursor-pointer group">
              <div className={`w-10 h-10 ${isAdmin ? 'bg-gradient-to-br from-blue-500 to-purple-600' : 'bg-gradient-to-br from-blue-400 to-indigo-500'} rounded-full flex items-center justify-center text-white font-semibold shadow-lg group-hover:shadow-xl group-hover:scale-110 transition-all`}>
                {currentUser.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
              </div>
              <div>
                <div className={`font-semibold text-sm ${isAdmin ? 'group-hover:text-blue-600' : 'text-white'} transition-colors`}>{currentUser.full_name}</div>
                <div className={`text-xs ${isAdmin ? 'text-gray-500' : 'text-blue-200'}`}>{isAdmin ? 'Super Admin' : 'Employee'}</div>
              </div>
            </div>
            <button 
              onClick={handleLogout}
              className={`w-10 h-10 ${isAdmin ? 'bg-gradient-to-br from-red-500 to-pink-600' : 'bg-red-600'} rounded-full flex items-center justify-center text-white hover:shadow-lg hover:scale-110 transition-all`}
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Navigation */}
        <div 
          className="px-6 overflow-x-auto"
          style={isAdmin ? {
            background: 'linear-gradient(to bottom, rgba(255, 255, 255, 0.4), rgba(255, 255, 255, 0.2))',
            backdropFilter: 'blur(40px) saturate(180%) brightness(110%)',
            WebkitBackdropFilter: 'blur(40px) saturate(180%) brightness(110%)',
            borderTop: '1px solid rgba(255, 255, 255, 0.2)',
            boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.5)'
          } : {
            background: 'rgba(30, 58, 138, 0.5)',
            backdropFilter: 'blur(20px)',
            borderTop: '1px solid rgba(255, 255, 255, 0.1)'
          }}
        >
          <div className="flex gap-2">
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
                  className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-all relative group ${
                    activeSection === item.id
                      ? isAdmin 
                        ? 'border-blue-600 text-blue-600'
                        : 'border-blue-400 text-white bg-blue-800/50'
                      : isAdmin
                        ? 'border-transparent text-gray-600 hover:text-blue-600'
                        : 'border-transparent text-blue-100 hover:text-white hover:bg-blue-800/30'
                  }`}
                  style={activeSection === item.id && isAdmin ? {
                    background: 'linear-gradient(to bottom, rgba(59, 130, 246, 0.15), rgba(147, 51, 234, 0.1))',
                    backdropFilter: 'blur(10px)',
                    WebkitBackdropFilter: 'blur(10px)',
                    boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.5)'
                  } : {}}
                >
                  <Icon className={`w-4 h-4 transition-transform ${activeSection === item.id ? 'scale-110' : 'group-hover:scale-110'}`} />
                  <span className="text-sm font-medium whitespace-nowrap">{item.label}</span>
                  {item.badge && item.badge > 0 && (
                    <span className="absolute -top-1 -right-1 bg-gradient-to-r from-red-500 to-pink-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-semibold animate-bounce shadow-lg">
                      {item.badge}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="pt-32 px-6 py-6">
        {isAdmin ? (
          <>
            {activeSection === 'dashboard' && (
              <div className="space-y-6">
                <div className="grid grid-cols-6 gap-4">
                  {metrics.map((metric, idx) => {
                    const Icon = metric.icon
                    return (
                      <div
                        key={idx}
                        className={`bg-gradient-to-br ${metric.color} text-white rounded-xl p-5 shadow-lg hover:shadow-2xl transform hover:scale-105 hover:-translate-y-1 transition-all duration-300 cursor-pointer group relative overflow-hidden`}
                      >
                        <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                        <div className="relative">
                          <div className="flex items-center justify-between mb-2">
                            <div className="text-4xl font-bold group-hover:scale-110 transition-transform">{metric.value}</div>
                            <Icon className="w-8 h-8 opacity-70 group-hover:opacity-100 group-hover:rotate-12 transition-all" />
                          </div>
                          <div className="text-sm mb-1 opacity-90">{metric.subtext}</div>
                          <div className="text-xs opacity-80">{metric.label}</div>
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Live Attendance Dashboard */}
                <div className="glass rounded-xl p-6 shadow-lg">
                  <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                    <Clock className="w-6 h-6 text-blue-600" />
                    Today's Live Attendance
                  </h3>
                  <div className="grid grid-cols-4 gap-4 mb-6">
                    {[
                      { label: 'Present', count: attendance.filter(a => a.status === 'present').length, color: 'from-green-500 to-green-700', icon: '✓' },
                      { label: 'Late', count: attendance.filter(a => a.status === 'late').length, color: 'from-orange-500 to-orange-700', icon: '⚠' },
                      { label: 'Absent', count: employees.length - attendance.length, color: 'from-red-500 to-red-700', icon: '✗' },
                      { label: 'On Leave', count: attendance.filter(a => a.status === 'on_leave').length, color: 'from-purple-500 to-purple-700', icon: '📅' }
                    ].map((stat, idx) => (
                      <div key={idx} className={`bg-gradient-to-br ${stat.color} text-white rounded-lg p-4 text-center hover:shadow-lg transition-all transform hover:scale-105`}>
                        <div className="text-4xl mb-2">{stat.icon}</div>
                        <div className="text-3xl font-bold">{stat.count}</div>
                        <div className="text-sm opacity-90 mt-1">{stat.label}</div>
                      </div>
                    ))}
                  </div>

                  {/* Late Employees Alert */}
                  {attendance.filter(a => a.status === 'late').length > 0 && (
                    <div className="bg-gradient-to-r from-orange-50 to-red-50 rounded-lg p-4 border-l-4 border-orange-500">
                      <h4 className="font-bold text-orange-900 mb-3 flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5" />
                        Late Arrivals ({attendance.filter(a => a.status === 'late').length})
                      </h4>
                      <div className="space-y-2">
                        {attendance.filter(a => a.status === 'late').map((att) => {
                          const emp = employees.find(e => e.id === att.employee_id)
                          return (
                            <div key={att.id} className="flex items-center justify-between bg-white/70 rounded p-3">
                              <div>
                                <div className="font-semibold">{emp?.full_name || 'Employee'}</div>
                                <div className="text-sm text-gray-600">Scheduled: {att.scheduled_time}</div>
                              </div>
                              <div className="text-right">
                                <div className="font-bold text-red-600 text-lg">{att.late_by_minutes} min late</div>
                                <div className="text-sm text-gray-600">{new Date(att.sign_in_time!).toLocaleTimeString()}</div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* Absent Employees */}
                  {(employees.length - attendance.length) > 0 && (
                    <div className="bg-gradient-to-r from-red-50 to-pink-50 rounded-lg p-4 border-l-4 border-red-500 mt-4">
                      <h4 className="font-bold text-red-900 mb-3 flex items-center gap-2">
                        <X className="w-5 h-5" />
                        Not Signed In Yet ({employees.length - attendance.length})
                      </h4>
                      <div className="grid grid-cols-3 gap-2">
                        {employees.filter(emp => !attendance.find(a => a.employee_id === emp.id)).map((emp) => (
                          <div key={emp.id} className="bg-white/70 rounded p-2 text-sm">
                            <div className="font-semibold">{emp.full_name}</div>
                            <div className="text-xs text-gray-600">Expected: {emp.shift_start}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeSection === 'clients' && (
              <div>
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-bold">Clients Management</h2>
                  <button onClick={() => openModal('addClient')} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow-lg transition-all">
                    <Plus className="w-4 h-4" />
                    Add Client
                  </button>
                </div>
                <div className="grid gap-4">
                  {clients.map((client) => (
                    <div key={client.id} className="glass rounded-xl p-6 shadow-md hover:shadow-xl transition-all">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h3 className="text-xl font-bold mb-2">{client.name}</h3>
                          <div className="grid grid-cols-3 gap-4 text-sm">
                            <div>
                              <p className="text-gray-500">Email</p>
                              <p className="font-medium">{client.email}</p>
                            </div>
                            <div>
                              <p className="text-gray-500">Phone</p>
                              <p className="font-medium">{client.phone}</p>
                            </div>
                            <div>
                              <p className="text-gray-500">Vehicles</p>
                              <p className="font-medium">{client.total_vehicles}</p>
                            </div>
                          </div>
                          <div className="mt-4">
                            <div className="flex items-center gap-2">
                              <div className="progress-bar flex-1">
                                <div
                                  className="progress-fill bg-gradient-to-r from-green-500 to-emerald-500 transition-all duration-1000"
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
                            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-all shadow-lg"
                          >
                            <Eye className="w-4 h-4" />
                            Vehicles
                          </button>
                          <label className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 cursor-pointer transition-all shadow-lg">
                            <Upload className="w-4 h-4" />
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
                      className="text-blue-600 hover:text-blue-700 mb-2 flex items-center gap-2"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      Back to Clients
                    </button>
                    <h2 className="text-2xl font-bold">{selectedClient.name} - Vehicles</h2>
                  </div>
                  <button
                    onClick={() => openModal('addVehicle')}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow-lg transition-all"
                  >
                    <Plus className="w-4 h-4" />
                    Add Vehicle
                  </button>
                </div>
                <div className="glass rounded-xl shadow-md overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-blue-50">
                      <tr>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase">Vehicle #</th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase">Driver</th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase">Status</th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase">Alerts (24h)</th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase">Video</th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase">Offline Reason</th>
                      </tr>
                    </thead>
                    <tbody>
                      {vehicles.map((vehicle) => (
                        <tr key={vehicle.id} className="border-b hover:bg-blue-50/50 transition-colors">
                          <td className="px-6 py-4 font-medium">{vehicle.vehicle_number}</td>
                          <td className="px-6 py-4">
                            <div>
                              <div className="font-medium">{vehicle.driver_name}</div>
                              <div className="text-sm text-gray-500">{vehicle.driver_phone}</div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <select
                              value={vehicle.status}
                              onChange={(e) => updateVehicleStatus(vehicle.id, 'status', e.target.value)}
                              className={`px-3 py-1 rounded-lg text-sm font-medium cursor-pointer border-2 ${
                                vehicle.status === 'online' ? 'bg-green-50 border-green-200 text-green-800' :
                                vehicle.status === 'offline' ? 'bg-red-50 border-red-200 text-red-800' :
                                'bg-yellow-50 border-yellow-200 text-yellow-800'
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
                              className="w-5 h-5 cursor-pointer accent-blue-600"
                            />
                          </td>
                          <td className="px-6 py-4">
                            <input
                              type="checkbox"
                              checked={vehicle.video_recording}
                              onChange={(e) => updateVehicleStatus(vehicle.id, 'video_recording', e.target.checked)}
                              className="w-5 h-5 cursor-pointer accent-blue-600"
                            />
                          </td>
                          <td className="px-6 py-4">
                            {vehicle.status === 'offline' && (
                              <select
                                value={vehicle.offline_reason || ''}
                                onChange={(e) => updateVehicleStatus(vehicle.id, 'offline_reason', e.target.value)}
                                className="px-3 py-1 border-2 border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
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
                      className="p-2 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200"
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
                      className="p-2 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </div>
                  {selectedEmployee && (
                    <button
                      onClick={() => generateMonthRoster(selectedEmployee.id)}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow-lg transition-all"
                    >
                      <Calendar className="w-4 h-4" />
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
                      className={`glass rounded-lg p-4 text-left transition-all ${
                        selectedEmployee?.id === emp.id
                          ? 'ring-2 ring-blue-600 shadow-lg'
                          : 'hover:shadow-lg'
                      }`}
                    >
                      <div className="font-bold">{emp.full_name}</div>
                      <div className="text-sm text-gray-600">{emp.shift_start} - {emp.shift_end}</div>
                    </button>
                  ))}
                </div>

                {selectedEmployee && roster.length > 0 && (
                  <div className="glass rounded-xl p-6 shadow-md">
                    <h3 className="text-lg font-bold mb-4">{selectedEmployee.full_name}'s Roster</h3>
                    <div className="grid grid-cols-7 gap-2">
                      {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                        <div key={day} className="text-center font-bold text-sm text-gray-600 py-2">
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
                                ? 'bg-gradient-to-br from-green-400 to-green-600 text-white border-2 border-green-700'
                                : 'bg-gradient-to-br from-red-400 to-red-600 text-white border-2 border-red-700'
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

            {activeSection === 'employees' && (
              <div>
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-bold">Employees Management</h2>
                  <button
                    onClick={() => openModal('addEmployee')}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow-lg transition-all"
                  >
                    <Plus className="w-4 h-4" />
                    Add Employee
                  </button>
                </div>
                <div className="grid gap-4">
                  {employees.map((emp) => (
                    <div key={emp.id} className="glass rounded-xl p-6 shadow-md hover:shadow-lg transition-all">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h3 className="text-xl font-bold">{emp.full_name}</h3>
                          <p className="text-gray-600">{emp.email}</p>
                          <div className="grid grid-cols-3 gap-4 mt-3 text-sm">
                            <div>
                              <p className="text-gray-500">User ID</p>
                              <p className="font-medium">{emp.user_id}</p>
                            </div>
                            <div>
                              <p className="text-gray-500">Shift Time</p>
                              <p className="font-medium">{emp.shift_start} - {emp.shift_end}</p>
                            </div>
                            <div>
                              <p className="text-gray-500">Phone</p>
                              <p className="font-medium">{emp.phone}</p>
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button 
                            onClick={() => {
                              setSelectedEmployee(emp)
                              setActiveSection('roster')
                              loadEmployeeRoster(emp.id)
                            }}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow-lg transition-all"
                          >
                            <Calendar className="w-4 h-4" />
                            Roster
                          </button>
                        </div>
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
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow-lg transition-all"
                  >
                    <Plus className="w-4 h-4" />
                    Create Task
                  </button>
                </div>
                <div className="grid gap-4">
                  {tasks.map((task) => (
                    <div key={task.id} className="glass rounded-xl p-6 shadow-md hover:shadow-lg transition-all">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="text-lg font-bold">{task.title}</h3>
                          <p className="text-gray-600 text-sm mt-1">{task.description}</p>
                          <div className="flex gap-4 mt-3 text-sm">
                            <span className={`badge ${
                              task.priority === 'urgent' ? 'badge-danger' :
                              task.priority === 'high' ? 'badge-warning' :
                              'badge-info'
                            }`}>
                              {task.priority}
                            </span>
                            <span className="text-gray-600">Due: {task.due_date}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-bold text-blue-600">{task.completion_percentage}%</div>
                          <div className="text-sm text-gray-600">Complete</div>
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
                <div className="glass rounded-xl shadow-md overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-blue-50">
                      <tr>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase">Employee</th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase">Sign In</th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase">Sign Out</th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase">Status</th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase">Late By</th>
                      </tr>
                    </thead>
                    <tbody>
                      {attendance.map((att) => {
                        const emp = employees.find(e => e.id === att.employee_id)
                        return (
                          <tr key={att.id} className="border-b hover:bg-blue-50/50">
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
                                <span className="text-red-600 font-semibold">{att.late_by_minutes} min</span>
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
                      <div key={leave.id} className="glass rounded-xl p-6 shadow-md hover:shadow-lg transition-all">
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className="text-lg font-bold">{emp?.full_name || 'Employee'}</h3>
                            <p className="text-gray-600">{leave.leave_type} Leave</p>
                            <p className="text-sm text-gray-500 mt-2">
                              {leave.from_date} to {leave.to_date} ({leave.total_days} days)
                            </p>
                            <p className="mt-2 text-gray-700">{leave.reason}</p>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleApproveLeave(leave.id, true)}
                              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow-lg transition-all"
                            >
                              <Check className="w-4 h-4" />
                              Approve
                            </button>
                            <button
                              onClick={() => handleApproveLeave(leave.id, false)}
                              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow-lg transition-all"
                            >
                              <X className="w-4 h-4" />
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
          </>
        ) : (
          <>
            {activeSection === 'dashboard' && (
              <div className="space-y-6">
                <div className="glass rounded-xl p-6 shadow-md backdrop-blur-xl bg-white/10 border border-white/20">
                  <h3 className="text-lg font-bold mb-4 text-white">Today's Shift</h3>
                  <div className="flex items-center justify-between text-white">
                    <div>
                      <p className="text-blue-200">Shift Timing</p>
                      <p className="text-3xl font-bold">{currentUser.shift_start} - {currentUser.shift_end}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-blue-200">Status</p>
                      <p className="text-2xl font-bold text-green-400">Active</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  {[
                    { value: tasks.filter(t => t.assigned_to === currentUser.id).length, label: 'My Tasks', color: 'from-blue-500 to-blue-700' },
                    { value: clients.length, label: 'Assigned Clients', color: 'from-indigo-500 to-indigo-700' },
                    { value: 0, label: 'Pending Leaves', color: 'from-purple-500 to-purple-700' }
                  ].map((stat, idx) => (
                    <div key={idx} className={`bg-gradient-to-br ${stat.color} text-white rounded-xl p-6 shadow-lg hover:shadow-xl transition-all transform hover:scale-105`}>
                      <p className="text-4xl font-bold">{stat.value}</p>
                      <p className="text-sm opacity-90 mt-2">{stat.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeSection === 'my-tasks' && (
              <div>
                <h2 className="text-2xl font-bold mb-6 text-white">My Tasks</h2>
                <div className="grid gap-4">
                  {tasks.filter(t => t.assigned_to === currentUser.id).map((task) => (
                    <div key={task.id} className="glass rounded-xl p-6 shadow-md backdrop-blur-xl bg-white/10 border border-white/20">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="text-lg font-bold text-white">{task.title}</h3>
                          <p className="text-blue-200 text-sm mt-1">{task.description}</p>
                          <div className="flex gap-4 mt-3 text-sm">
                            <span className={`badge ${
                              task.priority === 'urgent' ? 'badge-danger' :
                              task.priority === 'high' ? 'badge-warning' :
                              'badge-info'
                            }`}>
                              {task.priority}
                            </span>
                            <span className="text-blue-200">Due: {task.due_date}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-3xl font-bold text-blue-400">{task.completion_percentage}%</div>
                          <div className="text-sm text-blue-200">Complete</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeSection === 'my-clients' && (
              <div>
                <h2 className="text-2xl font-bold mb-6 text-white">My Assigned Clients</h2>
                <div className="grid gap-4">
                  {clients.map((client) => (
                    <div
                      key={client.id}
                      onClick={() => { 
                        setSelectedClient(client)
                        loadVehicles(client.id)
                        setActiveSection('client-vehicles')
                      }}
                      className="glass rounded-xl p-6 shadow-md hover:shadow-xl cursor-pointer transition-all backdrop-blur-xl bg-white/10 border border-white/20 transform hover:scale-105"
                    >
                      <div className="flex justify-between items-center">
                        <div>
                          <h3 className="text-xl font-bold text-white">{client.name}</h3>
                          <p className="text-blue-200">{client.email}</p>
                          <p className="text-sm text-blue-300 mt-2">{client.total_vehicles} vehicles</p>
                        </div>
                        <div className="text-right">
                          <div className="text-5xl font-bold text-blue-400">{client.completion_percentage}%</div>
                          <p className="text-sm text-blue-200">Completion</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeSection === 'client-vehicles' && selectedClient && (
              <div>
                <button onClick={() => setActiveSection('my-clients')} className="text-blue-400 hover:text-blue-300 mb-4 flex items-center gap-2">
                  <ChevronLeft className="w-4 h-4" />
                  Back to Clients
                </button>
                <h2 className="text-2xl font-bold mb-6 text-white">{selectedClient.name} - Vehicles</h2>
                <div className="glass rounded-xl shadow-md overflow-hidden backdrop-blur-xl bg-white/10 border border-white/20">
                  <table className="w-full">
                    <thead className="bg-blue-900/50">
                      <tr>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-blue-200 uppercase">Vehicle #</th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-blue-200 uppercase">Driver</th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-blue-200 uppercase">Status</th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-blue-200 uppercase">Alerts (24h)</th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-blue-200 uppercase">Video</th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-blue-200 uppercase">Offline Reason</th>
                      </tr>
                    </thead>
                    <tbody>
                      {vehicles.map((vehicle) => (
                        <tr key={vehicle.id} className="border-b border-white/10 hover:bg-white/5 text-white">
                          <td className="px-6 py-4 font-medium">{vehicle.vehicle_number}</td>
                          <td className="px-6 py-4">
                            <div>
                              <div className="font-medium">{vehicle.driver_name}</div>
                              <div className="text-sm text-blue-200">{vehicle.driver_phone}</div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <select
                              value={vehicle.status}
                              onChange={(e) => updateVehicleStatus(vehicle.id, 'status', e.target.value)}
                              className={`px-3 py-1 rounded-lg text-sm font-medium cursor-pointer border-2 ${
                                vehicle.status === 'online' ? 'bg-green-900/50 border-green-400 text-green-200' :
                                vehicle.status === 'offline' ? 'bg-red-900/50 border-red-400 text-red-200' :
                                'bg-yellow-900/50 border-yellow-400 text-yellow-200'
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
                                className="px-3 py-1 border-2 border-blue-400 rounded-lg text-sm bg-blue-900/50 text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
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
                <h2 className="text-2xl font-bold mb-6 text-white">My Roster</h2>
                <div className="glass rounded-xl p-6 shadow-md backdrop-blur-xl bg-white/10 border border-white/20">
                  <button
                    onClick={() => loadEmployeeRoster(currentUser.id)}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg mb-4 shadow-lg transition-all"
                  >
                    Load My Roster
                  </button>
                  {roster.length > 0 && (
                    <div className="grid grid-cols-7 gap-2">
                      {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                        <div key={day} className="text-center font-bold text-sm text-blue-200 py-2">
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
                                ? 'bg-gradient-to-br from-green-500 to-green-700 text-white border-2 border-green-400'
                                : 'bg-gradient-to-br from-red-500 to-red-700 text-white border-2 border-red-400'
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
                <h2 className="text-2xl font-bold mb-6 text-white">Request Leave</h2>
                <div className="glass rounded-xl p-6 shadow-md backdrop-blur-xl bg-white/10 border border-white/20">
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-2 text-blue-100">Leave Type</label>
                      <select
                        onChange={(e) => setModalData({ ...modalData, leave_type: e.target.value })}
                        className="w-full px-4 py-2 bg-white/20 border border-white/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-400"
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
                        <label className="block text-sm font-medium mb-2 text-blue-100">From Date</label>
                        <input
                          type="date"
                          onChange={(e) => setModalData({ ...modalData, from_date: e.target.value })}
                          className="w-full px-4 py-2 bg-white/20 border border-white/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-400"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2 text-blue-100">To Date</label>
                        <input
                          type="date"
                          onChange={(e) => setModalData({ ...modalData, to_date: e.target.value })}
                          className="w-full px-4 py-2 bg-white/20 border border-white/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-400"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2 text-blue-100">Total Days</label>
                      <input
                        type="number"
                        onChange={(e) => setModalData({ ...modalData, total_days: e.target.value })}
                        className="w-full px-4 py-2 bg-white/20 border border-white/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-400"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2 text-blue-100">Reason</label>
                      <textarea
                        onChange={(e) => setModalData({ ...modalData, reason: e.target.value })}
                        className="w-full px-4 py-2 bg-white/20 border border-white/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-400"
                        rows={4}
                      />
                    </div>
                    <button onClick={handleLeaveRequest} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-semibold shadow-lg transition-all" disabled={loading}>
                      {loading ? 'Submitting...' : 'Submit Leave Request'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modals for Admin */}
      {isAdmin && (
        <>
          {showModal === 'addClient' && (
            <div className="modal-overlay" onClick={closeModal}>
              <div className="glass modal-content" onClick={(e) => e.stopPropagation()}>
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
                    <button onClick={handleAddClient} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex-1" disabled={loading}>
                      {loading ? 'Adding...' : 'Add Client'}
                    </button>
                    <button onClick={closeModal} className="bg-gray-300 hover:bg-gray-400 px-4 py-2 rounded-lg">Cancel</button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {showModal === 'addEmployee' && (
            <div className="modal-overlay" onClick={closeModal}>
              <div className="glass modal-content" onClick={(e) => e.stopPropagation()}>
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
                    <button onClick={handleAddEmployee} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex-1" disabled={loading}>
                      {loading ? 'Adding...' : 'Add Employee'}
                    </button>
                    <button onClick={closeModal} className="bg-gray-300 hover:bg-gray-400 px-4 py-2 rounded-lg">Cancel</button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {showModal === 'addTask' && (
            <div className="modal-overlay" onClick={closeModal}>
              <div className="glass modal-content" onClick={(e) => e.stopPropagation()}>
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
                    <button onClick={handleAddTask} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex-1" disabled={loading}>
                      {loading ? 'Creating...' : 'Create Task'}
                    </button>
                    <button onClick={closeModal} className="bg-gray-300 hover:bg-gray-400 px-4 py-2 rounded-lg">Cancel</button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {showModal === 'addVehicle' && (
            <div className="modal-overlay" onClick={closeModal}>
              <div className="glass modal-content" onClick={(e) => e.stopPropagation()}>
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
                    <button onClick={handleAddVehicle} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex-1" disabled={loading}>
                      {loading ? 'Adding...' : 'Add Vehicle'}
                    </button>
                    <button onClick={closeModal} className="bg-gray-300 hover:bg-gray-400 px-4 py-2 rounded-lg">Cancel</button>
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
