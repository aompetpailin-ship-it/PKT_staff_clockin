'use client';

import { useState, useEffect } from 'react';
import BranchPieChart from '@/components/BranchPieChart';
import { getThaiDateStr, getThaiMonthYearStr } from '@/lib/dateUtils';

const THAI_MONTH_NAMES = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
];

const DAYS_OF_WEEK = [
  { day: 0, label: 'อาทิตย์ (Sun)' },
  { day: 1, label: 'จันทร์ (Mon)' },
  { day: 2, label: 'อังคาร (Tue)' },
  { day: 3, label: 'พุธ (Wed)' },
  { day: 4, label: 'พฤหัสบดี (Thu)' },
  { day: 5, label: 'ศุกร์ (Fri)' },
  { day: 6, label: 'เสาร์ (Sat)' },
];

const LEAVE_TYPES: Record<string, { label: string; badge: string }> = {
  SICK_LEAVE: { label: '🤒 ลาป่วย', badge: 'bg-amber-100 text-amber-900 border-amber-300' },
  CASUAL_LEAVE: { label: '📝 ลากิจ', badge: 'bg-sky-100 text-sky-900 border-sky-300' },
  ANNUAL_LEAVE: { label: '🏖️ ลาพักร้อน', badge: 'bg-purple-100 text-purple-900 border-purple-300' },
  ABSENT: { label: '❌ ขาดงาน', badge: 'bg-red-100 text-red-900 border-red-300' },
};

function formatThaiMonth(monthYearStr: string): string {
  if (!monthYearStr || !monthYearStr.includes('-')) return monthYearStr;
  const [yearStr, monthStr] = monthYearStr.split('-');
  const year = parseInt(yearStr, 10);
  const monthIdx = parseInt(monthStr, 10) - 1;
  const thaiMonth = THAI_MONTH_NAMES[monthIdx] || monthStr;
  return `${thaiMonth} ${year}`;
}

function generateMonthsOptions(count = 12) {
  const list = [];
  const now = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = `${THAI_MONTH_NAMES[d.getMonth()]} ${d.getFullYear()} ${i === 0 ? '📌 (เดือนปัจจุบัน)' : ''}`;
    list.push({ value, label });
  }
  return list;
}

