'use client'

import React, { useState, useEffect } from 'react'
import { 
  Users, Truck, UserCheck, CheckCircle, AlertTriangle, Activity, Plus, Upload, 
  ClipboardCheck, Calendar, BarChart3, Bell, Search, Download, LogOut, Clock,
  FileText, TrendingUp, X, Check, Edit, Trash2, Eye, Settings, Home
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
  type LeaveRequest
} from '@/lib/supabase'

export default function FleetTrackCRM() {
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [loginForm, setLoginForm] = useState({ user_id: '', password: '' })
  const [activeSection, setActiveSection] = useState('dashboard')
  
  // Data states
  const [clients, setClients] = useState<Client[]>([])
  const [employees, setEmployees] = useState<User[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([])
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  
  // Modal states
  const [showModal, setShowModal] = useState<string | null>(null)
  const [modalData, setModalData] = useState<any>({})
  const [loading, setLoading] = useState(false)

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
    
    setClients(clientsData || [])
    setEmployees(employeesData || [])
    setTasks(tasksData || [])
    setLeaveRequests(leaveData || [])
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
    alert(`Signed in at ${time}${lateMinutes > 0 ? ` (Late by ${lateMinutes} minutes)` : ''}`)
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
      alert('Client added successfully')
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
      alert('Employee added successfully')
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
      alert('Vehicle added successfully')
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
    
    alert(`Leave ${approved ? 'approved' : 'rejected'}`)
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
      alert('Leave request submitted successfully')
      closeModal()
    }
    
    setLoading(false)
  }

  // Login Page
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="flex items-center justify-center gap-3 mb-4">
              <Truck className="w-12 h-12 text-blue-600" />
              <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                FleetTrack
              </h1>
            </div>
            <p className="text-gray-600">Pro Enterprise CRM</p>
          </div>

          <div className="glass rounded-2xl p-8 shadow-2xl">
            <h2 className="text-2xl font-bold mb-6 text-center">Sign In</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">User ID</label>
                <input
                  type="text"
                  value={loginForm.user_id}
                  onChange={(e) => setLoginForm({ ...loginForm, user_id: e.target.value })}
                  className="input-field"
                  placeholder="Enter your user ID"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Password</label>
                <input
                  type="password"
                  value={loginForm.password}
                  onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                  className="input-field"
                  placeholder="Enter your password"
                  required
                />
              </div>
              <button
                onClick={handleLogin}
                disabled={loading}
                className="btn-primary w-full"
              >
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
            </div>
            <div className="mt-6 text-center text-sm text-gray-600">
              <p>Demo Credentials:</p>
              <p>Admin: admin / admin123</p>
              <p>Employee: emp001 / emp123</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Admin Dashboard
  if (currentUser.role === 'admin') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-purple-50 to-pink-50">
        {/* Header */}
        <div className="glass-header sticky top-0 z-50">
          <div className="px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Truck className="w-8 h-8 text-blue-600" />
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  FleetTrack Admin
                </h1>
                <p className="text-sm text-gray-600">Welcome, {currentUser.full_name}</p>
              </div>
            </div>
            <button onClick={handleLogout} className="btn-danger flex items-center gap-2">
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </div>

          {/* Navigation */}
          <div className="px-6 border-t border-white/10 overflow-x-auto">
            <div className="flex gap-2">
              {[
                { id: 'dashboard', label: 'Dashboard', icon: Home },
                { id: 'clients', label: 'Clients', icon: Users },
                { id: 'employees', label: 'Employees', icon: UserCheck },
                { id: 'tasks', label: 'Tasks', icon: ClipboardCheck },
                { id: 'leaves', label: 'Leave Requests', icon: Calendar, badge: leaveRequests.length }
              ].map((item) => {
                const Icon = item.icon
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveSection(item.id)}
                    className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-all relative ${
                      activeSection === item.id
                        ? 'border-purple-600 text-purple-600 bg-gradient-to-b from-purple-50 to-transparent'
                        : 'border-transparent text-gray-600 hover:text-purple-600'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="text-sm font-medium whitespace-nowrap">{item.label}</span>
                    {item.badge && item.badge > 0 && (
                      <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-semibold">
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
        <div className="p-6">
          {activeSection === 'dashboard' && (
            <div className="space-y-6">
              {/* Stats */}
              <div className="grid grid-cols-4 gap-4">
                {[
                  { label: 'Total Clients', value: clients.length, icon: Users, gradient: 'from-blue-500 to-purple-500' },
                  { label: 'Employees', value: employees.length, icon: UserCheck, gradient: 'from-green-500 to-emerald-500' },
                  { label: 'Active Tasks', value: tasks.length, icon: ClipboardCheck, gradient: 'from-orange-500 to-red-500' },
                  { label: 'Pending Leaves', value: leaveRequests.length, icon: Calendar, gradient: 'from-purple-500 to-pink-500' }
                ].map((stat, idx) => {
                  const Icon = stat.icon
                  return (
                    <div key={idx} className={`card-gradient bg-gradient-to-br ${stat.gradient}`}>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-3xl font-bold">{stat.value}</p>
                          <p className="text-sm opacity-90 mt-1">{stat.label}</p>
                        </div>
                        <Icon className="w-10 h-10 opacity-70" />
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Quick Actions */}
              <div className="grid grid-cols-4 gap-4">
                {[
                  { label: 'Add Client', icon: Plus, action: () => openModal('addClient') },
                  { label: 'Add Employee', icon: UserCheck, action: () => openModal('addEmployee') },
                  { label: 'Create Task', icon: ClipboardCheck, action: () => {} },
                  { label: 'View Reports', icon: BarChart3, action: () => {} }
                ].map((action, idx) => {
                  const Icon = action.icon
                  return (
                    <button
                      key={idx}
                      onClick={action.action}
                      className="card hover:shadow-xl hover:scale-105 transition-all group"
                    >
                      <Icon className="w-8 h-8 text-purple-600 mx-auto mb-2 group-hover:scale-110 transition-transform" />
                      <p className="text-sm font-medium text-center">{action.label}</p>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {activeSection === 'clients' && (
            <div>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold">Clients Management</h2>
                <button onClick={() => openModal('addClient')} className="btn-primary flex items-center gap-2">
                  <Plus className="w-4 h-4" />
                  Add Client
                </button>
              </div>
              <div className="grid gap-4">
                {clients.map((client) => (
                  <div key={client.id} className="card">
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
                                className="progress-fill bg-gradient-to-r from-green-500 to-emerald-500"
                                style={{ width: `${client.completion_percentage}%` }}
                              />
                            </div>
                            <span className="text-sm font-medium">{client.completion_percentage}%</span>
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => { 
                          setSelectedClient(client)
                          loadVehicles(client.id)
                          setActiveSection('vehicles')
                        }}
                        className="btn-primary flex items-center gap-2"
                      >
                        <Eye className="w-4 h-4" />
                        View Vehicles
                      </button>
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
                    className="text-purple-600 hover:text-purple-700 mb-2"
                  >
                    ← Back to Clients
                  </button>
                  <h2 className="text-2xl font-bold">{selectedClient.name} - Vehicles</h2>
                </div>
                <button
                  onClick={() => openModal('addVehicle')}
                  className="btn-primary flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
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
                      <th className="table-header">Video Recording</th>
                      <th className="table-header">Offline Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vehicles.map((vehicle) => (
                      <tr key={vehicle.id} className="table-row border-b">
                        <td className="px-6 py-4 font-medium">{vehicle.vehicle_number}</td>
                        <td className="px-6 py-4">{vehicle.driver_name}</td>
                        <td className="px-6 py-4">
                          <select
                            value={vehicle.status}
                            onChange={(e) => updateVehicleStatus(vehicle.id, 'status', e.target.value)}
                            className={`badge ${
                              vehicle.status === 'online' ? 'badge-success' :
                              vehicle.status === 'offline' ? 'badge-danger' :
                              'badge-warning'
                            }`}
                          >
                            <option value="online">Online</option>
                            <option value="offline">Offline</option>
                            <option value="maintenance">Maintenance</option>
                            <option value="idle">Idle</option>
                          </select>
                        </td>
                        <td className="px-6 py-4">
                          <input
                            type="checkbox"
                            checked={vehicle.alerts_active}
                            onChange={(e) => updateVehicleStatus(vehicle.id, 'alerts_active', e.target.checked)}
                            className="w-5 h-5"
                          />
                        </td>
                        <td className="px-6 py-4">
                          <input
                            type="checkbox"
                            checked={vehicle.video_recording}
                            onChange={(e) => updateVehicleStatus(vehicle.id, 'video_recording', e.target.checked)}
                            className="w-5 h-5"
                          />
                        </td>
                        <td className="px-6 py-4">
                          {vehicle.status === 'offline' && (
                            <select
                              value={vehicle.offline_reason || ''}
                              onChange={(e) => updateVehicleStatus(vehicle.id, 'offline_reason', e.target.value)}
                              className="input-field"
                            >
                              <option value="">Select reason</option>
                              <option value="vehicle_not_running">Vehicle Not Running</option>
                              <option value="dashcam_issue">Dashcam Issue</option>
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
                  className="btn-primary flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add Employee
                </button>
              </div>
              <div className="grid gap-4">
                {employees.map((emp) => (
                  <div key={emp.id} className="card">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="text-xl font-bold">{emp.full_name}</h3>
                        <p className="text-gray-600">{emp.email}</p>
                        <p className="text-sm text-gray-500 mt-2">
                          User ID: {emp.user_id} | Shift: {emp.shift_start} - {emp.shift_end}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button className="p-2 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200">
                          <Edit className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeSection === 'leaves' && (
            <div>
              <h2 className="text-2xl font-bold mb-6">Leave Requests</h2>
              <div className="grid gap-4">
                {leaveRequests.map((leave) => (
                  <div key={leave.id} className="card">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="text-lg font-bold">{leave.employee_name || 'Employee'}</h3>
                        <p className="text-gray-600">{leave.leave_type} Leave</p>
                        <p className="text-sm text-gray-500 mt-2">
                          {leave.from_date} to {leave.to_date} ({leave.total_days} days)
                        </p>
                        <p className="mt-2">{leave.reason}</p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleApproveLeave(leave.id, true)}
                          className="btn-success flex items-center gap-2"
                        >
                          <Check className="w-4 h-4" />
                          Approve
                        </button>
                        <button
                          onClick={() => handleApproveLeave(leave.id, false)}
                          className="btn-danger flex items-center gap-2"
                        >
                          <X className="w-4 h-4" />
                          Reject
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Modals */}
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

        {showModal === 'addVehicle' && (
          <div className="modal-overlay" onClick={closeModal}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-xl font-bold mb-4">Add New Vehicle</h3>
              <div className="space-y-4">
                <input
                  type="text"
                  placeholder="Vehicle Number"
                  onChange={(e) => setModalData({ ...modalData, vehicle_number: e.target.value })}
                  className="input-field"
                />
                <input
                  type="text"
                  placeholder="Vehicle Type"
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
      </div>
    )
  }

  // Employee Dashboard
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-purple-50">
      <div className="glass-header sticky top-0 z-50">
        <div className="px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <UserCheck className="w-8 h-8 text-blue-600" />
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Employee Portal
              </h1>
              <p className="text-sm text-gray-600">Welcome, {currentUser.full_name}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={handleSignIn} className="btn-success flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Sign In
            </button>
            <button onClick={handleSignOut} className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Sign Out
            </button>
            <button onClick={handleLogout} className="btn-danger flex items-center gap-2">
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </div>
        </div>

        <div className="px-6 border-t border-white/10">
          <div className="flex gap-2">
            {[
              { id: 'dashboard', label: 'Dashboard', icon: Home },
              { id: 'my-clients', label: 'My Clients', icon: Users },
              { id: 'request-leave', label: 'Request Leave', icon: FileText }
            ].map((item) => {
              const Icon = item.icon
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveSection(item.id)}
                  className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-all ${
                    activeSection === item.id
                      ? 'border-blue-600 text-blue-600 bg-blue-50'
                      : 'border-transparent text-gray-600 hover:text-blue-600'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="text-sm font-medium">{item.label}</span>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      <div className="p-6">
        {activeSection === 'dashboard' && (
          <div className="space-y-6">
            <div className="card">
              <h3 className="text-lg font-bold mb-4">Today's Shift</h3>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600">Shift Timing</p>
                  <p className="text-2xl font-bold">{currentUser.shift_start} - {currentUser.shift_end}</p>
                </div>
                <div className="text-right">
                  <p className="text-gray-600">Status</p>
                  <p className="text-lg font-bold text-green-600">Active</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="card-gradient bg-gradient-to-br from-blue-500 to-purple-500">
                <p className="text-3xl font-bold">{tasks.filter(t => t.assigned_to === currentUser.id).length}</p>
                <p className="text-sm opacity-90 mt-1">My Tasks</p>
              </div>
              <div className="card-gradient bg-gradient-to-br from-green-500 to-emerald-500">
                <p className="text-3xl font-bold">{clients.length}</p>
                <p className="text-sm opacity-90 mt-1">Assigned Clients</p>
              </div>
              <div className="card-gradient bg-gradient-to-br from-orange-500 to-red-500">
                <p className="text-3xl font-bold">0</p>
                <p className="text-sm opacity-90 mt-1">Pending Leaves</p>
              </div>
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
                  className="card hover:shadow-xl cursor-pointer"
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="text-xl font-bold">{client.name}</h3>
                      <p className="text-gray-600">{client.email}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-3xl font-bold text-purple-600">{client.completion_percentage}%</p>
                      <p className="text-sm text-gray-600">Completion</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeSection === 'client-vehicles' && selectedClient && (
          <div>
            <button onClick={() => setActiveSection('my-clients')} className="text-blue-600 hover:text-blue-700 mb-4">
              ← Back to Clients
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
                  </tr>
                </thead>
                <tbody>
                  {vehicles.map((vehicle) => (
                    <tr key={vehicle.id} className="border-b">
                      <td className="px-6 py-4 font-medium">{vehicle.vehicle_number}</td>
                      <td className="px-6 py-4">{vehicle.driver_name}</td>
                      <td className="px-6 py-4">
                        <span className={`badge ${
                          vehicle.status === 'online' ? 'badge-success' : 'badge-danger'
                        }`}>
                          {vehicle.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">{vehicle.alerts_active ? 'Active' : 'None'}</td>
                      <td className="px-6 py-4">{vehicle.video_recording ? 'Recording' : 'Not Recording'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeSection === 'request-leave' && (
          <div className="max-w-2xl mx-auto">
            <h2 className="text-2xl font-bold mb-6">Request Leave</h2>
            <div className="card">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Leave Type</label>
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
                    <label className="block text-sm font-medium mb-2">From Date</label>
                    <input
                      type="date"
                      onChange={(e) => setModalData({ ...modalData, from_date: e.target.value })}
                      className="input-field"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">To Date</label>
                    <input
                      type="date"
                      onChange={(e) => setModalData({ ...modalData, to_date: e.target.value })}
                      className="input-field"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Total Days</label>
                  <input
                    type="number"
                    onChange={(e) => setModalData({ ...modalData, total_days: e.target.value })}
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Reason</label>
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
      </div>
    </div>
  )
}
