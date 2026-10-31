'use client';

import { useState, useEffect } from 'react';
import { calculateDistanceMeters } from '@/lib/geofence';
import { getThaiDateStr } from '@/lib/dateUtils';

interface Branch {
  id: string;
  name: string;
  code: string;
  latitude: number;
  longitude: number;
  allowedRadiusMeters: number;
  shiftStartTime: string;
}

interface Employee {
  id: string;
  lineUserId: string;
  fullName: string;
  nickname: string;
  role: string;
  employmentType: string;
  homeBranchId: string;
  homeBranch?: Branch;
  canRoam: boolean;
  pinCode?: string;
  boundDeviceId?: string;
  avatarUrl?: string;
}

export default function StaffClockInPage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmpId, setSelectedEmpId] = useState<string>('');
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');
  
  // Device Fingerprint ID
  const [deviceId, setDeviceId] = useState<string>('');

  // PIN Verification State
  const [pinCodeInput, setPinCodeInput] = useState<string>('');

  // GPS State
  const [gpsLocation, setGpsLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [distanceMeters, setDistanceMeters] = useState<number | null>(null);
  const [isWithinGeofence, setIsWithinGeofence] = useState<boolean | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [isGettingGps, setIsGettingGps] = useState<boolean>(false);
  const [showGpsGuideModal, setShowGpsGuideModal] = useState<boolean>(false);

  // Feedback & Loading
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [alertMsg, setAlertMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [todayLogs, setTodayLogs] = useState<any[]>([]);
  const [successModalData, setSuccessModalData] = useState<{ type: 'CLOCK_IN' | 'CLOCK_OUT'; attendance: any } | null>(null);

  // Searchable Employee Selection Modal State
  const [isEmpModalOpen, setIsEmpModalOpen] = useState<boolean>(false);
  const [empSearchQuery, setEmpSearchQuery] = useState<string>('');
  const [empFilterType, setEmpFilterType] = useState<'ALL' | 'BRANCH' | 'FULL_TIME' | 'PART_TIME'>('ALL');

  // Admin Manual Attendance State
  const [isAdminAuth, setIsAdminAuth] = useState<boolean>(false);
  const [showAdminPasswordModal, setShowAdminPasswordModal] = useState<boolean>(false);
  const [adminPasswordInput, setAdminPasswordInput] = useState<string>('');
  const [showManualModal, setShowManualModal] = useState<boolean>(false);
  const [manualEmpId, setManualEmpId] = useState<string>('');
  const [manualBranchId, setManualBranchId] = useState<string>('');
  const [manualDateStr, setManualDateStr] = useState<string>(getThaiDateStr());
  const [manualClockInTime, setManualClockInTime] = useState<string>('09:30');
  const [manualClockOutTime, setManualClockOutTime] = useState<string>('21:00');
  const [manualStatus, setManualStatus] = useState<string>('ON_TIME');
  const [manualLateMinutes, setManualLateMinutes] = useState<number>(0);
  const [manualNotes, setManualNotes] = useState<string>('');
  const [isSubmittingManual, setIsSubmittingManual] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('pkt_admin_user');
      if (stored && ['aommyisme', 'pon'].includes(stored.toLowerCase())) {
        setIsAdminAuth(true);
      }
    }
  }, []);

  const handleOpenAdminManual = () => {
    if (isAdminAuth) {
      setManualEmpId(selectedEmpId || employees[0]?.id || '');
      setManualBranchId(selectedBranchId || branches[0]?.id || '');
      setManualDateStr(getThaiDateStr());
      setShowManualModal(true);
    } else {
      setShowAdminPasswordModal(true);
    }
  };

  const handleVerifyAdminPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (adminPasswordInput.trim() === '664662') {
      setIsAdminAuth(true);
      if (typeof window !== 'undefined') {
        localStorage.setItem('pkt_admin_user', 'aommyisme');
      }
      setShowAdminPasswordModal(false);
      setAdminPasswordInput('');
      setManualEmpId(selectedEmpId || employees[0]?.id || '');
      setManualBranchId(selectedBranchId || branches[0]?.id || '');
      setManualDateStr(getThaiDateStr());
      setShowManualModal(true);
    } else {
      alert('รหัสผ่านผู้จัดการไม่ถูกต้อง');
    }
  };

  const handleSaveManualAttendance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualEmpId || !manualBranchId || !manualDateStr) {
      alert('กรุณาเลือกพนักงาน สาขา และวันที่ให้ครบถ้วน');
      return;
    }

    setIsSubmittingManual(true);
    try {
      const res = await fetch('/api/attendance/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId: manualEmpId,
          branchId: manualBranchId,
          dateStr: manualDateStr,
          clockInTime: manualClockInTime,
          clockOutTime: manualClockOutTime,
          status: manualStatus,
          lateMinutes: manualStatus === 'LATE' ? Number(manualLateMinutes) : 0,
          notes: manualNotes,
          adminUser: 'aommyisme',
        }),
      });

      const data = await res.json();
      if (data.success) {
        alert(data.message || 'บันทึกเวลาเข้างานสำเร็จ');
        setShowManualModal(false);
        if (manualEmpId) fetchTodayLogs(manualEmpId);
      } else {
        alert(data.error || 'เกิดข้อผิดพลาดในการบันทึกเวลาเข้างาน');
      }
    } catch (err: any) {
      alert('เกิดข้อผิดพลาด: ' + err.message);
    } finally {
      setIsSubmittingManual(false);
    }
  };

  // Initialize Device Fingerprint ID
  useEffect(() => {
    let devId = localStorage.getItem('pkt_device_id');
    if (!devId) {
      devId = 'DEV_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now().toString(36);
      localStorage.setItem('pkt_device_id', devId);
    }
    setDeviceId(devId);
  }, []);

  // Fetch initial branches and employees
  useEffect(() => {
    fetchBranches();
    fetchEmployees();
  }, []);

  const fetchBranches = async () => {
    try {
      const res = await fetch('/api/branches', { cache: 'no-store' });
      const data = await res.json();
      if (data.success) {
        setBranches(data.branches);
        if (data.branches.length > 0) setSelectedBranchId(data.branches[0].id);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchEmployees = async () => {
    try {
      const res = await fetch('/api/employees', { cache: 'no-store' });
      const data = await res.json();
      if (data.success) {
        setEmployees(data.employees);
        if (data.employees.length > 0) {
          const savedEmpId = localStorage.getItem('pkt_last_emp_id');
          const foundSaved = data.employees.find((e: any) => e.id === savedEmpId);
          if (foundSaved) {
            setSelectedEmpId(foundSaved.id);
          } else {
            setSelectedEmpId(data.employees[0].id);
          }
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSelectEmployee = (empId: string) => {
    setSelectedEmpId(empId);
    localStorage.setItem('pkt_last_emp_id', empId);
    setIsEmpModalOpen(false);
  };

  const filteredEmployees = employees.filter((emp) => {
    const q = empSearchQuery.trim().toLowerCase();
    const matchesQuery =
      !q ||
      emp.fullName.toLowerCase().includes(q) ||
      (emp.nickname && emp.nickname.toLowerCase().includes(q)) ||
      emp.role.toLowerCase().includes(q);

    if (!matchesQuery) return false;

    if (empFilterType === 'BRANCH') return emp.homeBranchId === selectedBranchId;
    if (empFilterType === 'FULL_TIME') return emp.employmentType === 'FULL_TIME';
    if (empFilterType === 'PART_TIME') return emp.employmentType === 'PART_TIME';
    return true;
  });

  // Fetch today logs when employee changes
  useEffect(() => {
    if (selectedEmpId) {
      fetchTodayLogs(selectedEmpId);
    }
  }, [selectedEmpId]);

  const fetchTodayLogs = async (empId: string) => {
    const today = getThaiDateStr();
    try {
      const res = await fetch(`/api/attendance/logs?employeeId=${empId}&dateStr=${today}`);
      const data = await res.json();
      if (data.success) {
        setTodayLogs(data.logs);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Calculate Geofence distance whenever GPS or selected branch changes
  useEffect(() => {
    if (gpsLocation && selectedBranchId) {
      const branch = branches.find((b) => b.id === selectedBranchId);
      if (branch) {
        const dist = calculateDistanceMeters(
          gpsLocation.lat,
          gpsLocation.lng,
          branch.latitude,
          branch.longitude
        );
        setDistanceMeters(dist);
        setIsWithinGeofence(dist <= branch.allowedRadiusMeters);
      }
    }
  }, [gpsLocation, selectedBranchId, branches]);

  // Request GPS Location
  const getGpsLocation = () => {
    setIsGettingGps(true);
    setGpsError(null);

    if (!navigator.geolocation) {
      setGpsError('อุปกรณ์ของท่านไม่รองรับการดึงพิกัด GPS');
      setIsGettingGps(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGpsLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
        setIsGettingGps(false);
      },
      (err) => {
        console.error(err);
        if (err.code === 1) {
          setGpsError('🚫 สิทธิ์ GPS ถูกบล็อก: กรุณาแตะแม่กุญแจ 🔒 ที่แถบลิงก์ด้านบนเพื่อเปลี่ยนเป็น "อนุญาต"');
          setShowGpsGuideModal(true);
        } else {
          setGpsError('ไม่สามารถดึงพิกัด GPS ได้ กรุณาเปิดใช้งาน GPS/Location บนโทรศัพท์');
        }
        setIsGettingGps(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Handle Clock In
  const handleClockIn = async () => {
    setAlertMsg(null);

    if (!selectedEmpId) {
      setAlertMsg({ type: 'error', text: 'กรุณาเลือกพนักงาน' });
      return;
    }
    if (!selectedBranchId) {
      setAlertMsg({ type: 'error', text: 'กรุณาเลือกสาขา' });
      return;
    }
    if (!gpsLocation) {
      setAlertMsg({ type: 'error', text: 'กรุณากดปุ่มดึงพิกัด GPS ปัจจุบันก่อนลงเวลา' });
      return;
    }
    if (!pinCodeInput) {
      setAlertMsg({ type: 'error', text: 'กรุณากรอกรหัส PIN ประจำตัวพนักงาน (4 - 6 หลัก)' });
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/attendance/clock-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId: selectedEmpId,
          branchId: selectedBranchId,
          latitude: gpsLocation.lat,
          longitude: gpsLocation.lng,
          deviceId,
          verificationMethod: 'PIN_CODE',
          pinCode: pinCodeInput,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setAlertMsg({ type: 'success', text: data.message || 'บันทึกเวลาเข้างานเรียบร้อยแล้ว' });
        setPinCodeInput('');
        fetchTodayLogs(selectedEmpId);
        if (data.attendance) {
          setSuccessModalData({ type: 'CLOCK_IN', attendance: data.attendance });
        }
      } else {
        setAlertMsg({ type: 'error', text: data.error });
      }
    } catch (err: any) {
      setAlertMsg({ type: 'error', text: err.message || 'เกิดข้อผิดพลาดในการลงเวลา' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Clock Out
  const handleClockOut = async () => {
    setAlertMsg(null);
    if (!selectedEmpId) {
      setAlertMsg({ type: 'error', text: 'กรุณาเลือกพนักงาน' });
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/attendance/clock-out', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId: selectedEmpId,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setAlertMsg({ type: 'success', text: data.message || 'บันทึกเวลาออกงานเรียบร้อยแล้ว' });
        fetchTodayLogs(selectedEmpId);
        if (data.attendance) {
          setSuccessModalData({ type: 'CLOCK_OUT', attendance: data.attendance });
        }
      } else {
        setAlertMsg({ type: 'error', text: data.error });
      }
    } catch (err: any) {
      setAlertMsg({ type: 'error', text: err.message || 'เกิดข้อผิดพลาดในการออกงาน' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedBranch = branches.find((b) => b.id === selectedBranchId);
  const selectedEmp = employees.find((e) => e.id === selectedEmpId);

  return (
    <div className="max-w-md mx-auto space-y-4 py-1">

      {/* Alert Banner */}
      {alertMsg && (
        <div
          className={`p-3.5 rounded-2xl text-xs font-bold border transition-all shadow-xs ${
            alertMsg.type === 'success'
              ? 'bg-[#D8F3E5] text-[#14533C] border-[#B6E7CE]'
              : 'bg-[#FCDAD7] text-[#802227] border-[#F8B7B2]'
          }`}
        >
          {alertMsg.type === 'success' ? '✅ ' : '⚠️ '}
          {alertMsg.text}
        </div>
      )}

      {/* Admin Quick Action Banner: Manual Clock-In */}
      <div className="bg-[#FFF8F0] border-2 border-[#F97316]/40 rounded-3xl p-4 shadow-sm flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-10 h-10 rounded-2xl bg-[#F97316]/10 border border-[#F97316]/30 flex items-center justify-center text-lg flex-shrink-0">
            👩‍💼
          </div>
          <div className="min-w-0">
            <h3 className="font-extrabold text-xs text-stone-900 truncate flex items-center gap-1.5">
              <span>สำหรับผู้จัดการ (Admin)</span>
              <span className="bg-[#F97316] text-white text-[9px] px-1.5 py-0.5 rounded-full font-bold">อ้อม</span>
            </h3>
            <p className="text-[10px] text-stone-500 font-semibold truncate">
              กรณีพนักงานลืมกดเข้างาน หรือต้องการลงเวลาย้อนหลัง
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button
            type="button"
            onClick={handleOpenAdminManual}
            className="bg-gradient-to-r from-[#F97316] to-[#EA580C] hover:from-[#EA580C] hover:to-[#C2410C] text-white font-extrabold text-xs px-3.5 py-2 rounded-2xl shadow-sm transition active:scale-95 flex items-center gap-1 cursor-pointer ring-2 ring-orange-200"
          >
            <span>➕ บันทึกเวลา</span>
          </button>
          <a
            href="/admin"
            className="p-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-2xl text-xs font-bold transition flex items-center shadow-xs"
            title="ไปที่หน้า Admin Dashboard"
          >
            ⚙️
          </a>
        </div>
      </div>

      {/* Warm Cream Main Card */}
      <div className="bg-[#FCFAF7] rounded-3xl p-5 shadow-xs border border-[#EBE4D8] space-y-4">
        {/* Employee Selection */}
        <div>
          <div className="flex justify-between items-center mb-1.5">
            <label className="block text-xs font-bold text-stone-800">
              👤 พนักงาน (LINE Profile):
            </label>
            {selectedEmp && (
              <span
                className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                  selectedEmp.employmentType === 'PART_TIME'
                    ? 'bg-[#FCE5CD] text-[#783E10] border border-[#F9D3AD]'
                    : 'bg-[#E3E0F8] text-[#342D69] border border-[#C9C4F3]'
                }`}
              >
                {selectedEmp.employmentType === 'PART_TIME' ? '⏳ Part-Time' : '💼 Full-Time'}
              </span>
            )}
          </div>

          {/* Selected Employee Display Card + Quick Search Button */}
          <div className="bg-[#F5EFEA] border border-[#E5DDD4] rounded-2xl p-3 flex items-center justify-between gap-2.5">
            <div className="flex items-center gap-3 overflow-hidden">
              {selectedEmp?.avatarUrl ? (
                <img
                  src={selectedEmp.avatarUrl}
                  alt={selectedEmp.fullName}
                  className="w-10 h-10 rounded-full object-cover border border-[#E5DDD4] shadow-xs flex-shrink-0"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-[#F97316] text-white font-bold text-base flex items-center justify-center flex-shrink-0 shadow-xs">
                  {selectedEmp?.nickname ? selectedEmp.nickname[0] : '👤'}
                </div>
              )}
              <div className="min-w-0">
                <p className="font-extrabold text-xs text-stone-900 truncate">
                  {selectedEmp ? `${selectedEmp.fullName} (${selectedEmp.nickname || selectedEmp.role})` : 'ยังไม่ได้เลือกพนักงาน'}
                </p>
                <p className="text-[10px] text-stone-500 font-bold flex items-center gap-1 pt-0.5">
                  <span>🏬 {selectedEmp?.homeBranch?.name || 'ไม่มีสาขาหลัก'}</span>
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setEmpSearchQuery('');
                setIsEmpModalOpen(true);
              }}
              className="bg-[#F97316] hover:bg-[#EA580C] text-white font-bold px-3.5 py-2 rounded-2xl text-xs shadow-xs flex items-center gap-1 flex-shrink-0 transition active:scale-95 cursor-pointer"
            >
              <span>🔍 ค้นหา / เปลี่ยน</span>
            </button>
          </div>
        </div>

        {/* Branch Selection */}
        <div>
          <label className="block text-xs font-bold text-stone-800 mb-1.5">
            🏪 เลือกสาขาที่เข้างาน (4 สาขา):
          </label>
          <select
            value={selectedBranchId}
            onChange={(e) => setSelectedBranchId(e.target.value)}
            className="w-full p-3 bg-[#F5EFEA] border border-[#E5DDD4] text-stone-900 font-bold rounded-2xl text-xs focus:ring-2 focus:ring-[#F97316] outline-none transition"
          >
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} (เวลาเข้างาน {b.shiftStartTime} น.)
              </option>
            ))}
          </select>
        </div>

        {/* GPS Geofence Box */}
        <div className="bg-[#F5EFEA] p-3.5 rounded-2xl border border-[#E5DDD4] space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-stone-800 flex items-center gap-1">
              <span>📍 พิกัด GPS Geofence:</span>
            </span>
            <button
              onClick={getGpsLocation}
              disabled={isGettingGps}
              className="text-xs bg-[#2D2A26] hover:bg-[#1E1C1A] text-white font-bold px-3 py-1.5 rounded-2xl shadow-xs transition active:scale-95 disabled:opacity-50"
            >
              {isGettingGps ? 'กำลังเช็กพิกัด...' : '🔄 เช็กพิกัด GPS'}
            </button>
          </div>

          {gpsError && (
            <p className="text-xs text-[#802227] font-bold">{gpsError}</p>
          )}

          {gpsLocation && selectedBranch && (
            <div className="text-xs space-y-1.5">
              <p className="text-stone-500 font-mono text-[11px]">
                Latitude: {gpsLocation.lat.toFixed(6)}, Longitude: {gpsLocation.lng.toFixed(6)}
              </p>
              {distanceMeters !== null && (
                <div className="flex items-center gap-2">
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-bold text-white shadow-xs ${
                      isWithinGeofence
                        ? 'bg-[#10B981]'
                        : 'bg-[#EF4444]'
                    }`}
                  >
                    {isWithinGeofence
                      ? `อยู่ในระยะสาขา (${distanceMeters} เมตร)`
                      : `อยู่นอกพื้นที่ (${distanceMeters} เมตร / เกณฑ์ <= ${selectedBranch.allowedRadiusMeters}m)`}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* PIN CODE ENTRY BOX */}
        <div className="space-y-2 pt-1 border-t border-[#EBE4D8]">
          <div className="p-3.5 bg-[#F5EFEA] border border-[#E5DDD4] rounded-2xl space-y-2">
            <label className="block text-xs font-bold text-stone-800 flex items-center gap-1">
              <span>🔑 กรอกรหัส PIN ประจำตัวพนักงาน (4 - 6 หลัก):</span>
            </label>
            <input
              type="password"
              maxLength={6}
              placeholder="กรอกรหัส PIN 4-6 หลัก"
              value={pinCodeInput}
              onChange={(e) => setPinCodeInput(e.target.value)}
              className="w-full p-3 bg-white border border-[#E5DDD4] text-stone-900 rounded-2xl font-mono text-center font-bold text-lg tracking-widest focus:ring-2 focus:ring-[#F97316] outline-none shadow-xs"
            />
            <p className="text-[11px] text-stone-500 text-center font-bold">
              🔐 ยืนยันตัวตนด้วยรหัส PIN ประจำตัวพนักงาน (หากจำรหัสไม่ได้กรุณาติดต่อผู้จัดการ)
            </p>
          </div>
        </div>

        {/* Action Clock In / Clock Out Buttons */}
        <div className="grid grid-cols-2 gap-3 pt-1">
          <button
            onClick={handleClockIn}
            disabled={isSubmitting || !isWithinGeofence}
            className="w-full bg-[#10B981] hover:bg-[#059669] text-white font-bold py-3.5 px-4 rounded-2xl text-xs md:text-sm shadow-xs transition active:scale-95 disabled:opacity-40 flex items-center justify-center gap-1.5 cursor-pointer"
          >
            {isSubmitting ? 'กำลังบันทึก...' : '🟢 ลงเวลาเข้างาน'}
          </button>

          <button
            onClick={handleClockOut}
            disabled={isSubmitting}
            className="w-full bg-[#2D2A26] hover:bg-[#1E1C1A] text-white font-bold py-3.5 px-4 rounded-2xl text-xs md:text-sm shadow-xs transition active:scale-95 disabled:opacity-40 flex items-center justify-center gap-1.5 cursor-pointer"
          >
            🔴 ลงเวลาออกงาน
          </button>
        </div>
      </div>

      {/* Today Attendance Log Summary */}
      {selectedEmp && (
        <div className="bg-[#FCFAF7] rounded-3xl p-5 shadow-xs border border-[#EBE4D8] space-y-3">
          <h3 className="text-xs font-extrabold text-stone-800 flex items-center gap-1.5">
            <span>📋 ประวัติการเข้างานวันนี้ ({selectedEmp.fullName})</span>
          </h3>

          {todayLogs.length === 0 ? (
            <p className="text-xs text-stone-400 py-3 text-center">ยังไม่มีประวัติการเข้างานในวันนี้</p>
          ) : (
            <div className="space-y-2">
              {todayLogs.map((log) => (
                <div key={log.id} className="p-3 bg-[#F5EFEA] rounded-2xl border border-[#E5DDD4] text-xs space-y-1.5">
                  <div className="flex justify-between items-center font-bold">
                    <span className="text-[#F97316] font-extrabold">🏪 {log.branch?.name}</span>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold text-white ${
                        log.status === 'ON_TIME' ? 'bg-[#10B981]' : 'bg-[#F59E0B]'
                      }`}
                    >
                      {log.status === 'ON_TIME' ? 'ตรงเวลา' : `สาย ${log.lateMinutes} นาที`}
                    </span>
                  </div>
                  <div className="text-stone-600 flex justify-between font-mono text-[11px]">
                    <span>เข้างาน: {new Date(log.clockInAt).toLocaleTimeString('th-TH', { timeZone: 'Asia/Bangkok' })}</span>
                    <span>
                      ออกงาน:{' '}
                      {log.clockOutAt ? new Date(log.clockOutAt).toLocaleTimeString('th-TH', { timeZone: 'Asia/Bangkok' }) : 'ยังไม่ออกงาน'}
                    </span>
                  </div>
                  {log.notes && (
                    <p className="text-[10px] text-stone-600 italic bg-white p-1.5 rounded-xl border border-[#E5DDD4]">
                      📌 {log.notes}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SEARCHABLE EMPLOYEE MODAL */}
      {isEmpModalOpen && (
        <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-[#FCFAF7] rounded-3xl p-5 max-w-md w-full shadow-xl border border-[#EBE4D8] space-y-4 max-h-[85vh] flex flex-col animate-in fade-in zoom-in duration-150">
            {/* Modal Header */}
            <div className="flex justify-between items-center border-b border-[#EBE4D8] pb-3 flex-shrink-0">
              <div>
                <h3 className="font-extrabold text-base text-stone-900 flex items-center gap-1.5">
                  <span className="text-[#F97316]">🔍</span>
                  <span>เลือกพนักงาน</span>
                  <span className="text-xs bg-[#FCE5CD] text-[#783E10] font-bold px-2.5 py-0.5 rounded-full border border-[#F9D3AD]">
                    {employees.length} คน
                  </span>
                </h3>
                <p className="text-[11px] text-stone-500 font-bold">พิมพ์ชื่อ หรือแตะเลือกรายชื่อด้านล่างได้ทันที</p>
              </div>
              <button
                onClick={() => setIsEmpModalOpen(false)}
                className="text-stone-400 hover:text-stone-600 font-bold text-lg px-2.5 py-1 rounded-2xl hover:bg-[#EFE8E2] transition"
              >
                ✕
              </button>
            </div>

            {/* Search Input Box */}
            <div className="relative flex-shrink-0">
              <input
                type="text"
                placeholder="🔎 พิมพ์ชื่อเล่น หรือชื่อจริงเพื่อค้นหา..."
                value={empSearchQuery}
                onChange={(e) => setEmpSearchQuery(e.target.value)}
                autoFocus
                className="w-full p-3 pl-10 bg-[#F5EFEA] border border-[#E5DDD4] rounded-2xl text-xs font-bold text-stone-900 focus:ring-2 focus:ring-[#F97316] outline-none shadow-xs"
              />
              <span className="absolute left-3.5 top-3 text-[#F97316] text-sm">🔍</span>
              {empSearchQuery && (
                <button
                  onClick={() => setEmpSearchQuery('')}
                  className="absolute right-3 top-2.5 text-xs text-stone-400 hover:text-stone-600 font-bold px-1.5 py-0.5 bg-[#EFE8E2] rounded-full"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Quick Filter Tabs */}
            <div className="flex gap-1.5 overflow-x-auto pb-1 flex-shrink-0 text-[11px] font-bold">
              <button
                onClick={() => setEmpFilterType('ALL')}
                className={`px-3.5 py-2 rounded-2xl transition ${
                  empFilterType === 'ALL'
                    ? 'bg-[#2D2A26] text-white font-bold shadow-xs'
                    : 'bg-[#EFE8E2] text-stone-700 hover:bg-[#E5DDD4]'
                }`}
              >
                ทั้งหมด ({employees.length})
              </button>
              <button
                onClick={() => setEmpFilterType('BRANCH')}
                className={`px-3.5 py-2 rounded-2xl transition ${
                  empFilterType === 'BRANCH'
                    ? 'bg-[#F97316] text-white font-bold shadow-xs'
                    : 'bg-[#EFE8E2] text-stone-700 hover:bg-[#E5DDD4]'
                }`}
              >
                🏬 เฉพาะสาขานี้ ({employees.filter((e) => e.homeBranchId === selectedBranchId).length})
              </button>
              <button
                onClick={() => setEmpFilterType('FULL_TIME')}
                className={`px-3.5 py-2 rounded-2xl transition ${
                  empFilterType === 'FULL_TIME'
                    ? 'bg-[#342D69] text-white font-bold shadow-xs'
                    : 'bg-[#EFE8E2] text-stone-700 hover:bg-[#E5DDD4]'
                }`}
              >
                💼 Full-Time ({employees.filter((e) => e.employmentType === 'FULL_TIME').length})
              </button>
              <button
                onClick={() => setEmpFilterType('PART_TIME')}
                className={`px-3.5 py-2 rounded-2xl transition ${
                  empFilterType === 'PART_TIME'
                    ? 'bg-[#783E10] text-white font-bold shadow-xs'
                    : 'bg-[#EFE8E2] text-stone-700 hover:bg-[#E5DDD4]'
                }`}
              >
                ⏳ Part-Time ({employees.filter((e) => e.employmentType === 'PART_TIME').length})
              </button>
            </div>

            {/* Filtered Employee List */}
            <div className="overflow-y-auto space-y-2 pr-1 flex-1">
              {filteredEmployees.length === 0 ? (
                <div className="text-center py-8 text-stone-400 space-y-1">
                  <p className="text-2xl">🔍</p>
                  <p className="text-xs font-bold">ไม่พบพนักงานตามคำค้นหา</p>
                </div>
              ) : (
                filteredEmployees.map((emp) => {
                  const isSelected = emp.id === selectedEmpId;
                  return (
                    <div
                      key={emp.id}
                      onClick={() => handleSelectEmployee(emp.id)}
                      className={`p-3 rounded-2xl border transition cursor-pointer flex items-center justify-between gap-3 ${
                        isSelected
                          ? 'bg-[#FCE5CD] border-[#F9D3AD] ring-2 ring-[#F97316] shadow-xs'
                          : 'bg-[#F5EFEA] hover:bg-[#EFE8E2] border-[#E5DDD4]'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {emp.avatarUrl ? (
                          <img
                            src={emp.avatarUrl}
                            alt={emp.fullName}
                            className="w-9 h-9 rounded-full object-cover border border-[#E5DDD4] shadow-xs flex-shrink-0"
                          />
                        ) : (
                          <div
                            className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 ${
                              isSelected ? 'bg-[#F97316] text-white shadow-xs' : 'bg-[#EFE8E2] text-stone-700'
                            }`}
                          >
                            {emp.nickname ? emp.nickname[0] : '👤'}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="font-extrabold text-xs text-stone-900 truncate">
                            {emp.fullName} ({emp.nickname || emp.role})
                          </p>
                          <p className="text-[10px] text-stone-500 font-bold flex items-center gap-1.5 pt-0.5">
                            <span>🏬 {emp.homeBranch?.name || 'ไม่มีสาขาหลัก'}</span>
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <span
                          className={`text-[9px] font-bold px-2.5 py-0.5 rounded-full ${
                            emp.employmentType === 'PART_TIME'
                              ? 'bg-[#FCE5CD] text-[#783E10] border border-[#F9D3AD]'
                              : 'bg-[#E3E0F8] text-[#342D69] border border-[#C9C4F3]'
                          }`}
                        >
                          {emp.employmentType === 'PART_TIME' ? '⏳ Part-Time' : '💼 Full-Time'}
                        </span>
                        {isSelected && <span className="text-red-600 font-black text-sm">✓</span>}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Modal Footer */}
            <div className="border-t border-slate-100 pt-2 text-center flex-shrink-0">
              <button
                onClick={() => setIsEmpModalOpen(false)}
                className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition"
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}

      {/* GPS Unblock Guide Modal */}
      {showGpsGuideModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#FCFAF7] border border-[#EBE4D8] rounded-3xl p-5 max-w-sm w-full shadow-xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-[#EBE4D8] pb-3">
              <h3 className="font-extrabold text-stone-900 text-sm flex items-center gap-2">
                <span>📍 วิธีเปิดสิทธิ์พิกัด GPS (Android / iPhone)</span>
              </h3>
              <button
                onClick={() => setShowGpsGuideModal(false)}
                className="text-stone-400 hover:text-stone-700 font-bold text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs text-stone-700">
              <div className="bg-[#F5EFEA] p-3 rounded-2xl border border-[#E5DDD4] space-y-1.5">
                <p className="font-bold text-stone-900 flex items-center gap-1.5">
                  <span>📱 บน Android (Google Chrome):</span>
                </p>
                <ol className="list-decimal list-inside space-y-1 text-stone-600 font-medium pl-1">
                  <li>แตะที่ไอคอน <strong>แม่กุญแจ 🔒</strong> หรือไอคอนหน้าเว็บที่แถบ URL ด้านบนสุด</li>
                  <li>เลือก <strong>"การตั้งค่าเว็บไซต์" (Permissions / Site Settings)</strong></li>
                  <li>เลือก <strong>"ตำแหน่งที่ตั้ง" (Location)</strong> เปลี่ยนเป็น <strong>"อนุญาต" (Allow)</strong></li>
                  <li>รีเฟรช (Refresh) หน้าเว็บแล้วลองแตะปุ่มเช็กพิกัดอีกครั้ง</li>
                </ol>
              </div>

              <div className="bg-[#F5EFEA] p-3 rounded-2xl border border-[#E5DDD4] space-y-1.5">
                <p className="font-bold text-stone-900 flex items-center gap-1.5">
                  <span>🍎 บน iPhone (Safari):</span>
                </p>
                <ol className="list-decimal list-inside space-y-1 text-stone-600 font-medium pl-1">
                  <li>แตะปุ่ม <strong>aA</strong> หรือรูปแม่กุญแจที่แถบ URL ด้านบน</li>
                  <li>เลือก <strong>"การตั้งค่าเว็บไซต์" (Website Settings)</strong></li>
                  <li>เปลี่ยน <strong>"ตำแหน่ง" (Location)</strong> เป็น <strong>"อนุญาต" (Allow)</strong></li>
                </ol>
              </div>
            </div>

            <button
              onClick={() => {
                setShowGpsGuideModal(false);
                window.location.reload();
              }}
              className="w-full py-3 bg-[#2D2A26] hover:bg-[#1E1C1A] text-white font-bold text-xs rounded-2xl transition shadow-xs cursor-pointer"
            >
              🔄 รีเฟรชหน้าเว็บแล้วลองใหม่
            </button>
          </div>
        </div>
      )}

      {/* Success Confirmation Modal */}
      {successModalData && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#FCFAF7] border border-[#EBE4D8] rounded-3xl p-6 max-w-sm w-full shadow-2xl space-y-4 text-center animate-in fade-in zoom-in-95 duration-200">
            <div className="w-16 h-16 bg-[#D8F3E5] text-[#14533C] rounded-full flex items-center justify-center text-3xl mx-auto border border-[#B6E7CE] shadow-xs">
              ✓
            </div>

            <div>
              <h3 className="font-black text-lg text-stone-900">
                {successModalData.type === 'CLOCK_IN' ? '🎉 ลงเวลาเข้างานสำเร็จ!' : '🔴 ลงเวลาออกงานสำเร็จ!'}
              </h3>
              <p className="text-xs text-stone-500 font-bold mt-0.5">
                ระบบได้บันทึกข้อมูลการลงเวลาเรียบร้อยแล้ว
              </p>
            </div>

            <div className="bg-[#F5EFEA] p-4 rounded-2xl border border-[#E5DDD4] space-y-2 text-left text-xs">
              <div className="flex justify-between items-center">
                <span className="text-stone-500 font-bold">👤 พนักงาน:</span>
                <span className="font-extrabold text-stone-900">
                  {successModalData.attendance?.employee?.fullName} ({successModalData.attendance?.employee?.nickname || 'พนักงาน'})
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-stone-500 font-bold">🏪 สาขา:</span>
                <span className="font-extrabold text-[#F97316]">
                  {successModalData.attendance?.branch?.name}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-stone-500 font-bold">⏰ เวลาบันทึก:</span>
                <span className="font-extrabold text-stone-900 font-mono">
                  {new Date(
                    successModalData.type === 'CLOCK_IN'
                      ? successModalData.attendance?.clockInAt
                      : successModalData.attendance?.clockOutAt || new Date()
                  ).toLocaleTimeString('th-TH', { timeZone: 'Asia/Bangkok' })} น.
                </span>
              </div>
              {successModalData.type === 'CLOCK_IN' && (
                <div className="flex justify-between items-center pt-1 border-t border-[#E5DDD4]">
                  <span className="text-stone-500 font-bold">📌 สถานะ:</span>
                  <span
                    className={`font-bold px-2.5 py-0.5 rounded-full text-[10px] ${
                      successModalData.attendance?.status === 'ABSENT' || successModalData.attendance?.lateMinutes > 30
                        ? 'bg-[#FCDAD7] text-[#802227]'
                        : successModalData.attendance?.status === 'LATE' || successModalData.attendance?.lateMinutes > 15
                        ? 'bg-[#FCE5CD] text-[#783E10]'
                        : 'bg-[#D8F3E5] text-[#14533C]'
                    }`}
                  >
                    {successModalData.attendance?.status === 'ABSENT' || successModalData.attendance?.lateMinutes > 30
                      ? `🛑 ขาดงาน (สาย ${successModalData.attendance?.lateMinutes} นาที)`
                      : successModalData.attendance?.status === 'LATE' || successModalData.attendance?.lateMinutes > 15
                      ? `⚠️ สาย ${successModalData.attendance?.lateMinutes} นาที`
                      : '🟢 ตรงเวลา'}
                  </span>
                </div>
              )}
            </div>

            <button
              onClick={() => setSuccessModalData(null)}
              className="w-full py-3 bg-[#2D2A26] hover:bg-[#1E1C1A] text-white font-extrabold text-xs rounded-2xl transition shadow-xs cursor-pointer"
            >
              ตกลง (รับทราบ)
            </button>
          </div>
        </div>
      )}

      {/* Admin Floating Action Button (Fixed Bottom-Right for Mobile) */}
      <div className="fixed bottom-5 right-5 z-40">
        <button
          type="button"
          onClick={handleOpenAdminManual}
          className="flex items-center gap-2 bg-gradient-to-r from-[#F97316] to-[#EA580C] hover:from-[#EA580C] hover:to-[#C2410C] text-white font-extrabold text-xs md:text-sm px-4 py-3 rounded-full shadow-xl ring-4 ring-orange-200 transition transform active:scale-95 cursor-pointer"
        >
          <span className="text-base">👩‍💼</span>
          <span>ลงเวลาเข้างาน (Admin)</span>
        </button>
      </div>

      {/* Admin Password Prompt Modal */}
      {showAdminPasswordModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#FCFAF7] border border-[#EBE4D8] rounded-3xl p-6 max-w-sm w-full shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="text-center space-y-1">
              <div className="w-12 h-12 rounded-2xl bg-orange-100 text-[#F97316] flex items-center justify-center text-xl mx-auto border border-orange-200">
                🔒
              </div>
              <h3 className="font-extrabold text-base text-stone-900">
                ยืนยันตัวตนผู้จัดการ (Admin)
              </h3>
              <p className="text-xs text-stone-500 font-semibold">
                กรุณาระบุรหัสผ่านผู้จัดการเพื่อเปิดฟังก์ชันบันทึกเวลา
              </p>
            </div>

            <form onSubmit={handleVerifyAdminPassword} className="space-y-3">
              <div>
                <input
                  type="password"
                  autoFocus
                  placeholder="กรอกรหัสผ่านผู้จัดการ (PIN)"
                  value={adminPasswordInput}
                  onChange={(e) => setAdminPasswordInput(e.target.value)}
                  className="w-full p-3 bg-white border border-[#E5DDD4] rounded-2xl text-center text-base tracking-widest font-mono font-bold text-stone-900 outline-none focus:ring-2 focus:ring-[#F97316]"
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowAdminPasswordModal(false);
                    setAdminPasswordInput('');
                  }}
                  className="w-1/2 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold text-xs rounded-2xl transition cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="w-1/2 py-2.5 bg-[#F97316] hover:bg-[#EA580C] text-white font-extrabold text-xs rounded-2xl shadow-sm transition cursor-pointer"
                >
                  ยืนยัน
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Manual Attendance Modal (Staff Clock-In Page) */}
      {showManualModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#FCFAF7] border border-[#EBE4D8] rounded-3xl p-5 md:p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-[#EBE4D8] pb-3">
              <div>
                <h3 className="font-extrabold text-stone-900 text-sm md:text-base flex items-center gap-1.5">
                  <span>➕ บันทึกเวลาเข้างาน (Admin Manual)</span>
                </h3>
                <p className="text-[11px] text-stone-500 font-semibold mt-0.5">
                  สำหรับผู้จัดการ: <span className="text-[#F97316] font-bold">อ้อม (aommyisme)</span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowManualModal(false)}
                className="text-stone-400 hover:text-stone-700 font-bold text-base cursor-pointer p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveManualAttendance} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Employee Selection */}
                <div>
                  <label className="block font-bold text-stone-700 mb-1">
                    👤 พนักงาน <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={manualEmpId}
                    onChange={(e) => {
                      const empId = e.target.value;
                      setManualEmpId(empId);
                      const emp = employees.find((x) => x.id === empId);
                      if (emp && emp.homeBranchId) {
                        setManualBranchId(emp.homeBranchId);
                      }
                    }}
                    required
                    className="w-full p-2.5 bg-white border border-[#E5DDD4] rounded-xl font-bold text-stone-900 outline-none focus:ring-2 focus:ring-[#F97316]"
                  >
                    <option value="">-- เลือกพนักงาน --</option>
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.fullName} ({emp.nickname || 'พนักงาน'})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Branch Selection */}
                <div>
                  <label className="block font-bold text-stone-700 mb-1">
                    🏬 สาขาที่เข้างาน <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={manualBranchId}
                    onChange={(e) => setManualBranchId(e.target.value)}
                    required
                    className="w-full p-2.5 bg-white border border-[#E5DDD4] rounded-xl font-bold text-stone-900 outline-none focus:ring-2 focus:ring-[#F97316]"
                  >
                    <option value="">-- เลือกสาขา --</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Date & Time */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-stone-700 mb-1">
                    📅 วันที่เข้างาน <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={manualDateStr}
                    onChange={(e) => setManualDateStr(e.target.value)}
                    required
                    className="w-full p-2.5 bg-white border border-[#E5DDD4] rounded-xl font-bold text-stone-900 outline-none focus:ring-2 focus:ring-[#F97316]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-stone-700 mb-1">
                    ⏰ เวลาเข้างาน
                  </label>
                  <input
                    type="time"
                    value={manualClockInTime}
                    onChange={(e) => setManualClockInTime(e.target.value)}
                    className="w-full p-2.5 bg-white border border-[#E5DDD4] rounded-xl font-bold text-stone-900 outline-none focus:ring-2 focus:ring-[#F97316]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-stone-700 mb-1">
                    🏁 เวลาออกงาน
                  </label>
                  <input
                    type="time"
                    value={manualClockOutTime}
                    onChange={(e) => setManualClockOutTime(e.target.value)}
                    className="w-full p-2.5 bg-white border border-[#E5DDD4] rounded-xl font-bold text-stone-900 outline-none focus:ring-2 focus:ring-[#F97316]"
                  />
                </div>
              </div>

              {/* Status */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-stone-700 mb-1">
                    🏷️ สถานะ / รูปแบบการเข้างาน
                  </label>
                  <select
                    value={manualStatus}
                    onChange={(e) => setManualStatus(e.target.value)}
                    className="w-full p-2.5 bg-white border border-[#E5DDD4] rounded-xl font-bold text-stone-900 outline-none focus:ring-2 focus:ring-[#F97316]"
                  >
                    <option value="ON_TIME">🟢 ตรงเวลา (ON_TIME)</option>
                    <option value="COVER_SHIFT">🔄 เข้ากะแทน (มาบ่าย / กะเพิ่ม) (COVER_SHIFT)</option>
                    <option value="LATE">⚠️ มาสาย (LATE)</option>
                    <option value="ABSENT">🛑 ขาดงาน (ABSENT)</option>
                  </select>
                </div>

                {manualStatus === 'LATE' ? (
                  <div>
                    <label className="block font-bold text-amber-800 mb-1">
                      ⚠️ จำนวนนาทีที่สาย (นาที)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="480"
                      value={manualLateMinutes}
                      onChange={(e) => setManualLateMinutes(Number(e.target.value))}
                      className="w-full p-2.5 bg-amber-50 border border-amber-300 rounded-xl font-bold text-amber-900 outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                ) : (
                  <div className="flex items-center text-[11px] text-stone-500 p-2.5 bg-[#F5EFEA] rounded-xl border border-[#E5DDD4]">
                    <span>
                      {manualStatus === 'COVER_SHIFT'
                        ? '💡 เข้ากะแทน/มาบ่าย ไม่ถูกนับเป็นสาย และนับกะทำงานตามจริง'
                        : '💡 สถานะตรงเวลา ไม่มีการหักเวลาสาย'}
                    </span>
                  </div>
                )}
              </div>

              {/* Notes */}
              <div>
                <label className="block font-bold text-stone-700 mb-1">
                  📝 หมายเหตุ
                </label>
                <input
                  type="text"
                  placeholder="เช่น เข้ากะแทนเพื่อนร่วมงาน, ลืมกดเข้างาน เป็นต้น"
                  value={manualNotes}
                  onChange={(e) => setManualNotes(e.target.value)}
                  className="w-full p-2.5 bg-white border border-[#E5DDD4] rounded-xl text-stone-900 outline-none focus:ring-2 focus:ring-[#F97316]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#EBE4D8]">
                <button
                  type="button"
                  onClick={() => setShowManualModal(false)}
                  disabled={isSubmittingManual}
                  className="px-4 py-2.5 bg-[#F5EFEA] hover:bg-[#E5DDD4] text-stone-700 font-bold rounded-xl transition cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingManual}
                  className="px-5 py-2.5 bg-[#F97316] hover:bg-[#EA580C] text-white font-extrabold rounded-xl shadow-sm transition cursor-pointer disabled:opacity-50"
                >
                  {isSubmittingManual ? 'กำลังบันทึก...' : '💾 บันทึกเวลาเข้างาน'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
