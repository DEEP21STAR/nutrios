import { supabase } from '@/lib/supabase'
import type { ChallengeType } from '@/lib/togetherDemo'

export interface HouseholdMember {
  userId: string
  displayName: string
  shareLevel: 'everyone' | 'friends' | 'none'
  avatar: string
}

export interface MyHousehold {
  householdId: string
  code: string
  displayName: string
  shareLevel: 'everyone' | 'friends' | 'none'
}

/** Null when this user hasn't created/joined a household yet. */
export async function fetchMyHousehold(userId: string): Promise<MyHousehold | null> {
  const { data: membership, error: memberErr } = await supabase
    .from('household_members')
    .select('household_id, display_name, share_level')
    .eq('user_id', userId)
    .maybeSingle()
  if (memberErr) throw new Error(`Failed to load household membership: ${memberErr.message}`)
  if (!membership) return null

  const { data: household, error: houseErr } = await supabase
    .from('households')
    .select('code')
    .eq('id', membership.household_id)
    .single()
  if (houseErr) throw new Error(`Failed to load household: ${houseErr.message}`)

  return {
    householdId: membership.household_id,
    code: household.code,
    displayName: membership.display_name,
    shareLevel: membership.share_level as MyHousehold['shareLevel'],
  }
}

export async function createHousehold(displayName: string): Promise<MyHousehold> {
  const { data, error } = await supabase.rpc('create_household', { p_display_name: displayName })
  if (error) throw new Error(`Failed to create household: ${error.message}`)
  const row = data?.[0]
  if (!row) throw new Error('Failed to create household: no data returned.')
  return { householdId: row.household_id, code: row.code, displayName, shareLevel: 'friends' }
}

export async function joinHousehold(code: string, displayName: string): Promise<string> {
  const { data, error } = await supabase.rpc('join_household', { p_code: code, p_display_name: displayName })
  if (error) throw new Error(error.message.includes('No household found') ? 'That code doesn’t match any household.' : error.message)
  return data as string
}

export async function updateMyHousehold(userId: string, patch: { displayName?: string; shareLevel?: MyHousehold['shareLevel'] }) {
  const update: Record<string, string> = {}
  if (patch.displayName !== undefined) update.display_name = patch.displayName
  if (patch.shareLevel !== undefined) update.share_level = patch.shareLevel
  const { error } = await supabase.from('household_members').update(update).eq('user_id', userId)
  if (error) throw new Error(`Failed to update: ${error.message}`)
}

export async function leaveHousehold(userId: string) {
  const { error } = await supabase.from('household_members').delete().eq('user_id', userId)
  if (error) throw new Error(`Failed to leave household: ${error.message}`)
}

/** Writes YOUR OWN computed value for one challenge — never anyone else's. Real numbers, same
 * math as computeYourChallengeValue in togetherDemo.ts. */
export async function syncMyStat(userId: string, challenge: ChallengeType, value: number) {
  const { error } = await supabase.from('member_stats').upsert({ user_id: userId, challenge, value })
  if (error) throw new Error(`Failed to sync stat: ${error.message}`)
}

/** Real household members other than you, with their stat for this specific challenge — only
 * rows their own share_level actually permits you to see (enforced server-side by RLS, this is
 * just reading whatever comes back). */
export async function fetchHouseholdMembers(
  householdId: string,
  challenge: ChallengeType,
  excludeUserId: string,
): Promise<(HouseholdMember & { value: number })[]> {
  const { data: members, error: memberErr } = await supabase
    .from('household_members')
    .select('user_id, display_name, share_level')
    .eq('household_id', householdId)
    .neq('user_id', excludeUserId)
  if (memberErr) throw new Error(`Failed to load household members: ${memberErr.message}`)
  if (!members || members.length === 0) return []

  const { data: stats, error: statsErr } = await supabase
    .from('member_stats')
    .select('user_id, value')
    .eq('challenge', challenge)
    .in(
      'user_id',
      members.map((m) => m.user_id),
    )
  if (statsErr) throw new Error(`Failed to load household stats: ${statsErr.message}`)

  const { data: profiles } = await supabase
    .from('profiles')
    .select('user_id, avatar_url')
    .in(
      'user_id',
      members.map((m) => m.user_id),
    )
  const avatarByUser = new Map((profiles ?? []).map((p) => [p.user_id, p.avatar_url]))

  const statByUser = new Map((stats ?? []).map((s) => [s.user_id, s.value]))
  return members.map((m) => ({
    userId: m.user_id,
    displayName: m.display_name,
    shareLevel: m.share_level as HouseholdMember['shareLevel'],
    value: statByUser.get(m.user_id) ?? 0,
    avatar: avatarByUser.get(m.user_id) ?? '🙂',
  }))
}
