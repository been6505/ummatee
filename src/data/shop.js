import { useEffect, useState } from 'react'
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase.js'

// สินค้า Um Shop — เก็บใน Firestore collection "products"
// โครงสร้างสินค้า: { name, images: [url...], price, description, colors: [..], sizes: [..], stock, category, createdAt }

export function useProducts() {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'products'), (snap) => {
      setProducts(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
      setLoading(false)
    }, () => setLoading(false))
    return unsub
  }, [])

  return { products, loading }
}

export const addProduct = (data) => addDoc(collection(db, 'products'), { ...data, createdAt: Date.now() })
export const updateProduct = (id, data) => updateDoc(doc(db, 'products', id), data)
export const deleteProduct = (id) => deleteDoc(doc(db, 'products', id))

// แปลงข้อความ comma-separated เป็น array (ใช้กับ colors/sizes)
export const csvToList = (str) => String(str || '').split(',').map((s) => s.trim()).filter(Boolean)
