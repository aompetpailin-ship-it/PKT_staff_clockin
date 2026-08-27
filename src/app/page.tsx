'use client';

import { useState, useEffect } from 'react';
import { calculateDistanceMeters } from '@/lib/geofence';

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
  canRoam: boolean;
  pinCode?: string;
  boundDeviceId?: string;
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
      const res = await fetch('/api/branches');
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
      const res = await fetch('/api/employees');
      const data = await res.json();
      if (data.success) {
        setEmployees(data.employees);
        if (data.employees.length > 0) setSelectedEmpId(data.employees[0].id);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Fetch today logs when employee changes
  useEffect(() => {
    if (selectedEmpId) {
      fetchTodayLogs(selectedEmpId);
    }
  }, [selectedEmpId]);

  const fetchTodayLogs = async (empId: string) => {
    const today = new Date().toISOString().split('T')[0];
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
    <div className="max-w-md mx-auto space-y-5 py-2">
      {/* Light Mode Brand Card */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-lg flex flex-col items-center text-center relative overflow-hidden">
        {/* Official Logo */}
        <div className="w-20 h-20 bg-white p-1.5 rounded-2xl shadow-md border-2 border-red-500/50 mb-3 transform hover:scale-105 transition-transform duration-300">
          {/* eslint-disable-next-html-extension/no-img-element */}
          <img src="/logo.png" alt="ร้านผมขอทอด" className="w-full h-full object-contain" />
        </div>

        <h1 className="text-2xl font-black tracking-tight text-slate-900 flex items-center gap-1.5">
          <span>ร้านผมขอทอด</span>
        </h1>
        <p className="text-xs text-red-600 font-bold tracking-wider mt-0.5 uppercase">
          "ที่มันอร่อยเกินไป" • ระบบเข้า-ออกงาน 4 สาขา
        </p>
      </div>

      {/* Alert Banner */}
      {alertMsg && (
        <div
          className={`p-3.5 rounded-2xl text-xs font-bold border transition-all ${
            alertMsg.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-300 shadow'
              : 'bg-red-50 text-red-800 border-red-300 shadow'
          }`}
        >
          {alertMsg.type === 'success' ? '✅ ' : '⚠️ '}
          {alertMsg.text}
        </div>
      )}

      {/* Main Light Card */}
      <div className="bg-white rounded-3xl p-6 shadow-xl border border-slate-200 space-y-5">
        {/* Employee Selection */}
        <div>
          <div className="flex justify-between items-center mb-1.5">
            <label className="block text-xs font-black text-slate-800">
              👤 พนักงาน (LINE Profile):
            </label>
            {selectedEmp && (
              <span
                className={`text-[10px] font-black px-2.5 py-0.5 rounded-full shadow-sm ${
                  selectedEmp.employmentType === 'PART_TIME'
                    ? 'bg-amber-100 text-amber-900 border border-amber-300'
                    : 'bg-sky-100 text-sky-900 border border-sky-300'
                }`}
              >
                {selectedEmp.employmentType === 'PART_TIME' ? '⏳ Part-Time' : '💼 Full-Time'}
              </span>
            )}
          </div>
          <select
            value={selectedEmpId}
            onChange={(e) => setSelectedEmpId(e.target.value)}
            className="w-full p-3 bg-slate-50 border border-slate-300 text-slate-900 rounded-xl text-xs font-bold focus:ring-2 focus:ring-red-500 outline-none transition"
          >
            {employees.length === 0 ? (
              <option value="">กรุณาเพิ่มข้อมูลพนักงานก่อนลงเวลา</option>
            ) : (
              employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.fullName} ({emp.nickname || emp.role}) [{emp.employmentType === 'PART_TIME' ? 'Part-Time' : 'Full-Time'}]
                </option>
              ))
            )}
          </select>
        </div>

        {/* Branch Selection */}
        <div>
          <label className="block text-xs font-black text-slate-800 mb-1.5">
            🏪 เลือกสาขาที่เข้างาน (4 สาขา):
          </label>
          <select
            value={selectedBranchId}
            onChange={(e) => setSelectedBranchId(e.target.value)}
            className="w-full p-3 bg-slate-50 border border-slate-300 text-red-600 rounded-xl text-xs font-black focus:ring-2 focus:ring-red-500 outline-none transition"
          >
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} (เวลาเข้างาน {b.shiftStartTime} น.)
              </option>
            ))}
          </select>
        </div>

        {/* GPS Geofence Box */}
        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-800">📍 พิกัด GPS Geofence:</span>
            <button
              onClick={getGpsLocation}
              disabled={isGettingGps}
              className="text-xs bg-slate-900 hover:bg-slate-800 text-white font-black px-3 py-1.5 rounded-xl shadow transition disabled:opacity-50"
            >
              {isGettingGps ? 'กำลังเช็กพิกัด...' : '🔄 เช็กพิกัด GPS'}
            </button>
          </div>

          {gpsError && (
            <p className="text-xs text-red-600 font-bold">{gpsError}</p>
          )}

          {gpsLocation && selectedBranch && (
            <div className="text-xs space-y-1.5">
              <p className="text-slate-600 font-mono text-[11px]">
                Latitude: {gpsLocation.lat.toFixed(6)}, Longitude: {gpsLocation.lng.toFixed(6)}
              </p>
              {distanceMeters !== null && (
                <div className="flex items-center gap-2">
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-black text-white shadow-sm ${
                      isWithinGeofence
                        ? 'bg-emerald-600'
                        : 'bg-red-600'
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

        {/* PIN CODE ENTRY VERIFICATION */}
        <div className="space-y-3 pt-1 border-t border-slate-200">
          <div className="p-4 bg-slate-50 border border-slate-300 rounded-2xl space-y-2">
            <label className="block text-xs font-bold text-slate-800">
              🔑 กรอกรหัส PIN ประจำตัวพนักงาน (4 หลัก):
            </label>
            <input
              type="password"
              maxLength={6}
              placeholder="กรอกรหัส PIN (เช่น: 1234)"
              value={pinCodeInput}
              onChange={(e) => setPinCodeInput(e.target.value)}
              className="w-full p-3 bg-white border border-slate-300 text-slate-900 rounded-xl font-mono text-center font-black text-base tracking-widest focus:ring-2 focus:ring-red-500 outline-none"
            />
            <p className="text-[11px] text-slate-500 text-center">
              🛡️ มีระบบล็อกเครื่อง: โทรศัพท์ 1 เครื่องใช้ลงเวลาได้เฉพาะพนักงานเจ้าของเครื่องเท่านั้น
            </p>
          </div>
        </div>

        {/* Action Clock In / Clock Out Buttons */}
        <div className="grid grid-cols-2 gap-3 pt-2">
          <button
            onClick={handleClockIn}
            disabled={isSubmitting || !isWithinGeofence}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-3.5 px-4 rounded-2xl text-xs md:text-sm shadow-md transition disabled:opacity-40 flex items-center justify-center gap-1.5"
          >
            {isSubmitting ? 'กำลังบันทึก...' : '🟢 ลงเวลาเข้างาน'}
          </button>

          <button
            onClick={handleClockOut}
            disabled={isSubmitting}
            className="w-full bg-slate-800 hover:bg-slate-900 text-white font-black py-3.5 px-4 rounded-2xl text-xs md:text-sm shadow-md transition disabled:opacity-40 flex items-center justify-center gap-1.5"
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
                    <span>เข้างาน: {new Date(log.clockInAt).toLocaleTimeString('th-TH')}</span>
                    <span>
                      ออกงาน:{' '}
                      {log.clockOutAt ? new Date(log.clockOutAt).toLocaleTimeString('th-TH') : 'ยังไม่ออกงาน'}
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
    </div>
  );
}
