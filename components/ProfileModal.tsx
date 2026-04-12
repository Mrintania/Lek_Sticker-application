'use client'
import { useState, useEffect } from 'react'
import { useCurrentUser } from '@/hooks/useCurrentUser'

interface ProfileData {
  phone: string
  bank_name: string
  bank_account_number: string
  bank_account_name: string
}

const BANKS = [
  'ธนาคารกรุงเทพ', 'ธนาคารกสิกรไทย', 'ธนาคารกรุงไทย', 'ธนาคารไทยพาณิชย์',
  'ธนาคารกรุงศรีอยุธยา', 'ธนาคารทหารไทยธนชาต', 'ธนาคารออมสิน',
  'ธนาคารเพื่อการเกษตรและสหกรณ์การเกษตร', 'ธนาคารซีไอเอ็มบีไทย',
  'ธนาคารยูโอบี', 'ธนาคารแลนด์ แอนด์ เฮ้าส์', 'ธนาคารอาคารสงเคราะห์',
  'ธนาคารอิสลามแห่งประเทศไทย',
]

interface Props {
  open: boolean
  onClose: () => void
}

type Tab = 'profile' | 'password'

export default function ProfileModal({ open, onClose }: Props) {
  const { user } = useCurrentUser()
  const [tab, setTab] = useState<Tab>('profile')

  // Profile form
  const [profileData, setProfileData] = useState<ProfileData>({ phone: '', bank_name: '', bank_account_number: '', bank_account_name: '' })
  const [profileForm, setProfileForm] = useState<ProfileData>({ phone: '', bank_name: '', bank_account_number: '', bank_account_name: '' })
  const [savingProfile, setSavingProfile] = useState(false)
  const [profileMsg, setProfileMsg] = useState('')

  // Password form
  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })
  const [savingPw, setSavingPw] = useState(false)
  const [pwMsg, setPwMsg] = useState('')

  useEffect(() => {
    if (!open || !user?.employeeId) return
    fetch('/api/me/profile')
      .then(r => r.ok ? r.json() : null)
      .then((data: ProfileData | null) => {
        if (data) { setProfileData(data); setProfileForm(data) }
      })
  }, [open, user])

  const handleClose = () => {
    setTab('profile')
    setProfileMsg('')
    setPwMsg('')
    setPwForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
    onClose()
  }

  const handleSaveProfile = async () => {
    setSavingProfile(true)
    setProfileMsg('')
    try {
      const res = await fetch('/api/me/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profileForm),
      })
      if (res.ok) {
        setProfileData({ ...profileForm })
        setProfileMsg('✓ บันทึกสำเร็จ')
        setTimeout(handleClose, 1000)
      } else {
        const d = await res.json()
        setProfileMsg(d.error || 'เกิดข้อผิดพลาด')
      }
    } catch { setProfileMsg('เกิดข้อผิดพลาด') }
    finally { setSavingProfile(false) }
  }

  const handleChangePassword = async () => {
    if (pwForm.newPassword !== pwForm.confirmPassword) { setPwMsg('รหัสผ่านใหม่ไม่ตรงกัน'); return }
    if (pwForm.newPassword.length < 8) { setPwMsg('รหัสผ่านใหม่ต้องมีอย่างน้อย 8 ตัวอักษร'); return }
    setSavingPw(true)
    setPwMsg('')
    try {
      const res = await fetch('/api/me/password', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: pwForm.currentPassword, newPassword: pwForm.newPassword }),
      })
      if (res.ok) {
        setPwMsg('✓ เปลี่ยนรหัสผ่านสำเร็จ')
        setTimeout(handleClose, 1200)
      } else {
        const d = await res.json()
        setPwMsg(d.error || 'เกิดข้อผิดพลาด')
      }
    } catch { setPwMsg('เกิดข้อผิดพลาด') }
    finally { setSavingPw(false) }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={handleClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="px-5 pt-5 pb-3">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-base font-bold text-gray-800">โปรไฟล์ของฉัน</h2>
            <button onClick={handleClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          {user && (
            <p className="text-sm text-gray-500">{user.fullName || user.username} <span className="text-gray-300">·</span> @{user.username}</p>
          )}

          {/* Tabs */}
          <div className="flex gap-1 mt-3 bg-gray-100 rounded-lg p-0.5">
            {([['profile', '📋 ข้อมูลส่วนตัว'], ['password', '🔑 เปลี่ยนรหัสผ่าน']] as [Tab, string][]).map(([t, label]) => (
              <button key={t} onClick={() => { setTab(t); setProfileMsg(''); setPwMsg('') }}
                className={`flex-1 text-xs font-medium py-1.5 rounded-md transition-colors ${tab === t ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab: ข้อมูลส่วนตัว */}
        {tab === 'profile' && (
          <div className="px-5 pb-5 space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">เบอร์โทรศัพท์</label>
              <input type="tel" value={profileForm.phone}
                onChange={e => setProfileForm(f => ({ ...f, phone: e.target.value }))}
                placeholder="0xx-xxx-xxxx" className="w-full" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">ธนาคาร</label>
              <select value={profileForm.bank_name}
                onChange={e => setProfileForm(f => ({ ...f, bank_name: e.target.value }))}
                className="w-full">
                <option value="">— เลือกธนาคาร —</option>
                {BANKS.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">เลขบัญชี</label>
              <input type="text" value={profileForm.bank_account_number}
                onChange={e => setProfileForm(f => ({ ...f, bank_account_number: e.target.value }))}
                placeholder="xxx-x-xxxxx-x" className="w-full" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">ชื่อบัญชี</label>
              <input type="text" value={profileForm.bank_account_name}
                onChange={e => setProfileForm(f => ({ ...f, bank_account_name: e.target.value }))}
                placeholder="ชื่อ-นามสกุล ตามบัญชี" className="w-full" />
            </div>
            {profileMsg && (
              <p className={`text-sm text-center ${profileMsg.startsWith('✓') ? 'text-green-600' : 'text-red-500'}`}>{profileMsg}</p>
            )}
            <div className="flex gap-2 pt-1">
              <button onClick={handleClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-500 text-sm hover:bg-gray-50">ยกเลิก</button>
              <button onClick={handleSaveProfile} disabled={savingProfile}
                className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-60">
                {savingProfile ? 'กำลังบันทึก...' : 'บันทึก'}
              </button>
            </div>
          </div>
        )}

        {/* Tab: เปลี่ยนรหัสผ่าน */}
        {tab === 'password' && (
          <div className="px-5 pb-5 space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">รหัสผ่านปัจจุบัน</label>
              <input type="password" value={pwForm.currentPassword}
                onChange={e => setPwForm(f => ({ ...f, currentPassword: e.target.value }))}
                placeholder="รหัสผ่านที่ใช้อยู่" className="w-full" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">รหัสผ่านใหม่ (อย่างน้อย 8 ตัวอักษร)</label>
              <input type="password" value={pwForm.newPassword}
                onChange={e => setPwForm(f => ({ ...f, newPassword: e.target.value }))}
                placeholder="รหัสผ่านใหม่" className="w-full" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">ยืนยันรหัสผ่านใหม่</label>
              <input type="password" value={pwForm.confirmPassword}
                onChange={e => setPwForm(f => ({ ...f, confirmPassword: e.target.value }))}
                placeholder="กรอกรหัสผ่านใหม่อีกครั้ง" className="w-full" />
            </div>
            {pwMsg && (
              <p className={`text-sm text-center ${pwMsg.startsWith('✓') ? 'text-green-600' : 'text-red-500'}`}>{pwMsg}</p>
            )}
            <div className="flex gap-2 pt-1">
              <button onClick={handleClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-500 text-sm hover:bg-gray-50">ยกเลิก</button>
              <button onClick={handleChangePassword} disabled={savingPw}
                className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-60">
                {savingPw ? 'กำลังเปลี่ยน...' : 'เปลี่ยนรหัสผ่าน'}
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
