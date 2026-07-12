import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Send, MessageSquare } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import {
  fetchConversations,
  fetchMessages,
  sendMessage,
  subscribeToMessages,
} from '../lib/chat'
import { ConversationSummary, Message } from '../types'

export default function Messages() {
  const { id: activeId } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [conversations, setConversations] = useState<ConversationSummary[]>([])
  const [loadingList, setLoadingList] = useState(true)

  const [messages, setMessages] = useState<Message[]>([])
  const [loadingThread, setLoadingThread] = useState(false)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

<<<<<<< HEAD
  // Load the inbox list once we know who's logged in.
=======
>>>>>>> feature/escrow-vault
  useEffect(() => {
    if (!user) return
    setLoadingList(true)
    fetchConversations(user.id)
      .then(setConversations)
      .catch(() => setConversations([]))
      .finally(() => setLoadingList(false))
  }, [user])

<<<<<<< HEAD
  // Load the open thread + subscribe to new messages arriving live.
=======
>>>>>>> feature/escrow-vault
  useEffect(() => {
    if (!activeId) {
      setMessages([])
      return
    }
    setLoadingThread(true)
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

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    if (!user || !activeId || !draft.trim()) return
    setSending(true)
    const body = draft.trim()
    setDraft('')
    try {
      await sendMessage(activeId, user.id, body)
<<<<<<< HEAD
      // No optimistic append needed — the Realtime subscription above delivers
      // our own message back within milliseconds, keeping a single source of truth.
    } catch (err) {
      setDraft(body) // put it back so the user doesn't lose what they typed
=======
    } catch (err) {
      setDraft(body)
>>>>>>> feature/escrow-vault
    } finally {
      setSending(false)
    }
  }

  const activeConversation = conversations.find((c) => c.id === activeId)

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <h1 className="font-display text-3xl font-semibold">Messages</h1>

      <div className="mt-6 grid grid-cols-1 gap-0 overflow-hidden rounded-xl2 border border-black/5 bg-white md:grid-cols-[320px_1fr]">
<<<<<<< HEAD
        {/* Conversation list */}
=======
>>>>>>> feature/escrow-vault
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

<<<<<<< HEAD
        {/* Thread */}
=======
>>>>>>> feature/escrow-vault
        <div className="flex h-[70vh] flex-col">
          {!activeId ? (
            <div className="flex flex-1 items-center justify-center text-sm text-ink/40">
              Select a conversation to start chatting.
            </div>
          ) : (
            <>
              {activeConversation && (
                <div className="border-b border-black/5 p-4">
                  <p className="text-sm font-semibold text-ink">{activeConversation.listingTitle}</p>
                  <p className="text-xs text-ink/50">₹{activeConversation.listingPrice.toLocaleString('en-IN')}</p>
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
                      <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                        <div
                          className={`max-w-[75%] rounded-xl2 px-4 py-2 text-sm ${
                            mine ? 'bg-forest text-cream' : 'bg-cream-dark text-ink'
                          }`}
                        >
                          {m.body}
                        </div>
                      </div>
                    )
                  })
                )}
                <div ref={bottomRef} />
              </div>

              <form onSubmit={handleSend} className="flex items-center gap-2 border-t border-black/5 p-4">
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
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
              <p className="border-t border-black/5 px-4 py-2 text-center text-[11px] text-ink/40">
                Never share OTPs or accept payment outside the e-Sauda Vault.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
<<<<<<< HEAD
}
=======
}
>>>>>>> feature/escrow-vault
