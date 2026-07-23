import { supabase } from './supabase'

export interface AssistantMessage {
  role: 'user' | 'assistant'
  content: string
}

export async function askAssistant(messages: AssistantMessage[]): Promise<string> {
  const { data, error } = await supabase.functions.invoke('chat-assistant', {
    body: { messages },
  })
  if (error) throw error
  if (data?.error) throw new Error(data.error)
  return data.reply as string
}
