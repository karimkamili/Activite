import type { Timestamp } from 'firebase/firestore'
import type { TimeRange } from '../lib/schedule.ts'

export interface Booking extends TimeRange {
  teacherName: string
  activityName: string
  durationMinutes: number
  ownerUid: string
  createdAt: Timestamp | null
}

export interface BookingWithId extends Booking {
  id: string
}
