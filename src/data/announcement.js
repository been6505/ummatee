import { useConfigDoc, saveConfigDoc } from './configDoc.js'

// แบนเนอร์ประกาศหน้าแรก — เก็บ doc เดียวที่ config/announcement (อ่านได้ทุกคน, แก้ได้เฉพาะแอดมิน ตาม firestore.rules เดิม)
export function useAnnouncement() {
  const { data, loading } = useConfigDoc('announcement')
  return { announcement: data, loading }
}

export const saveAnnouncement = (data) => saveConfigDoc('announcement', data)