export default function AdminDashboardPage() {
  // Authentication State
  const [adminUser, setAdminUser] = useState<string | null>(null);
  const [loginUsername, setLoginUsername] = useState<string>('');
  const [loginPassword, setLoginPassword] = useState<string>('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);

  const [activeTab, setActiveTab] = useState<'branches' | 'employees' | 'logs' | 'bonus' | 'diligence' | 'performance' | 'leaves' | 'payroll'>('performance');

  // Global Month Filter State (e.g. "2026-08")
  const [selectedMonthYear, setSelectedMonthYear] = useState<string>(getThaiMonthYearStr());
  const recentMonthsOptions = generateMonthsOptions(12);

  // Data states
  const [branches, setBranches] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [attendanceLogs, setAttendanceLogs] = useState<any[]>([]);
  const [schedules, setSchedules] = useState<any[]>([]);
  
  // Daily Sales & Bonus Form State
  const [salesBranchId, setSalesBranchId] = useState<string>('');
  const [salesDateStr, setSalesDateStr] = useState<string>(getThaiDateStr());
  const [salesAmount, setSalesAmount] = useState<string>('');
  const [salesRecords, setSalesRecords] = useState<any[]>([]);
  const [salesFeedback, setSalesFeedback] = useState<any>(null);

  // Bulk CSV / Google Sheet State
  const [csvInputText, setCsvInputText] = useState<string>(
    `date,branchCode,totalSales\n${getThaiDateStr()},B1,22000\n${getThaiDateStr()},B2,30000\n${getThaiDateStr()},B3,18000\n${getThaiDateStr()},B4,45000`
  );
  const [bulkImportResults, setBulkImportResults] = useState<any>(null);
  const [isImporting, setIsImporting] = useState<boolean>(false);

  // Diligence State
  const [diligenceReport, setDiligenceReport] = useState<any[]>([]);

  // Leave Management State
  const [leaveRecords, setLeaveRecords] = useState<any[]>([]);
  const [leaveEmpId, setLeaveEmpId] = useState<string>('');
  const [leaveStartDate, setLeaveStartDate] = useState<string>(getThaiDateStr());
  const [leaveEndDate, setLeaveEndDate] = useState<string>(getThaiDateStr());
  const [leaveType, setLeaveType] = useState<string>('SICK_LEAVE');
  const [leaveReason, setLeaveReason] = useState<string>('');

  // Performance Analytics State
  const [perfReport, setPerfReport] = useState<any[]>([]);
  const [selectedPerfEmpId, setSelectedPerfEmpId] = useState<string>('');
  const [perfFilterMode, setPerfFilterMode] = useState<'EMPLOYEE' | 'BRANCH'>('EMPLOYEE');
  const [selectedPerfBranchId, setSelectedPerfBranchId] = useState<string>('');
  const [selectedDiligenceBranchId, setSelectedDiligenceBranchId] = useState<string>('ALL');
  const [selectedPayrollBranchId, setSelectedPayrollBranchId] = useState<string>('ALL');

  // Schedule Form State per branch
  const [selectedScheduleBranchId, setSelectedScheduleBranchId] = useState<string>('');
  const [scheduleDay, setScheduleDay] = useState<number>(1);
  const [scheduleStartTime, setScheduleStartTime] = useState<string>('09:00');

  // Branch GPS Editor State
  const [editBranchId, setEditBranchId] = useState<string>('');
  const [editLat, setEditLat] = useState<string>('');
  const [editLng, setEditLng] = useState<string>('');
  const [editRadius, setEditRadius] = useState<string>('100');
  const [isGrabbingGps, setIsGrabbingGps] = useState<boolean>(false);

  // Employee Form State
  const [editingEmp, setEditingEmp] = useState<any | null>(null);
  const [newEmployee, setNewEmployee] = useState({
    lineUserId: '',
    fullName: '',
    nickname: '',
    phone: '',
    pinCode: '1234',
    role: 'STAFF',
    employmentType: 'FULL_TIME',
    homeBranchId: '',
    canRoam: true,
    avatarUrl: '',
  });

  // Check login cookie on load
  useEffect(() => {
    const cookies = document.cookie.split('; ');
    const userCookie = cookies.find((c) => c.startsWith('pkt_admin_user='));
    if (userCookie) {
      const username = userCookie.split('=')[1];
      if (['aommyisme', 'pon'].includes(username)) {
        setAdminUser(username);
      }
    }
  }, []);

  // Initial & Month-based Data Loading when logged in
  useEffect(() => {
    if (adminUser) {
      fetchBranches();
      fetchEmployees();
      fetchSchedules();
    }
  }, [adminUser]);

  useEffect(() => {
    if (adminUser) {
      fetchAttendanceLogs(selectedMonthYear);
      fetchSalesRecords(selectedMonthYear);
      fetchDiligenceReport(selectedMonthYear);
      fetchPerformanceReport(selectedMonthYear);
      fetchLeaveRecords(selectedMonthYear);
    }
  }, [adminUser, selectedMonthYear]);

  // Login Form Handler
  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setIsLoggingIn(true);

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: loginUsername,
          password: loginPassword,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setAdminUser(data.user.username);
        setLoginPassword('');
      } else {
        setLoginError(data.error);
      }
    } catch (err: any) {
      setLoginError('เกิดข้อผิดพลาดในการเชื่อมต่อเพื่อเข้าสู่ระบบ');
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Logout Handler
  const handleAdminLogout = async () => {
    try {
      await fetch('/api/admin/logout', { method: 'POST' });
    } catch (e) {}
    document.cookie = 'pkt_admin_user=; Max-Age=0; path=/;';
    setAdminUser(null);
  };

  const fetchBranches = async () => {
    try {
      const res = await fetch('/api/branches');
      const data = await res.json();
      if (data.success) {
        setBranches(data.branches);
        if (data.branches.length > 0) {
          if (!salesBranchId) setSalesBranchId(data.branches[0].id);
          if (!selectedScheduleBranchId) setSelectedScheduleBranchId(data.branches[0].id);
          if (!selectedPerfBranchId) setSelectedPerfBranchId(data.branches[0].id);
          if (!editBranchId) {
            setEditBranchId(data.branches[0].id);
            setEditLat(String(data.branches[0].latitude));
            setEditLng(String(data.branches[0].longitude));
            setEditRadius(String(data.branches[0].allowedRadiusMeters));
          }
          setNewEmployee((prev) => ({ ...prev, homeBranchId: data.branches[0].id }));
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchEmployees = async () => {
    try {
      const res = await fetch('/api/employees');
      const data = await res.json();
      if (data.success) {
        setEmployees(data.employees);
        if (data.employees.length > 0) {
          if (!selectedPerfEmpId) setSelectedPerfEmpId(data.employees[0].id);
          if (!leaveEmpId) setLeaveEmpId(data.employees[0].id);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchAttendanceLogs = async (monthYearStr: string) => {
    try {
      const res = await fetch(`/api/attendance/logs?monthYear=${monthYearStr}`);
      const data = await res.json();
      if (data.success) setAttendanceLogs(data.logs);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchSalesRecords = async (monthYearStr: string) => {
    try {
      const res = await fetch(`/api/sales?monthYear=${monthYearStr}`);
      const data = await res.json();
      if (data.success) setSalesRecords(data.dailySales);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchDiligenceReport = async (monthYearStr: string) => {
    try {
      const res = await fetch(`/api/incentives/diligence?monthYear=${monthYearStr}`);
      const data = await res.json();
      if (data.success) setDiligenceReport(data.report);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchPerformanceReport = async (monthYearStr: string) => {
    try {
      const res = await fetch(`/api/analytics/performance?monthYear=${monthYearStr}`);
      const data = await res.json();
      if (data.success) setPerfReport(data.report);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchLeaveRecords = async (monthYearStr: string) => {
    try {
      const res = await fetch(`/api/leaves?monthYear=${monthYearStr}`);
      const data = await res.json();
      if (data.success) setLeaveRecords(data.leaves);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchSchedules = async () => {
    try {
      const res = await fetch('/api/schedules');
      const data = await res.json();
      if (data.success) setSchedules(data.schedules);
    } catch (e) {
      console.error(e);
    }
  };

  // Month Navigation Handlers
  const handlePrevMonth = () => {
    const [year, month] = selectedMonthYear.split('-').map(Number);
    const d = new Date(year, month - 2, 1);
    const newMonthStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    setSelectedMonthYear(newMonthStr);
  };

  const handleNextMonth = () => {
    const [year, month] = selectedMonthYear.split('-').map(Number);
    const d = new Date(year, month, 1);
    const newMonthStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    setSelectedMonthYear(newMonthStr);
  };

  // Populate branch fields when selected in GPS editor
  const handleSelectBranchToEdit = (branchId: string) => {
    setEditBranchId(branchId);
    const b = branches.find((item) => item.id === branchId);
    if (b) {
      setEditLat(String(b.latitude));
      setEditLng(String(b.longitude));
      setEditRadius(String(b.allowedRadiusMeters));
    }
  };

  // Grab Current GPS Location from Manager's Device to set Store Location
  const handleGrabAdminGpsLocation = () => {
    setIsGrabbingGps(true);
    if (!navigator.geolocation) {
      alert('อุปกรณ์ของท่านไม่รองรับการดึงพิกัด GPS');
      setIsGrabbingGps(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setEditLat(String(pos.coords.latitude));
        setEditLng(String(pos.coords.longitude));
        setIsGrabbingGps(false);
        alert(`ดึงพิกัดปัจจุบันเรียบร้อยแล้ว: ${pos.coords.latitude}, ${pos.coords.longitude}`);
      },
      (err) => {
        console.error(err);
        alert('ไม่สามารถดึงพิกัด GPS ได้ กรุณาอนุญาตให้สิทธิ์การดึงพิกัด Location');
        setIsGrabbingGps(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Save Branch GPS & Radius
  const handleSaveBranchGps = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editBranchId || !editLat || !editLng) {
      alert('กรุณากรอกพิกัด Latitude และ Longitude');
      return;
    }

    try {
      const res = await fetch('/api/branches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editBranchId,
          latitude: parseFloat(editLat),
          longitude: parseFloat(editLng),
          allowedRadiusMeters: parseFloat(editRadius),
        }),
      });
      const data = await res.json();
      if (data.success) {
        alert('ล็อกพิกัด GPS และรัศมีสาขาเรียบร้อยแล้ว!');
        fetchBranches();
      } else {
        alert(data.error);
      }
    } catch (e) {
      alert('เกิดข้อผิดพลาดในการบันทึกพิกัดสาขา');
    }
  };

  // Save Leave Record Handler (Supports Advance or Retroactive dates)
  const handleSaveLeaveRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leaveEmpId || !leaveStartDate || !leaveEndDate) {
      alert('กรุณาเลือกพนักงานและระบุวันที่');
      return;
    }

    try {
      const res = await fetch('/api/leaves', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId: leaveEmpId,
          startDateStr: leaveStartDate,
          endDateStr: leaveEndDate,
          leaveType,
          reason: leaveReason,
          recordedBy: adminUser,
        }),
      });
      const data = await res.json();
      if (data.success) {
        alert(data.message);
        setLeaveReason('');
        fetchLeaveRecords(selectedMonthYear);
        fetchDiligenceReport(selectedMonthYear);
      } else {
        alert(data.error);
      }
    } catch (e) {
      alert('เกิดข้อผิดพลาดในการบันทึกการลางาน');
    }
  };

  // Delete Leave Record Handler
  const handleDeleteLeaveRecord = async (id: string) => {
    if (!confirm('คุณต้องการลบรายการลางานนี้ใช่หรือไม่?')) return;
    try {
      const res = await fetch(`/api/leaves?id=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        alert('ลบรายการเรียบร้อยแล้ว');
        fetchLeaveRecords(selectedMonthYear);
        fetchDiligenceReport(selectedMonthYear);
      } else {
        alert(data.error);
      }
    } catch (e) {
      alert('เกิดข้อผิดพลาดในการลบรายการ');
    }
  };

  // Save Branch Schedule
  const handleSaveSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedScheduleBranchId) {
      alert('กรุณาเลือกสาขา');
      return;
    }
    try {
      const res = await fetch('/api/schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branchId: selectedScheduleBranchId,
          dayOfWeek: scheduleDay,
          shiftStartTime: scheduleStartTime,
        }),
      });
      const data = await res.json();
      if (data.success) {
        alert('บันทึกกำหนดเวลาเข้างานสาขาเรียบร้อยแล้ว');
        fetchSchedules();
      } else {
        alert(data.error);
      }
    } catch (e) {
      alert('เกิดข้อผิดพลาดในการบันทึกตารางเวลาสาขา');
    }
  };

  // Handle Save Single Daily Sales
  const handleSaveSales = async (e: React.FormEvent) => {
    e.preventDefault();
    setSalesFeedback(null);
    if (!salesBranchId || !salesDateStr || !salesAmount) {
      alert('กรุณากรอกข้อมูลสาขา วันที่ และยอดขายรวม');
      return;
    }

    try {
      const res = await fetch('/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branchId: salesBranchId,
          dateStr: salesDateStr,
          totalSales: parseFloat(salesAmount),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSalesFeedback(data);
        fetchSalesRecords(selectedMonthYear);
        fetchPerformanceReport(selectedMonthYear);
      } else {
        alert(data.error);
      }
    } catch (err: any) {
      alert('เกิดข้อผิดพลาดในการบันทึกยอดขาย');
    }
  };

  // Handle Bulk Import (CSV / Google Sheets)
  const handleBulkImportSales = async (e: React.FormEvent) => {
    e.preventDefault();
    setBulkImportResults(null);
    if (!csvInputText.trim()) {
      alert('กรุณากรอกหรือวางข้อมูล CSV / Google Sheets');
      return;
    }

    setIsImporting(true);
    try {
      const res = await fetch('/api/sales/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          csvText: csvInputText,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setBulkImportResults(data);
        fetchSalesRecords(selectedMonthYear);
        fetchPerformanceReport(selectedMonthYear);
      } else {
        alert(data.error);
      }
    } catch (e) {
      alert('เกิดข้อผิดพลาดในการนำเข้าข้อมูลยอดขาย');
    } finally {
      setIsImporting(false);
    }
  };

  // File Upload CSV handler
  const handleCsvFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        const text = evt.target?.result as string;
        if (text) setCsvInputText(text);
      };
      reader.readAsText(file);
    }
  };

  // Download Sample CSV
  const downloadSampleCsv = () => {
    const today = new Date().toISOString().split('T')[0];
    const sample = `date,branchCode,totalSales\n${today},B1,25000\n${today},B2,32000\n${today},B3,21500\n${today},B4,43000`;
    const blob = new Blob([sample], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'sales_sample.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Create Employee
  const handleCreateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newEmployee),
      });
      const data = await res.json();
      if (data.success) {
        alert(`บันทึกพนักงานเรียบร้อยแล้ว (รหัส PIN: ${data.employee.pinCode})`);
        setNewEmployee({
          lineUserId: '',
          fullName: '',
          nickname: '',
          phone: '',
          pinCode: '1234',
          role: 'STAFF',
          employmentType: 'FULL_TIME',
          homeBranchId: branches[0]?.id || '',
          canRoam: true,
          avatarUrl: '',
        });
        fetchEmployees();
        fetchPerformanceReport(selectedMonthYear);
      } else {
        alert(data.error);
      }
    } catch (e) {
      alert('เกิดข้อผิดพลาดในการบันทึกพนักงาน');
    }
  };

  // Update Employee PIN Code
  const handleUpdateEmployeePin = async (empId: string, currentPin: string, empName: string) => {
    const newPin = prompt(`กรอกรหัส PIN ประจำตัวใหม่สำหรับ ${empName} (4-6 หลัก):`, currentPin || '1234');
    if (newPin && newPin.trim()) {
      try {
        const res = await fetch('/api/employees', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: empId, pinCode: newPin.trim() }),
        });
        const data = await res.json();
        if (data.success) {
          alert(`อัปเดตรหัส PIN ของ ${empName} เป็น "${newPin.trim()}" เรียบร้อยแล้ว`);
          fetchEmployees();
        } else {
          alert(data.error);
        }
      } catch (e) {
        alert('เกิดข้อผิดพลาดในการอัปเดตรหัส PIN');
      }
    }
  };

  // Reset Phone Binding for Employee
  const handleResetDeviceBinding = async (empId: string, empName: string) => {
    if (!confirm(`คุณต้องการปลดล็อกการผูกเครื่องมือถือของ ${empName} เพื่อให้สามารถลงทะเบียนเครื่องใหม่ใช่หรือไม่?`)) return;
    try {
      const res = await fetch('/api/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: empId, resetDeviceBinding: true }),
      });
      const data = await res.json();
      if (data.success) {
        alert(`ปลดล็อกเครื่องมือถือของ ${empName} เรียบร้อยแล้ว พนักงานสามารถใช้อุปกรณ์เครื่องใหม่กดเข้างานได้ทันที`);
        fetchEmployees();
      } else {
        alert(data.error);
      }
    } catch (e) {
      alert('เกิดข้อผิดพลาดในการปลดล็อกเครื่อง');
    }
  };

  // Image Compress & Base64 Handler
  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>, isEdit: boolean = false) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const maxDim = 400;
        if (width > height) {
          if (width > maxDim) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          }
        } else {
          if (height > maxDim) {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);

        if (isEdit && editingEmp) {
          setEditingEmp((prev: any) => ({ ...prev, avatarUrl: dataUrl }));
        } else {
          setNewEmployee((prev: any) => ({ ...prev, avatarUrl: dataUrl }));
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Edit Employee Handler
  const handleSaveEditEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEmp) return;

    try {
      const res = await fetch('/api/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingEmp.id,
          fullName: editingEmp.fullName,
          nickname: editingEmp.nickname,
          pinCode: editingEmp.pinCode,
          employmentType: editingEmp.employmentType,
          homeBranchId: editingEmp.homeBranchId,
          canRoam: editingEmp.canRoam,
          avatarUrl: editingEmp.avatarUrl,
        }),
      });
      const data = await res.json();
      if (data.success) {
        alert(`อัปเดตข้อมูลพนักงาน "${editingEmp.fullName}" เรียบร้อยแล้ว`);
        setEditingEmp(null);
        fetchEmployees();
        fetchPerformanceReport(selectedMonthYear);
        fetchDiligenceReport(selectedMonthYear);
      } else {
        alert(data.error);
      }
    } catch (err: any) {
      alert('เกิดข้อผิดพลาดในการอัปเดตข้อมูลพนักงาน');
    }
  };

  // Delete Employee Handler
  const handleDeleteEmployee = async (id: string, name: string) => {
    if (confirm(`คุณต้องการลบพนักงาน "${name}" ออกจากระบบใช่หรือไม่?\n\n⚠️ คำเตือน: ข้อมูลการเข้างานและสิทธิ์ทั้งหมดของพนักงานคนนี้จะถูกลบออก`)) {
      try {
        const res = await fetch(`/api/employees?id=${id}`, {
          method: 'DELETE',
        });
        const data = await res.json();
        if (data.success) {
          alert(`ลบพนักงาน "${name}" เรียบร้อยแล้ว`);
          fetchEmployees();
          fetchPerformanceReport(selectedMonthYear);
          fetchDiligenceReport(selectedMonthYear);
        } else {
          alert(data.error);
        }
      } catch (err: any) {
        alert('เกิดข้อผิดพลาดในการลบพนักงาน');
      }
    }
  };

  // IF NOT LOGGED IN: DISPLAY SLEEK LIGHT MANAGER LOGIN FORM
  if (!adminUser) {
    return (
      <div className="max-w-md mx-auto space-y-6 pt-6 pb-12">
        <div className="bg-white rounded-3xl p-6 md:p-8 shadow-xl border border-slate-200 space-y-6">
          {/* Logo & Header */}
          <div className="flex flex-col items-center text-center space-y-3">
            <div className="w-20 h-20 bg-white p-1.5 rounded-2xl shadow-md border-2 border-red-500/50">
              {/* eslint-disable-next-html-extension/no-img-element */}
              <img src="/logo.png" alt="ร้านผมขอทอด" className="w-full h-full object-contain" />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900">เข้าสู่ระบบผู้จัดการ (Manager Login)</h1>
              <p className="text-xs text-red-600 font-bold tracking-wide mt-1">
                ร้านผมขอทอด "ที่มันอร่อยเกินไป"
              </p>
            </div>
          </div>

          {/* Login Form */}
          <form onSubmit={handleAdminLogin} className="space-y-4">
            {loginError && (
              <div className="p-3 bg-red-50 text-red-800 border border-red-300 rounded-2xl text-xs font-bold text-center">
                ⚠️ {loginError}
              </div>
            )}

            <div>
              <label className="block text-xs font-black text-slate-800 mb-1.5">
                👤 ชื่อผู้ใช้งานผู้จัดการ (Username):
              </label>
              <input
                type="text"
                placeholder="เช่น aommyisme หรือ pon"
                value={loginUsername}
                onChange={(e) => setLoginUsername(e.target.value)}
                className="w-full p-3 bg-slate-50 border border-slate-300 text-slate-900 rounded-xl text-xs font-bold focus:ring-2 focus:ring-red-500 outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-black text-slate-800 mb-1.5">
                🔑 รหัสผ่าน (Password):
              </label>
              <input
                type="password"
                placeholder="กรอกรหัสผ่าน"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                className="w-full p-3 bg-slate-50 border border-slate-300 text-slate-900 rounded-xl text-xs font-bold focus:ring-2 focus:ring-red-500 outline-none"
                required
              />
            </div>

            <button
              type="submit"
              disabled={isLoggingIn}
              className="w-full bg-red-600 hover:bg-red-700 text-white font-black py-3.5 px-4 rounded-2xl text-xs md:text-sm shadow-md transition disabled:opacity-50"
            >
              {isLoggingIn ? 'กำลังตรวจสอบ...' : '🔓 เข้าสู่ระบบผู้จัดการ (Admin)'}
            </button>
          </form>

          <div className="pt-2 text-center border-t border-slate-200">
            <p className="text-[11px] text-slate-500">
              📌 สิทธิ์เฉพาะบัญชีผู้จัดการ <strong className="text-red-600">aommyisme</strong> และ <strong className="text-red-600">pon</strong>
            </p>
          </div>
        </div>
      </div>
    );
  }

  const selectedPerfItem = perfReport.find((p) => p.employee.id === selectedPerfEmpId) || perfReport[0];

  return (
    <div className="space-y-6 pb-12">
      {/* Clean Modern Admin Header */}
      <div className="bg-white text-slate-900 rounded-2xl p-5 shadow-sm border border-slate-200 space-y-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                <span>⚙️ Admin Dashboard</span>
              </h1>
              <span className="bg-slate-100 text-slate-700 border border-slate-200 text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1">
                👤 ผู้จัดการ: <strong className="text-slate-900">{adminUser}</strong>
              </span>
              <button
                onClick={handleAdminLogout}
                className="text-[11px] bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-3 py-1 rounded-xl transition border border-slate-200 active:scale-95"
              >
                🚪 ออกจากระบบ
              </button>
            </div>
            <p className="text-xs text-slate-500 font-bold mt-1">
              ระบบบริหารจัดการ 4 สาขา ร้านผมขอทอด "ที่มันอร่อยเกินไป" (สิทธิ์ผู้จัดการ)
            </p>
          </div>

          {/* SUPER EASY THAI MONTH SELECTOR */}
          <div className="bg-slate-50 p-2 rounded-xl border border-slate-200 flex flex-wrap md:flex-nowrap items-center gap-2 w-full md:w-auto">
            <button
              onClick={handlePrevMonth}
              className="bg-white hover:bg-slate-100 text-slate-800 font-bold px-3 py-2 rounded-xl text-xs transition border border-slate-200 flex items-center gap-1 shadow-sm active:scale-95"
            >
              <span>◀️ เดือนก่อน</span>
            </button>

            {/* Clear Thai Dropdown */}
            <div className="flex-1 md:flex-none">
              <select
                value={selectedMonthYear}
                onChange={(e) => setSelectedMonthYear(e.target.value)}
                className="w-full bg-white border border-slate-200 text-orange-600 font-bold text-xs md:text-sm px-3.5 py-2 rounded-xl shadow-sm focus:ring-2 focus:ring-orange-500 outline-none cursor-pointer"
              >
                {recentMonthsOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    📅 {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={handleNextMonth}
              className="bg-white hover:bg-slate-100 text-slate-800 font-bold px-3 py-2 rounded-xl text-xs transition border border-slate-200 flex items-center gap-1 shadow-sm active:scale-95"
            >
              <span>เดือนถัดไป ▶️</span>
            </button>
          </div>
        </div>

        {/* Current Active Month Banner Indicator */}
        <div className="bg-slate-900/80 p-3 rounded-2xl border border-amber-500/30 flex items-center justify-between text-xs relative z-10">
          <span className="text-amber-200/80 font-bold">กำลังแสดงผลข้อมูลย้อนหลังประจำเดือน:</span>
          <span className="bg-gradient-to-r from-amber-500 to-amber-600 text-white font-black px-4 py-1 rounded-full text-xs shadow-md border border-amber-400/30">
            ✨ {formatThaiMonth(selectedMonthYear)}
          </span>
        </div>
      </div>

      {/* Sidebar + Main Content Grid Container */}
      <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] lg:grid-cols-[280px_1fr] gap-6 items-start">
        
        {/* Left Sidebar Navigation Panel */}
        <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm space-y-1.5 md:sticky md:top-4 z-20">
          <div className="px-3 py-2 text-[11px] font-black text-slate-400 uppercase tracking-wider border-b border-slate-100 mb-1 flex items-center justify-between">
            <span>⚙️ เมนูสั่งการผู้บริหาร</span>
            <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded-full text-[10px] font-extrabold">8 เมนู</span>
          </div>

          <button
            onClick={() => setActiveTab('performance')}
            className={`w-full text-left py-3 px-3.5 rounded-xl transition flex items-center gap-2.5 font-bold text-xs md:text-sm ${
              activeTab === 'performance'
                ? 'bg-gradient-to-r from-red-600 to-red-700 text-white shadow-md shadow-red-500/20'
                : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <span className="text-base">📈</span>
            <span>ประสิทธิภาพพนักงาน & Chart</span>
          </button>

          <button
            onClick={() => setActiveTab('leaves')}
            className={`w-full text-left py-3 px-3.5 rounded-xl transition flex items-center gap-2.5 font-bold text-xs md:text-sm ${
              activeTab === 'leaves'
                ? 'bg-gradient-to-r from-red-600 to-red-700 text-white shadow-md shadow-red-500/20'
                : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <span className="text-base">📝</span>
            <span>บันทึกการลางาน</span>
          </button>

          <button
            onClick={() => setActiveTab('bonus')}
            className={`w-full text-left py-3 px-3.5 rounded-xl transition flex items-center gap-2.5 font-bold text-xs md:text-sm ${
              activeTab === 'bonus'
                ? 'bg-gradient-to-r from-red-600 to-red-700 text-white shadow-md shadow-red-500/20'
                : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <span className="text-base">💰</span>
            <span>บันทึกยอดขาย & CSV Import</span>
          </button>

          <button
            onClick={() => setActiveTab('diligence')}
            className={`w-full text-left py-3 px-3.5 rounded-xl transition flex items-center gap-2.5 font-bold text-xs md:text-sm ${
              activeTab === 'diligence'
                ? 'bg-gradient-to-r from-red-600 to-red-700 text-white shadow-md shadow-red-500/20'
                : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <span className="text-base">🏆</span>
            <span>เบี้ยขยันประจำเดือน</span>
          </button>

          <button
            onClick={() => setActiveTab('payroll')}
            className={`w-full text-left py-3 px-3.5 rounded-xl transition flex items-center gap-2.5 font-bold text-xs md:text-sm ${
              activeTab === 'payroll'
                ? 'bg-gradient-to-r from-red-600 to-red-700 text-white shadow-md shadow-red-500/20 font-black'
                : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <span className="text-base">💵</span>
            <span>สรุปยอดจ่ายรวม (โบนัส+เบี้ยขยัน)</span>
          </button>

          <button
            onClick={() => setActiveTab('logs')}
            className={`w-full text-left py-3 px-3.5 rounded-xl transition flex items-center gap-2.5 font-bold text-xs md:text-sm ${
              activeTab === 'logs'
                ? 'bg-gradient-to-r from-red-600 to-red-700 text-white shadow-md shadow-red-500/20'
                : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <span className="text-base">📋</span>
            <span>ประวัติลงเวลาเข้างาน</span>
          </button>

          <button
            onClick={() => setActiveTab('branches')}
            className={`w-full text-left py-3 px-3.5 rounded-xl transition flex items-center gap-2.5 font-bold text-xs md:text-sm ${
              activeTab === 'branches'
                ? 'bg-gradient-to-r from-red-600 to-red-700 text-white shadow-md shadow-red-500/20'
                : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <span className="text-base">🏪</span>
            <span>4 สาขา & ล็อกพิกัด GPS</span>
          </button>

          <button
            onClick={() => setActiveTab('employees')}
            className={`w-full text-left py-3 px-3.5 rounded-xl transition flex items-center gap-2.5 font-bold text-xs md:text-sm ${
              activeTab === 'employees'
                ? 'bg-gradient-to-r from-red-600 to-red-700 text-white shadow-md shadow-red-500/20'
                : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <span className="text-base">👥</span>
            <span>จัดการพนักงาน & กำหนด PIN</span>
          </button>
        </div>

        {/* Right Content Panel */}
        <div className="min-w-0">

      {/* TAB: LEAVE MANAGEMENT */}
      {activeTab === 'leaves' && (
        <div className="space-y-6">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div>
              <h2 className="font-extrabold text-base text-slate-900 flex items-center gap-2">
                <span>📝 บันทึกข้อมูลการลางาน / ขาดงาน (ล่วงหน้า & ย้อนหลัง)</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                ผู้จัดการสามารถกรอกบันทึกการลางานล่วงหน้าหรือย้อนหลังได้ เพื่อให้ระบบอัปเดตสถานะและคำนวณสิทธิ์เบี้ยขยันโดยอัตโนมัติ
              </p>
            </div>

            <form onSubmit={handleSaveLeaveRecord} className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">เลือกพนักงานที่ลางาน:</label>
                <select
                  value={leaveEmpId}
                  onChange={(e) => setLeaveEmpId(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-900"
                  required
                >
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.fullName} ({emp.nickname || emp.role})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">วันที่เริ่มลางาน:</label>
                <input
                  type="date"
                  value={leaveStartDate}
                  onChange={(e) => setLeaveStartDate(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-900"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">ถึงวันที่ (กรณีลาหลายวัน):</label>
                <input
                  type="date"
                  value={leaveEndDate}
                  onChange={(e) => setLeaveEndDate(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-900"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">ประเภทการลางาน:</label>
                <select
                  value={leaveType}
                  onChange={(e) => setLeaveType(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-black text-red-600"
                  required
                >
                  <option value="SICK_LEAVE">🤒 ลาป่วย (Sick Leave)</option>
                  <option value="CASUAL_LEAVE">📝 ลากิจ (Casual Leave)</option>
                  <option value="ANNUAL_LEAVE">🏖️ ลาพักร้อน (Annual Leave)</option>
                  <option value="ABSENT">❌ ขาดงาน (Absent)</option>
                </select>
              </div>

              <div className="md:col-span-3">
                <label className="block font-bold text-slate-700 mb-1">เหตุผลการลา / หมายเหตุเพิ่มเติม:</label>
                <input
                  type="text"
                  placeholder="เช่น มีใบรับรองแพทย์ / ลากิจติดธุระครอบครัว"
                  value={leaveReason}
                  onChange={(e) => setLeaveReason(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-medium text-slate-900"
                />
              </div>

              <div className="flex items-end">
                <button
                  type="submit"
                  className="w-full bg-red-600 hover:bg-red-700 text-white font-black p-2.5 rounded-xl shadow transition"
                >
                  💾 บันทึกรายการลางาน
                </button>
              </div>
            </form>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
            <h3 className="font-bold text-slate-900 text-sm">
              ประวัติรายการลางานในเดือน {formatThaiMonth(selectedMonthYear)}
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                    <th className="p-3">วันที่ลางาน</th>
                    <th className="p-3">ชื่อ-นามสกุล พนักงาน</th>
                    <th className="p-3">ประเภทการลา</th>
                    <th className="p-3">เหตุผลการลา</th>
                    <th className="p-3">ผู้บันทึก</th>
                    <th className="p-3 text-center">การจัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {leaveRecords.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-4 text-center text-slate-400">ยังไม่มีรายการลางานในเดือนนี้</td>
                    </tr>
                  ) : (
                    leaveRecords.map((r) => {
                      const typeInfo = LEAVE_TYPES[r.leaveType] || { label: r.leaveType, badge: 'bg-slate-100 text-slate-800' };
                      return (
                        <tr key={r.id} className="hover:bg-slate-50">
                          <td className="p-3 font-semibold font-mono text-slate-900">{r.dateStr}</td>
                          <td className="p-3 font-bold text-slate-900">
                            {r.employee?.fullName} ({r.employee?.nickname})
                          </td>
                          <td className="p-3">
                            <span className={`px-2.5 py-0.5 rounded-full font-bold text-[10px] border ${typeInfo.badge}`}>
                              {typeInfo.label}
                            </span>
                          </td>
                          <td className="p-3 text-slate-600">{r.reason || '-'}</td>
                          <td className="p-3 text-slate-500 font-mono">{r.recordedBy || 'ADMIN'}</td>
                          <td className="p-3 text-center">
                            <button
                              onClick={() => handleDeleteLeaveRecord(r.id)}
                              className="bg-red-50 hover:bg-red-100 text-red-700 px-2.5 py-1 rounded-lg border border-red-200 font-bold transition text-[11px]"
                            >
                              🗑️ ลบ
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB: PERFORMANCE & ROAMING PIE CHART */}
      {activeTab === 'performance' && (
        <div className="space-y-6">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h2 className="font-extrabold text-base text-slate-900">
                📊 รายงานประสิทธิภาพการทำงานประจำเดือน {formatThaiMonth(selectedMonthYear)}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                เลือกสลับมุมมองสถิติและ Pie Chart แยกรายพนักงาน หรือ แยกรายสาขา
              </p>
            </div>

            {/* DUAL FILTER CONTROLS */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="bg-slate-100 p-1 rounded-xl flex items-center gap-1 border border-slate-200 text-xs font-bold">
                <button
                  onClick={() => setPerfFilterMode('EMPLOYEE')}
                  className={`px-3 py-1.5 rounded-lg transition ${
                    perfFilterMode === 'EMPLOYEE'
                      ? 'bg-red-600 text-white shadow-sm font-black'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  👤 กรองรายพนักงาน
                </button>
                <button
                  onClick={() => setPerfFilterMode('BRANCH')}
                  className={`px-3 py-1.5 rounded-lg transition ${
                    perfFilterMode === 'BRANCH'
                      ? 'bg-red-600 text-white shadow-sm font-black'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  🏪 กรองรายสาขา
                </button>
              </div>

              {perfFilterMode === 'EMPLOYEE' ? (
                <select
                  value={selectedPerfEmpId}
                  onChange={(e) => setSelectedPerfEmpId(e.target.value)}
                  className="p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-red-500 outline-none"
                >
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      👤 {emp.fullName} ({emp.nickname || emp.role})
                    </option>
                  ))}
                </select>
              ) : (
                <select
                  value={selectedPerfBranchId}
                  onChange={(e) => setSelectedPerfBranchId(e.target.value)}
                  className="p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-black text-red-600 focus:ring-2 focus:ring-red-500 outline-none cursor-pointer"
                >
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      🏬 {b.name} ({b.code})
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {/* VIEW MODE 1: EMPLOYEE FILTER */}
          {perfFilterMode === 'EMPLOYEE' && selectedPerfItem && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-1">
                  <p className="text-xs text-slate-500 font-bold">จำนวนกะเข้างานรวม</p>
                  <p className="text-2xl font-black text-slate-900">{selectedPerfItem.totalShifts} วัน</p>
                  <span className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-medium border border-slate-200">
                    {selectedPerfItem.employee?.employmentType === 'PART_TIME' ? 'พาร์ทไทม์' : 'ประจำ'}
                  </span>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-1">
                  <p className="text-xs text-slate-500 font-bold">อัตราตรงเวลา (On-Time Rate)</p>
                  <p className="text-2xl font-black text-sky-600">{selectedPerfItem.onTimeRate}%</p>
                  <p className="text-[10px] text-slate-500">
                    ตรงเวลา {selectedPerfItem.onTimeCount} วัน | สาย {selectedPerfItem.lateCount} ครั้ง
                  </p>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-1">
                  <p className="text-xs text-slate-500 font-bold">โบนัสยอดขายที่ได้รับ</p>
                  <p className="text-2xl font-black text-emerald-600">+{selectedPerfItem.totalBonusAmount.toLocaleString()} ฿</p>
                  <p className="text-[10px] text-slate-500">ในเดือน {formatThaiMonth(selectedMonthYear)}</p>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-1">
                  <p className="text-xs text-slate-500 font-bold">สาขาประจำ (Home Branch)</p>
                  <p className="text-sm font-black text-slate-900 truncate">
                    {selectedPerfItem.employee?.homeBranch?.name}
                  </p>
                  <span className="text-[10px] bg-red-50 text-red-700 px-2 py-0.5 rounded font-bold border border-red-200">
                    {selectedPerfItem.employee?.canRoam ? '⚡ หมุนเวียนสาขาได้' : 'ประจำสาขาเดียว'}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="font-black text-sm text-slate-900 flex items-center gap-2">
                  <span>🥧 Pie Chart สัดส่วนการทำงานข้ามสาขาของ {selectedPerfItem.employee?.fullName} ({formatThaiMonth(selectedMonthYear)})</span>
                </h3>
                <BranchPieChart
                  data={selectedPerfItem.branchBreakdown}
                  totalShifts={selectedPerfItem.totalShifts}
                />
              </div>

              {/* DETAILED BONUS BREAKDOWN PER EMPLOYEE */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2">
                  <div>
                    <h3 className="font-black text-sm text-slate-900 flex items-center gap-2">
                      <span>💰 รายละเอียดโบนัสรายวันและสาขาของ {selectedPerfItem.employee?.fullName} ({formatThaiMonth(selectedMonthYear)})</span>
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      แสดงรายการโบนัสที่ได้รับในแต่ละวัน • <span className="font-bold text-slate-900">ชื่อสีดำ = Full Time</span> • <span className="font-bold text-sky-600">ชื่อสีฟ้า = Part Time</span> (การคิดโบนัสอิงตามพนักงาน Full Time เท่านั้น)
                    </p>
                  </div>
                  <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 font-extrabold px-3 py-1.5 rounded-xl text-xs">
                    ยอดโบนัสสะสม: +{selectedPerfItem.totalBonusAmount.toLocaleString()} บาท ({selectedPerfItem.bonusDetails?.length || 0} วัน)
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                        <th className="p-2.5">วันที่</th>
                        <th className="p-2.5">สาขาที่ทำยอดขาย</th>
                        <th className="p-2.5 text-right">ยอดขายรวมสาขา</th>
                        <th className="p-2.5 text-center">โบนัสที่ได้รับ</th>
                        <th className="p-2.5">พนักงานที่เข้ากะวันนั้น (จำนวน & รายชื่อ)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {!selectedPerfItem.bonusDetails || selectedPerfItem.bonusDetails.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="p-4 text-center text-slate-400 italic">
                            ไม่พบประวัติโบนัสย้อนหลังในเดือนนี้
                          </td>
                        </tr>
                      ) : (
                        selectedPerfItem.bonusDetails.map((b: any) => (
                          <tr key={b.id} className="hover:bg-slate-50">
                            <td className="p-2.5 font-semibold font-mono text-slate-900">{b.dateStr}</td>
                            <td className="p-2.5 font-bold text-red-600">
                              🏬 {b.branchName} ({b.branchCode})
                            </td>
                            <td className="p-2.5 text-right font-mono font-bold text-slate-900">
                              {b.totalSales.toLocaleString()} ฿
                            </td>
                            <td className="p-2.5 text-center">
                              <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 font-black px-2.5 py-1 rounded-full text-xs">
                                +{b.amount.toLocaleString()} ฿
                              </span>
                            </td>
                            <td className="p-2.5 text-slate-800 text-[11px] font-medium">
                              {b.shiftStaffList && b.shiftStaffList.length > 0 ? (
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="bg-slate-100 text-slate-800 border border-slate-200 px-2 py-0.5 rounded-lg font-black text-[10px]">
                                    👥 FT {b.fullTimeCount || 0} คน {b.partTimeCount > 0 ? `(+PT ${b.partTimeCount} คน)` : ''}
                                  </span>
                                  <div className="flex items-center gap-0.5 flex-wrap">
                                    {b.shiftStaffList.map((st: any, sIdx: number) => (
                                      <span key={sIdx} className="inline-flex items-center">
                                        <span
                                          className={
                                            st.employmentType === 'PART_TIME'
                                              ? 'text-sky-600 font-extrabold'
                                              : 'text-slate-900 font-extrabold'
                                          }
                                        >
                                          {st.name}
                                        </span>
                                        {sIdx < b.shiftStaffList.length - 1 && (
                                          <span className="text-slate-400 font-normal mr-1">,</span>
                                        )}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              ) : (
                                <span className="text-slate-600">{b.shiftStaffText || b.reason}</span>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* VIEW MODE 2: BRANCH FILTER */}
          {perfFilterMode === 'BRANCH' && (() => {
            const selectedBranch = branches.find((b) => b.id === selectedPerfBranchId) || branches[0];
            if (!selectedBranch) return null;

            const branchLogs = attendanceLogs.filter((att) => att.branchId === selectedBranch.id);
            const branchSales = salesRecords.filter((s) => s.branchId === selectedBranch.id);
            const totalBranchSales = branchSales.reduce((sum, s) => sum + s.totalSales, 0);

            const branchPayouts: any[] = [];
            branchSales.forEach((s) => {
              if (s.bonusPayouts) branchPayouts.push(...s.bonusPayouts);
            });
            const totalBranchBonusPaid = branchPayouts.reduce((sum, p) => sum + p.amount, 0);

            const staffStatsMap: Record<string, { employee: any; shiftCount: number; bonusEarned: number; onTimeCount: number }> = {};
            for (const log of branchLogs) {
              const empId = log.employeeId;
              if (!staffStatsMap[empId]) {
                staffStatsMap[empId] = {
                  employee: log.employee,
                  shiftCount: 0,
                  bonusEarned: 0,
                  onTimeCount: 0,
                };
              }
              staffStatsMap[empId].shiftCount += 1;
              if (log.status === 'ON_TIME') staffStatsMap[empId].onTimeCount += 1;
            }

            for (const payout of branchPayouts) {
              const empId = payout.employeeId;
              if (staffStatsMap[empId]) {
                staffStatsMap[empId].bonusEarned += payout.amount;
              }
            }

            const totalBranchShifts = branchLogs.length;
            const staffBreakdownList = Object.values(staffStatsMap).map((st: any, idx: number) => ({
              branchId: st.employee?.id || `EMP_${idx}`,
              branchCode: st.employee?.fullName || 'ไม่ระบุ',
              branchName: st.employee?.fullName ? `${st.employee.fullName} (${st.employee.nickname || 'พนักงาน'})` : 'พนักงาน',
              count: st.shiftCount,
              percentage: totalBranchShifts > 0 ? Math.round((st.shiftCount / totalBranchShifts) * 100) : 0,
            }));

            return (
              <div className="space-y-4">
                {/* Branch Overview Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-1">
                    <p className="text-xs text-slate-500 font-bold">กะเข้างานรวมที่สาขานี้</p>
                    <p className="text-2xl font-black text-slate-900">{totalBranchShifts} กะ</p>
                    <span className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-medium border border-slate-200">
                      เปิดให้บริการ {branchSales.length} วัน
                    </span>
                  </div>

                  <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-1">
                    <p className="text-xs text-slate-500 font-bold">ยอดขายรวมของสาขา</p>
                    <p className="text-2xl font-black text-red-600">{totalBranchSales.toLocaleString()} ฿</p>
                    <p className="text-[10px] text-slate-500">ในเดือน {formatThaiMonth(selectedMonthYear)}</p>
                  </div>

                  <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-1">
                    <p className="text-xs text-slate-500 font-bold">โบนัสยอดขายที่จ่ายรวม</p>
                    <p className="text-2xl font-black text-emerald-600">+{totalBranchBonusPaid.toLocaleString()} ฿</p>
                    <p className="text-[10px] text-slate-500">จ่ายให้พนักงาน {branchPayouts.length} ครั้ง</p>
                  </div>

                  <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-1">
                    <p className="text-xs text-slate-500 font-bold">พนักงานที่เคยเข้างาน</p>
                    <p className="text-2xl font-black text-sky-600">{Object.keys(staffStatsMap).length} คน</p>
                    <span className="text-[10px] bg-sky-50 text-sky-700 px-2 py-0.5 rounded font-bold border border-sky-200">
                      ประจำ + หมุนเวียน
                    </span>
                  </div>
                </div>

                {/* Pie Chart Distribution of Staff at Branch */}
                <div className="space-y-2">
                  <h3 className="font-black text-sm text-slate-900 flex items-center gap-2">
                    <span>🥧 Pie Chart สัดส่วนพนักงานที่มาปฏิบัติงาน ณ สาขา {selectedBranch.name} ({formatThaiMonth(selectedMonthYear)})</span>
                  </h3>
                  <BranchPieChart
                    data={staffBreakdownList}
                    totalShifts={totalBranchShifts}
                  />
                </div>

                {/* Staff Breakdown Table at Branch */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
                  <h3 className="font-black text-sm text-slate-900">
                    👥 รายชื่อพนักงานที่เข้างานและรับโบนัส ณ สาขา {selectedBranch.name} ({formatThaiMonth(selectedMonthYear)})
                  </h3>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                          <th className="p-2.5">พนักงาน</th>
                          <th className="p-2.5">สาขาประจำ</th>
                          <th className="p-2.5 text-center">สิทธิหมุนเวียน</th>
                          <th className="p-2.5 text-center">จำนวนวันที่เข้างานสาขานี้</th>
                          <th className="p-2.5 text-center">ตรงเวลา (%)</th>
                          <th className="p-2.5 text-right">โบนัสที่ได้รับจากสาขานี้</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {Object.values(staffStatsMap).length === 0 ? (
                          <tr>
                            <td colSpan={6} className="p-4 text-center text-slate-400 italic">
                              ไม่พบข้อมูลการเข้างานที่สาขานี้ในเดือนนี้
                            </td>
                          </tr>
                        ) : (
                          Object.values(staffStatsMap).map((st: any) => {
                            const onTimePct = st.shiftCount > 0 ? Math.round((st.onTimeCount / st.shiftCount) * 100) : 100;
                            return (
                              <tr key={st.employee?.id} className="hover:bg-slate-50">
                                <td className="p-2.5 font-bold text-slate-900">
                                  {st.employee?.fullName} ({st.employee?.nickname || 'พนักงาน'})
                                </td>
                                <td className="p-2.5 text-slate-600">{st.employee?.homeBranch?.name || '-'}</td>
                                <td className="p-2.5 text-center">
                                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${st.employee?.canRoam ? 'bg-red-50 text-red-700 border-red-200' : 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                                    {st.employee?.canRoam ? '⚡ หมุนเวียน' : 'ประจำสาขา'}
                                  </span>
                                </td>
                                <td className="p-2.5 text-center font-bold text-slate-900">{st.shiftCount} วัน</td>
                                <td className="p-2.5 text-center font-black text-sky-600">{onTimePct}%</td>
                                <td className="p-2.5 text-right font-black text-emerald-600">
                                  +{st.bonusEarned.toLocaleString()} ฿
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* TAB 1: BONUS & DAILY SALES */}
      {activeTab === 'bonus' && (
        <div className="space-y-6">
          <div className="bg-white text-slate-900 p-5 rounded-2xl shadow-sm space-y-4 border border-slate-200">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2">
              <div>
                <h2 className="font-extrabold text-base flex items-center gap-2 text-slate-900">
                  <span>📥 นำเข้ายอดขายทุกสาขาพร้อมกัน (Google Sheets / CSV Bulk Import)</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  สามารถก๊อปปี้ข้อมูลจาก Google Sheets / Excel มาวางในช่องด้านล่าง หรืออัปโหลดไฟล์ .csv เพื่อนำเข้าข้อมูลทีละหลายสาขาในครั้งเดียว
                </p>
              </div>

              <button
                onClick={downloadSampleCsv}
                className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-3 py-2 rounded-xl transition shadow"
              >
                📄 ดาวน์โหลดไฟล์ตัวอย่าง CSV
              </button>
            </div>

            <form onSubmit={handleBulkImportSales} className="space-y-3">
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-bold text-slate-700">
                    วางข้อมูล CSV / Google Sheets (รูปแบบ: วันที่, รหัสสาขา, ยอดขาย):
                  </label>
                  <label className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-800 px-3 py-1 rounded-lg border border-slate-300 cursor-pointer font-bold transition">
                    📁 หรือเลือกไฟล์ .csv
                    <input type="file" accept=".csv,.txt" onChange={handleCsvFileUpload} className="hidden" />
                  </label>
                </div>
                <textarea
                  rows={4}
                  value={csvInputText}
                  onChange={(e) => setCsvInputText(e.target.value)}
                  className="w-full p-3 bg-slate-50 text-slate-900 border border-slate-300 rounded-xl text-xs font-mono focus:ring-2 focus:ring-red-500 outline-none"
                  placeholder="2026-08-20, B1, 22000&#10;2026-08-20, B2, 30000"
                />
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={isImporting}
                  className="bg-red-600 hover:bg-red-700 text-white font-extrabold px-5 py-2.5 rounded-xl text-xs shadow transition disabled:opacity-50"
                >
                  {isImporting ? 'กำลังนำเข้าและประมวลผลโบนัส...' : '🚀 กดนำเข้ายอดขายทุกสาขาในครั้งเดียว'}
                </button>
              </div>
            </form>

            {bulkImportResults && (
              <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl space-y-3">
                <div className="font-bold text-slate-900 text-xs flex justify-between">
                  <span>🎉 {bulkImportResults.message}</span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-100 text-slate-700 border-b border-slate-200 font-bold">
                        <th className="p-2">วันที่</th>
                        <th className="p-2">สาขา</th>
                        <th className="p-2">ยอดขาย</th>
                        <th className="p-2 text-center">พนักงานเข้างาน</th>
                        <th className="p-2 text-center">โบนัสต่อคน</th>
                        <th className="p-2">สถานะ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-slate-800">
                      {bulkImportResults.results?.map((res: any, idx: number) => (
                        <tr key={idx} className="hover:bg-slate-100">
                          <td className="p-2 font-mono">{res.dateStr}</td>
                          <td className="p-2 font-bold text-red-600">{res.branchName || res.branchCodeOrName}</td>
                          <td className="p-2 font-bold">{res.totalSales ? res.totalSales.toLocaleString() + ' บาท' : '-'}</td>
                          <td className="p-2 text-center">{res.workingStaffCount !== undefined ? res.workingStaffCount + ' คน' : '-'}</td>
                          <td className="p-2 text-center font-extrabold text-emerald-600">
                            {res.bonusPerPerson ? `+${res.bonusPerPerson} บาท` : '0 บาท'}
                          </td>
                          <td className="p-2">
                            {res.status === 'SUCCESS' ? (
                              <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold px-2 py-0.5 rounded text-[10px]">
                                ✅ สำเร็จ ({res.payoutsCount} คนได้รับโบนัส)
                              </span>
                            ) : (
                              <span className="bg-red-100 text-red-800 border border-red-300 font-bold px-2 py-0.5 rounded text-[10px]">
                                ❌ ล้มเหลว ({res.reason})
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <h2 className="font-bold text-slate-900 text-base flex items-center gap-2">
              <span>✍️ หรือบันทึกยอดขายทีละสาขา (Single Entry)</span>
            </h2>

            <form onSubmit={handleSaveSales} className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">เลือกสาขา (Branch):</label>
                <select
                  value={salesBranchId}
                  onChange={(e) => setSalesBranchId(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900"
                >
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">วันที่ (Date):</label>
                <input
                  type="date"
                  value={salesDateStr}
                  onChange={(e) => setSalesDateStr(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">ยอดขายรวมประจำวัน (บาท):</label>
                <input
                  type="number"
                  placeholder="เช่น 22000"
                  value={salesAmount}
                  onChange={(e) => setSalesAmount(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900"
                />
              </div>

              <div className="flex items-end">
                <button
                  type="submit"
                  className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-2.5 px-4 rounded-xl text-xs shadow transition"
                >
                  ⚡ คำนวณและบันทึกโบนัส
                </button>
              </div>
            </form>

            {salesFeedback && (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-xs space-y-2">
                <div className="font-bold text-emerald-900 text-sm">
                  🎉 {salesFeedback.message}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-slate-700 font-medium">
                  <p>พนักงานเข้างานจริง: <strong className="text-emerald-700">{salesFeedback.workingStaffCount} คน</strong></p>
                  <p>โบนัสต่อคน: <strong className="text-emerald-700">{salesFeedback.bonusResult.bonusPerPerson} บาท/คน</strong></p>
                  <p>รวมโบนัสทั้งหมด: <strong className="text-emerald-700">{salesFeedback.bonusResult.totalBonusPool} บาท</strong></p>
                </div>
                <p className="text-slate-600 text-xs italic bg-white p-2 rounded border border-emerald-100">
                  📌 เหตุผล: {salesFeedback.bonusResult.reason}
                </p>

                {salesFeedback.payouts && salesFeedback.payouts.length > 0 && (
                  <div className="pt-2">
                    <p className="font-bold text-slate-800 mb-1">รายชื่อพนักงานที่ได้รับโบนัสในวันดังกล่าว:</p>
                    <ul className="list-disc pl-5 space-y-0.5">
                      {salesFeedback.payouts.map((p: any) => (
                        <li key={p.id}>
                          {p.employee.fullName} ({p.employee.nickname}) — <strong className="text-emerald-700">+{p.amount} บาท</strong>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
            <h3 className="font-bold text-slate-900 text-sm">
              ประวัติการคำนวณโบนัสประจำวันในเดือน {formatThaiMonth(selectedMonthYear)}
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                    <th className="p-2.5">วันที่</th>
                    <th className="p-2.5">สาขา</th>
                    <th className="p-2.5">ยอดขายรวม</th>
                    <th className="p-2.5">พนักงานที่เข้างาน & โบนัสที่ได้รับ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {salesRecords.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-4 text-center text-slate-400">ยังไม่มีข้อมูลบันทึกยอดขายในเดือนนี้</td>
                    </tr>
                  ) : (
                    salesRecords.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-50">
                        <td className="p-2.5 font-semibold text-slate-900">{r.dateStr}</td>
                        <td className="p-2.5 text-red-600 font-bold">{r.branch?.name}</td>
                        <td className="p-2.5 font-black text-slate-900">{r.totalSales.toLocaleString()} บาท</td>
                        <td className="p-2.5">
                          {r.bonusPayouts?.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {r.bonusPayouts.map((p: any) => (
                                <span key={p.id} className="bg-emerald-100 text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded text-[11px] font-medium">
                                  {p.employee?.fullName}: +{p.amount}B
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-slate-400 italic">ไม่ผ่านเกณฑ์โบนัส</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: DILIGENCE ALLOWANCE */}
      {activeTab === 'diligence' && (() => {
        const filteredDiligence = diligenceReport.filter((row) => {
          if (selectedDiligenceBranchId === 'ALL') return true;
          return row.employee.homeBranchId === selectedDiligenceBranchId || row.employee.homeBranch?.id === selectedDiligenceBranchId;
        });

        const totalStaffCount = filteredDiligence.length;
        const eligibleStaffCount = filteredDiligence.filter((r) => r.evalResult.isEligible).length;
        const totalPayoutAmount = eligibleStaffCount * 500;

        return (
          <div className="space-y-6">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <h2 className="font-extrabold text-base text-slate-900 flex items-center gap-2">
                    <span>🏆 รายงานสรุปเบี้ยขยันประจำเดือน {formatThaiMonth(selectedMonthYear)}</span>
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    เกณฑ์: เงินพิเศษ 500 บาท/เดือน | มาสาย &lt; 3 ครั้ง (ไม่เกิน 15 นาที) | ไม่ขาด ไม่ลา
                  </p>
                </div>

                {/* BRANCH FILTER DROPDOWN */}
                <div className="flex items-center gap-2">
                  <label className="text-xs font-bold text-slate-700 whitespace-nowrap">กรองตามสาขา:</label>
                  <select
                    value={selectedDiligenceBranchId}
                    onChange={(e) => setSelectedDiligenceBranchId(e.target.value)}
                    className="p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-black text-red-600 focus:ring-2 focus:ring-red-500 outline-none cursor-pointer"
                  >
                    <option value="ALL">🌐 ทั้งหมดทุกสาขา ({employees.length} คน)</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        🏬 {b.name} ({b.code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* STATS OVERVIEW FOR SELECTED BRANCH */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t border-slate-100">
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-0.5">
                  <p className="text-[11px] font-bold text-slate-500">จำนวนพนักงานในสาขานี้</p>
                  <p className="text-xl font-black text-slate-900">{totalStaffCount} คน</p>
                </div>
                <div className="bg-emerald-50 p-3.5 rounded-xl border border-emerald-200 space-y-0.5">
                  <p className="text-[11px] font-bold text-emerald-800">ผ่านเกณฑ์ได้รับเบี้ยขยัน</p>
                  <p className="text-xl font-black text-emerald-600">{eligibleStaffCount} คน</p>
                </div>
                <div className="bg-emerald-100/70 p-3.5 rounded-xl border border-emerald-300 space-y-0.5">
                  <p className="text-[11px] font-bold text-emerald-900">ยอดรวมจ่ายเงินเบี้ยขยันสาขานี้</p>
                  <p className="text-xl font-black text-emerald-700">+{totalPayoutAmount.toLocaleString()} บาท</p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                      <th className="p-3">ชื่อ-นามสกุล พนักงาน</th>
                      <th className="p-3">สาขาประจำ</th>
                      <th className="p-3">ประเภทพนักงาน</th>
                      <th className="p-3 text-center">มาสาย (&lt;15นาที)</th>
                      <th className="p-3 text-center">ลางาน (ครั้ง/วัน)</th>
                      <th className="p-3 text-center">ขาดงาน</th>
                      <th className="p-3 text-center">สถานะเบี้ยขยัน</th>
                      <th className="p-3 text-right">จำนวนเงินที่ต้องจ่าย</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {filteredDiligence.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="p-4 text-center text-slate-400 italic">
                          ไม่พบข้อมูลพนักงาน ณ สาขาที่เลือก
                        </td>
                      </tr>
                    ) : (
                      filteredDiligence.map((row) => (
                        <tr key={row.employee.id} className="hover:bg-slate-50">
                          <td className="p-3 font-bold text-slate-900">
                            {row.employee.fullName} ({row.employee.nickname || 'พนักงาน'})
                          </td>
                          <td className="p-3 text-slate-600 font-medium">
                            {row.employee.homeBranch?.name || '-'}
                          </td>
                          <td className="p-3">
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                                row.employee.employmentType === 'PART_TIME'
                                  ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                  : 'bg-sky-100 text-sky-900 border border-sky-300'
                              }`}
                            >
                              {row.employee.employmentType === 'PART_TIME' ? '⏳ Part-Time' : '💼 Full-Time'}
                            </span>
                          </td>
                          <td className="p-3 text-center font-bold">
                            <span className={row.diligence?.lateCount >= 3 ? 'text-red-600 font-black' : 'text-slate-800'}>
                              {row.diligence?.lateCount || 0} ครั้ง
                            </span>
                          </td>
                          <td className="p-3 text-center font-bold">
                            <span className={row.diligence?.leaveCount > 0 ? 'text-red-600 font-extrabold' : 'text-slate-800'}>
                              {row.diligence?.leaveCount || 0} วัน
                            </span>
                          </td>
                          <td className="p-3 text-center font-bold">
                            <span className={row.diligence?.absentCount > 0 ? 'text-red-600 font-extrabold' : 'text-slate-800'}>
                              {row.diligence?.absentCount || 0} วัน
                            </span>
                          </td>
                          <td className="p-3 text-center">
                            {row.evalResult.isEligible ? (
                              <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold px-2.5 py-1 rounded-full text-[11px]">
                                ✅ ผ่านเกณฑ์ได้รับ
                              </span>
                            ) : (
                              <span className="bg-red-100 text-red-800 border border-red-300 font-bold px-2.5 py-1 rounded-full text-[11px]" title={row.evalResult.reason}>
                                ❌ ตัดสิทธิ์ ({row.evalResult.reason})
                              </span>
                            )}
                          </td>
                          <td className="p-3 text-right font-black text-sm">
                            {row.evalResult.isEligible ? (
                              <span className="text-emerald-600">+500 บาท</span>
                            ) : (
                              <span className="text-slate-400">0 บาท</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );
      })()}

      {/* TAB: PAYROLL SUMMARY (BONUS + DILIGENCE) */}
      {activeTab === 'payroll' && (() => {
        const payrollList = employees.map((emp) => {
          const perfData = perfReport.find((p) => p.employee.id === emp.id);
          const bonusDetails = perfData?.bonusDetails || [];

          let bonusAmount = 0;
          if (selectedPayrollBranchId === 'ALL') {
            bonusAmount = perfData?.totalBonusAmount || 0;
          } else {
            const selectedBranchObj = branches.find((b) => b.id === selectedPayrollBranchId);
            bonusAmount = bonusDetails
              .filter((b: any) => b.branchName === selectedBranchObj?.name || b.branchCode === selectedBranchObj?.code)
              .reduce((sum: number, b: any) => sum + (b.amount || 0), 0);
          }

          const diligenceData = diligenceReport.find((d) => d.employee.id === emp.id);
          let diligenceAmount = 0;
          let diligenceStatus = 'ตัดสิทธิ์ / ไม่ได้สิทธิ์';

          if (emp.employmentType === 'PART_TIME') {
            diligenceStatus = '❌ ไม่มีสิทธิ์ (Part-Time)';
          } else if (diligenceData?.evalResult?.isEligible) {
            if (selectedPayrollBranchId === 'ALL' || emp.homeBranchId === selectedPayrollBranchId || emp.homeBranch?.id === selectedPayrollBranchId) {
              diligenceAmount = diligenceData.evalResult.allowanceAmount || 500;
              diligenceStatus = '✅ ผ่านเกณฑ์ (+500฿)';
            } else {
              diligenceStatus = 'ประจำสาขาอื่น';
            }
          } else if (diligenceData?.evalResult?.reason) {
            diligenceStatus = `❌ Cut (${diligenceData.evalResult.reason})`;
          }

          const totalNetPay = bonusAmount + diligenceAmount;

          return {
            employee: emp,
            homeBranchName: emp.homeBranch?.name || '-',
            bonusAmount,
            bonusDaysCount: bonusDetails.length,
            diligenceAmount,
            diligenceStatus,
            totalNetPay,
          };
        });

        const filteredPayroll = payrollList.filter((row) => {
          if (selectedPayrollBranchId === 'ALL') return true;
          return row.employee.homeBranchId === selectedPayrollBranchId || row.bonusAmount > 0;
        });

        const totalBonusAll = filteredPayroll.reduce((sum, r) => sum + r.bonusAmount, 0);
        const totalDiligenceAll = filteredPayroll.reduce((sum, r) => sum + r.diligenceAmount, 0);
        const grandTotalNet = totalBonusAll + totalDiligenceAll;

        return (
          <div className="space-y-6">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <h2 className="font-extrabold text-base text-slate-900 flex items-center gap-2">
                    <span>💵 สรุปยอดจ่ายรวม (โบนัสยอดขาย + เบี้ยขยัน) ประจำเดือน {formatThaiMonth(selectedMonthYear)}</span>
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    รวมยอดเงินพิเศษที่พนักงานแต่ละคนได้รับ เพื่อนำไปทำจ่ายในระบบเงินเดือน • <span className="font-bold text-slate-900">ชื่อสีดำ = Full Time</span> • <span className="font-bold text-sky-600">ชื่อสีฟ้า = Part Time</span>
                  </p>
                </div>

                {/* BRANCH FILTER DROPDOWN */}
                <div className="flex items-center gap-2">
                  <label className="text-xs font-bold text-slate-700 whitespace-nowrap">กรองตามสาขา:</label>
                  <select
                    value={selectedPayrollBranchId}
                    onChange={(e) => setSelectedPayrollBranchId(e.target.value)}
                    className="p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-black text-red-600 focus:ring-2 focus:ring-red-500 outline-none cursor-pointer"
                  >
                    <option value="ALL">🌐 ทั้งหมดทุกสาขา ({employees.length} คน)</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        🏬 {b.name} ({b.code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* OVERVIEW STAT CARDS */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t border-slate-100">
                <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-200 space-y-1">
                  <p className="text-xs font-bold text-emerald-800">💰 ยอดโบนัสยอดขายรวม</p>
                  <p className="text-2xl font-black text-emerald-600">+{totalBonusAll.toLocaleString()} บาท</p>
                </div>
                <div className="bg-sky-50 p-4 rounded-xl border border-sky-200 space-y-1">
                  <p className="text-xs font-bold text-sky-800">🏆 ยอดเบี้ยขยันรวม (เฉพาะ Full-Time)</p>
                  <p className="text-2xl font-black text-sky-600">+{totalDiligenceAll.toLocaleString()} บาท</p>
                </div>
                <div className="bg-red-600 text-white p-4 rounded-xl shadow-md space-y-1">
                  <p className="text-xs font-bold text-red-100">💵 รวมยอดเงินที่ต้องทำจ่ายสุทธิ</p>
                  <p className="text-2xl font-black text-white">+{grandTotalNet.toLocaleString()} บาท</p>
                </div>
              </div>

              {/* PAYROLL BREAKDOWN TABLE */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                      <th className="p-3">ชื่อ-นามสกุล พนักงาน</th>
                      <th className="p-3">สาขาประจำ</th>
                      <th className="p-3">ประเภทพนักงาน</th>
                      <th className="p-3 text-right">โบนัสยอดขาย (บาท)</th>
                      <th className="p-3 text-right">เบี้ยขยัน (บาท)</th>
                      <th className="p-3 text-right text-red-600">ยอดจ่ายสุทธิรวม (บาท)</th>
                      <th className="p-3">สถานะ / รายละเอียดเพิ่มเติม</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {filteredPayroll.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-4 text-center text-slate-400 italic">
                          ไม่พบข้อมูลพนักงาน ณ สาขาที่เลือก
                        </td>
                      </tr>
                    ) : (
                      filteredPayroll.map((r) => (
                        <tr key={r.employee.id} className="hover:bg-slate-50">
                          <td className="p-3">
                            <span
                              className={`font-extrabold text-sm ${
                                r.employee.employmentType === 'PART_TIME'
                                  ? 'text-sky-600'
                                  : 'text-slate-900'
                              }`}
                            >
                              {r.employee.fullName} ({r.employee.nickname || 'พนักงาน'})
                            </span>
                          </td>
                          <td className="p-3 text-slate-600 font-semibold">{r.homeBranchName}</td>
                          <td className="p-3">
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                                r.employee.employmentType === 'PART_TIME'
                                  ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                  : 'bg-sky-100 text-sky-900 border border-sky-300'
                              }`}
                            >
                              {r.employee.employmentType === 'PART_TIME' ? '⏳ Part-Time' : '💼 Full-Time'}
                            </span>
                          </td>
                          <td className="p-3 text-right font-mono font-bold text-emerald-600">
                            {r.bonusAmount > 0 ? `+${r.bonusAmount.toLocaleString()} ฿` : '0 ฿'}
                          </td>
                          <td className="p-3 text-right font-mono font-bold text-sky-600">
                            {r.diligenceAmount > 0 ? `+${r.diligenceAmount.toLocaleString()} ฿` : '0 ฿'}
                          </td>
                          <td className="p-3 text-right font-mono font-black text-sm text-red-600 bg-red-50/50">
                            +{r.totalNetPay.toLocaleString()} ฿
                          </td>
                          <td className="p-3 text-slate-600 text-[11px]">
                            {r.diligenceStatus}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );
      })()}

      {/* TAB 3: ATTENDANCE LOGS */}
      {activeTab === 'logs' && (
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <h2 className="font-bold text-slate-900 text-base">
            📋 ประวัติลงเวลาเข้า-ออกงาน ({formatThaiMonth(selectedMonthYear)})
          </h2>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                  <th className="p-3">วันที่ / เวลาเข้างาน</th>
                  <th className="p-3">พนักงาน</th>
                  <th className="p-3">วิธียืนยันตัวตน</th>
                  <th className="p-3">สาขาที่เข้างานจริง</th>
                  <th className="p-3">สถานะ</th>
                  <th className="p-3">หมายเหตุ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {attendanceLogs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-4 text-center text-slate-400">ยังไม่มีประวัติการเข้างานในเดือนนี้</td>
                  </tr>
                ) : (
                  attendanceLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50">
                      <td className="p-3 font-medium text-slate-900">
                        {log.dateStr}
                        <br />
                        <span className="text-slate-500">{new Date(log.clockInAt).toLocaleTimeString('th-TH')}</span>
                      </td>
                      <td className="p-3 font-bold text-slate-900">
                        {log.employee?.fullName} ({log.employee?.nickname})
                      </td>
                      <td className="p-3 font-bold">
                        {log.verificationMethod === 'PIN_CODE' ? (
                          <span className="text-amber-800 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded text-[10px]">
                            🔑 รหัส PIN พนักงาน
                          </span>
                        ) : (
                          <span className="text-sky-800 bg-sky-100 border border-sky-300 px-2 py-0.5 rounded text-[10px]">
                            🔑 รหัส PIN ประจำตัว
                          </span>
                        )}
                      </td>
                      <td className="p-3 font-bold text-red-600">{log.branch?.name}</td>
                      <td className="p-3">
                        <span
                          className={`px-2.5 py-0.5 rounded-full font-bold text-[10px] text-white ${
                            log.status === 'ON_TIME' ? 'bg-emerald-600' : 'bg-amber-600'
                          }`}
                        >
                          {log.status === 'ON_TIME' ? 'ตรงเวลา' : `สาย ${log.lateMinutes} นาที`}
                        </span>
                      </td>
                      <td className="p-3 text-slate-600 text-[11px]">{log.notes || '-'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: BRANCHES & GPS COORDINATE LOCK EDITOR */}
      {activeTab === 'branches' && (
        <div className="space-y-6">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <h2 className="font-bold text-slate-900 text-base">🏪 รายชื่อ 4 สาขา & พิกัด GPS Geofence ปัจจุบัน</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {branches.map((b) => (
                <div key={b.id} className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2 text-xs">
                  <div className="flex justify-between items-center">
                    <h3 className="font-black text-sm text-red-600">{b.name} ({b.code})</h3>
                    <span className="bg-slate-200 text-slate-800 font-bold px-2.5 py-0.5 rounded-full border border-slate-300">
                      เวลามาตรฐาน: {b.shiftStartTime} น.
                    </span>
                  </div>
                  <p className="text-slate-700 font-mono">📍 พิกัด GPS: {b.latitude}, {b.longitude}</p>
                  <p className="text-slate-700">
                    🎯 รัศมีอนุญาต: <strong className={b.allowedRadiusMeters <= 5 ? 'text-red-600' : 'text-emerald-700'}>{b.allowedRadiusMeters} เมตร</strong>
                  </p>
                  <button
                    onClick={() => handleSelectBranchToEdit(b.id)}
                    className="mt-1 bg-red-50 hover:bg-red-100 text-red-700 font-bold px-3 py-1 rounded-lg border border-red-200 transition"
                  >
                    ✏️ ล็อก/แก้ไขพิกัด GPS สาขานี้
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-gradient-to-br from-red-50 to-white p-5 rounded-2xl border border-red-200 shadow-sm space-y-4">
            <div>
              <h3 className="font-black text-slate-900 text-base text-red-700 flex items-center gap-2">
                <span>📍 ตั้งค่าและล็อกพิกัด GPS ประจำสาขา (Set Branch GPS Coordinates)</span>
              </h3>
              <p className="text-xs text-slate-600 mt-1">
                คุณสามารถกดปุ่มเพื่อดึงพิกัดปัจจุบันจากตำแหน่งที่คุณยืนอยู่ ณ ร้านได้ทันที หรือคัดลอกพิกัดจาก Google Maps มาวาง
              </p>
            </div>

            <form onSubmit={handleSaveBranchGps} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div>
                  <label className="block font-bold text-slate-800 mb-1">เลือกสาขาที่จะตั้งพิกัด:</label>
                  <select
                    value={editBranchId}
                    onChange={(e) => handleSelectBranchToEdit(e.target.value)}
                    className="w-full p-2.5 bg-white border border-slate-300 text-slate-900 rounded-xl font-bold"
                    required
                  >
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-800 mb-1">Latitude (ละติจูด):</label>
                  <input
                    type="number"
                    step="any"
                    placeholder="เช่น 13.814321"
                    value={editLat}
                    onChange={(e) => setEditLat(e.target.value)}
                    className="w-full p-2.5 bg-white border border-slate-300 font-mono text-slate-900 rounded-xl font-bold"
                    required
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-800 mb-1">Longitude (ลองจิจูด):</label>
                  <input
                    type="number"
                    step="any"
                    placeholder="เช่น 100.561234"
                    value={editLng}
                    onChange={(e) => setEditLng(e.target.value)}
                    className="w-full p-2.5 bg-white border border-slate-300 font-mono text-slate-900 rounded-xl font-bold"
                    required
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-800 mb-1">รัศมีที่อนุญาต (เมตร):</label>
                  <input
                    type="number"
                    placeholder="เช่น 5 หรือ 100"
                    value={editRadius}
                    onChange={(e) => setEditRadius(e.target.value)}
                    className="w-full p-2.5 bg-white border border-slate-300 text-slate-900 rounded-xl font-bold"
                    required
                  />
                </div>
              </div>

              <div className="flex flex-col md:flex-row justify-between items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleGrabAdminGpsLocation}
                  disabled={isGrabbingGps}
                  className="w-full md:w-auto bg-slate-900 hover:bg-slate-800 text-white font-bold px-4 py-2.5 rounded-xl transition flex items-center justify-center gap-1.5 shadow"
                >
                  {isGrabbingGps ? 'กำลังเช็กตำแหน่ง...' : '📍 ดึงพิกัดตำแหน่งปัจจุบันจากมือถือ/คอมฯ ของฉันมาใส่'}
                </button>

                <button
                  type="submit"
                  className="w-full md:w-auto bg-red-600 hover:bg-red-700 text-white font-black px-6 py-2.5 rounded-xl transition shadow-md"
                >
                  💾 บันทึกและล็อกพิกัด GPS สาขา
                </button>
              </div>
            </form>

            <div className="bg-white p-3.5 rounded-xl border border-red-200 text-slate-700 text-xs space-y-1">
              <p className="font-bold text-red-700">💡 วิธีเอาพิกัด GPS จาก Google Maps มาใส่เอง:</p>
              <ol className="list-decimal pl-5 space-y-0.5 text-[11px] text-slate-600">
                <li>เปิดแอป <strong>Google Maps</strong> แล้วค้นหาตำแหน่งร้านอาหารของคุณ</li>
                <li>กดค้างที่จุดตำแหน่งร้าน จะมีหมุดสีแดงขึ้นมา</li>
                <li>คัดลอกตัวเลขพิกัดคู่ เช่น <code className="bg-slate-100 text-red-600 px-1 rounded">13.814321, 100.561234</code> แล้วนำตัวเลขแรกมาใส่ในช่อง <strong>Latitude</strong> และตัวเลขหลังใส่ในช่อง <strong>Longitude</strong></li>
              </ol>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="font-bold text-slate-900 text-sm">📅 กำหนดเวลาเข้างานในแต่ละวันแตกต่างกันตามสาขา (Daily Shift Schedule)</h3>

            <form onSubmit={handleSaveSchedule} className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">เลือกสาขา:</label>
                <select
                  value={selectedScheduleBranchId}
                  onChange={(e) => setSelectedScheduleBranchId(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 text-slate-900 rounded-xl font-bold"
                >
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">เลือกวันในสัปดาห์:</label>
                <select
                  value={scheduleDay}
                  onChange={(e) => setScheduleDay(parseInt(e.target.value, 10))}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 text-red-600 rounded-xl font-bold"
                >
                  {DAYS_OF_WEEK.map((d) => (
                    <option key={d.day} value={d.day}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">เวลาเริ่มกะเข้างาน:</label>
                <input
                  type="time"
                  value={scheduleStartTime}
                  onChange={(e) => setScheduleStartTime(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 text-slate-900 rounded-xl font-bold"
                  required
                />
              </div>

              <div className="flex items-end">
                <button
                  type="submit"
                  className="w-full bg-red-600 hover:bg-red-700 text-white font-bold p-2.5 rounded-xl transition"
                >
                  💾 บันทึกเวลาเข้างานของวัน
                </button>
              </div>
            </form>

            <div className="pt-3">
              <p className="font-bold text-xs text-slate-700 mb-2">ตารางเวลาเข้างานสาขาที่บันทึกแล้ว:</p>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100 font-bold border-b border-slate-200 text-slate-700">
                      <th className="p-2">สาขา</th>
                      <th className="p-2">วัน</th>
                      <th className="p-2">เวลาเริ่มกะเข้างาน</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {schedules.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="p-3 text-center text-slate-400">ยังไม่มีการตั้งตารางรายวัน (ใช้เวลามาตรฐานสาขา)</td>
                      </tr>
                    ) : (
                      schedules.map((s) => (
                        <tr key={s.id} className="hover:bg-slate-50">
                          <td className="p-2 font-bold text-red-600">{s.branch?.name}</td>
                          <td className="p-2 font-semibold text-slate-800">
                            {DAYS_OF_WEEK.find((d) => d.day === s.dayOfWeek)?.label}
                          </td>
                          <td className="p-2 font-extrabold text-slate-900">{s.shiftStartTime} น.</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: EMPLOYEES & INDIVIDUAL PIN CONFIG */}
      {activeTab === 'employees' && (
        <div className="space-y-6">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2">
              <div>
                <h2 className="font-bold text-slate-900 text-base">👥 รายชื่อพนักงาน & กำหนดรหัส PIN ประจำตัว</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  ผู้จัดการสามารถกำหนดหรือเปลี่ยนรหัส PIN ประจำตัวเฉพาะพนักงานแต่ละคน และปลดล็อกเครื่องโทรศัพท์ได้ที่นี่
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                    <th className="p-2.5">ชื่อ-นามสกุล</th>
                    <th className="p-2.5">ประเภทจ้างงาน</th>
                    <th className="p-2.5">รหัส PIN ประจำตัว</th>
                    <th className="p-2.5">สาขาประจำ</th>
                    <th className="p-2.5">สถานะการผูกเครื่อง</th>
                    <th className="p-2.5 text-center">การจัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {employees.map((emp) => (
                    <tr key={emp.id} className="hover:bg-slate-50">
                      <td className="p-2.5 font-bold text-slate-900">
                        <div className="flex items-center gap-2.5">
                          {emp.avatarUrl ? (
                            <img
                              src={emp.avatarUrl}
                              alt={emp.fullName}
                              className="w-9 h-9 rounded-full object-cover border border-slate-200 shadow-sm flex-shrink-0"
                            />
                          ) : (
                            <div className="w-9 h-9 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-black text-sm flex-shrink-0">
                              {emp.nickname ? emp.nickname[0] : '👤'}
                            </div>
                          )}
                          <div>
                            <div>{emp.fullName} ({emp.nickname})</div>
                            <span className="text-[10px] text-slate-400 font-mono font-normal">{emp.lineUserId}</span>
                          </div>
                        </div>
                      </td>
                      <td className="p-2.5 font-bold">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] ${
                            emp.employmentType === 'PART_TIME'
                              ? 'bg-amber-100 text-amber-900 border border-amber-300'
                              : 'bg-sky-100 text-sky-900 border border-sky-300'
                          }`}
                        >
                          {emp.employmentType === 'PART_TIME' ? '⏳ Part-Time' : '💼 Full-Time'}
                        </span>
                      </td>
                      <td className="p-2.5 font-bold font-mono">
                        <span className="bg-slate-100 border border-slate-300 px-2.5 py-1 rounded-lg text-red-600 font-black text-xs">
                          🔑 {emp.pinCode || '1234'}
                        </span>
                      </td>
                      <td className="p-2.5 text-red-600 font-bold">{emp.homeBranch?.name}</td>
                      <td className="p-2.5">
                        {emp.boundDeviceId ? (
                          <span className="text-emerald-800 bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded text-[10px] font-bold">
                            🔒 ผูกเครื่องแล้ว
                          </span>
                        ) : (
                          <span className="text-slate-400 italic text-[10px]">ยังไม่ผูกเครื่อง</span>
                        )}
                      </td>
                      <td className="p-2.5 text-center">
                        <div className="flex justify-center gap-1.5 flex-wrap">
                          <button
                            onClick={() => setEditingEmp(emp)}
                            className="bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-300 font-bold px-2.5 py-1 rounded-lg text-[11px] transition"
                          >
                            ✏️ แก้ไข
                          </button>
                          {emp.boundDeviceId && (
                            <button
                              onClick={() => handleResetDeviceBinding(emp.id, emp.fullName)}
                              className="bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 font-bold px-2.5 py-1 rounded-lg text-[11px] transition"
                              title="ปลดล็อกหากพนักงานเปลี่ยนเครื่องมือถือใหม่"
                            >
                              📱 ปลดล็อกเครื่อง
                            </button>
                          )}
                          <button
                            onClick={() => handleDeleteEmployee(emp.id, emp.fullName)}
                            className="bg-red-50 hover:bg-red-100 text-red-700 border border-red-300 font-bold px-2.5 py-1 rounded-lg text-[11px] transition"
                          >
                            🗑️ ลบ
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* REGISTER NEW EMPLOYEE FORM */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="font-bold text-slate-900 text-sm">➕ ลงทะเบียนพนักงานใหม่ (กำหนดรหัส PIN เฉพาะบุคคล)</h3>
            <form onSubmit={handleCreateEmployee} className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">LINE User ID:</label>
                <input
                  type="text"
                  placeholder="เช่น LINE_EMP_006"
                  value={newEmployee.lineUserId}
                  onChange={(e) => setNewEmployee({ ...newEmployee, lineUserId: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 text-slate-900 rounded-xl"
                  required
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">ชื่อ-นามสกุล:</label>
                <input
                  type="text"
                  placeholder="เช่น สมศักดิ์ มีชัย"
                  value={newEmployee.fullName}
                  onChange={(e) => setNewEmployee({ ...newEmployee, fullName: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 text-slate-900 rounded-xl"
                  required
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">ชื่อเล่น:</label>
                <input
                  type="text"
                  placeholder="เช่น ศักดิ์"
                  value={newEmployee.nickname}
                  onChange={(e) => setNewEmployee({ ...newEmployee, nickname: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 text-slate-900 rounded-xl"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">🔑 รหัส PIN ประจำตัว (4-6 หลัก):</label>
                <input
                  type="text"
                  maxLength={6}
                  placeholder="เช่น 5678"
                  value={newEmployee.pinCode}
                  onChange={(e) => setNewEmployee({ ...newEmployee, pinCode: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 font-mono text-red-600 font-black rounded-xl"
                  required
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">ประเภทการจ้างงาน:</label>
                <select
                  value={newEmployee.employmentType}
                  onChange={(e) => setNewEmployee({ ...newEmployee, employmentType: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 text-slate-900 rounded-xl font-bold"
                >
                  <option value="FULL_TIME">💼 Full-Time (พนักงานประจำ)</option>
                  <option value="PART_TIME">⏳ Part-Time (พนักงานพาร์ทไทม์)</option>
                </select>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">สาขาประจำ:</label>
                <select
                  value={newEmployee.homeBranchId}
                  onChange={(e) => setNewEmployee({ ...newEmployee, homeBranchId: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 text-red-600 font-bold rounded-xl"
                  required
                >
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      สาขาประจำ: {b.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">🖼️ รูปถ่ายพนักงานประจำตัว (เลือกไฟล์/ถ่ายภาพ):</label>
                <div className="flex items-center gap-2">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleImageFileChange(e, false)}
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-xl text-xs"
                  />
                  {newEmployee.avatarUrl && (
                    <img
                      src={newEmployee.avatarUrl}
                      alt="Preview"
                      className="w-9 h-9 rounded-full object-cover border border-slate-300 flex-shrink-0"
                    />
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="canRoam"
                  checked={newEmployee.canRoam}
                  onChange={(e) => setNewEmployee({ ...newEmployee, canRoam: e.target.checked })}
                />
                <label htmlFor="canRoam" className="font-bold text-slate-700">อนุญาตเข้างานข้ามสาขาได้ (Roaming)</label>
              </div>
              <div className="md:col-span-2 flex items-end">
                <button
                  type="submit"
                  className="w-full bg-red-600 hover:bg-red-700 text-white font-bold p-2.5 rounded-xl transition"
                >
                  บันทึกพนักงานใหม่พร้อมรหัส PIN และรูปถ่าย
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* EDIT EMPLOYEE MODAL */}
      {editingEmp && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-200 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="font-extrabold text-base text-slate-900 flex items-center gap-1.5">
                <span>✏️ แก้ไขข้อมูลพนักงาน ({editingEmp.fullName})</span>
              </h3>
              <button
                onClick={() => setEditingEmp(null)}
                className="text-slate-400 hover:text-slate-600 font-black text-lg px-2"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEditEmployee} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">ชื่อ-นามสกุล:</label>
                <input
                  type="text"
                  value={editingEmp.fullName}
                  onChange={(e) => setEditingEmp({ ...editingEmp, fullName: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-900"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">ชื่อเล่น:</label>
                  <input
                    type="text"
                    value={editingEmp.nickname || ''}
                    onChange={(e) => setEditingEmp({ ...editingEmp, nickname: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-900"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">🔑 รหัส PIN ประจำตัว:</label>
                  <input
                    type="text"
                    value={editingEmp.pinCode || '1234'}
                    onChange={(e) => setEditingEmp({ ...editingEmp, pinCode: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-bold font-mono text-red-600"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">ประเภทจ้างงาน:</label>
                  <select
                    value={editingEmp.employmentType}
                    onChange={(e) => setEditingEmp({ ...editingEmp, employmentType: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-900"
                  >
                    <option value="FULL_TIME">💼 Full-Time</option>
                    <option value="PART_TIME">⏳ Part-Time</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">สาขาประจำ (Home Branch):</label>
                  <select
                    value={editingEmp.homeBranchId}
                    onChange={(e) => setEditingEmp({ ...editingEmp, homeBranchId: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-900"
                  >
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        🏬 {b.name} ({b.code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">🖼️ รูปถ่ายประจำตัวพนักงาน (เลือกไฟล์/ถ่ายใหม่):</label>
                <div className="flex items-center gap-3 bg-slate-50 p-2 border border-slate-300 rounded-xl">
                  {editingEmp.avatarUrl ? (
                    <img
                      src={editingEmp.avatarUrl}
                      alt="Avatar"
                      className="w-10 h-10 rounded-full object-cover border border-slate-300 flex-shrink-0"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-black text-sm flex-shrink-0">
                      {editingEmp.nickname ? editingEmp.nickname[0] : '👤'}
                    </div>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleImageFileChange(e, true)}
                    className="w-full text-xs text-slate-600"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="editCanRoam"
                  checked={editingEmp.canRoam}
                  onChange={(e) => setEditingEmp({ ...editingEmp, canRoam: e.target.checked })}
                  className="w-4 h-4 text-red-600 rounded"
                />
                <label htmlFor="editCanRoam" className="font-bold text-slate-800">
                  🔄 สามารถหมุนเวียนไปปฏิบัติงานสาขาอื่นได้ (Roam)
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingEmp(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white font-black rounded-xl shadow"
                >
                  💾 บันทึกการแก้ไข
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
