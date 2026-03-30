import FileUpload from '@/components/upload/FileUpload'

export default function HomePage() {
  return (
    <div className="p-4 sm:p-8 max-w-2xl mx-auto">
      <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">อัปโหลดข้อมูลการเข้างาน</h2>
      <p className="text-gray-500 mb-6 text-sm sm:text-base">
        นำไฟล์ Excel ที่ Export จากเครื่องสแกนลายนิ้วมือมาวางเพื่อสร้างรายงาน
      </p>
      <FileUpload />

      <div className="mt-6 sm:mt-8 card">
        <h3 className="font-semibold text-gray-800 mb-3 text-sm sm:text-base">📋 รูปแบบไฟล์ที่รองรับ</h3>
        <p className="text-sm text-gray-600 mb-3">ไฟล์ควรมีคอลัมน์ดังนี้:</p>
        <div className="grid grid-cols-2 gap-2">
          {['Depart', 'ชื่อ', 'รหัสที่เครื่อง', 'วัน/เวลา', 'เข้า/ออก', 'หมายเลขเครื่อง', 'รหัสพนักงาน', 'บันทึกโดย'].map((col) => (
            <div key={col} className="flex items-center gap-2 text-sm text-gray-600">
              <span className="w-2 h-2 rounded-full bg-blue-400 flex-shrink-0"></span>
              {col}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
