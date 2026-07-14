import { auth } from './firebase.js'

const VOLUNTEER_EMAILS = ['ummatee.volunteer@gmail.com']

export function isVolunteerEmail(email) {
  return VOLUNTEER_EMAILS.includes(email)
}

export function useIsVolunteer() {
  return isVolunteerEmail(auth.currentUser?.email || '')
}
