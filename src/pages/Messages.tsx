import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Send, MessageSquare, AlertTriangle, Ban, ShieldOff } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import {
  fetchConversations,
  fetchMessages,
  sendMessage,
  subscribeToMessages,
} from '../lib/chat'
import { scanMessage, describeFlags } from '../lib/moderation'
import { blockUser, unblockUser, amIBlocking, fetchMyBlockedUsers, BlockedUser } from '../lib/blocking'
import { ConversationSummary, Message } from '../types'

export default function Messages() {
  const { id: activeId } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user, profile } = useAuth()

  const [conversations, setConversations] = useState<ConversationSummary[]>([])
  const [loadingList, setLoadingList] = useState(true)

  const [messages, setMessages] = useState<Message[]>([])
  const [loadingThread, setLoadingThread] = useState(false)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [pendingWarning, setPendingWarning] = useState<{ body: string; reasons: string[] } | null>(
    null,
  )
  const [isBlocked, setIsBlocked] = useState(false) // have I blocked the other party in this thread
  const [blockActing, setBlockActing] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const [showBlockedList, setShowBlockedList] = useState(false)
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([])
  const bottomRef = useRef<HTMLDivElement>(null)

  // Load the inbox list once we know who's logged in.
  useEffect(() => {
    if (!user) return
    setLoadingList(true)
    fetchConversations(user.id)
      .then(setConversations)
      .catch(() => setConversations([]))
      .finally(() => setLoadingList(false))
  }, [user])

  // Load the open thread + subscribe to new messages arriving live.
  useEffect(() => {
    if (!activeId) {
      setMessages([])
      return
    }
    setLoadingThread(true)
    setPendingWarning(null)
    fetchMessages(activeId)
      .then(setMessages)
      .catch(() => setMessages([]))
      .finally(() => setLoadingThread(false))

    const unsubscribe = subscribeToMessages(activeId, (message) => {
      setMessages((prev) => (prev.some((m) => m.id === message.id) ? prev : [...prev, message]))
    })
    return unsubscribe
  }, [activeId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Re-check block status whenever the active thread changes -- otherPartyId comes
  // from the conversation list, which is why this depends on `conversations` too.
  useEffect(() => {
    const conv = conversations.find((c) => c.id === activeId)
    if (!user || !conv) {
      setIsBlocked(false)
      return
    }
    amIBlocking(user.id, conv.otherPartyId)
      .then(setIsBlocked)
      .catch(() => setIsBlocked(false))
  }, [activeId, conversations, user])

  function loadBlockedUsers() {
    if (!user) return
    fetchMyBlockedUsers(user.id)
      .then(setBlockedUsers)
      .catch(() => setBlockedUsers([]))
  }

  async function handleToggleBlock() {
    const conv = conversations.find((c) => c.id === activeId)
    if (!user || !conv) return
    setBlockActing(true)
    try {
      if (isBlocked) {
        await unblockUser(user.id, conv.otherPartyId)
        setIsBlocked(false)
      } else {
        if (!confirm(`Block this user? Neither of you will be able to message the other.`)) return
        await blockUser(user.id, conv.otherPartyId)
        setIsBlocked(true)
      }
    } catch (err: any) {
      setSendError(err.message || 'Could not update block status')
    } finally {
      setBlockActing(false)
    }
  }

  async function handleUnblockFromList(otherId: string) {
    if (!user) return
    try {
      await unblockUser(user.id, otherId)
      setBlockedUsers((prev) => prev.filter((b) => b.id !== otherId))
      if (conversations.find((c) => c.id === activeId)?.otherPartyId === otherId) setIsBlocked(false)
    } catch {
      // Non-critical -- the list just won't update; they can retry from the same panel.
    }
  }

  async function actuallySend(body: string) {
    if (!user || !activeId) return
    setSending(true)
    setSendError(null)
    try {
      await sendMessage(activeId, user.id, body)
      // No optimistic append needed — the Realtime subscription above delivers
      // our own message back within milliseconds, keeping a single source of truth.
    } catch (err: any) {
      setDraft(body) // put it back so the user doesn't lose what they typed
      // The blocking trigger (blocking_schema.sql) rejects the insert with this
      // message when either party has blocked the other -- most likely here because
      // the *other* person blocked *you*, since our own "isBlocked" state already
      // hides the send form when you're the one who blocked them.
      setSendError(
        err.message?.includes('blocked')
          ? "This message couldn't be delivered."
          : err.message || 'Could not send message',
      )
    } finally {
      setSending(false)
    }
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    if (!user || !activeId || !draft.trim()) return
    const body = draft.trim()

    // Scan before sending, not after — a warning is only useful if it can still
    // change the person's mind. If it's clean, send immediately as before.
    const { flagged, reasons } = scanMessage(body)
    if (flagged) {
      setPendingWarning({ body, reasons })
      return
    }

    setDraft('')
    await actuallySend(body)
  }

  async function sendAnyway() {
    if (!pendingWarning) return
    const { body } = pendingWarning
    setPendingWarning(null)
    setDraft('')
    await actuallySend(body)
  }

  const activeConversation = conversations.find((c) => c.id === activeId)

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl font-semibold">Messages</h1>
        <button
          onClick={() => {
            setShowBlockedList((v) => !v)
            if (!showBlockedList) loadBlockedUsers()
          }}
          className="flex items-center gap-1.5 text-xs font-medium text-ink/50 hover:text-ink"
        >
          <ShieldOff size={13} /> Blocked users
        </button>
      </div>

      {showBlockedList && (
        <div className="mt-3 rounded-xl2 border border-black/5 bg-white p-4">
          {blockedUsers.length === 0 ? (
            <p className="text-sm text-ink/50">You haven't blocked anyone.</p>
          ) : (
            <ul className="space-y-2">
              {blockedUsers.map((b) => (
                <li key={b.id} className="flex items-center justify-between text-sm">
                  <span className="text-ink">{b.displayName}</span>
                  <button
                    onClick={() => handleUnblockFromList(b.id)}
                    className="text-xs font-medium text-clay hover:underline"
                  >
                    Unblock
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 gap-0 overflow-hidden rounded-xl2 border border-black/5 bg-white md:grid-cols-[320px_1fr]">
        {/* Conversation list */}
        <div className="border-b border-black/5 md:border-b-0 md:border-r">
          {loadingList ? (
            <div className="space-y-3 p-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-16 animate-pulse rounded-lg bg-cream-dark" />
              ))}
            </div>
          ) : conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <MessageSquare size={28} className="text-ink/25" />
              <p className="mt-3 text-sm text-ink/50">No conversations yet.</p>
              <p className="text-xs text-ink/40">Chat with a seller from any listing page.</p>
            </div>
          ) : (
            <ul className="max-h-[70vh] divide-y divide-black/5 overflow-y-auto">
              {conversations.map((c) => (
                <li key={c.id}>
                  <button
                    onClick={() => navigate(`/messages/${c.id}`)}
                    className={`flex w-full items-center gap-3 p-4 text-left hover:bg-cream ${
                      c.id === activeId ? 'bg-cream' : ''
                    }`}
                  >
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-cream-dark text-xl">
                      {c.listingPhotoUrl ? (
                        <img src={c.listingPhotoUrl} alt="" className="h-full w-full object-cover" />
                      ) : (
                        c.listingEmoji
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-semibold text-ink">{c.listingTitle}</span>
                        <span className="shrink-0 text-xs text-ink/40">
                          ₹{c.listingPrice.toLocaleString('en-IN')}
                        </span>
                      </span>
                      <span className="block truncate text-xs text-ink/50">
                        {c.lastMessageBody || 'Say hello 👋'}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Thread */}
        <div className="flex h-[70vh] flex-col">
          {!activeId ? (
            <div className="flex flex-1 items-center justify-center text-sm text-ink/40">
              Select a conversation to start chatting.
            </div>
          ) : (
            <>
              {activeConversation && (
                <div className="flex items-center justify-between border-b border-black/5 p-4">
                  <div>
                    <p className="text-sm font-semibold text-ink">{activeConversation.listingTitle}</p>
                    <p className="text-xs text-ink/50">₹{activeConversation.listingPrice.toLocaleString('en-IN')}</p>
                  </div>
                  <button
                    onClick={handleToggleBlock}
                    disabled={blockActing}
                    className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold disabled:opacity-50 ${
                      isBlocked
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                        : 'border-black/10 bg-white text-ink/60 hover:bg-cream-dark'
                    }`}
                  >
                    <Ban size={13} /> {isBlocked ? 'Unblock' : 'Block'}
                  </button>
                </div>
              )}

              <div className="flex-1 space-y-3 overflow-y-auto p-4">
                {loadingThread ? (
                  <div className="space-y-3">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="h-10 w-2/3 animate-pulse rounded-lg bg-cream-dark" />
                    ))}
                  </div>
                ) : messages.length === 0 ? (
                  <p className="mt-10 text-center text-sm text-ink/40">
                    No messages yet — say hello to get things moving.
                  </p>
                ) : (
                  messages.map((m) => {
                    const mine = m.senderId === user?.id
                    return (
                      <div key={m.id} className={`flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
                        <div
                          className={`max-w-[75%] rounded-xl2 px-4 py-2 text-sm ${
                            mine ? 'bg-forest text-cream' : 'bg-cream-dark text-ink'
                          }`}
                        >
                          {m.body}
                        </div>
                        {m.flagged && (
                          <span className="mt-1 flex items-center gap-1 text-[11px] text-amber-700">
                            <AlertTriangle size={11} /> May contain sensitive info — never share OTPs
                            or pay outside the Vault
                          </span>
                        )}
                      </div>
                    )
                  })
                )}
                <div ref={bottomRef} />
              </div>

              {profile?.suspended ? (
                <p className="border-t border-black/5 p-4 text-center text-sm text-red-600">
                  Your account is suspended and can't send messages.
                </p>
              ) : isBlocked ? (
                <p className="border-t border-black/5 p-4 text-center text-sm text-ink/50">
                  You've blocked this user.{' '}
                  <button onClick={handleToggleBlock} className="font-medium text-clay hover:underline">
                    Unblock
                  </button>{' '}
                  to message them again.
                </p>
              ) : (
                <>
                  {sendError && (
                    <p className="mx-4 mb-2 rounded-lg bg-red-50 p-3 text-xs text-red-600">{sendError}</p>
                  )}
                  {pendingWarning && (
                    <div className="mx-4 mb-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
                      <p className="flex items-start gap-2 text-xs text-amber-800">
                        <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                        {describeFlags(pendingWarning.reasons)}
                      </p>
                      <div className="mt-2 flex gap-2">
                        <button
                          onClick={() => setPendingWarning(null)}
                          className="rounded-full border border-amber-300 px-3 py-1 text-xs font-semibold text-amber-800 hover:bg-amber-100"
                        >
                          Edit message
                        </button>
                        <button
                          onClick={sendAnyway}
                          disabled={sending}
                          className="rounded-full bg-amber-800 px-3 py-1 text-xs font-semibold text-white hover:bg-amber-900 disabled:opacity-50"
                        >
                          Send anyway
                        </button>
                      </div>
                    </div>
                  )}

                  <form onSubmit={handleSend} className="flex items-center gap-2 border-t border-black/5 p-4">
                    <input
                      value={draft}
                      onChange={(e) => {
                        setDraft(e.target.value)
                        if (pendingWarning) setPendingWarning(null)
                      }}
                      placeholder="Type a message…"
                      className="flex-1 rounded-full border border-black/10 px-4 py-2.5 text-sm focus:outline-none"
                    />
                    <button
                      type="submit"
                      disabled={sending || !draft.trim()}
                      className="flex h-10 w-10 items-center justify-center rounded-full bg-forest text-cream disabled:opacity-40"
                      aria-label="Send message"
                    >
                      <Send size={16} />
                    </button>
                  </form>
                </>
              )}
              <p className="border-t border-black/5 px-4 py-2 text-center text-[11px] text-ink/40">
                Never share OTPs or accept payment outside the e-Sauda Vault.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
