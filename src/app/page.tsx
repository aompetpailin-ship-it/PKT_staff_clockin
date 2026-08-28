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

  // Feedback & Loading
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [alertMsg, setAlertMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [todayLogs, setTodayLogs] = useState<any[]>([]);

  // Searchable Employee Selection Modal State
  const [isEmpModalOpen, setIsEmpModalOpen] = useState<boolean>(false);
  const [empSearchQuery, setEmpSearchQuery] = useState<string>('');
  const [empFilterType, setEmpFilterType] = useState<'ALL' | 'BRANCH' | 'FULL_TIME' | 'PART_TIME'>('ALL');

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
        setGpsError('ไม่สามารถดึงพิกัด GPS ได้ กรุณาอนุญาตเปิดใช้งาน Location');
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
      setAlertMsg({ type: 'error', text: 'กรุณากรอกรหัส PIN ประจำตัวพนักงาน 4 หลัก' });
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
        setAlertMsg({ type: 'success', text: data.message });
        setPinCodeInput('');
        fetchTodayLogs(selectedEmpId);
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
        setAlertMsg({ type: 'success', text: data.message });
        fetchTodayLogs(selectedEmpId);
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
    <div className="max-w-md mx-auto space-y-4 py-2">
      {/* Clean Modern Brand Header */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex flex-col items-center text-center">
        {/* Official Logo */}
        <div className="w-16 h-16 bg-white p-1 rounded-2xl border border-slate-200 shadow-sm mb-2.5">
          {/* eslint-disable-next-html-extension/no-img-element */}
          <img src="/logo.png" alt="ร้านผมขอทอด" className="w-full h-full object-contain" />
        </div>

        <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
          ร้านผมขอทอด
        </h1>
        <p className="text-xs text-orange-500 font-bold tracking-wide mt-0.5">
          "ที่มันอร่อยเกินไป" • ระบบลงเวลา 4 สาขา
        </p>
      </div>

      {/* Alert Banner */}
      {alertMsg && (
        <div
          className={`p-3.5 rounded-2xl text-xs font-bold border transition-all shadow-sm ${
            alertMsg.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}
        >
          {alertMsg.type === 'success' ? '✅ ' : '⚠️ '}
          {alertMsg.text}
        </div>
      )}

      {/* Clean Modern Main Card */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 space-y-4">
        {/* Employee Selection */}
        <div>
          <div className="flex justify-between items-center mb-1.5">
            <label className="block text-xs font-bold text-slate-800">
              👤 พนักงาน (LINE Profile):
            </label>
            {selectedEmp && (
              <span
                className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                  selectedEmp.employmentType === 'PART_TIME'
                    ? 'bg-amber-100 text-amber-800 border border-amber-200'
                    : 'bg-sky-100 text-sky-800 border border-sky-200'
                }`}
              >
                {selectedEmp.employmentType === 'PART_TIME' ? '⏳ Part-Time' : '💼 Full-Time'}
              </span>
            )}
          </div>

          {/* Selected Employee Display Card + Quick Search Button */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center justify-between gap-2.5">
            <div className="flex items-center gap-3 overflow-hidden">
              {selectedEmp?.avatarUrl ? (
                <img
                  src={selectedEmp.avatarUrl}
                  alt={selectedEmp.fullName}
                  className="w-10 h-10 rounded-full object-cover border border-slate-200 shadow-sm flex-shrink-0"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-orange-500 text-white font-bold text-base flex items-center justify-center flex-shrink-0 shadow-sm">
                  {selectedEmp?.nickname ? selectedEmp.nickname[0] : '👤'}
                </div>
              )}
              <div className="min-w-0">
                <p className="font-extrabold text-xs text-slate-900 truncate">
                  {selectedEmp ? `${selectedEmp.fullName} (${selectedEmp.nickname || selectedEmp.role})` : 'ยังไม่ได้เลือกพนักงาน'}
                </p>
                <p className="text-[10px] text-slate-500 font-bold flex items-center gap-1 pt-0.5">
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
              className="bg-orange-500 hover:bg-orange-600 text-white font-bold px-3 py-2 rounded-xl text-xs shadow-sm flex items-center gap-1 flex-shrink-0 transition active:scale-95 cursor-pointer"
            >
              <span>🔍 ค้นหา / เปลี่ยน</span>
            </button>
          </div>
        </div>

        {/* Branch Selection */}
        <div>
          <label className="block text-xs font-bold text-slate-800 mb-1.5">
            🏪 เลือกสาขาที่เข้างาน (4 สาขา):
          </label>
          <select
            value={selectedBranchId}
            onChange={(e) => setSelectedBranchId(e.target.value)}
            className="w-full p-3 bg-slate-50 border border-slate-200 text-slate-900 font-bold rounded-xl text-xs focus:ring-2 focus:ring-orange-500 outline-none transition"
          >
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} (เวลาเข้างาน {b.shiftStartTime} น.)
              </option>
            ))}
          </select>
        </div>

        {/* GPS Geofence Box */}
        <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-800 flex items-center gap-1">
              <span>📍 พิกัด GPS Geofence:</span>
            </span>
            <button
              onClick={getGpsLocation}
              disabled={isGettingGps}
              className="text-xs bg-slate-900 hover:bg-slate-800 text-white font-bold px-3 py-1.5 rounded-xl shadow-sm transition active:scale-95 disabled:opacity-50"
            >
              {isGettingGps ? 'กำลังเช็กพิกัด...' : '🔄 เช็กพิกัด GPS'}
            </button>
          </div>

          {gpsError && (
            <p className="text-xs text-rose-600 font-bold">{gpsError}</p>
          )}

          {gpsLocation && selectedBranch && (
            <div className="text-xs space-y-1.5">
              <p className="text-slate-500 font-mono text-[11px]">
                Latitude: {gpsLocation.lat.toFixed(6)}, Longitude: {gpsLocation.lng.toFixed(6)}
              </p>
              {distanceMeters !== null && (
                <div className="flex items-center gap-2">
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-bold text-white shadow-sm ${
                      isWithinGeofence
                        ? 'bg-emerald-600'
                        : 'bg-rose-600'
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
        <div className="space-y-2 pt-1 border-t border-slate-100">
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
            <label className="block text-xs font-bold text-slate-800 flex items-center gap-1">
              <span>🔑 กรอกรหัส PIN ประจำตัวพนักงาน (4 หลัก):</span>
            </label>
            <input
              type="password"
              maxLength={6}
              placeholder="••••"
              value={pinCodeInput}
              onChange={(e) => setPinCodeInput(e.target.value)}
              className="w-full p-3 bg-white border border-slate-300 text-slate-900 rounded-xl font-mono text-center font-bold text-lg tracking-widest focus:ring-2 focus:ring-orange-500 outline-none shadow-sm"
            />
            <p className="text-[11px] text-slate-500 text-center font-bold">
              🛡️ ล็อกเครื่อง: โทรศัพท์ 1 เครื่องใช้ลงเวลาเฉพาะพนักงานเจ้าของเครื่องเท่านั้น
            </p>
          </div>
        </div>

        {/* Action Clock In / Clock Out Buttons */}
        <div className="grid grid-cols-2 gap-3 pt-1">
          <button
            onClick={handleClockIn}
            disabled={isSubmitting || !isWithinGeofence}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 px-4 rounded-xl text-xs md:text-sm shadow-sm transition active:scale-95 disabled:opacity-40 flex items-center justify-center gap-1.5"
          >
            {isSubmitting ? 'กำลังบันทึก...' : '🟢 ลงเวลาเข้างาน'}
          </button>

          <button
            onClick={handleClockOut}
            disabled={isSubmitting}
            className="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold py-3.5 px-4 rounded-xl text-xs md:text-sm shadow-sm transition active:scale-95 disabled:opacity-40 flex items-center justify-center gap-1.5"
          >
            🔴 ลงเวลาออกงาน
          </button>
        </div>
      </div>

      {/* Today Attendance Log Summary */}
      {selectedEmp && (
        <div className="bg-white rounded-3xl p-5 shadow-xl border border-slate-200 space-y-3">
          <h3 className="text-xs font-black text-slate-800 flex items-center gap-1.5">
            <span>📋 ประวัติการเข้างานวันนี้ ({selectedEmp.fullName})</span>
          </h3>

          {todayLogs.length === 0 ? (
            <p className="text-xs text-slate-400 py-3 text-center">ยังไม่มีประวัติการเข้างานในวันนี้</p>
          ) : (
            <div className="space-y-2">
              {todayLogs.map((log) => (
                <div key={log.id} className="p-3 bg-slate-50 rounded-2xl border border-slate-200 text-xs space-y-1.5">
                  <div className="flex justify-between items-center font-bold">
                    <span className="text-red-600 font-extrabold">🏪 {log.branch?.name}</span>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-black text-white ${
                        log.status === 'ON_TIME' ? 'bg-emerald-600' : 'bg-amber-600'
                      }`}
                    >
                      {log.status === 'ON_TIME' ? 'ตรงเวลา' : `สาย ${log.lateMinutes} นาที`}
                    </span>
                  </div>
                  <div className="text-slate-600 flex justify-between font-mono text-[11px]">
                    <span>เข้างาน: {new Date(log.clockInAt).toLocaleTimeString('th-TH', { timeZone: 'Asia/Bangkok' })}</span>
                    <span>
                      ออกงาน:{' '}
                      {log.clockOutAt ? new Date(log.clockOutAt).toLocaleTimeString('th-TH', { timeZone: 'Asia/Bangkok' }) : 'ยังไม่ออกงาน'}
                    </span>
                  </div>
                  {log.notes && (
                    <p className="text-[10px] text-slate-600 italic bg-white p-1.5 rounded-xl border border-slate-200">
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
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-5 max-w-md w-full shadow-2xl border border-slate-200 space-y-4 max-h-[85vh] flex flex-col animate-in fade-in zoom-in duration-150">
            {/* Modal Header */}
            <div className="flex justify-between items-center border-b border-slate-100 pb-3 flex-shrink-0">
              <div>
                <h3 className="font-extrabold text-base text-slate-900 flex items-center gap-1.5">
                  <span className="text-orange-500">🔍</span>
                  <span>เลือกพนักงาน</span>
                  <span className="text-xs bg-orange-50 text-orange-700 font-extrabold px-2.5 py-0.5 rounded-full border border-orange-200">
                    {employees.length} คน
                  </span>
                </h3>
                <p className="text-[11px] text-slate-500 font-bold">พิมพ์ชื่อ หรือแตะเลือกรายชื่อด้านล่างได้ทันที</p>
              </div>
              <button
                onClick={() => setIsEmpModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-black text-lg px-2.5 py-1 rounded-xl hover:bg-slate-100 transition"
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
                className="w-full p-3 pl-10 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-orange-500 outline-none shadow-sm"
              />
              <span className="absolute left-3.5 top-3 text-orange-500 text-sm">🔍</span>
              {empSearchQuery && (
                <button
                  onClick={() => setEmpSearchQuery('')}
                  className="absolute right-3 top-2.5 text-xs text-slate-400 hover:text-slate-600 font-bold px-1.5 py-0.5 bg-slate-200 rounded-full"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Quick Filter Tabs */}
            <div className="flex gap-1.5 overflow-x-auto pb-1 flex-shrink-0 text-[11px] font-bold">
              <button
                onClick={() => setEmpFilterType('ALL')}
                className={`px-3 py-1.5 rounded-xl border transition ${
                  empFilterType === 'ALL'
                    ? 'bg-slate-900 text-white border-slate-900 font-black shadow'
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                ทั้งหมด ({employees.length})
              </button>
              <button
                onClick={() => setEmpFilterType('BRANCH')}
                className={`px-3 py-1.5 rounded-xl border transition ${
                  empFilterType === 'BRANCH'
                    ? 'bg-red-600 text-white border-red-600 font-black shadow'
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                🏬 เฉพาะสาขานี้ ({employees.filter((e) => e.homeBranchId === selectedBranchId).length})
              </button>
              <button
                onClick={() => setEmpFilterType('FULL_TIME')}
                className={`px-3 py-1.5 rounded-xl border transition ${
                  empFilterType === 'FULL_TIME'
                    ? 'bg-sky-600 text-white border-sky-600 font-black shadow'
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                💼 Full-Time ({employees.filter((e) => e.employmentType === 'FULL_TIME').length})
              </button>
              <button
                onClick={() => setEmpFilterType('PART_TIME')}
                className={`px-3 py-1.5 rounded-xl border transition ${
                  empFilterType === 'PART_TIME'
                    ? 'bg-amber-600 text-white border-amber-600 font-black shadow'
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                ⏳ Part-Time ({employees.filter((e) => e.employmentType === 'PART_TIME').length})
              </button>
            </div>

            {/* Filtered Employee List */}
            <div className="overflow-y-auto space-y-2 pr-1 flex-1">
              {filteredEmployees.length === 0 ? (
                <div className="text-center py-8 text-slate-400 space-y-1">
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
                          ? 'bg-red-50 border-red-400 shadow-md ring-2 ring-red-400'
                          : 'bg-slate-50 hover:bg-slate-100 border-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {emp.avatarUrl ? (
                          <img
                            src={emp.avatarUrl}
                            alt={emp.fullName}
                            className="w-9 h-9 rounded-full object-cover border border-slate-300 shadow-sm flex-shrink-0"
                          />
                        ) : (
                          <div
                            className={`w-9 h-9 rounded-full flex items-center justify-center font-black text-sm flex-shrink-0 ${
                              isSelected ? 'bg-red-600 text-white shadow' : 'bg-slate-200 text-slate-700'
                            }`}
                          >
                            {emp.nickname ? emp.nickname[0] : '👤'}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="font-extrabold text-xs text-slate-900 truncate">
                            {emp.fullName} ({emp.nickname || emp.role})
                          </p>
                          <p className="text-[10px] text-slate-500 font-bold flex items-center gap-1.5 pt-0.5">
                            <span>🏬 {emp.homeBranch?.name || 'ไม่มีสาขาหลัก'}</span>
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <span
                          className={`text-[9px] font-black px-2 py-0.5 rounded-full ${
                            emp.employmentType === 'PART_TIME'
                              ? 'bg-amber-100 text-amber-900 border border-amber-300'
                              : 'bg-sky-100 text-sky-900 border border-sky-300'
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
    </div>
  );
}
