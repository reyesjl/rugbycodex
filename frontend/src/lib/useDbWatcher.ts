import { defineStore } from 'pinia'
import { supabase } from '@/lib/supabaseClient'

type EventType = 'INSERT' | 'UPDATE' | 'DELETE'

interface Subscriber<T> {
  callback: (payload: PostgresChange<T>) => void
}

// Supabase change payload
export interface PostgresChange<T> {
  schema: string
  table: string
  commit_timestamp: string
  eventType: EventType
  old: T | null
  new: T | null
}

export const useDbWatcherStore = defineStore('dbWatcher', () => {
  const channels: Record<string, any> = {}
  const subscribers: Record<string, Subscriber<any>[]> = {}

  /**
   * Subscribe to updates for a table with typed payload
   */
  function subscribe<T>(
    table: string,
    callback: (payload: PostgresChange<T>) => void
  ) {
    if (!subscribers[table]) subscribers[table] = []
    subscribers[table].push({ callback })

    if (!channels[table]) {
      channels[table] = supabase.channel(table)
        .on('postgres_changes', { event: '*', schema: 'public', table }, (payload: any) => {
          subscribers[table]?.forEach(sub => sub.callback(payload))
        })
        .subscribe()
    }

    return () => unsubscribe(table, callback)
  }

  function unsubscribe<T>(table: string, callback: (payload: PostgresChange<T>) => void) {
    if (!subscribers[table]) return
    subscribers[table] = subscribers[table].filter(sub => sub.callback !== callback)
    if (subscribers[table].length === 0) {
      channels[table]?.unsubscribe()
      delete channels[table]
    }
  }

  return { subscribe, unsubscribe }
})


// export interface Subscriber {
//   callback: (payload: any) => void
//   events?: ('INSERT' | 'UPDATE' | 'DELETE')[]
//   filter?: (payload: any) => boolean
// }

// export const useDbWatcherStore = defineStore('dbWatcher', () => {
//   const channels: Record<string, any> = {}
//   const subscribers: Record<string, Subscriber[]> = {}

//   function subscribe(table: string, callback: Subscriber['callback'], options?: Omit<Subscriber, 'callback'>) {
//     if (!subscribers[table]) subscribers[table] = []
//     subscribers[table].push({ callback, ...options })

//     // create channel only once
//     if (!channels[table]) {
//       channels[table] = supabase.channel(table)
//         .on('postgres_changes', { event: '*', schema: 'public', table }, payload => {
//           // notify only subscribers interested in this event
//           subscribers[table]?.forEach(sub => {
//             if (!sub.events || sub.events.includes(payload.eventType)) {
//               if (!sub.filter || sub.filter(payload)) {
//                 sub.callback(payload)
//               }
//             }
//           })
//         })
//         .subscribe()
//     }

//     return () => unsubscribe(table, callback) // return unsubscribe fn
//   }

//   function unsubscribe(table: string, callback: Subscriber['callback']) {
//     if (!subscribers[table]) return
//     subscribers[table] = subscribers[table].filter(sub => sub.callback !== callback)
//     // optionally clean up channel if no subscribers left
//     if (subscribers[table].length === 0) {
//       channels[table]?.unsubscribe()
//       delete channels[table]
//     }
//   }

//   return { subscribe, unsubscribe }
// })

// import { defineStore } from 'pinia'
// import { ref } from 'vue'
// import { supabase } from '@/lib/supabaseClient'

// type TableUpdate = {
//   table: string
//   payload: any
// }

// export const useDbWatcher = defineStore('dbWatcher', () => {
//   const channels = ref<Record<string, any>>({}) // active channels
//   const updates = ref<TableUpdate[]>([]) // reactive updates

//   function subscribeToTable(table: string, filter?: string) {
//     if (channels.value[table]) return // already subscribed

//     const channel = supabase
//       .channel(table)
//       .on('postgres_changes', { event: '*', schema: 'public', table, filter }, (payload) => {
//         updates.value.push({ table, payload })
//       })
//       .subscribe()

//     channels.value[table] = channel
//   }

//   function unsubscribe(table: string) {
//     const channel = channels.value[table]
//     if (channel) {
//       channel.unsubscribe()
//       delete channels.value[table]
//     }
//   }

//   return { channels, updates, subscribeToTable, unsubscribe }
// })
