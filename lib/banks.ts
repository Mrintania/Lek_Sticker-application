export interface ThaiBank {
  id: string
  name: string
  shortName: string
  color: string
  bgColor: string
}

export const THAI_BANKS: ThaiBank[] = [
  { id: 'kbank',  name: 'ธนาคารกสิกรไทย',               shortName: 'KBANK', color: '#ffffff', bgColor: '#138f2d' },
  { id: 'scb',    name: 'ธนาคารไทยพาณิชย์',              shortName: 'SCB',   color: '#ffffff', bgColor: '#4e2d8c' },
  { id: 'bbl',    name: 'ธนาคารกรุงเทพ',                 shortName: 'BBL',   color: '#ffffff', bgColor: '#1e3a8a' },
  { id: 'ktb',    name: 'ธนาคารกรุงไทย',                 shortName: 'KTB',   color: '#ffffff', bgColor: '#00a0e9' },
  { id: 'bay',    name: 'ธนาคารกรุงศรีอยุธยา',            shortName: 'BAY',   color: '#1a1a1a', bgColor: '#fdb813' },
  { id: 'ttb',    name: 'ธนาคารทหารไทยธนชาต (TTB)',      shortName: 'TTB',   color: '#ffffff', bgColor: '#0055a4' },
  { id: 'gsb',    name: 'ธนาคารออมสิน',                   shortName: 'GSB',   color: '#ffffff', bgColor: '#eb198d' },
  { id: 'ghb',    name: 'ธนาคารอาคารสงเคราะห์',           shortName: 'GHB',   color: '#ffffff', bgColor: '#f57d20' },
  { id: 'baac',   name: 'ธนาคารเพื่อการเกษตรและสหกรณ์ (ธ.ก.ส.)', shortName: 'BAAC', color: '#ffffff', bgColor: '#4caf50' },
  { id: 'uob',    name: 'ธนาคารยูโอบี',                   shortName: 'UOB',   color: '#ffffff', bgColor: '#0038a8' },
  { id: 'cimb',   name: 'ธนาคารซีไอเอ็มบีไทย',            shortName: 'CIMB',  color: '#ffffff', bgColor: '#c8102e' },
  { id: 'lhbank', name: 'ธนาคารแลนด์ แอนด์ เฮ้าส์',      shortName: 'LH',    color: '#ffffff', bgColor: '#2d3192' },
]

export function getBankById(id: string | null | undefined): ThaiBank | undefined {
  if (!id) return undefined
  return THAI_BANKS.find(b => b.id === id)
}
